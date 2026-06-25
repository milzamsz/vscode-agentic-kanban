import * as vscode from 'vscode';
import * as path from 'path';
import { LogService, NO_OP_LOGGER } from './LogService';
import { TaskStore } from './TaskStore';
import { BoardConfigStore } from './BoardConfigStore';
import { WorktreeService } from './WorktreeService';

// ---------------------------------------------------------------------------
// ProjectContext — per-folder state bundle
// ---------------------------------------------------------------------------

export interface ProjectContext {
    /** The workspace folder this context belongs to. */
    folder: vscode.WorkspaceFolder;
    /** Whether this project has been initialised (has .agentkanban/board.yaml). */
    isInitialised: boolean;
    /** Per-project TaskStore. */
    taskStore: TaskStore;
    /** Per-project BoardConfigStore. */
    boardConfigStore: BoardConfigStore;
    /** Per-project WorktreeService. */
    worktreeService: WorktreeService;
    /** Per-project LogService (NO_OP_LOGGER when disabled or uninitialised). */
    logService: LogService;
    /** File watchers scoped to this folder's .agentkanban/. */
    fileWatchers: vscode.FileSystemWatcher[];
    /** Extra disposable resources tied to this context lifetime. */
    subscriptions: vscode.Disposable[];
}

// ---------------------------------------------------------------------------
// WorkspaceRegistry — owns all contexts, resolves active project
// ---------------------------------------------------------------------------

const ACTIVE_PROJECT_STORAGE_KEY = 'agentKanban.activeProjectUri';

export class WorkspaceRegistry {
    private readonly _contexts = new Map<string, ProjectContext>();
    private _activeUri: string | undefined;
    private readonly _onDidChangeActiveProject = new vscode.EventEmitter<string | undefined>();
    private readonly _onDidChangeContexts = new vscode.EventEmitter<void>();

    /** Fires when the active project changes. Carries the new folder URI (undefined = none). */
    readonly onDidChangeActiveProject = this._onDidChangeActiveProject.event;

    /** Fires when the context list changes (add/remove). */
    readonly onDidChangeContexts = this._onDidChangeContexts.event;

    constructor(
        private readonly _extensionContext: vscode.ExtensionContext,
        private readonly _extensionUri: vscode.Uri,
    ) {}

    // ---- context management ------------------------------------------------

    /** List all managed contexts (read-only snapshot). */
    getContexts(): readonly ProjectContext[] {
        return Array.from(this._contexts.values());
    }

    /** Look up a context by folder URI string. */
    getContextByUri(folderUri: string): ProjectContext | undefined {
        return this._contexts.get(this._norm(folderUri));
    }

    /** Look up a context by workspace folder. */
    getContextByFolder(folder: vscode.WorkspaceFolder): ProjectContext | undefined {
        return this.getContextByUri(folder.uri.toString());
    }

    /** Resolve active project context, or the first initialised context, or the first context. */
    getActiveContext(): ProjectContext | undefined {
        if (this._activeUri) {
            const ctx = this._contexts.get(this._activeUri);
            if (ctx) { return ctx; }
        }
        // Fallback: first initialised context
        for (const ctx of this._contexts.values()) {
            if (ctx.isInitialised) { return ctx; }
        }
        // Last resort: first context
        return this._contexts.values().next().value;
    }

    /** Persist and switch the active project. */
    async setActiveContext(folderUri: string): Promise<void> {
        const norm = this._norm(folderUri);
        if (!this._contexts.has(norm)) {
            throw new Error(`No context for folder ${folderUri}`);
        }
        this._activeUri = norm;
        await this._extensionContext.workspaceState.update(ACTIVE_PROJECT_STORAGE_KEY, norm);
        this._onDidChangeActiveProject.fire(norm);
    }

    /** Create or retrieve a context for a workspace folder. */
    async ensureContext(folder: vscode.WorkspaceFolder): Promise<ProjectContext> {
        const key = this._norm(folder.uri);
        const existing = this._contexts.get(key);
        if (existing) { return existing; }

        const ctx = await this._buildContext(folder);
        this._contexts.set(key, ctx);
        this._onDidChangeContexts.fire();

        // Pick active project if none set yet
        if (!this._activeUri) {
            const stored = this._extensionContext.workspaceState.get<string>(ACTIVE_PROJECT_STORAGE_KEY);
            if (stored && this._contexts.has(stored)) {
                this._activeUri = stored;
            } else if (ctx.isInitialised) {
                this._activeUri = key;
            } else {
                // If no initialised context yet, set the first created as active
                this._activeUri = key;
            }
            if (this._activeUri) {
                this._onDidChangeActiveProject.fire(this._activeUri);
            }
        }

        return ctx;
    }

