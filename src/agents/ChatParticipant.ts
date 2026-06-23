import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
import { TaskStore } from '../TaskStore';
import type { BoardConfigStore } from '../BoardConfigStore';
import type { WorktreeService } from '../WorktreeService';
import type { LogService } from '../LogService';
import { NO_OP_LOGGER } from '../LogService';
import {
    DEFAULT_ENFORCEMENT,
    DEFAULT_REVIEW_POLICY,
    DONE_LANE,
    getFirstLane,
    type Priority,
    type ReviewPolicy,
    type TaskEvidence,
    type EvidenceEntry,
} from '../types';
import { getDefaultProfile, isEnforceWorktrees } from '../settings';
import { WorkflowDoctor } from '../WorkflowDoctor';
import { interpolate, resolveVars } from '../PromptTemplate';
import { TaskEvidenceValidator } from '../TaskEvidenceValidator';

/** Relative path within the workspace for the instruction file. */
const INSTRUCTION_REL_PATH = '.agentkanban/INSTRUCTION.md';

/** Relative path within the workspace for AGENTS.md (managed section). */
export const AGENTS_MD_REL_PATH = 'AGENTS.md';

/** Relative root for spec-driven change artifacts. */
const CHANGES_REL_PATH = '.agentkanban/changes';

/** Relative root for capability specs (referenced by tasks via the `spec` key). */
const SPECS_REL_PATH = '.agentkanban/specs';

/** Relative root for bundled stage-driver prompts. */
const PROMPTS_REL_PATH = '.agentkanban/prompts';

/** Bundled prompt files written to `.agentkanban/prompts/` on init and via `/prompts`. */
const STANDARD_PROMPT_FILES = [
    'README.md',
    'new-task-intake.md',
    'stage-backlog-to-planning.md',
    'stage-planning-to-review.md',
    'stage-review-to-in-progress.md',
    'stage-review-to-done.md',
    'stage-blocked-and-resume.md',
    'production-readiness-audit.md',
    'work-on-task.md',
];

/** Lite profile uses only basic prompts without planning/review stage prompts. */
const LITE_PROMPT_FILES = [
    'README.md',
    'new-task-intake.md',
    'stage-backlog-to-planning.md',
    'work-on-task.md',
];

export const AGENTS_MD_BEGIN = '<!-- BEGIN AGENTIC KANBAN \u2014 DO NOT EDIT THIS SECTION -->';
export const AGENTS_MD_END = '<!-- END AGENTIC KANBAN -->';

/**
 * Legacy sentinels from the pre-rename "Agent Kanban" era. Still recognised when
 * reading/replacing an existing AGENTS.md section so old markers are upgraded in
 * place; never written anymore \u2014 new output always uses the AGENTIC KANBAN markers.
 */
export const AGENTS_MD_BEGIN_LEGACY = '<!-- BEGIN AGENT KANBAN \u2014 DO NOT EDIT THIS SECTION -->';
export const AGENTS_MD_END_LEGACY = '<!-- END AGENT KANBAN -->';

        const AGENTS_MD_SECTION = [
    AGENTS_MD_BEGIN,
    '## Agentic Kanban',
    '',
    'Read `.agentkanban/INSTRUCTION.md` for task workflow rules.',
    'Read `.agentkanban/memory.md` for project context.',
    '',
    'If a task file (`.agentkanban/tasks/**/*.md`) was referenced earlier in this conversation, re-read it before responding and always respond in and at the end the task file.',
    AGENTS_MD_END,
].join('\n');

/** Succinct reminder shown in worktree workspaces to discourage redundant commands. */
const WORKTREE_WORKSPACE_HINT = 'ℹ️ **Worktree workspace** — AGENTS.md permanently provides task context. You don\'t need these commands unless you use `/task` to switch tasks.\n\n';

interface AgentsTaskContext {
    title: string;
    taskRelPath: string;
    todoRelPath?: string;
    changeRelPath?: string;
    specRelPath?: string;
    priority?: Priority;
}

function getWorkflowPrompt(profile: 'standard' | 'lite' = 'standard'): string {
    if (profile === 'lite') {
        return 'Use **implement** in IN PROGRESS (no separate planning lane). Lite flow: backlog -> in-progress -> done.\n\n';
    }
    return 'Use **plan**, **checklist**, **implement**, or **review** based on the active lane. Move tasks with explicit transitions: `backlog -> planning -> in-progress -> review -> done` for Standard, or `backlog -> in-progress -> done` for Lite.\n\n';
}

function formatReviewPolicyLines(reviewPolicy: ReviewPolicy): string[] {
    return [
        `low: planning=${reviewPolicy.low.planning}, implementation=${reviewPolicy.low.implementation}`,
        `medium: planning=${reviewPolicy.medium.planning}, implementation=${reviewPolicy.medium.implementation}`,
        `high: planning=${reviewPolicy.high.planning}, implementation=${reviewPolicy.high.implementation}`,
        `critical: planning=${reviewPolicy.critical.planning}, implementation=${reviewPolicy.critical.implementation}`,
    ];
}

function getPriorityReviewGuidance(priority: Priority | undefined, reviewPolicy: ReviewPolicy): string {
    const effectivePriority = priority ?? 'medium';
    const policy = reviewPolicy[effectivePriority === 'none' ? 'medium' : effectivePriority];
    return `Priority ${effectivePriority}: planning review by ${policy.planning}, implementation review by ${policy.implementation}`;
}

