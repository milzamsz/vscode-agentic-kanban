import * as vscode from 'vscode';
import * as path from 'path';
import { BoardViewProvider } from './BoardViewProvider';
import { KanbanEditorPanel } from './KanbanEditorPanel';
import { TaskStore } from './TaskStore';
import { BoardConfigStore } from './BoardConfigStore';
import { ChatParticipant } from './agents/ChatParticipant';
import { WorktreeService } from './WorktreeService';
import { SlashCommandProvider } from './SlashCommandProvider';
import { LogService, NO_OP_LOGGER } from './LogService';
import { DEFAULT_PROFILE, type WorkflowProfile } from './types';
import { WorkspaceRegistry, type ProjectContext } from './WorkspaceRegistry';
import {
    countTasksOutsideProfileLanes,
    getDefaultProfile,
    resolveEnforcement,
    resolveWorktreePolicy,
} from './settings';

// ---------------------------------------------------------------------------
// Global shared instances (one per VS Code window)
// ---------------------------------------------------------------------------

let _registry: WorkspaceRegistry | undefined;
let _chatParticipantHandler: ChatParticipant | undefined;
let _boardViewProvider: BoardViewProvider | undefined;

/** Convenience: resolve the active project context from the registry. */
function getActiveContext(): ProjectContext | undefined {
    return _registry?.getActiveContext();
}

/** Convenience: get the active project's TaskStore. */
function activeTaskStore(): TaskStore | undefined {
    return getActiveContext()?.taskStore;
}

/** Convenience: get the active project's BoardConfigStore. */
function activeBoardConfigStore(): BoardConfigStore | undefined {
    return getActiveContext()?.boardConfigStore;
}

/** Convenience: get the active project's WorktreeService. */
function activeWorktreeService(): WorktreeService | undefined {
    return getActiveContext()?.worktreeService;
}

/** Convenience: get the active project's LogService. */
function activeLogger(): LogService {
    return getActiveContext()?.logService ?? NO_OP_LOGGER;
}