    /** Dispose and remove a context. */
    async disposeContext(folderUri: string): Promise<void> {
        const key = this._norm(folderUri);
        const ctx = this._contexts.get(key);
        if (!ctx) { return; }

        this._disposeContext(ctx);
        this._contexts.delete(key);

        if (this._activeUri === key) {
            this._activeUri = undefined;
            // Fall back to another project
            const fallback = this._contexts.values().next().value;
            if (fallback) {
                this._activeUri = this._norm(fallback.folder.uri);
                await this._extensionContext.workspaceState.update(ACTIVE_PROJECT_STORAGE_KEY, this._activeUri);
            } else {
                await this._extensionContext.workspaceState.update(ACTIVE_PROJECT_STORAGE_KEY, undefined);
            }
            this._onDidChangeActiveProject.fire(this._activeUri);
        }
        this._onDidChangeContexts.fire();
    }

    /** Dispose ALL contexts (for deactivation). */
    dispose(): void {
        for (const ctx of this._contexts.values()) {
            this._disposeContext(ctx);
        }
        this._contexts.clear();
        this._activeUri = undefined;
        this._onDidChangeActiveProject.dispose();
        this._onDidChangeContexts.dispose();
    }

    // ---- internal ----------------------------------------------------------

    private async _buildContext(folder: vscode.WorkspaceFolder): Promise<ProjectContext> {
        // Detect initialisation without creating .agentkanban
        const boardYamlUri = vscode.Uri.joinPath(folder.uri, '.agentkanban', 'board.yaml');
        let isInitialised = false;
        try {
            await vscode.workspace.fs.stat(boardYamlUri);
            isInitialised = true;
        } catch {
            // Not initialised — do NOT create .agentkanban
        }

        // LogService: only enabled when already initialised + config allows
        const config = vscode.workspace.getConfiguration('agentKanban');
        const loggingEnabled = isInitialised && (
            config.get<boolean>('enableLogging', false)
            || process.env.AGENT_KANBAN_DEBUG === '1'
        );
        const logDir = path.join(folder.uri.fsPath, '.agentkanban', 'logs');
        const logService = loggingEnabled ? new LogService(logDir, { enabled: true }) : NO_OP_LOGGER;
        if (logService.isEnabled) {
            logService.info('workspaceRegistry', `Logging activated for ${folder.uri.fsPath}`);
        }

        const taskStore = new TaskStore(folder.uri, logService);
        const boardConfigStore = new BoardConfigStore(folder.uri, logService);
        const worktreeService = new WorktreeService(folder.uri, logService);

        // Scoped file watchers
        const watchers = this._createWatchers(folder, taskStore, boardConfigStore);

        const subscriptions: vscode.Disposable[] = [];

        return {
            folder,
            isInitialised,
            taskStore,
            boardConfigStore,
            worktreeService,
            logService,
            fileWatchers: watchers,
            subscriptions,
        };
    }

    private _createWatchers(
        folder: vscode.WorkspaceFolder,
        taskStore: TaskStore,
        boardConfigStore: BoardConfigStore,
    ): vscode.FileSystemWatcher[] {
        const result: vscode.FileSystemWatcher[] = [];

        // Task file watcher
        const mdWatcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(folder, '.agentkanban/tasks/**/*.md'),
        );
        let reloadTimer: ReturnType<typeof setTimeout> | undefined;
        const debouncedReload = () => {
            if (reloadTimer) { clearTimeout(reloadTimer); }
            reloadTimer = setTimeout(async () => {
                reloadTimer = undefined;
                await taskStore.reload();
            }, 200);
        };
        mdWatcher.onDidChange(debouncedReload);
        mdWatcher.onDidCreate(debouncedReload);
        mdWatcher.onDidDelete(debouncedReload);
        result.push(mdWatcher);

        // Spec directory watcher
        const specWatcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(folder, '.agentkanban/specs/**/*'),
        );
        specWatcher.onDidChange(debouncedReload);
        specWatcher.onDidCreate(debouncedReload);
        specWatcher.onDidDelete(debouncedReload);
        result.push(specWatcher);

        // Change directory watcher
        const changeWatcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(folder, '.agentkanban/changes/**/*'),
        );
        changeWatcher.onDidChange(debouncedReload);
        changeWatcher.onDidCreate(debouncedReload);
        changeWatcher.onDidDelete(debouncedReload);
        result.push(changeWatcher);

        // Board config watcher
        const yamlWatcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(folder, '.agentkanban/board.yaml'),
        );
        yamlWatcher.onDidChange(async () => { await boardConfigStore.init(); });
        result.push(yamlWatcher);

        return result;
    }

    private _disposeContext(ctx: ProjectContext): void {
        for (const w of ctx.fileWatchers) { w.dispose(); }
        for (const d of ctx.subscriptions) { d.dispose(); }
        if (ctx.logService.isEnabled) {
            ctx.logService.info('workspaceRegistry', `Context disposed for ${ctx.folder.uri.fsPath}`);
        }
    }

    private _norm(uri: vscode.Uri | string): string {
        const s = typeof uri === 'string' ? uri : uri.toString();
        // Normalise trailing slash differences
        return s.replace(/\/+$/, '');
    }
}