function buildAgentsMdSection(
    enforcementMode: 'strict' | 'warn',
    reviewPolicy: ReviewPolicy,
    profile: 'standard' | 'lite' = 'standard',
    skills?: string[],
): string {
    const lines = [
        AGENTS_MD_BEGIN,
        '## Agentic Kanban',
        '',
        'Read `.agentkanban/INSTRUCTION.md` for task workflow rules.',
        'Read `.agentkanban/memory.md` for project context.',
        '',
        `Enforcement mode: \`${enforcementMode}\``,
        // Only show review policy for Standard profile
        ...(profile === 'standard' ? [
            'Review policy:',
            ...formatReviewPolicyLines(reviewPolicy),
        ] : []),
        '',
    ];
    if (skills && skills.length > 0) {
        lines.push(`Load these project skills before working: ${skills.map(s => `\`${s}\``).join(', ')}.`);
        lines.push('');
    }
    lines.push(
        'If a task file (`.agentkanban/tasks/**/*.md`) was referenced earlier in this conversation, re-read it before responding and always respond in and at the end the task file.',
        AGENTS_MD_END,
    );
    return lines.join('\n');
}

/** Build a richer AGENTS.md sentinel for worktree-linked workspaces. */
export function buildWorktreeAgentsMdSection(
    taskTitle: string,
    taskRelPath: string,
    todoRelPath?: string,
    changeRelPath?: string,
    priority?: Priority,
    reviewPolicy: ReviewPolicy = DEFAULT_REVIEW_POLICY,
    enforcementMode: 'strict' | 'warn' = DEFAULT_ENFORCEMENT.standard.mode,
    specRelPath?: string,
    profile?: 'standard' | 'lite',
    skills?: string[],
): string {
    const isStandard = profile === 'standard';
    const lines = [
        AGENTS_MD_BEGIN,
        '## Agentic Kanban',
        '',
        `**Active Task:** ${taskTitle}`,
        `**Task File:** \`${taskRelPath}\``,
    ];
    if (changeRelPath) {
        // Spec-driven tasks use `<change>/tasks.md` as the authoritative checklist.
        lines.push(`**Checklist File:** \`${changeRelPath}/tasks.md\``);
    } else if (todoRelPath) {
        lines.push(`**Checklist File:** \`${todoRelPath}\``);
    }
    if (isStandard && changeRelPath) {
        lines.push(`**Spec Change:** \`${changeRelPath}\``);
        lines.push(`**Spec Proposal:** \`${changeRelPath}/proposal.md\``);
        lines.push(`**Spec Tasks:** \`${changeRelPath}/tasks.md\``);
    }
    if (isStandard && specRelPath) {
        lines.push(`**Capability Spec:** \`${specRelPath}\``);
    }
    lines.push(
        '',
        `Enforcement mode: \`${enforcementMode}\``,
        getPriorityReviewGuidance(priority, reviewPolicy),
    );
    if (skills && skills.length > 0) {
        lines.push(`Load these project skills before working: ${skills.map(s => `\`${s}\``).join(', ')}.`);
    }
    lines.push(
        'Read the task file above before responding.',
        ...(changeRelPath ? ['Read the linked spec change artifacts before planning, implementing, reviewing, or marking done.'] : []),
        'Read `.agentkanban/INSTRUCTION.md` for task workflow rules.',
        'Read `.agentkanban/memory.md` for project context.',
        'IMPORTANT: ALWAYS respond in and at the end of the task file.',
        AGENTS_MD_END,
    );
    return lines.join('\n');
}

/**
 * Lightweight @kanban chat participant.
 *
 * Routes /new and /task commands. Sets up task context (INSTRUCTION.md +
 * task file) and hands off to Copilot agent mode for the actual work.
 */
/** Recognised verb names for context-refresh commands. */
const VERBS = ['refresh'] as const;
type Verb = typeof VERBS[number];

export class ChatParticipant {
    private readonly logger: LogService;
    private readonly extensionUri: vscode.Uri;
    private readonly getIsInitialised: () => boolean;
    private readonly worktreeService: WorktreeService | undefined;

    /** Tracks the last task selected via /task, used by verb commands. */
    lastSelectedTaskId: string | undefined;

    constructor(
        private readonly taskStore: TaskStore,
        private readonly boardConfigStore: BoardConfigStore,
        extensionUri: vscode.Uri,
        getIsInitialised: (() => boolean) | undefined = undefined,
        logger?: LogService,
        worktreeService?: WorktreeService,
    ) {
        this.extensionUri = extensionUri;
        this.getIsInitialised = getIsInitialised ?? (() => true);
        this.logger = logger ?? NO_OP_LOGGER;
        this.worktreeService = worktreeService;
    }

    async handleRequest(
        request: vscode.ChatRequest,
        _context: vscode.ChatContext,
        response: vscode.ChatResponseStream,
        _token: vscode.CancellationToken,
    ): Promise<void> {
        const command = request.command;
        const prompt = request.prompt.trim();

        switch (command) {
            case 'new':
                await this.handleNew(prompt, response);
                return;
            case 'task':
                await this.handleTask(prompt, response);
                return;
            case 'refresh': {
                await this.handleRefresh(prompt, response);
                return;
            }
            case 'spec':
                await this.handleSpec(prompt, response);
                return;
            case 'worktree':
                await this.handleWorktree(prompt, response);
                return;
            case 'archive':
                await this.handleArchive(prompt, response);
                return;
            case 'prompts':
                await this.handlePrompts(prompt, response);
                return;
            case 'sweep':
                await this.handleSweep(prompt, response);
                return;
            case 'doctor':
                await this.handleDoctor(response);
                return;
            case 'pack':
                await this.handlePack(prompt, response);
                return;
            case 'work':
                await this.handleWork(prompt, response);
                return;
            case 'evidence':
                await this.handleEvidence(prompt, response);
                return;
            default: {
                response.markdown('Available commands: `/new`, `/task`, `/refresh`, `/spec`, `/worktree`, `/archive`, `/prompts`, `/sweep`, `/doctor`, `/pack`, `/work`, `/evidence`\n\n');
                response.markdown('- `@kanban /spec [capability]` - Scaffold spec-driven change artifacts for the selected task\n');
                response.markdown('- `@kanban /new <task title>` - Create a new task\n');
                response.markdown('- `@kanban /task <task name>` - Select a task to work on\n');
                response.markdown('- `@kanban /refresh` - Re-inject agent context for the selected task\n');
                response.markdown('- `@kanban /worktree` - Create a git worktree for the selected task\n');
                response.markdown('- `@kanban /archive [slug]` - Move a completed change folder to changes/archive/\n');
                response.markdown('- `@kanban /prompts` - Open a QuickPick of prompts; select to copy to clipboard\n');
                response.markdown('- `@kanban /prompts refresh` - Rewrite the bundled stage-driver prompts in .agentkanban/prompts/\n');
                response.markdown('- `@kanban /worktree open` - Open the task worktree for the selected task in VS Code\n');
                response.markdown('- `@kanban /worktree remove` - Remove the task worktree\n');
                response.markdown('- `@kanban /sweep [lane]` - Run an autonomous sweep of ready tasks (default: planning)\n');
                response.markdown('- `@kanban /doctor` - Run workflow diagnostics for lane drift, blockers, dependencies, and stale worktrees\n');
                response.markdown('- `@kanban /pack list` - List all configured stack packs\n');
                response.markdown('- `@kanban /pack use <name>` - Select an active stack pack\n');
                response.markdown('- `@kanban /work [task name]` - Pick a not-done task and copy a task-specific work prompt to clipboard\n');
                response.markdown('- `@kanban /evidence [task]` - Show evidence status for a task\n');
                response.markdown('- `@kanban /evidence <task> lint|test|build|behavior pass|fail ["<notes>"]` - Record evidence for a task\n');
                return;
            }
        }
    }

    /** Get active task titles for display (e.g., in help messages). */
    getActiveTaskTitles(): string[] {
        return this.taskStore.getAll()
            .filter(t => t.lane !== DONE_LANE)
            .map(t => t.title);
    }

    /**
     * Sync `.agentkanban/INSTRUCTION.md` with the bundled template.
     * Always overwrites — this file is managed by the extension, not user-editable.
     */
    async syncInstructionFile(): Promise<vscode.Uri | undefined> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) { return undefined; }

        const instrUri = vscode.Uri.joinPath(workspaceFolder.uri, INSTRUCTION_REL_PATH);
        try {
            const templateUri = vscode.Uri.joinPath(this.extensionUri, 'assets', 'INSTRUCTION.md');
            const templateContent = await vscode.workspace.fs.readFile(templateUri);
            await vscode.workspace.fs.writeFile(instrUri, templateContent);
            this.logger.info('chatParticipant', 'Synced INSTRUCTION.md from template');
            return instrUri;
        } catch (err: any) {
            this.logger.warn('chatParticipant', `Failed to sync INSTRUCTION.md: ${err.message}`);
            return undefined;
        }
    }

    /**
     * Copy `assets/packs.yaml` to `.agentkanban/packs.yaml` if absent (or overwrite if requested).
     */
    async syncPacksYaml(overwrite = false): Promise<vscode.Uri | undefined> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) { return undefined; }

        const destUri = vscode.Uri.joinPath(workspaceFolder.uri, '.agentkanban', 'packs.yaml');
        try {
            const exists = await this.exists(destUri);
            if (exists && !overwrite) {
                return destUri;
            }
            const srcUri = vscode.Uri.joinPath(this.extensionUri, 'assets', 'packs.yaml');
            const content = await vscode.workspace.fs.readFile(srcUri);
            await vscode.workspace.fs.writeFile(destUri, content);
            this.logger.info('chatParticipant', 'Synced packs.yaml from assets');
            return destUri;
        } catch (err: any) {
            this.logger.warn('chatParticipant', `Failed to sync packs.yaml: ${err.message}`);
            return undefined;
        }
    }

    /**
     * Write the bundled stage-driver prompts to `.agentkanban/prompts/`.
     * On init (`overwrite=false`) only missing files are written, so user edits
     * survive. `@kanban /prompts` calls with `overwrite=true` to refresh them all.
     */
    async scaffoldPrompts(overwrite = false): Promise<{ created: string[]; updated: string[]; skipped: string[] }> {
        const result = { created: [] as string[], updated: [] as string[], skipped: [] as string[] };
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) { return result; }

        const destDir = vscode.Uri.joinPath(workspaceFolder.uri, ...PROMPTS_REL_PATH.split('/'));
        try {
            await vscode.workspace.fs.createDirectory(destDir);
        } catch {
            // may already exist
        }

        // Select prompt files based on active profile
        const config = this.boardConfigStore.get();
        const targetFiles = config.profile === 'lite' ? LITE_PROMPT_FILES : STANDARD_PROMPT_FILES;
        const activePack = config.activeStack
            ? config.packs?.find(p => p.name === config.activeStack)
            : undefined;
        const vars = resolveVars(config, activePack);

        for (const name of targetFiles) {
            const destUri = vscode.Uri.joinPath(destDir, name);
            const exists = await this.exists(destUri);
            if (exists && !overwrite) {
                result.skipped.push(name);
                continue;
            }
            try {
                const srcUri = vscode.Uri.joinPath(this.extensionUri, 'assets', 'prompts', name);
                const bytes = await vscode.workspace.fs.readFile(srcUri);
                const rawContent = new TextDecoder().decode(bytes);
                const interpolated = interpolate(rawContent, vars);
                await vscode.workspace.fs.writeFile(destUri, new TextEncoder().encode(interpolated));
                (exists ? result.updated : result.created).push(name);
            } catch (err: any) {
                this.logger.warn('chatParticipant', `Failed to write prompt ${name}: ${err.message}`);
            }
        }
        this.logger.info('chatParticipant', `Scaffolded prompts: +${result.created.length} ~${result.updated.length} =${result.skipped.length}`);
        return result;
    }

    /**
     * Manage a sentinel-delimited section in the workspace's AGENTS.md.
     * Preserves any user content outside the sentinels. Creates the file if
     * it does not exist.
     *
     * When a worktree-linked task is provided, writes a richer sentinel that
     * names the specific task file — this is used in worktree workspaces where
     * the AGENTS.md is protected by --skip-worktree.
     */
    async syncAgentsMdSection(worktreeTask?: AgentsTaskContext): Promise<vscode.Uri | undefined> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) { return undefined; }

        const agentsUri = vscode.Uri.joinPath(workspaceFolder.uri, AGENTS_MD_REL_PATH);
        try {
            let existing = '';
            try {
                const bytes = await vscode.workspace.fs.readFile(agentsUri);
                existing = new TextDecoder().decode(bytes);
            } catch {
                // File doesn't exist — start fresh
            }

            // When called WITHOUT worktreeTask, check if the existing AGENTS.md
            // already contains a worktree-enhanced sentinel (written by
            // WorktreeService during worktree creation). If so, preserve it —
            // don't downgrade to the standard sentinel.
            const hasBegin = existing.includes(AGENTS_MD_BEGIN) || existing.includes(AGENTS_MD_BEGIN_LEGACY);
            if (!worktreeTask && hasBegin && existing.includes('**Active Task:**')) {
                this.logger.info('chatParticipant', 'Preserving existing worktree-enhanced AGENTS.md sentinel');
                return agentsUri;
            }

            const config = this.boardConfigStore.get();
            const activePack = config.activeStack
                ? config.packs?.find(p => p.name === config.activeStack)
                : undefined;
            const projectSkills = config.skills ?? [];
            const packSkills = activePack?.skills ?? [];
            const resolvedSkills = Array.from(new Set([...projectSkills, ...packSkills]));

            const section = worktreeTask
                ? buildWorktreeAgentsMdSection(
                    worktreeTask.title,
                    worktreeTask.taskRelPath,
                    worktreeTask.todoRelPath,
                    worktreeTask.changeRelPath,
                    worktreeTask.priority,
                    config.reviewPolicy ?? DEFAULT_REVIEW_POLICY,
                    config.enforcement?.mode ?? DEFAULT_ENFORCEMENT[config.profile].mode,
                    worktreeTask.specRelPath,
                    config.profile,
                    resolvedSkills,
                )
                : buildAgentsMdSection(
                    config.enforcement?.mode ?? DEFAULT_ENFORCEMENT[config.profile].mode,
                    config.reviewPolicy ?? DEFAULT_REVIEW_POLICY,
                    config.profile,
                    resolvedSkills,
                );

            // Recognise both current and legacy sentinels so an old "Agent Kanban"
            // section is replaced in place with the new "AGENTIC KANBAN" markers.
            const beginMarker = existing.includes(AGENTS_MD_BEGIN) ? AGENTS_MD_BEGIN : AGENTS_MD_BEGIN_LEGACY;
            const endMarker = existing.includes(AGENTS_MD_END) ? AGENTS_MD_END : AGENTS_MD_END_LEGACY;
            const beginIdx = existing.indexOf(beginMarker);
            const endIdx = existing.indexOf(endMarker);

            let updated: string;
            if (beginIdx !== -1 && endIdx !== -1) {
                // Replace existing section
                const before = existing.slice(0, beginIdx);
                const after = existing.slice(endIdx + endMarker.length);
                updated = before + section + after;
            } else {
                // Append section
                const sep = existing.length > 0 && !existing.endsWith('\n') ? '\n\n' : existing.length > 0 ? '\n' : '';
                updated = existing + sep + section + '\n';
            }

            await vscode.workspace.fs.writeFile(agentsUri, new TextEncoder().encode(updated));
            this.logger.info('chatParticipant', 'Synced AGENTS.md managed section');
            return agentsUri;
        } catch (err: any) {
            this.logger.warn('chatParticipant', `Failed to sync AGENTS.md section: ${err.message}`);
            return undefined;
        }
    }

    /**
     * Detect if the current workspace has a worktree-linked task and sync
     * the enhanced AGENTS.md sentinel accordingly. Called on extension activation.
     */
    async syncWorktreeAgentsMd(): Promise<void> {
        const linkedTask = this.findLinkedWorktreeTask();
        if (linkedTask) {
            const taskUri = this.taskStore.getTaskUri(linkedTask.id);
            const taskRelPath = vscode.workspace.asRelativePath(taskUri);
            const todoUri = this.taskStore.getTodoUri(linkedTask.id);
            const todoRelPath = vscode.workspace.asRelativePath(todoUri);
            await this.syncAgentsMdSection({
                title: linkedTask.title,
                taskRelPath,
                todoRelPath,
                changeRelPath: this.getChangeRelPath(linkedTask),
                specRelPath: this.getSpecRelPath(linkedTask),
                priority: linkedTask.priority,
            });
            this.logger.info('chatParticipant', `Synced worktree AGENTS.md for task: ${linkedTask.title}`);
        }
    }

    /** Normalise a file path for comparison (lowercase on Windows, resolve). */
    private normalisePath(p: string): string {
        const normalised = p.replace(/\\/g, '/').replace(/\/+$/, '');
        return process.platform === 'win32' ? normalised.toLowerCase() : normalised;
    }

    /** Check if the current workspace IS the worktree for the given task. */
    private isInTaskWorktree(task: { worktree?: { path: string } }): boolean {
        if (!task.worktree) { return false; }
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) { return false; }
        return this.normalisePath(workspaceFolder.uri.fsPath) === this.normalisePath(task.worktree.path);
    }

    /** Find a task whose worktree.path matches the current workspace. */
    findLinkedWorktreeTask(): ReturnType<TaskStore['get']> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) { return undefined; }
        const currentPath = workspaceFolder.uri.fsPath;
        return this.taskStore.getAll().find(t =>
            t.worktree && this.normalisePath(t.worktree.path) === this.normalisePath(currentPath),
        );
    }

    /**
     * Provide follow-up suggestions after a chat response.
     * Suggests /task for the most recently updated active task.
     */
    getFollowups(): vscode.ChatFollowup[] {
        // When a task is selected, offer verb commands as followups
        if (this.lastSelectedTaskId) {
            const task = this.taskStore.get(this.lastSelectedTaskId);
            if (task && task.lane !== DONE_LANE) {
                const followups: vscode.ChatFollowup[] = [
                    { prompt: '', command: 'refresh', label: `Refresh: ${task.title}` },
                ];
                // Add worktree followup if no worktree exists and service is available
                if (!task.worktree && this.worktreeService) {
                    followups.push({ prompt: '', command: 'worktree', label: `Create Worktree: ${task.title}` });
                } else if (task.worktree && this.worktreeService) {
                    followups.push({ prompt: 'open', command: 'worktree', label: `Open Worktree: ${task.title}` });
                }
                return followups;
            }
            // Task gone/done — clear selection
            this.lastSelectedTaskId = undefined;
        }

        const activeTasks = this.taskStore.getAll()
            .filter(t => t.lane !== DONE_LANE)
            .sort((a, b) => (b.updated || b.created).localeCompare(a.updated || a.created));

        if (activeTasks.length === 0) { return []; }

        const mostRecent = activeTasks[0];
        return [{
            prompt: mostRecent.title,
            command: 'task',
            label: `Task: ${mostRecent.title}`,
        }];
    }

    private async handleNew(prompt: string, response: vscode.ChatResponseStream): Promise<void> {
        const title = prompt;
        if (!title) {
            response.markdown('Usage: `@kanban /new <task title>`');
            return;
        }

        this.lastSelectedTaskId = undefined;

        // Auto-initialise if not yet set up (using @kanban /new implies consent)
        if (!this.getIsInitialised()) {
            await vscode.commands.executeCommand('agentKanban.initialise', getDefaultProfile());
        }

        await this.syncInstructionFile();

        const config = this.boardConfigStore.get();
        const firstLane = getFirstLane(config.profile);
        const task = this.taskStore.createTask(title, firstLane);
        await this.taskStore.save(task);

        const taskUri = this.taskStore.getTaskUri(task.id);
        this.logger.info('chatParticipant', `Created task: ${task.id}`);

        response.markdown(`Created task **${title}**\n\n`);
        response.markdown(`File: \`${vscode.workspace.asRelativePath(taskUri)}\`\n\n`);
        response.markdown('Use `@kanban /task ' + title + '` to start working on it.');
    }

    private async handleTask(prompt: string, response: vscode.ChatResponseStream): Promise<void> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

        if (!prompt) {
            // In a worktree workspace with no args — detect linked task and show reminder
            const linkedTask = this.findLinkedWorktreeTask();
            if (linkedTask) {
                response.markdown(`Working on task: **${linkedTask.title}**\n\n`);
                response.markdown(WORKTREE_WORKSPACE_HINT);
                return;
            }

            // No task name — list active tasks
            const titles = this.getActiveTaskTitles();
            if (titles.length === 0) {
                response.markdown('No active tasks. Use `@kanban /new <title>` to create one.');
            } else {
                response.markdown('Active tasks:\n\n');
                for (const t of titles) {
                    response.markdown(`- **${t}**\n`);
                }
                response.markdown('\nUsage: `@kanban /task <task name>`');
            }
            return;
        }

        const { task } = this.resolveTaskFromPrompt(prompt);

        if (!task) {
            const suggestions = this.taskStore.findByTitle(prompt.split(/\s+/)[0] || '', DONE_LANE);
            if (suggestions.length > 0) {
                response.markdown(`No task match for "${prompt}". Did you mean:\n\n`);
                for (const s of suggestions.slice(0, 5)) {
                    response.markdown(`- **${s.title}**\n`);
                }
            } else {
                response.markdown(`No task found matching "${prompt}". Use \`@kanban /new <title>\` to create one.`);
            }
            return;
        }

        // Use the refactored selectTask helper (syncs context, opens file)
        const { taskRelPath } = await this.selectTask(task, response);

        // Inject custom instruction file reference if configured
        const customPath = vscode.workspace.getConfiguration('agentKanban').get<string>('customInstructionFile', '');
        if (customPath) {
            try {
                const customUri = customPath.match(/^[a-zA-Z]:[\\/]/) || customPath.startsWith('/')
                    ? vscode.Uri.file(customPath)
                    : vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0].uri, customPath);
                await vscode.workspace.fs.stat(customUri);
                const customRelPath = vscode.workspace.asRelativePath(customUri);
                response.markdown(`Read \`${customRelPath}\` for additional instructions.\n\n`);
            } catch {
                this.logger.warn('chatParticipant', `Custom instruction file not found: ${customPath}`);
            }
        }

        response.markdown(`Working on task: **${task.title}**\n\n`);
        response.markdown(`Task file: \`${taskRelPath}\`\n\n`);

        // Show worktree status
        if (task.worktree) {
            response.markdown(`Worktree: \`${task.worktree.path}\` (branch \`${task.worktree.branch}\`)\n\n`);
            if (this.isInTaskWorktree(task)) {
                response.markdown(WORKTREE_WORKSPACE_HINT);
            }
        }

        response.markdown('The conversation for this task happens in the task file above.\n\n');
        const config = this.boardConfigStore.get();
        response.markdown(getWorkflowPrompt(config.profile));
        response.markdown('Use `@kanban /refresh` to re-inject context if the agent loses track, or `@kanban /worktree` to create an isolated worktree.');
    }

    /**
     * Refactored shared selection block: syncs context, opens the task file.
     * Returns the task's relative path.
     */
    private async selectTask(task: NonNullable<ReturnType<TaskStore['get']>>, response: vscode.ChatResponseStream): Promise<{ taskRelPath: string }> {
        this.lastSelectedTaskId = task.id;
        this.logger.info('chatParticipant', `Selected task: ${task.id} (${task.title})`);

        const instrUri = this.getIsInitialised() ? await this.syncInstructionFile() : undefined;
        const taskUri = this.taskStore.getTaskUri(task.id);
        const taskRelPath = vscode.workspace.asRelativePath(taskUri);
        const todoRelPath = vscode.workspace.asRelativePath(this.taskStore.getTodoUri(task.id));

        if (this.getIsInitialised()) {
            await this.syncAgentsMdSection({
                title: task.title,
                taskRelPath,
                todoRelPath,
                changeRelPath: this.getChangeRelPath(task),
                specRelPath: this.getSpecRelPath(task),
                priority: task.priority,
            });
        }

        if (instrUri) {
            response.reference(instrUri);
            const instrRelPath = vscode.workspace.asRelativePath(instrUri);
            response.markdown(`Read \`${instrRelPath}\` for workflow instructions.\n\n`);
        }
        response.reference(taskUri);

        try {
            const doc = await vscode.workspace.openTextDocument(taskUri);
            await vscode.window.showTextDocument(doc, { preview: false });
        } catch {
            // non-fatal
        }

        return { taskRelPath };
    }

    /**
     * Pick a not-done task via QuickPick.
     */
    private async pickNotDoneTask(): Promise<ReturnType<TaskStore['get']> | undefined> {
        const tasks = this.taskStore.getAll().filter(t => t.lane !== DONE_LANE);
        if (tasks.length === 0) { return undefined; }

        type Pick = vscode.QuickPickItem & { id: string };
        const items: Pick[] = tasks.map(t => ({
            label: t.title,
            description: `${t.lane}${t.priority ? ' · ' + t.priority : ''}`,
            id: t.id,
        }));

        const picked = await vscode.window.showQuickPick(items, {
            title: 'Select a task to work on (not done)',
            ignoreFocusOut: true,
            placeHolder: 'Choose a task...',
        });

        return picked ? this.taskStore.get(picked.id) : undefined;
    }

    /**
     * Handle the /work command.
     * Picks a not-done task, syncs context, and copies a task-specific work prompt to clipboard.
     */
    private async handleWork(prompt: string, response: vscode.ChatResponseStream): Promise<void> {
        let task: ReturnType<TaskStore['get']>;

        if (prompt.trim()) {
            const resolved = this.resolveTaskFromPrompt(prompt.trim());
            task = resolved.task;
        } else {
            task = await this.pickNotDoneTask();
        }

        if (!task) {
            response.markdown('No not-done tasks to work on. Use `@kanban /new <title>` to create one.');
            return;
        }

        // Select and sync context
        const { taskRelPath } = await this.selectTask(task, response);

        // Load work-on-task prompt template
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            response.markdown('No workspace folder is open.');
            return;
        }

        let promptContent: string;
        let promptUri: vscode.Uri;

        // Try workspace copy first, fall back to bundled
        const workspacePromptUri = vscode.Uri.joinPath(workspaceFolder.uri, ...PROMPTS_REL_PATH.split('/'), 'work-on-task.md');
        const bundledPromptUri = vscode.Uri.joinPath(this.extensionUri, 'assets', 'prompts', 'work-on-task.md');

        try {
            promptUri = (await this.exists(workspacePromptUri)) ? workspacePromptUri : bundledPromptUri;
            const bytes = await vscode.workspace.fs.readFile(promptUri);
            promptContent = new TextDecoder().decode(bytes);
        } catch (err: any) {
            response.markdown(`Failed to read work-on-task prompt: ${err.message}`);
            return;
        }

        // Resolve vars and interpolate
        const config = this.boardConfigStore.get();
        const activePack = config.activeStack
            ? config.packs?.find(p => p.name === config.activeStack)
            : undefined;
        const vars = {
            ...resolveVars(config, activePack),
            taskTitle: task.title,
            taskFile: taskRelPath,
        };
        const out = interpolate(promptContent, vars);

        // Copy to clipboard
        try {
            await vscode.env.clipboard.writeText(out);
        } catch (err: any) {
            response.markdown(`Failed to copy prompt to clipboard: ${err.message}`);
            return;
        }

        response.markdown(`Selected **${task.title}** and copied a work prompt to clipboard.\n\n`);
        response.markdown(`Task file: \`${taskRelPath}\`\n\n`);
        response.reference(promptUri);

        const laneChain = config.profile === 'lite'
            ? 'backlog → in-progress → done'
            : 'backlog → planning → in-progress → review → done';
        response.markdown(`Workflow: \`${laneChain}\`\n\n`);
        response.markdown('Paste the prompt into a new chat to carry this task to completion.');
    }

    /**
     * Handle the /evidence command.
     * With no check arg: shows evidence status.
     * With check + pass|fail: records evidence on the task.
     */
    private async handleEvidence(prompt: string, response: vscode.ChatResponseStream): Promise<void> {
        const VALID_CHECKS = ['lint', 'test', 'build', 'behavior'] as const;
        type CheckKey = typeof VALID_CHECKS[number];

        let task: ReturnType<TaskStore['get']>;
        let freeText = '';

        if (prompt.trim()) {
            const resolved = this.resolveTaskFromPrompt(prompt.trim());
            task = resolved.task;
            freeText = resolved.freeText;
        } else if (this.lastSelectedTaskId) {
            task = this.taskStore.get(this.lastSelectedTaskId);
        }

        if (!task) {
            const activeTasks = this.taskStore.getAll().filter(t => t.lane !== DONE_LANE);
            if (activeTasks.length === 0) {
                response.markdown('No active tasks. Use `@kanban /new <title>` to create one.');
            } else {
                response.markdown('Active tasks:\n\n');
                for (const t of activeTasks) {
                    response.markdown(`- **${t.title}**\n`);
                }
                response.markdown('\nUsage: `@kanban /evidence <task> [lint|test|build|behavior] [pass|fail]`');
            }
            return;
        }

        const config = this.boardConfigStore.get();
        const isStandard = config.profile !== 'lite';

        // Parse check key and pass/fail from remaining text
        const parts = freeText.trim().split(/\s+/).filter(Boolean);
        const checkArg = parts[0] as CheckKey | undefined;
        const resultArg = parts[1]?.toLowerCase();
        const notesArg = parts.slice(2).join(' ').replace(/^["']|["']$/g, '');

        if (!checkArg || !VALID_CHECKS.includes(checkArg)) {
            // Show evidence status
            const evidence = task.evidence;
            const checks: CheckKey[] = isStandard ? ['lint', 'test', 'build', 'behavior'] : ['behavior'];

            response.markdown(`## Evidence: **${task.title}**\n\n`);
            for (const c of checks) {
                const entry = evidence?.[c as keyof TaskEvidence] as EvidenceEntry | undefined;
                if (!entry) {
                    response.markdown(`- ❌ **${c}**: not recorded\n`);
                } else if (!entry.ran) {
                    response.markdown(`- ⚠️ **${c}**: not run\n`);
                } else if (entry.passed) {
                    response.markdown(`- ✅ **${c}**: passed${entry.description ? ` — ${entry.description}` : ''}\n`);
                } else {
                    response.markdown(`- ❌ **${c}**: failed${entry.description ? ` — ${entry.description}` : ''}\n`);
                }
            }

            const validation = TaskEvidenceValidator.validate(task, isStandard);
            if (validation.ok) {
                response.markdown('\n✅ Evidence complete — task is ready for `review → done`.\n');
            } else {
                if (validation.missing.length > 0) {
                    response.markdown(`\nMissing: ${validation.missing.join(', ')}\n`);
                }
                if (validation.failed.length > 0) {
                    response.markdown(`Failed: ${validation.failed.join(', ')}\n`);
                }
            }
            response.markdown('\nUsage: `@kanban /evidence <task> lint|test|build|behavior pass|fail ["<notes>"]`');
            return;
        }

        if (resultArg !== 'pass' && resultArg !== 'fail') {
            response.markdown(`Usage: \`@kanban /evidence ${task.slug ?? task.title} ${checkArg} pass|fail ["<notes>"]\``);
            return;
        }

        // Record the evidence entry
        const entry: EvidenceEntry = {
            ran: true,
            passed: resultArg === 'pass',
            timestamp: new Date().toISOString(),
            description: notesArg || undefined,
        };

        if (!task.evidence) { task.evidence = {}; }
        (task.evidence as any)[checkArg] = entry;
        await this.taskStore.save(task);

        const icon = resultArg === 'pass' ? '✅' : '❌';
        response.markdown(`${icon} Recorded **${checkArg}** as **${resultArg}** for **${task.title}**.\n`);
        if (notesArg) { response.markdown(`Notes: ${notesArg}\n`); }


        const validation = TaskEvidenceValidator.validate(task, isStandard);
        if (validation.ok) {
            response.markdown('\n✅ All evidence complete — task is ready for `review → done`.\n');
        } else {
            const remaining = [...validation.missing, ...validation.failed];
            response.markdown(`\nRemaining: ${remaining.join(', ')}\n`);
        }
    }

    /**
     * Handle the /spec command.
     * Scaffolds spec-driven change artifacts for the selected task.
     */
    private async handleSpec(prompt: string, response: vscode.ChatResponseStream): Promise<void> {
        if (!this.lastSelectedTaskId) {
            const linkedTask = this.findLinkedWorktreeTask();
            if (linkedTask) {
                this.lastSelectedTaskId = linkedTask.id;
            }
        }

        if (!this.lastSelectedTaskId) {
            response.markdown('No task selected. Use `@kanban /task <task name>` first, then run `@kanban /spec [capability]`.');
            return;
        }

        const task = this.taskStore.get(this.lastSelectedTaskId);
        if (!task || task.lane === DONE_LANE) {
            this.lastSelectedTaskId = undefined;
            response.markdown('Previously selected task is no longer active. Use `@kanban /task <task name>` to select a new one.');
            return;
        }

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            response.markdown('No workspace folder is open.');
            return;
        }

        const changeSlug = this.getTaskSlug(task);
        const capability = this.slugifySpecPart(prompt.trim() || changeSlug) || changeSlug;
        const changeRelPath = `${CHANGES_REL_PATH}/${changeSlug}`;
        const specRelPath = `${SPECS_REL_PATH}/${capability}/spec.md`;
        const changeUri = this.uriFromRelativePath(workspaceFolder.uri, changeRelPath);
        const specUri = this.uriFromRelativePath(workspaceFolder.uri, specRelPath);
        const config = this.boardConfigStore.get();

        try {
            await vscode.workspace.fs.createDirectory(changeUri);

            const created: vscode.Uri[] = [];
            const reused: vscode.Uri[] = [];
            const proposalUri = vscode.Uri.joinPath(changeUri, 'proposal.md');
            const tasksUri = vscode.Uri.joinPath(changeUri, 'tasks.md');

            await this.writeTemplateIfMissing('proposal.md', proposalUri, task, changeSlug, capability, created, reused);
            await this.writeTemplateIfMissing('tasks.md', tasksUri, task, changeSlug, capability, created, reused);

            // Capability spec lives once under .agentkanban/specs/<capability>/ and is
            // referenced (not duplicated) by the task via the `spec` frontmatter key.
            await vscode.workspace.fs.createDirectory(
                this.uriFromRelativePath(workspaceFolder.uri, `${SPECS_REL_PATH}/${capability}`),
            );
            await this.writeTemplateIfMissing('spec.md', specUri, task, changeSlug, capability, created, reused);

            let designUri: vscode.Uri | undefined;
            if (config.profile === 'standard') {
                designUri = vscode.Uri.joinPath(changeUri, 'design.md');
                await this.writeTemplateIfMissing('design.md', designUri, task, changeSlug, capability, created, reused);
            }

            task.change = changeRelPath;
            task.spec = specRelPath;
            await this.taskStore.save(task);

            const taskUri = this.taskStore.getTaskUri(task.id);
            const taskRelPath = vscode.workspace.asRelativePath(taskUri);
            const todoRelPath = vscode.workspace.asRelativePath(this.taskStore.getTodoUri(task.id));
            await this.syncAgentsMdSection({
                title: task.title,
                taskRelPath,
                todoRelPath,
                changeRelPath,
                specRelPath,
                priority: task.priority,
            });

            response.reference(taskUri);
            for (const uri of [proposalUri, tasksUri, designUri, specUri].filter(Boolean) as vscode.Uri[]) {
                response.reference(uri);
            }

            const doc = await vscode.workspace.openTextDocument(proposalUri);
            await vscode.window.showTextDocument(doc, { preview: false });

            response.markdown(`Spec change scaffolded for **${task.title}**\n\n`);
            response.markdown(`Change: \`${changeRelPath}\`\n\n`);
            response.markdown(`Capability spec: \`${specRelPath}\`\n\n`);
            response.markdown(`Profile: \`${config.profile}\`\n\n`);
            if (created.length > 0) {
                response.markdown('Created:\n');
                for (const uri of created) {
                    response.markdown(`- \`${vscode.workspace.asRelativePath(uri)}\`\n`);
                }
                response.markdown('\n');
            }
            if (reused.length > 0) {
                response.markdown('Preserved existing files:\n');
                for (const uri of reused) {
                    response.markdown(`- \`${vscode.workspace.asRelativePath(uri)}\`\n`);
                }
                response.markdown('\n');
            }
            response.markdown('Use `tasks.md` as the checklist for this spec-driven task.');
        } catch (err: any) {
            response.markdown(`Failed to scaffold spec change: ${err.message}`);
            this.logger.warn('chatParticipant', `Spec scaffold failed for ${task.id}: ${err.message}`);
        }
    }

    /**
     * Handle the /archive command. Moves a completed change folder
     * `.agentkanban/changes/<slug>` to `.agentkanban/changes/archive/<slug>`.
     * Slug comes from the prompt, else from the selected task's `change`. The
     * capability spec under `.agentkanban/specs/` is left in place (it is shared).
     */
    private async handleArchive(prompt: string, response: vscode.ChatResponseStream): Promise<void> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            response.markdown('No workspace folder is open.');
            return;
        }

        let slug = prompt.trim();
        if (!slug && this.lastSelectedTaskId) {
            const task = this.taskStore.get(this.lastSelectedTaskId);
            const changeRel = task ? this.getChangeRelPath(task) : undefined;
            if (changeRel) {
                slug = changeRel.split('/').filter(Boolean).pop() ?? '';
            }
        }
        if (!slug) {
            response.markdown('Usage: `@kanban /archive <change-slug>` (or select a spec-driven task first with `/task`).');
            return;
        }

        const sourceRel = `${CHANGES_REL_PATH}/${slug}`;
        const destRel = `${CHANGES_REL_PATH}/archive/${slug}`;
        const sourceUri = this.uriFromRelativePath(workspaceFolder.uri, sourceRel);
        const destUri = this.uriFromRelativePath(workspaceFolder.uri, destRel);

        if (!(await this.exists(sourceUri))) {
            response.markdown(`No change folder at \`${sourceRel}\`.`);
            return;
        }
        if (await this.exists(destUri)) {
            response.markdown(`Archive target \`${destRel}\` already exists — resolve it manually.`);
            return;
        }

        try {
            await vscode.workspace.fs.createDirectory(
                this.uriFromRelativePath(workspaceFolder.uri, `${CHANGES_REL_PATH}/archive`),
            );
            await vscode.workspace.fs.rename(sourceUri, destUri, { overwrite: false });
            response.markdown(`Archived change \`${slug}\`:\n- \`${sourceRel}\` → \`${destRel}\`\n\nThe capability spec under \`${SPECS_REL_PATH}/\` was left in place (shared across tasks).`);
            this.logger.info('chatParticipant', `Archived change ${slug}`);
        } catch (err: any) {
            response.markdown(`Failed to archive change \`${slug}\`: ${err.message}`);
            this.logger.warn('chatParticipant', `Archive failed for ${slug}: ${err.message}`);
        }
    }

    /**
     * Handle the /prompts command. Has two modes:
     * - `/prompts` (no args) opens a QuickPick of prompt files
     * - `/prompts refresh` rewrites the bundled stage-driver prompts
     */
    private async handlePrompts(
        prompt: string,
        response: vscode.ChatResponseStream,
    ): Promise<void> {
        // Refresh mode: rewrite the bundled prompts
        if (prompt.trim() === 'refresh') {
            await this.handlePromptsRefresh(response);
            return;
        }

        // Picker mode: show list of prompt files
        await this.handlePromptsPicker(response);
    }

    /** Pick a prompt file from the workspace and copy its content to clipboard. */
    private async handlePromptsPicker(response: vscode.ChatResponseStream): Promise<void> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            response.markdown('No workspace folder is open.');
            return;
        }

        const promptsDir = vscode.Uri.joinPath(workspaceFolder.uri, PROMPTS_REL_PATH);
        let entries: [string, vscode.FileType][];
        try {
            entries = await vscode.workspace.fs.readDirectory(promptsDir);
        } catch {
            response.markdown('The `.agentkanban/prompts/` directory does not exist. Run `/prompts refresh` first.');
            return;
        }

        // Filter to .md prompt files; relegate README.md (it is docs, not a prompt).
        const promptFiles = entries
            .filter(([name, type]) => type === vscode.FileType.File && name.toLowerCase().endsWith('.md'))
            .map(([name]) => name)
            .filter(name => name.toLowerCase() !== 'readme.md');

        if (promptFiles.length === 0) {
            response.markdown('No prompt files found in `.agentkanban/prompts/`. Run `/prompts refresh` first.');
            return;
        }

        // Carry the real filename on each item so selection never reconstructs a path.
        type PromptPick = vscode.QuickPickItem & { filename: string };
        const items: PromptPick[] = promptFiles.map(name => ({
            label: name.replace(/\.md$/i, ''),
            filename: name,
        }));

        const picked = await vscode.window.showQuickPick(
            items,
            {
                title: 'Select a prompt to copy to clipboard',
                ignoreFocusOut: true,
                placeHolder: 'Choose a prompt file...',
            },
        );

        if (!picked) {
            response.markdown('No prompt selected.');
            return;
        }

        // Read and copy the selected prompt content
        const promptPath = vscode.Uri.joinPath(promptsDir, picked.filename);
        try {
            const bytes = await vscode.workspace.fs.readFile(promptPath);
            const content = new TextDecoder().decode(bytes);
            await vscode.env.clipboard.writeText(content);
            response.markdown(`Copied **${picked.label}** to clipboard.\n\nUse it in your agent/chat.`);
            response.reference(promptPath);
        } catch {
            response.markdown(`Failed to read prompt \`${picked.filename}\`.`);
        }
    }

    /**
     * Rewrite the bundled stage-driver prompts into `.agentkanban/prompts/`.
     * This is the behavior for `/prompts refresh`.
     */
    private async handlePromptsRefresh(response: vscode.ChatResponseStream): Promise<void> {
        const { created, updated, skipped } = await this.scaffoldPrompts(true);
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (created.length === 0 && updated.length === 0) {
            response.markdown('No prompts were written (no workspace, or the bundled prompts are missing).');
            return;
        }
        response.markdown(`Refreshed stage-driver prompts in \`${PROMPTS_REL_PATH}/\` (${created.length} created, ${updated.length} updated).\n\n`);
        if (workspaceFolder) {
            const readmeUri = vscode.Uri.joinPath(workspaceFolder.uri, ...PROMPTS_REL_PATH.split('/'), 'README.md');
            response.reference(readmeUri);
        }
        response.markdown('Start with `stage-planning-to-review.md` (the autonomous default). See `README.md` for the flow.');
    }

    /**
     * Handle the /refresh command.
     * Re-injects workflow context for the last selected task.
     */
    private async handleRefresh(
        prompt: string,
        response: vscode.ChatResponseStream,
    ): Promise<void> {
        // Auto-detect linked task in worktree workspace
        if (!this.lastSelectedTaskId) {
            const linkedTask = this.findLinkedWorktreeTask();
            if (linkedTask) {
                this.lastSelectedTaskId = linkedTask.id;
            }
        }

        if (!this.lastSelectedTaskId) {
            const titles = this.getActiveTaskTitles();
            if (titles.length === 0) {
                response.markdown('No active tasks. Use `@kanban /new <title>` to create one.');
            } else {
                response.markdown('No task selected. Use `@kanban /task <task name>` first.\n\n');
                response.markdown('Active tasks:\n\n');
                for (const t of titles) {
                    response.markdown(`- **${t}**\n`);
                }
            }
            return;
        }

        const task = this.taskStore.get(this.lastSelectedTaskId);
        if (!task || task.lane === DONE_LANE) {
            this.lastSelectedTaskId = undefined;
            response.markdown('Previously selected task is no longer active. Use `@kanban /task <task name>` to select a new one.');
            return;
        }

        if (isEnforceWorktrees() && !task.worktree && !this.isInTaskWorktree(task)) {
            response.markdown('This task requires a git worktree before `/refresh` can continue.\n\n');
            response.markdown('Use `@kanban /worktree` to create one for the selected task.');
            return;
        }

        this.logger.info('chatParticipant', `/refresh on: ${task.id} (${task.title})`);

        // Sync INSTRUCTION.md and AGENTS.md section from bundled templates
        const instrUri = this.getIsInitialised() ? await this.syncInstructionFile() : undefined;
        if (this.getIsInitialised()) {
            const refreshTaskUri = this.taskStore.getTaskUri(task.id);
            const refreshTaskRelPath = vscode.workspace.asRelativePath(refreshTaskUri);
            const refreshTodoRelPath = vscode.workspace.asRelativePath(this.taskStore.getTodoUri(task.id));
            await this.syncAgentsMdSection({
                title: task.title,
                taskRelPath: refreshTaskRelPath,
                todoRelPath: refreshTodoRelPath,
                changeRelPath: this.getChangeRelPath(task),
                specRelPath: this.getSpecRelPath(task),
                priority: task.priority,
            });
        }

        const taskUri = this.taskStore.getTaskUri(task.id);
        const taskRelPath = vscode.workspace.asRelativePath(taskUri);

        // Attach files as references so they persist in conversation context
        if (instrUri) { response.reference(instrUri); }
        response.reference(taskUri);

        // Open the task file in editor (preserveFocus keeps cursor in chat input)
        try {
            const doc = await vscode.workspace.openTextDocument(taskUri);
            await vscode.window.showTextDocument(doc, { preview: false, preserveFocus: true });
        } catch {
            // non-fatal — file may already be open
        }

        // Output context for Copilot
        if (instrUri) {
            const instrRelPath = vscode.workspace.asRelativePath(instrUri);
            response.markdown(`Read \`${instrRelPath}\` for workflow instructions.\n\n`);
        }

        response.markdown(`**REFRESH** — Task: **${task.title}**\n\n`);
        response.markdown(`Task file: \`${taskRelPath}\`\n\n`);

        if (this.isInTaskWorktree(task)) {
            response.markdown(WORKTREE_WORKSPACE_HINT);
        }

        if (prompt.trim()) {
            response.markdown(`Additional context: ${prompt.trim()}\n\n`);
        }

        response.markdown('Use **plan**, **checklist**, **implement**, or **review** as needed. `checklist` updates the TODO file artifact; it is not a lane.');
    }

    /**
     * Handle the /worktree command.
     * Subcommands: (none) → create, "open" → open, "remove" → remove.
     */
    private async handleWorktree(prompt: string, response: vscode.ChatResponseStream): Promise<void> {
        if (!this.worktreeService) {
            response.markdown('Git worktree support is not available (workspace may not be a git repository).');
            return;
        }

        const isGit = await this.worktreeService.isGitRepo();
        if (!isGit) {
            response.markdown('This workspace is not a git repository. Worktree support requires git.');
            return;
        }

        // Auto-detect linked task in worktree workspace
        if (!this.lastSelectedTaskId) {
            const linkedTask = this.findLinkedWorktreeTask();
            if (linkedTask) {
                this.lastSelectedTaskId = linkedTask.id;
            }
        }

        if (!this.lastSelectedTaskId) {
            response.markdown('No task selected. Use `@kanban /task <task name>` first.');
            return;
        }

        const task = this.taskStore.get(this.lastSelectedTaskId);
        if (!task || task.lane === DONE_LANE) {
            this.lastSelectedTaskId = undefined;
            response.markdown('Previously selected task is no longer active. Use `@kanban /task <task name>` to select a new one.');
            return;
        }

        const subcommand = prompt.toLowerCase().trim();

        if (subcommand === 'open') {
            await this.handleWorktreeOpen(task, response);
        } else if (subcommand === 'remove') {
            await this.handleWorktreeRemove(task, response);
        } else {
            await this.handleWorktreeCreate(task, response);
        }
    }

    private async handleWorktreeCreate(
        task: ReturnType<TaskStore['get']> & {},
        response: vscode.ChatResponseStream,
    ): Promise<void> {
        if (task.worktree) {
            const exists = await this.worktreeService!.exists(task.worktree.path);
            if (exists) {
                response.markdown(`Task **${task.title}** already has a worktree at \`${task.worktree.path}\`.\n\n`);
                response.markdown('Use `@kanban /worktree open` to open it, or `@kanban /worktree remove` to remove it.\n\n');
                if (this.isInTaskWorktree(task)) {
                    response.markdown(WORKTREE_WORKSPACE_HINT);
                }
                return;
            }
            // Worktree metadata exists but directory is gone — clean up and recreate
            this.logger.warn('chatParticipant', `Stale worktree metadata for task ${task.id}, recreating`);
        }

        try {
            response.markdown(`Creating worktree for **${task.title}**...\n\n`);

            const taskUri = this.taskStore.getTaskUri(task.id);
            const taskRelPath = vscode.workspace.asRelativePath(taskUri);
            const config = this.boardConfigStore.get();
            const activePack = config.activeStack
                ? config.packs?.find(p => p.name === config.activeStack)
                : undefined;
            const projectSkills = config.skills ?? [];
            const packSkills = activePack?.skills ?? [];
            const resolvedSkills = Array.from(new Set([...projectSkills, ...packSkills]));
            const worktreeInfo = await this.worktreeService!.create(task.id, task.title, taskRelPath, resolvedSkills);

            // Update task frontmatter with worktree info
            task.worktree = worktreeInfo;
            await this.taskStore.save(task);

            // Copy updated task file (with worktree metadata) into the worktree
            // so the extension can detect the worktree association on activation
            try {
                const savedBytes = await vscode.workspace.fs.readFile(taskUri);
                const worktreeTaskUri = vscode.Uri.joinPath(vscode.Uri.file(worktreeInfo.path), taskRelPath);
                await vscode.workspace.fs.writeFile(worktreeTaskUri, savedBytes);
            } catch (err: any) {
                this.logger.warn('chatParticipant', `Failed to sync task file to worktree: ${err.message}`);
            }

            response.markdown(`✅ Worktree created:\n\n`);
            response.markdown(`- **Branch:** \`${worktreeInfo.branch}\`\n`);
            response.markdown(`- **Path:** \`${worktreeInfo.path}\`\n\n`);
            response.markdown('Opening worktree in VS Code...\n');

            await this.worktreeService!.openInVSCode(worktreeInfo.path);
        } catch (err: any) {
            response.markdown(`❌ Failed to create worktree: ${err.message}`);
            this.logger.warn('chatParticipant', `Worktree creation failed: ${err.message}`);
        }
    }

    private async handleWorktreeOpen(
        task: ReturnType<TaskStore['get']> & {},
        response: vscode.ChatResponseStream,
    ): Promise<void> {
        if (!task.worktree) {
            response.markdown(`Task **${task.title}** has no worktree. Use \`@kanban /worktree\` to create one.`);
            return;
        }

        const exists = await this.worktreeService!.exists(task.worktree.path);
        if (!exists) {
            response.markdown(`Worktree directory no longer exists at \`${task.worktree.path}\`.\n\n`);
            response.markdown('Use `@kanban /worktree` to create a new one.');
            // Clean up stale metadata
            task.worktree = undefined;
            await this.taskStore.save(task);
            return;
        }

        response.markdown(`Opening worktree for **${task.title}** at \`${task.worktree.path}\`...\n\n`);
        if (this.isInTaskWorktree(task)) {
            response.markdown(WORKTREE_WORKSPACE_HINT);
        }
        await this.worktreeService!.openInVSCode(task.worktree.path);
    }

    private async handleWorktreeRemove(
        task: ReturnType<TaskStore['get']> & {},
        response: vscode.ChatResponseStream,
    ): Promise<void> {
        if (!task.worktree) {
            response.markdown(`Task **${task.title}** has no worktree to remove.`);
            return;
        }

        try {
            await this.worktreeService!.remove(task.worktree);
            const branch = task.worktree.branch;
            task.worktree = undefined;
            await this.taskStore.save(task);

            response.markdown(`✅ Worktree removed for **${task.title}**.\n`);
            response.markdown(`Branch \`${branch}\` has been deleted.\n`);
        } catch (err: any) {
            response.markdown(`❌ Failed to remove worktree: ${err.message}`);
            this.logger.warn('chatParticipant', `Worktree removal failed: ${err.message}`);
        }
    }

    /**
     * Resolve a task from the prompt text.
     * Cascade: slug match → exact title prefix → title substring → alphanumeric fuzzy → first-word partial.
     * Returns the matched task and any remaining free text.
     */
    resolveTaskFromPrompt(prompt: string): { task: ReturnType<TaskStore['get']>; freeText: string } {
        if (!prompt) {
            return { task: undefined, freeText: '' };
        }

        const activeTasks = this.taskStore.getAll().filter(t => t.lane !== DONE_LANE);
        const promptLower = prompt.toLowerCase();

        // 1. Slug match (highest priority) — exact slug, case-insensitive
        const promptSlug = prompt.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
        if (promptSlug) {
            const slugMatch = activeTasks.find(t => t.slug?.toLowerCase() === promptSlug);
            if (slugMatch) {
                return { task: slugMatch, freeText: '' };
            }
        }

        // 2. Exact title prefix (case-insensitive)
        const exactMatch = activeTasks.find(t => promptLower.startsWith(t.title.toLowerCase()));
        if (exactMatch) {
            const freeText = prompt.slice(exactMatch.title.length).trim();
            return { task: exactMatch, freeText };
        }

        // 3. Title substring — find best match where full title appears in prompt
        let bestMatch: typeof activeTasks[0] | undefined;
        let bestMatchLength = 0;

        for (const t of activeTasks) {
            const titleLower = t.title.toLowerCase();
            if (promptLower.includes(titleLower) && titleLower.length > bestMatchLength) {
                bestMatch = t;
                bestMatchLength = titleLower.length;
            }
        }

        if (bestMatch) {
            const idx = promptLower.indexOf(bestMatch.title.toLowerCase());
            const freeText = (prompt.slice(0, idx) + prompt.slice(idx + bestMatch.title.length)).trim();
            return { task: bestMatch, freeText };
        }

        // 4. Alphanumeric fuzzy — strip non-alnum, check substring
        const promptAlnum = promptLower.replace(/[^a-z0-9]/g, '');
        if (promptAlnum) {
            let alnumBest: typeof activeTasks[0] | undefined;
            let alnumBestLen = 0;
            let alnumAmbiguous = false;

            for (const t of activeTasks) {
                const titleAlnum = t.title.toLowerCase().replace(/[^a-z0-9]/g, '');
                if (titleAlnum.includes(promptAlnum)) {
                    if (titleAlnum.length > alnumBestLen) {
                        alnumBest = t;
                        alnumBestLen = titleAlnum.length;
                        alnumAmbiguous = false;
                    } else if (titleAlnum.length === alnumBestLen && alnumBest && alnumBest.id !== t.id) {
                        alnumAmbiguous = true;
                    }
                }
            }

            if (alnumBest && !alnumAmbiguous) {
                return { task: alnumBest, freeText: '' };
            }
        }

        // 5. First-word partial — first word of prompt matches within a title
        const firstWord = prompt.split(/\s+/)[0].toLowerCase();
        const partialMatch = activeTasks.find(t => t.title.toLowerCase().includes(firstWord));
        if (partialMatch) {
            const freeText = prompt.split(/\s+/).slice(1).join(' ').trim();
            return { task: partialMatch, freeText };
        }

        return { task: undefined, freeText: prompt };
    }

    private getChangeRelPath(task: { change?: string; extras?: Record<string, unknown> }): string | undefined {
        const value = task.change ?? task.extras?.change;
        return typeof value === 'string' && value.trim() ? value : undefined;
    }

    private getSpecRelPath(task: { spec?: string; extras?: Record<string, unknown> }): string | undefined {
        const value = task.spec ?? task.extras?.spec;
        return typeof value === 'string' && value.trim() ? value : undefined;
    }

    private async handleSweep(
        prompt: string,
        response: vscode.ChatResponseStream,
    ): Promise<void> {
        const config = this.boardConfigStore.get();
        
        // Parse flags from the prompt arg
        const args = prompt.split(/\s+/).filter(Boolean);
        let targetLane = 'planning';
        let filterLabel: string | undefined;
        let filterPriority: string | undefined;
        let filterPack: string | undefined;

        for (const arg of args) {
            if (arg.startsWith('--label=')) {
                filterLabel = arg.slice('--label='.length);
            } else if (arg.startsWith('--priority=')) {
                filterPriority = arg.slice('--priority='.length);
            } else if (arg.startsWith('--pack=')) {
                filterPack = arg.slice('--pack='.length);
            } else if (arg.startsWith('--stack=')) {
                filterPack = arg.slice('--stack='.length);
            } else if (!arg.startsWith('-')) {
                // Keep first bare token as lane
                targetLane = arg;
            }
        }

        if (!config.lanes.includes(targetLane)) {
            response.markdown(`❌ Invalid lane **${targetLane}**. Valid lanes are: ${config.lanes.map(l => `\`${l}\``).join(', ')}\n`);
            return;
        }

        const allTasks = this.taskStore.getAll();
        const tasksInLane = allTasks.filter(t => t.lane === targetLane);

        if (tasksInLane.length === 0) {
            response.markdown(`No tasks found in lane **${targetLane}**.\n`);
            return;
        }

        const readyTasks = tasksInLane.filter(task => {
            if (task.dependsOn && task.dependsOn.length > 0) {
                for (const depId of task.dependsOn) {
                    const depTask = allTasks.find(t => t.id === depId || t.slug === depId);
                    if (depTask && depTask.lane !== 'done' && depTask.lane !== 'archive') {
                        return false;
                    }
                }
            }
            if (filterLabel && (!task.labels || !task.labels.includes(filterLabel))) {
                return false;
            }
            if (filterPriority && task.priority !== filterPriority) {
                return false;
            }
            return true;
        });

        if (readyTasks.length === 0) {
            response.markdown(`No ready tasks (with all dependencies resolved) found in lane **${targetLane}**.\n`);
            return;
        }

        const packName = filterPack || config.activeStack;
        const selectedPack = packName ? config.packs?.find(p => p.name === packName) : undefined;
        if (selectedPack) {
            this.logger.info('chatParticipant', `Sweep driven by pack: ${selectedPack.name}`);
        } else {
            this.logger.info('chatParticipant', `Sweep driven by default board policies`);
        }

        let headerMsg = `🧹 **Starting sweep of ${readyTasks.length} task(s) in lane "${targetLane}"**`;
        const activeFilters: string[] = [];
        if (filterLabel) { activeFilters.push(`label: \`${filterLabel}\``); }
        if (filterPriority) { activeFilters.push(`priority: \`${filterPriority}\``); }
        if (packName) { activeFilters.push(`pack: \`${packName}\``); }
        if (activeFilters.length > 0) {
            headerMsg += ` filtered by ${activeFilters.join(', ')}`;
        }
        headerMsg += `...\n\n`;
        response.markdown(headerMsg);

        const results: Array<{ title: string; success: boolean; error?: string }> = [];

        for (const task of readyTasks) {
            response.markdown(`Processing task **${task.title}**...\n`);

            // 1. Move to in-progress
            task.lane = 'in-progress';
            await this.taskStore.save(task);

            // 2. Run verification
            const commandsToRun: { name: string; command: string }[] = [];
            if (selectedPack?.verifyCmds && selectedPack.verifyCmds.length > 0) {
                for (let i = 0; i < selectedPack.verifyCmds.length; i++) {
                    commandsToRun.push({ name: `verifyCmd[${i}]`, command: selectedPack.verifyCmds[i] });
                }
            } else {
                const verification = config.policies?.verification;
                if (verification?.testCommand) {
                    commandsToRun.push({ name: 'test', command: verification.testCommand });
                }
                if (verification?.lintCommand) {
                    commandsToRun.push({ name: 'lint', command: verification.lintCommand });
                }
                if (verification?.buildCommand) {
                    commandsToRun.push({ name: 'build', command: verification.buildCommand });
                }
            }

            let passed = true;
            let errorLogs = '';
            const cwd = task.worktree?.path || this.taskStore.getWorkspacePath();

            if (commandsToRun.length > 0) {
                for (const cmd of commandsToRun) {
                    try {
                        this.logger.info('chatParticipant', `Sweep running command: ${cmd.command} (cwd: ${cwd})`);
                        await execAsync(cmd.command, { cwd });
                    } catch (err: any) {
                        passed = false;
                        const stdout = err.stdout ? `\nStdout:\n${err.stdout}` : '';
                        const stderr = err.stderr ? `\nStderr:\n${err.stderr}` : '';
                        errorLogs += `❌ Command failed: "${cmd.command}"\nError: ${err.message || err}${stdout}${stderr}\n`;
                        break;
                    }
                }
            }

            if (passed) {
                // Move to review
                task.lane = 'review';
                if (task.labels) {
                    const hadBlocker = task.labels.some(l => l === 'blocked' || l.startsWith('blocked-by:'));
                    task.labels = task.labels.filter(l => l !== 'blocked' && !l.startsWith('blocked-by:'));
                    if (hadBlocker) {
                        task.blockerResolved = true;
                    }
                }
                const successComment = `[comment: sweep success: verification passed on ${new Date().toISOString()}]`;
                await this.appendCommentToTask(task, successComment);
                response.markdown(`✅ **${task.title}**: Verification passed. Moved to **REVIEW**.\n\n`);
                results.push({ title: task.title, success: true });
            } else {
                // Move back to targetLane and mark blocked
                task.lane = targetLane;
                if (!task.labels) {
                    task.labels = [];
                }
                if (!task.labels.includes('blocked')) {
                    task.labels.push('blocked');
                }
                const failureComment = `[comment: sweep failure: verification failed on ${new Date().toISOString()}\nLogs:\n${errorLogs}]`;
                await this.appendCommentToTask(task, failureComment);
                response.markdown(`❌ **${task.title}**: Verification failed. Moved back to **${targetLane.toUpperCase()}** (labeled blocked).\n\n`);
                results.push({ title: task.title, success: false, error: errorLogs });
            }
        }

        // Summary
        response.markdown(`### Sweep Summary\n\n`);
        const passedCount = results.filter(r => r.success).length;
        const failedCount = results.filter(r => !r.success).length;
        response.markdown(`- **Total processed:** ${results.length}\n`);
        response.markdown(`- **Passed:** ${passedCount}\n`);
        response.markdown(`- **Failed:** ${failedCount}\n`);
    }

    private async handlePack(
        prompt: string,
        response: vscode.ChatResponseStream,
    ): Promise<void> {
        const parts = prompt.trim().split(/\s+/).filter(Boolean);
        const action = parts[0]?.toLowerCase();

        if (action === 'list') {
            const config = this.boardConfigStore.get();
            response.markdown('### Configured Stack Packs\n\n');
            if (!config.packs || config.packs.length === 0) {
                response.markdown('No stack packs defined.\n');
                return;
            }
            for (const pack of config.packs) {
                const isActive = pack.name === config.activeStack ? ' *(active)*' : '';
                response.markdown(`- **${pack.name}**${isActive}: ${pack.stack || 'No label'}\n`);
                if (pack.skills && pack.skills.length > 0) {
                    response.markdown(`  - Skills: ${pack.skills.map(s => `\`${s}\``).join(', ')}\n`);
                }
                if (pack.coverage && pack.coverage.length > 0) {
                    response.markdown(`  - Coverage requirements: ${pack.coverage.length} item(s)\n`);
                }
                if (pack.verifyCmds && pack.verifyCmds.length > 0) {
                    response.markdown(`  - Verify commands: ${pack.verifyCmds.map(c => `\`${c}\``).join(', ')}\n`);
                }
            }
        } else if (action === 'use') {
            const packName = parts[1];
            if (!packName) {
                response.markdown('❌ Please specify a pack name, e.g. `@kanban /pack use odoo`.\n');
                return;
            }
            const config = this.boardConfigStore.get();
            const pack = config.packs?.find(p => p.name === packName);
            if (!pack) {
                response.markdown(`❌ Pack **${packName}** not found. Use \`@kanban /pack list\` to see available packs.\n`);
                return;
            }
            
            await this.boardConfigStore.update({ activeStack: packName });
            
            // Re-run scaffoldPrompts(true) and syncAgentsMdSection() immediately
            await this.scaffoldPrompts(true);
            await this.syncAgentsMdSection();
            // Also sync worktree AGENTS.md if in a worktree task
            await this.syncWorktreeAgentsMd();

            response.markdown(`✅ Active stack pack set to **${packName}**.\n`);
            response.markdown(`- Scaffolded prompts updated with **${pack.stack || packName}** settings.\n`);
            response.markdown(`- root \`AGENTS.md\` and worktree sentinels updated with active skills.\n`);
        } else {
            response.markdown('Available `/pack` commands:\n\n');
            response.markdown('- `@kanban /pack list` - List all configured stack packs\n');
            response.markdown('- `@kanban /pack use <name>` - Select a stack pack and bake it into prompts and AGENTS.md\n');
        }
    }

    private async appendCommentToTask(task: import('../types').Task, comment: string): Promise<void> {
        const uri = this.taskStore.getTaskUri(task.id);
        let body = '\n## Conversation\n\n### user\n\n';
        try {
            const existing = await vscode.workspace.fs.readFile(uri);
            const existingText = new TextDecoder().decode(existing);
            const parsed = TaskStore.splitFrontmatter(existingText);
            if (parsed.body) {
                body = parsed.body;
            }
        } catch {
            // Keep default body
        }
        const separator = body.endsWith('\n') ? '' : '\n';
        const updatedBody = `${body}${separator}\n${comment}\n`;
        await this.taskStore.saveWithBody(task, updatedBody);
    }

    private getTaskSlug(task: { id: string; title: string; slug?: string }): string {
        return task.slug || TaskStore.extractSlugFromId(task.id) || TaskStore.slugify(task.title);
    }

    private slugifySpecPart(value: string): string {
        return value
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 80)
            .replace(/_+$/, '');
    }

    private uriFromRelativePath(baseUri: vscode.Uri, relPath: string): vscode.Uri {
        return vscode.Uri.joinPath(baseUri, ...relPath.split('/').filter(Boolean));
    }

    private async writeTemplateIfMissing(
        templateName: string,
        targetUri: vscode.Uri,
        task: { title: string; description?: string },
        changeSlug: string,
        capability: string,
        created: vscode.Uri[],
        reused: vscode.Uri[],
    ): Promise<void> {
        if (await this.exists(targetUri)) {
            reused.push(targetUri);
            return;
        }

        const templateUri = vscode.Uri.joinPath(this.extensionUri, 'assets', 'spec-templates', templateName);
        const raw = new TextDecoder().decode(await vscode.workspace.fs.readFile(templateUri));
        const content = raw
            .replace(/\{\{TASK_TITLE\}\}/g, task.title)
            .replace(/\{\{TASK_DESCRIPTION\}\}/g, task.description || 'No description provided.')
            .replace(/\{\{CHANGE_SLUG\}\}/g, changeSlug)
            .replace(/\{\{CAPABILITY\}\}/g, capability);
        await vscode.workspace.fs.writeFile(targetUri, new TextEncoder().encode(content));
        created.push(targetUri);
    }

    private async handleDoctor(response: vscode.ChatResponseStream): Promise<void> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            response.markdown('No workspace folder is open.');
            return;
        }

        const config = this.boardConfigStore.get();
        const doctor = new WorkflowDoctor(
            this.taskStore,
            this.boardConfigStore,
            workspaceFolder.uri,
            undefined,
        );
        const issues = await doctor.diagnose();

        const profile = config.profile.toUpperCase();
        const status = issues.length === 0 ? 'HEALTHY' : 'ACTION REQUIRED';

        response.markdown(`## WORKFLOW DOCTOR REPORT\n\n`);
        response.markdown(`Profile: **${profile}** | Status: **${status}** | Issues: **${issues.length}**\n\n`);

        if (issues.length > 0) {
            response.markdown('| # | Severity | Category | Task | Issue |\n');
            response.markdown('|---|---|---|---|---|\n');
            for (let i = 0; i < issues.length; i++) {
                const issue = issues[i];
                const severityIcon = issue.severity === 'error' ? '🔴' : issue.severity === 'warning' ? '🟡' : '🔵';
                response.markdown(`| ${i + 1} | ${severityIcon} ${issue.severity} | ${issue.category} | \`${issue.taskId}\` | ${issue.message} |\n`);
            }
        } else {
            response.markdown('No issues found. The board is in good shape.\n');
        }

        this.logger.info('chatParticipant', `Doctor diagnosed ${issues.length} issues`);
    }

    private async exists(uri: vscode.Uri): Promise<boolean> {
        try {
            await vscode.workspace.fs.stat(uri);
            return true;
        } catch {
            return false;
        }
    }
}