// ---------------------------------------------------------------------------
// Activation
// ---------------------------------------------------------------------------

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
        return;
    }

    // Create the registry
    _registry = new WorkspaceRegistry(context, context.extensionUri);

    // Build contexts for all workspace folders
    for (const folder of folders) {
        await _registry.ensureContext(folder);
    }

    const wiredContextUris = new Set<string>();
    const wireContextRefresh = (project: ProjectContext) => {
        const key = project.folder.uri.toString();
        if (wiredContextUris.has(key)) {
            return;
        }
        wiredContextUris.add(key);
        project.subscriptions.push(
            project.taskStore.onDidChange(() => {
                _boardViewProvider?.refresh();
                void KanbanEditorPanel.currentPanel?.refresh();
            }),
        );
        project.subscriptions.push(
            project.boardConfigStore.onDidChange(() => {
                _boardViewProvider?.refresh();
                void KanbanEditorPanel.currentPanel?.refresh();
            }),
        );
    };
    for (const project of _registry.getContexts()) {
        wireContextRefresh(project);
    }

    // Create one shared ChatParticipant (global surface, delegates through registry)
    _chatParticipantHandler = new ChatParticipant(
        // Pass a proxy-style resolver so ChatParticipant always works on active context
        createDelegatingTaskStore(),
        createDelegatingBoardConfigStore(),
        context.extensionUri,
        () => _registry?.getActiveContext()?.isInitialised ?? false,
        NO_OP_LOGGER, // ChatParticipant uses activeLogger() internally; this is the fallback
        undefined,     // worktreeService resolved per-command from active context
    );

    // Create one shared sidebar provider
    _boardViewProvider = new BoardViewProvider(
        context.extensionUri,
        createDelegatingTaskStore(),
        createDelegatingBoardConfigStore(),
        () => _registry?.getActiveContext()?.isInitialised ?? false,
        NO_OP_LOGGER,
    );

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            'agentKanban.boardView',
            _boardViewProvider,
        ),
    );

    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            { language: 'markdown', pattern: '**/.agentkanban/tasks/**/*.md' },
            new SlashCommandProvider(),
            '/',
        ),
    );

    context.subscriptions.push(
        _registry.onDidChangeActiveProject(() => {
            _boardViewProvider?.refresh();
            const active = getActiveContext();
            KanbanEditorPanel.currentPanel?.setInitialised(active?.isInitialised ?? false);
            void KanbanEditorPanel.currentPanel?.refresh();
        }),
    );
    context.subscriptions.push(
        _registry.onDidChangeContexts(() => {
            _boardViewProvider?.refresh();
            void KanbanEditorPanel.currentPanel?.refresh();
        }),
    );

    // Register the webview panel serialiser so the board panel survives reloads
    context.subscriptions.push(
        vscode.window.registerWebviewPanelSerializer(KanbanEditorPanel.VIEW_TYPE, {
            async deserializeWebviewPanel(panel: vscode.WebviewPanel) {
                const revivedCtx = _registry?.getActiveContext();
                KanbanEditorPanel.revive(
                    panel,
                    context.extensionUri,
                    createDelegatingTaskStore(),
                    createDelegatingBoardConfigStore(),
                    NO_OP_LOGGER,
                    revivedCtx?.isInitialised ?? false,
                    revivedCtx?.worktreeService,
                    _chatParticipantHandler!,
                    _registry,
                );
            },
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('agentKanban.openBoard', () => {
            const ctx = getActiveContext();
            if (!ctx) { return; }
            KanbanEditorPanel.createOrShow(
                context.extensionUri,
                createDelegatingTaskStore(),
                createDelegatingBoardConfigStore(),
                NO_OP_LOGGER,
                ctx.isInitialised,
                activeWorktreeService(),
                _chatParticipantHandler!,
                _registry,
            );
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('agentKanban.newTask', () => {
            const ctx = getActiveContext();
            if (!ctx) { return; }
            KanbanEditorPanel.createOrShow(
                context.extensionUri,
                createDelegatingTaskStore(),
                createDelegatingBoardConfigStore(),
                NO_OP_LOGGER,
                ctx.isInitialised,
                activeWorktreeService(),
                _chatParticipantHandler!,
                _registry,
            );
            KanbanEditorPanel.currentPanel?.triggerCreateModal();
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('agentKanban.openSettings', () => {
            const ctx = getActiveContext();
            if (!ctx) { return; }
            KanbanEditorPanel.createOrShow(
                context.extensionUri,
                createDelegatingTaskStore(),
                createDelegatingBoardConfigStore(),
                NO_OP_LOGGER,
                ctx.isInitialised,
                activeWorktreeService(),
                _chatParticipantHandler!,
                _registry,
            );
            KanbanEditorPanel.currentPanel?.triggerSettingsModal();
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('agentKanban.openTask', async (taskId: string) => {
            const taskStore = activeTaskStore();
            if (!taskStore) { return; }
            const task = taskStore.get(taskId);
            if (task) {
                const uri = taskStore.getTaskUri(taskId);
                const doc = await vscode.workspace.openTextDocument(uri);
                await vscode.window.showTextDocument(doc);
            }
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('agentKanban.resetMemory', async () => {
            const ctx = getActiveContext();
            if (!ctx) { return; }
            const memoryUri = vscode.Uri.joinPath(ctx.folder.uri, '.agentkanban', 'memory.md');
            try {
                await vscode.workspace.fs.writeFile(memoryUri, new TextEncoder().encode('# Memory\n'));
                vscode.window.showInformationMessage('Agentic Kanban memory has been reset.');
                ctx.logService.info('extension', 'Memory reset');
            } catch (err: any) {
                vscode.window.showErrorMessage(`Failed to reset memory: ${err.message}`);
            }
        }),
    );

    // Full first-time setup for a specific folder — creates dirs, writes config & instruction files.
    const doInitialise = async (folderUri: vscode.Uri, profile: WorkflowProfile) => {
        const ctx = _registry!.getContextByUri(folderUri.toString());
        if (!ctx) {
            vscode.window.showErrorMessage('Cannot initialise: project context not found.');
            return;
        }

        await ctx.boardConfigStore.initialise(profile, {
            enforcement: resolveEnforcement(profile),
            worktreePolicy: resolveWorktreePolicy(profile),
        });
        await ctx.taskStore.initialise();
        await _chatParticipantHandler!.syncPacksYamlForContext(ctx);
        await ctx.boardConfigStore.loadExternalPacksIfAbsent();
        await _chatParticipantHandler!.syncInstructionFileForContext(ctx);
        await _chatParticipantHandler!.scaffoldPromptsForContext(ctx, false);
        await _chatParticipantHandler!.syncAgentsMdSectionForContext(ctx);
        // Update initialised flag
        (ctx as { isInitialised: boolean }).isInitialised = true;
        _boardViewProvider?.refresh();
        KanbanEditorPanel.currentPanel?.refresh();
        await ctx.logService.info('extension', 'Workspace initialised');
    };

    context.subscriptions.push(
        vscode.commands.registerCommand('agentKanban.initialise', async (requestedProfile?: WorkflowProfile) => {
            const ctx = getActiveContext();
            if (!ctx) {
                vscode.window.showWarningMessage('No project selected. Open a workspace folder first.');
                return;
            }
            const defaultProfile = getDefaultProfile();
            const quickPickItems = [
                { label: 'Lite', description: 'backlog -> in-progress -> done', value: 'lite' as WorkflowProfile },
                { label: 'Standard', description: 'backlog -> planning -> in-progress -> review -> done', value: 'standard' as WorkflowProfile },
            ].sort((a, b) => a.value === defaultProfile ? -1 : b.value === defaultProfile ? 1 : 0);

            const selectedProfile = requestedProfile ? { value: requestedProfile } : await vscode.window.showQuickPick(
                quickPickItems,
                {
                    title: 'Choose an Agentic Kanban workflow profile',
                    ignoreFocusOut: true,
                },
            );
            if (!selectedProfile) {
                return;
            }
            await doInitialise(ctx.folder.uri, selectedProfile.value ?? DEFAULT_PROFILE);
            vscode.window.showInformationMessage('Agentic Kanban initialised successfully.');
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('agentKanban.applySettingsToBoardConfig', async () => {
            const ctx = getActiveContext();
            if (!ctx) { return; }
            if (!ctx.isInitialised) {
                vscode.window.showWarningMessage('Initialise Agentic Kanban before applying board settings.');
                return;
            }

            const targetProfile = getDefaultProfile();
            const activeTasks = ctx.taskStore.getAll().filter((task) => !ctx.taskStore.isArchived(task));
            const conflicts = countTasksOutsideProfileLanes(activeTasks, targetProfile);

            if (ctx.boardConfigStore.get().profile !== targetProfile && conflicts.length > 0) {
                const summary = conflicts.map((entry) => `${entry.count} in ${entry.lane}`).join(', ');
                const confirmation = await vscode.window.showWarningMessage(
                    `Switching the board profile to ${targetProfile} leaves tasks in lanes missing from that profile: ${summary}. Continue?`,
                    { modal: true },
                    'Apply Settings',
                );
                if (confirmation !== 'Apply Settings') {
                    return;
                }
            }

            await ctx.boardConfigStore.update({
                profile: targetProfile,
                enforcement: resolveEnforcement(targetProfile),
                worktreePolicy: resolveWorktreePolicy(targetProfile),
            });
            vscode.window.showInformationMessage('Agentic Kanban settings applied to board.yaml.');
        }),
    );

    // Register chat participant
    const participant = vscode.chat.createChatParticipant(
        'agentKanban.chat',
        async (request, chatContext, response, token) => {
            await _chatParticipantHandler!.handleRequest(request, chatContext, response, token);
        },
    );
    participant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'images', 'kanban-icon.svg');
    participant.followupProvider = {
        provideFollowups() {
            return _chatParticipantHandler!.getFollowups();
        },
    };
    context.subscriptions.push(participant);

    // Initialise all initialised projects (load config, tasks, sync AGENTS.md)
    for (const ctx of _registry.getContexts()) {
        if (!ctx.isInitialised) { continue; }
        await ctx.boardConfigStore.init();
        await ctx.taskStore.init();
        await _chatParticipantHandler!.syncInstructionFileForContext(ctx);
        await _chatParticipantHandler!.scaffoldPromptsForContext(ctx, false);
        await _chatParticipantHandler!.syncAgentsMdSectionForContext(ctx);
        await _chatParticipantHandler!.syncWorktreeAgentsMdForContext(ctx);
        await cleanStaleWorktreeMetadataForContext(ctx);
        await housekeepingForContext(ctx);
        const housekeepingInterval = setInterval(() => housekeepingForContext(ctx), 10 * 60 * 1000);
        context.subscriptions.push({ dispose: () => clearInterval(housekeepingInterval) });
        ctx.logService.info('extension', `Project initialised: ${ctx.folder.uri.fsPath}`);
    }

    // Listen for workspace folder add/remove
    context.subscriptions.push(
        vscode.workspace.onDidChangeWorkspaceFolders(async (event) => {
            for (const folder of event.added) {
                await _registry!.ensureContext(folder);
                const newCtx = _registry!.getContextByFolder(folder);
                if (newCtx) {
                    wireContextRefresh(newCtx);
                }
                // Auto-initialise if the new folder has board.yaml
                const ctx = _registry!.getContextByFolder(folder);
                if (ctx?.isInitialised) {
                    await ctx.boardConfigStore.init();
                    await ctx.taskStore.init();
                    await _chatParticipantHandler!.syncInstructionFileForContext(ctx);
                    await _chatParticipantHandler!.scaffoldPromptsForContext(ctx, false);
                    await _chatParticipantHandler!.syncAgentsMdSectionForContext(ctx);
                    await _chatParticipantHandler!.syncWorktreeAgentsMdForContext(ctx);
                    await cleanStaleWorktreeMetadataForContext(ctx);
                    await housekeepingForContext(ctx);
                }
                _boardViewProvider?.refresh();
            }
            for (const folder of event.removed) {
                await _registry!.disposeContext(folder.uri.toString());
                _boardViewProvider?.refresh();
            }
        }),
    );

    if (_registry.getContexts().length > 0) {
        const activeCtx = _registry.getActiveContext();
        if (activeCtx?.logService.isEnabled) {
            activeCtx.logService.info('extension', 'Extension activated');
        }
    }
}

export function deactivate(): void {
    _registry?.dispose();
    _registry = undefined;
    _chatParticipantHandler = undefined;
    _boardViewProvider = undefined;
}

// ---------------------------------------------------------------------------
// Proxy-style delegating stores that always resolve from the active context
// ---------------------------------------------------------------------------

function createDelegatingTaskStore(): TaskStore {
    const handler: ProxyHandler<TaskStore> = {
        get(_target, prop: keyof TaskStore, receiver) {
            const active = activeTaskStore();
            if (!active) {
                throw new Error('No active project context available');
            }
            const value = Reflect.get(active, prop, receiver);
            return typeof value === 'function' ? value.bind(active) : value;
        },
    };
    return new Proxy({} as TaskStore, handler);
}

function createDelegatingBoardConfigStore(): BoardConfigStore {
    const handler: ProxyHandler<BoardConfigStore> = {
        get(_target, prop: keyof BoardConfigStore, receiver) {
            const active = activeBoardConfigStore();
            if (!active) {
                throw new Error('No active project context available');
            }
            const value = Reflect.get(active, prop, receiver);
            return typeof value === 'function' ? value.bind(active) : value;
        },
    };
    return new Proxy({} as BoardConfigStore, handler);
}

// ---------------------------------------------------------------------------
// Per-context helpers
// ---------------------------------------------------------------------------

async function housekeepingForContext(ctx: ProjectContext): Promise<void> {
    const tasks = ctx.taskStore.getAll();
    await ctx.boardConfigStore.reconcileMetadata(tasks);
}

async function cleanStaleWorktreeMetadataForContext(ctx: ProjectContext): Promise<void> {
    const tasks = ctx.taskStore.getAll().filter(t => t.worktree);
    for (const task of tasks) {
        const exists = await ctx.worktreeService.exists(task.worktree!.path);
        if (!exists) {
            ctx.logService.info('extension', `Clearing stale worktree metadata for task ${task.id}`);
            task.worktree = undefined;
            await ctx.taskStore.save(task);
        }
    }
}
