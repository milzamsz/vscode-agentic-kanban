import * as vscode from 'vscode';
import { parse, stringify } from 'yaml';
import type { BoardConfig, WorkflowProfile } from './types';
import {
    DEFAULT_BOARD_CONFIG,
    PROFILE_LANES,
    PROFILE_VERSION,
    normaliseBoardConfig,
} from './types';
import type { LogService } from './LogService';
import { NO_OP_LOGGER } from './LogService';

const CONFIG_PATH = '.agentkanban/board.yaml';
const GITIGNORE_PATH = '.agentkanban/.gitignore';
const GITIGNORE_CONTENT = '# Agentic Kanban - auto-generated\nlogs/\n';

// Fixed reference header prepended to every serialised board.yaml. Regenerated
// on each save, so it always survives a canonical rewrite. Documents every
// editable field in place; inline per-field comments are not used because the
// yaml stringify path cannot emit them. No em dashes (product copy rule).
const CONFIG_HEADER = [
    '# ===============================================================',
    '# Agentic Kanban board configuration (managed file)',
    '# Edit the values below; this header is regenerated on every save.',
    '#',
    '# profile: standard | lite        (lanes derive from profile)',
    '# enforcement.mode: strict | warn  (strict blocks illegal moves; warn allows and warns)',
    '#   overrides.allowed: true | false',
    '#   overrides.actors: [human] | [human, agent] | [agent]',
    '#   overrides.requireReason: true | false',
    '# reviewPolicy.<low|medium|high|critical>.<planning|implementation>:',
    '#   self-agent | independent-agent | independent-agent+human',
    '# worktreePolicy.requiredForImplementation: true | false',
    '# wipLimits.<lane>: <max tasks in that lane>  (e.g. in-progress: 1; omit/0 = no limit)',
    '# policies.transition.requireChecklistForInProgress: true | false',
    '# policies.transition.requireSpecForInProgress: true | false',
    '# policies.transition.requireDescriptionForReview: true | false',
    '# policies.transition.requireWorktreeForInProgress: true | false',
    '# policies.transition.requireDoneChecklistForDone: true | false  (review -> done also needs a full Definition of Done section)',
    '# policies.verification.testCommand: "npm test" (run on in-progress -> review)',
    '# policies.verification.lintCommand: "npm run lint" (run on in-progress -> review)',
    '# policies.verification.buildCommand: "npm run build" (run on in-progress -> review)',
    '# ===============================================================',
    '',
].join('\n');

export class BoardConfigStore {
    private config: BoardConfig = normaliseBoardConfig(DEFAULT_BOARD_CONFIG);
    private readonly configUri: vscode.Uri;
    private readonly _onDidChange = new vscode.EventEmitter<void>();
    readonly onDidChange = this._onDidChange.event;
    private readonly logger: LogService;

    constructor(private readonly workspaceUri: vscode.Uri, logger?: LogService) {
        this.configUri = vscode.Uri.joinPath(workspaceUri, CONFIG_PATH);
        this.logger = logger ?? NO_OP_LOGGER;
    }

    async init(): Promise<void> {
        try {
            const text = new TextDecoder().decode(await vscode.workspace.fs.readFile(this.configUri));
            this.config = BoardConfigStore.deserialise(text);
            if (BoardConfigStore.needsCanonicalRewrite(text, this.config)) {
                await this.save();
                this.logger.info('boardConfig', 'Rewrote legacy board config to canonical format');
            }
            this.logger.info('boardConfig', `Loaded ${this.config.profile} profile`);
        } catch {
            this.config = normaliseBoardConfig(DEFAULT_BOARD_CONFIG);
            this.logger.info('boardConfig', 'No config found, using defaults (not writing)');
        }
        this._onDidChange.fire();
    }

    async initialise(profile: WorkflowProfile, overrides?: Partial<BoardConfig>): Promise<void> {
        try {
            await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(this.workspaceUri, '.agentkanban'));
        } catch {
            // Directory may already exist.
        }

        await this.ensureGitignore();

        try {
            const text = new TextDecoder().decode(await vscode.workspace.fs.readFile(this.configUri));
            this.config = BoardConfigStore.deserialise(text);
            if (BoardConfigStore.needsCanonicalRewrite(text, this.config)) {
                await this.save();
                this.logger.info('boardConfig', 'Rewrote legacy board config to canonical format');
            }
        } catch {
            this.config = normaliseBoardConfig({
                profile,
                profileVersion: PROFILE_VERSION,
                ...overrides,
            });
            await this.save();
        }

        this._onDidChange.fire();
    }

    get(): BoardConfig {
        return this.config;
    }

    getLanes(): string[] {
        return PROFILE_LANES[this.config.profile];
    }

    async update(config: Partial<BoardConfig>): Promise<void> {
        this.config = normaliseBoardConfig({ ...this.config, ...config });
        await this.save();
        this.logger.info('boardConfig', 'Board config updated');
        this._onDidChange.fire();
    }

    async addUser(name: string): Promise<void> {
        const users = this.config.users ?? [];
        if (!users.includes(name)) {
            this.config = normaliseBoardConfig({ ...this.config, users: [...users, name] });
            await this.save();
            this._onDidChange.fire();
        }
    }

    async addLabel(name: string): Promise<void> {
        const labels = this.config.labels ?? [];
        if (!labels.includes(name)) {
            this.config = normaliseBoardConfig({ ...this.config, labels: [...labels, name] });
            await this.save();
            this._onDidChange.fire();
        }
    }

    async reconcileMetadata(tasks: Array<{ assignee?: string; labels?: string[] }>): Promise<void> {
        let changed = false;
        const users = new Set(this.config.users ?? []);
        const labels = new Set(this.config.labels ?? []);

        for (const task of tasks) {
            if (task.assignee && !users.has(task.assignee)) {
                users.add(task.assignee);
                changed = true;
            }
            if (task.labels) {
                for (const label of task.labels) {
                    if (!labels.has(label)) {
                        labels.add(label);
                        changed = true;
                    }
                }
            }
        }

        if (changed) {
            this.config = normaliseBoardConfig({
                ...this.config,
                users: [...users],
                labels: [...labels],
            });
            await this.save();
            this.logger.info('boardConfig', 'Reconciled metadata - added missing users/labels');
            this._onDidChange.fire();
        }
    }

    private async ensureGitignore(): Promise<void> {
        const gitignoreUri = vscode.Uri.joinPath(this.workspaceUri, GITIGNORE_PATH);
        try {
            await vscode.workspace.fs.stat(gitignoreUri);
            return;
        } catch {
            // File does not exist.
        }
        try {
            await vscode.workspace.fs.writeFile(gitignoreUri, new TextEncoder().encode(GITIGNORE_CONTENT));
            this.logger.info('boardConfig', 'Created .agentkanban/.gitignore');
        } catch (err: any) {
            this.logger.warn('boardConfig', `Failed to create .gitignore: ${err.message}`);
        }
    }

    private async save(): Promise<void> {
        const content = new TextEncoder().encode(BoardConfigStore.serialise(this.config));
        await vscode.workspace.fs.writeFile(this.configUri, content);
    }

    static serialise(config: BoardConfig): string {
        const normalised = normaliseBoardConfig(config);
        const payload: Record<string, unknown> = {
            profile: normalised.profile,
            profileVersion: normalised.profileVersion,
            lanes: normalised.lanes,
            users: normalised.users,
            enforcement: normalised.enforcement,
            reviewPolicy: normalised.reviewPolicy,
            worktreePolicy: normalised.worktreePolicy,
            policies: normalised.policies,
        };
        // Only persist wipLimits when it has entries (keeps lite boards unchanged).
        if (normalised.wipLimits && Object.keys(normalised.wipLimits).length > 0) {
            payload.wipLimits = normalised.wipLimits;
        }
        // labels last for readability
        if (normalised.labels !== undefined) {
            payload.labels = normalised.labels;
        }
        return CONFIG_HEADER + stringify(payload, { lineWidth: 0 });
    }

    static deserialise(text: string): BoardConfig {
        const loaded = parse(text) as Partial<BoardConfig> & { lanes?: unknown };
        if (Array.isArray(loaded?.lanes) && !loaded.profile) {
            const lanes = BoardConfigStore.normaliseLegacyLanes(loaded.lanes.map((lane) => String(lane)));
            if (JSON.stringify(lanes) === JSON.stringify(PROFILE_LANES.lite)) {
                return normaliseBoardConfig({ ...loaded, profile: 'lite' });
            }
            return normaliseBoardConfig({ ...loaded, profile: 'standard' });
        }
        const profile = loaded?.profile === 'lite' ? 'lite' : 'standard';
        return normaliseBoardConfig({
            ...loaded,
            profile,
            lanes: Array.isArray(loaded?.lanes)
                ? BoardConfigStore.normaliseLegacyLanes(loaded.lanes.map((lane) => String(lane)))
                : undefined,
        });
    }

    private static normaliseLegacyLanes(lanes: string[]): string[] {
        return lanes.filter((lane, index) => lane !== 'blocked' && lanes.indexOf(lane) === index);
    }

    private static needsCanonicalRewrite(text: string, config: BoardConfig): boolean {
        const loaded = parse(text);
        const canonical = parse(BoardConfigStore.serialise(config));
        return JSON.stringify(loaded) !== JSON.stringify(canonical);
    }
}
