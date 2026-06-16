import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BoardConfigStore } from '../BoardConfigStore';
import type { BoardConfig } from '../types';
import {
    DEFAULT_BOARD_CONFIG,
    PROFILE_LANES,
    isProtectedLane,
    PROTECTED_LANES,
} from '../types';
import { Uri, workspace } from 'vscode';

describe('BoardConfigStore', () => {
    describe('serialise / deserialise round-trip', () => {
        it('should round-trip default config', () => {
            const yaml = BoardConfigStore.serialise(DEFAULT_BOARD_CONFIG);
            const result = BoardConfigStore.deserialise(yaml);

            expect(result).toEqual(DEFAULT_BOARD_CONFIG);
        });

        it('should round-trip config with an explicit lite profile', () => {
            const config: BoardConfig = {
                profile: 'lite',
                profileVersion: 3,
                lanes: PROFILE_LANES.lite,
            };

            const yaml = BoardConfigStore.serialise(config);
            const result = BoardConfigStore.deserialise(yaml);

            expect(result.profile).toBe('lite');
            expect(result.lanes).toEqual(PROFILE_LANES.lite);
        });

        it('should produce valid YAML output', () => {
            const config: BoardConfig = {
                profile: 'lite',
                profileVersion: 3,
                lanes: PROFILE_LANES.lite,
            };

            const yaml = BoardConfigStore.serialise(config);

            expect(yaml).toContain('profile: lite');
        });

        it('should normalise legacy lane lists into a profile', () => {
            const config: BoardConfig = {
                profile: 'standard',
                profileVersion: 3,
                lanes: PROFILE_LANES.standard,
            };

            const yaml = BoardConfigStore.serialise(config);
            const result = BoardConfigStore.deserialise(yaml);

            expect(result.profile).toBe('standard');
            expect(result.lanes).toEqual(PROFILE_LANES.standard);
        });

        it('should drop the legacy blocked lane when reading old standard configs', () => {
            const yaml = [
                'lanes:',
                '  - backlog',
                '  - planning',
                '  - in-progress',
                '  - blocked',
                '  - review',
                '  - done',
            ].join('\n');

            const result = BoardConfigStore.deserialise(yaml);

            expect(result.profile).toBe('standard');
            expect(result.profileVersion).toBe(3);
            expect(result.lanes).toEqual(PROFILE_LANES.standard);
        });
    });

    describe('isProtectedLane', () => {
        it('should protect backlog lane', () => {
            expect(isProtectedLane('backlog')).toBe(true);
        });

        it('should protect done lane', () => {
            expect(isProtectedLane('done')).toBe(true);
        });

        it('should not protect other lanes', () => {
            expect(isProtectedLane('planning')).toBe(false);
            expect(isProtectedLane('in-progress')).toBe(false);
            expect(isProtectedLane('review')).toBe(false);
        });
    });

    describe('PROTECTED_LANES', () => {
        it('should contain backlog and done', () => {
            expect(PROTECTED_LANES).toContain('backlog');
            expect(PROTECTED_LANES).toContain('done');
        });

        it('should only contain lowercase values', () => {
            for (const name of PROTECTED_LANES) {
                expect(name).toBe(name.toLowerCase());
            }
        });
    });

    describe('ensureGitignore (via initialise)', () => {
        const workspaceUri = Uri.file('/test-workspace');

        beforeEach(() => {
            vi.restoreAllMocks();
        });

        it('should create .gitignore when it does not exist', async () => {
            // stat throws for .gitignore (doesn't exist), readFile throws for board.yaml (no config)
            vi.spyOn(workspace.fs, 'stat').mockRejectedValue(new Error('not found'));
            vi.spyOn(workspace.fs, 'readFile').mockRejectedValue(new Error('not found'));
            vi.spyOn(workspace.fs, 'createDirectory').mockResolvedValue(undefined);
            const writeSpy = vi.spyOn(workspace.fs, 'writeFile').mockResolvedValue(undefined);

            const store = new BoardConfigStore(workspaceUri);
            await store.initialise('standard');

            // Find the writeFile call for .gitignore
            const gitignoreCall = writeSpy.mock.calls.find(
                ([uri]) => (uri as any).fsPath.endsWith('.gitignore'),
            );
            expect(gitignoreCall).toBeDefined();
            const content = new TextDecoder().decode(gitignoreCall![1] as Uint8Array);
            expect(content).toContain('logs/');
        });

        it('should not overwrite existing .gitignore', async () => {
            // stat succeeds for .gitignore (exists)
            vi.spyOn(workspace.fs, 'stat').mockResolvedValue({ type: 1, ctime: 0, mtime: 0, size: 10 } as any);
            vi.spyOn(workspace.fs, 'readFile').mockResolvedValue(
                new TextEncoder().encode('lanes:\n  - todo\n  - done\n'),
            );
            vi.spyOn(workspace.fs, 'createDirectory').mockResolvedValue(undefined);
            const writeSpy = vi.spyOn(workspace.fs, 'writeFile').mockResolvedValue(undefined);

            const store = new BoardConfigStore(workspaceUri);
            await store.initialise('standard');

            const gitignoreCall = writeSpy.mock.calls.find(
                ([uri]) => (uri as any).fsPath.endsWith('.gitignore'),
            );
            expect(gitignoreCall).toBeUndefined();
        });
    });

    describe('read-only init', () => {
        const workspaceUri = Uri.file('/test-workspace');

        beforeEach(() => {
            vi.restoreAllMocks();
        });

        it('should not write any files when board.yaml does not exist', async () => {
            vi.spyOn(workspace.fs, 'readFile').mockRejectedValue(new Error('not found'));
            const writeSpy = vi.spyOn(workspace.fs, 'writeFile').mockResolvedValue(undefined);
            const dirSpy = vi.spyOn(workspace.fs, 'createDirectory').mockResolvedValue(undefined);

            const store = new BoardConfigStore(workspaceUri);
            await store.init();

            expect(writeSpy).not.toHaveBeenCalled();
            expect(dirSpy).not.toHaveBeenCalled();
        });

        it('should load config from existing board.yaml without writing', async () => {
            const configYaml = [
                'profile: lite',
                'profileVersion: 3',
                'lanes:',
                '  - backlog',
                '  - in-progress',
                '  - done',
                'enforcement:',
                '  mode: warn',
                '  overrides:',
                '    allowed: true',
                '    actors:',
                '      - human',
                '      - agent',
                '    requireReason: false',
                'reviewPolicy:',
                '  low:',
                '    planning: self-agent',
                '    implementation: self-agent',
                '  medium:',
                '    planning: self-agent',
                '    implementation: self-agent',
                '  high:',
                '    planning: independent-agent',
                '    implementation: independent-agent',
                '  critical:',
                '    planning: independent-agent',
                '    implementation: independent-agent+human',
                'worktreePolicy:',
                '  requiredForImplementation: false',
            ].join('\n');
            vi.spyOn(workspace.fs, 'readFile').mockResolvedValue(new TextEncoder().encode(configYaml));
            const writeSpy = vi.spyOn(workspace.fs, 'writeFile').mockResolvedValue(undefined);
            vi.spyOn(workspace.fs, 'createDirectory').mockResolvedValue(undefined);

            const store = new BoardConfigStore(workspaceUri);
            await store.init();

            expect(writeSpy).not.toHaveBeenCalled();
            expect(store.get().profile).toBe('lite');
            expect(store.get().lanes).toEqual(PROFILE_LANES.lite);
        });

        it('should persist a canonical board when loading a legacy config', async () => {
            const configYaml = 'lanes:\n  - todo\n  - doing\n  - done\n';
            vi.spyOn(workspace.fs, 'readFile').mockResolvedValue(new TextEncoder().encode(configYaml));
            const writeSpy = vi.spyOn(workspace.fs, 'writeFile').mockResolvedValue(undefined);
            vi.spyOn(workspace.fs, 'createDirectory').mockResolvedValue(undefined);

            const store = new BoardConfigStore(workspaceUri);
            await store.init();

            const boardYamlCall = writeSpy.mock.calls.find(
                ([uri]) => (uri as any).fsPath.endsWith('board.yaml'),
            );
            expect(boardYamlCall).toBeDefined();

            const saved = new TextDecoder().decode(boardYamlCall![1] as Uint8Array);
            expect(saved).toContain('profile: standard');
            expect(saved).toContain('  - backlog');
            expect(saved).toContain('  - planning');
            expect(saved).toContain('  - in-progress');
            expect(saved).toContain('  - review');
            expect(saved).toContain('  - done');
        });

        it('should stay with default config when board.yaml is absent', async () => {
            vi.spyOn(workspace.fs, 'readFile').mockRejectedValue(new Error('not found'));
            vi.spyOn(workspace.fs, 'writeFile').mockResolvedValue(undefined);
            vi.spyOn(workspace.fs, 'createDirectory').mockResolvedValue(undefined);

            const store = new BoardConfigStore(workspaceUri);
            await store.init();

            expect(store.get().lanes.length).toBeGreaterThan(0);
        });
    });

    describe('initialise', () => {
        const workspaceUri = Uri.file('/test-workspace');

        beforeEach(() => {
            vi.restoreAllMocks();
        });

        it('should create directories and write board.yaml when not present', async () => {
            vi.spyOn(workspace.fs, 'stat').mockRejectedValue(new Error('not found'));
            vi.spyOn(workspace.fs, 'readFile').mockRejectedValue(new Error('not found'));
            const dirSpy = vi.spyOn(workspace.fs, 'createDirectory').mockResolvedValue(undefined);
            const writeSpy = vi.spyOn(workspace.fs, 'writeFile').mockResolvedValue(undefined);

            const store = new BoardConfigStore(workspaceUri);
            await store.initialise('standard');

            expect(dirSpy).toHaveBeenCalled();
            const boardYamlCall = writeSpy.mock.calls.find(
                ([uri]) => (uri as any).fsPath.endsWith('board.yaml'),
            );
            expect(boardYamlCall).toBeDefined();
        });

        it('should write override values into a new board config', async () => {
            vi.spyOn(workspace.fs, 'stat').mockRejectedValue(new Error('not found'));
            vi.spyOn(workspace.fs, 'readFile').mockRejectedValue(new Error('not found'));
            vi.spyOn(workspace.fs, 'createDirectory').mockResolvedValue(undefined);
            const writeSpy = vi.spyOn(workspace.fs, 'writeFile').mockResolvedValue(undefined);

            const store = new BoardConfigStore(workspaceUri);
            await store.initialise('lite', {
                worktreePolicy: { requiredForImplementation: true },
            });

            const boardYamlCall = writeSpy.mock.calls.find(
                ([uri]) => (uri as any).fsPath.endsWith('board.yaml'),
            );
            expect(boardYamlCall).toBeDefined();

            const saved = new TextDecoder().decode(boardYamlCall![1] as Uint8Array);
            expect(saved).toContain('profile: lite');
            expect(saved).toContain('requiredForImplementation: true');
        });

        it('should not overwrite board.yaml when it already exists', async () => {
            vi.spyOn(workspace.fs, 'stat').mockResolvedValue({ type: 1, ctime: 0, mtime: 0, size: 10 } as any);
            vi.spyOn(workspace.fs, 'readFile').mockResolvedValue(
                new TextEncoder().encode(BoardConfigStore.serialise(DEFAULT_BOARD_CONFIG)),
            );
            vi.spyOn(workspace.fs, 'createDirectory').mockResolvedValue(undefined);
            const writeSpy = vi.spyOn(workspace.fs, 'writeFile').mockResolvedValue(undefined);

            const store = new BoardConfigStore(workspaceUri);
            await store.initialise('standard');

            const boardYamlCall = writeSpy.mock.calls.find(
                ([uri]) => (uri as any).fsPath.endsWith('board.yaml'),
            );
            expect(boardYamlCall).toBeUndefined();
        });

        it('should keep an existing board config authoritative even when overrides are passed', async () => {
            const existing = BoardConfigStore.serialise({
                ...DEFAULT_BOARD_CONFIG,
                profile: 'standard',
                lanes: PROFILE_LANES.standard,
                worktreePolicy: { requiredForImplementation: false },
            });

            vi.spyOn(workspace.fs, 'stat').mockResolvedValue({ type: 1, ctime: 0, mtime: 0, size: 10 } as any);
            vi.spyOn(workspace.fs, 'readFile').mockResolvedValue(new TextEncoder().encode(existing));
            vi.spyOn(workspace.fs, 'createDirectory').mockResolvedValue(undefined);
            const writeSpy = vi.spyOn(workspace.fs, 'writeFile').mockResolvedValue(undefined);

            const store = new BoardConfigStore(workspaceUri);
            await store.initialise('lite', {
                worktreePolicy: { requiredForImplementation: true },
            });

            const boardYamlCall = writeSpy.mock.calls.find(
                ([uri]) => (uri as any).fsPath.endsWith('board.yaml'),
            );
            expect(boardYamlCall).toBeUndefined();
            expect(store.get().profile).toBe('standard');
            expect(store.get().worktreePolicy).toEqual({ requiredForImplementation: false });
        });

        it('should rewrite existing legacy board.yaml during initialise', async () => {
            vi.spyOn(workspace.fs, 'stat').mockResolvedValue({ type: 1, ctime: 0, mtime: 0, size: 10 } as any);
            vi.spyOn(workspace.fs, 'readFile').mockResolvedValue(
                new TextEncoder().encode('lanes:\n  - todo\n  - doing\n  - done\n'),
            );
            vi.spyOn(workspace.fs, 'createDirectory').mockResolvedValue(undefined);
            const writeSpy = vi.spyOn(workspace.fs, 'writeFile').mockResolvedValue(undefined);

            const store = new BoardConfigStore(workspaceUri);
            await store.initialise('standard');

            const boardYamlCall = writeSpy.mock.calls.find(
                ([uri]) => (uri as any).fsPath.endsWith('board.yaml'),
            );
            expect(boardYamlCall).toBeDefined();

            const saved = new TextDecoder().decode(boardYamlCall![1] as Uint8Array);
            expect(saved).toContain('profile: standard');
            expect(saved).toContain('  - review');
        });
    });

    describe('users and labels registry', () => {
        it('should round-trip config with users and labels', () => {
            const config: BoardConfig = {
                profile: 'standard',
                profileVersion: 3,
                lanes: PROFILE_LANES.standard,
                users: ['alice', 'bob'],
                labels: ['backend', 'frontend'],
            };
            const yaml = BoardConfigStore.serialise(config);
            const result = BoardConfigStore.deserialise(yaml);
            expect(result.users).toEqual(['alice', 'bob']);
            expect(result.labels).toEqual(['backend', 'frontend']);
        });

        it('should handle missing users/labels gracefully', () => {
            const config: BoardConfig = {
                profile: 'standard',
                profileVersion: 3,
                lanes: PROFILE_LANES.standard,
            };
            const yaml = BoardConfigStore.serialise(config);
            const result = BoardConfigStore.deserialise(yaml);
            expect(result.users).toBeUndefined();
            expect(result.labels).toBeUndefined();
        });
    });

    describe('reconcileMetadata', () => {
        const workspaceUri = Uri.file('/test-workspace');

        beforeEach(() => {
            vi.restoreAllMocks();
        });

        it('should add unknown assignees from tasks', async () => {
            vi.spyOn(workspace.fs, 'stat').mockRejectedValue(new Error('not found'));
            vi.spyOn(workspace.fs, 'readFile').mockRejectedValue(new Error('not found'));
            vi.spyOn(workspace.fs, 'createDirectory').mockResolvedValue(undefined);
            vi.spyOn(workspace.fs, 'writeFile').mockResolvedValue(undefined);

            const store = new BoardConfigStore(workspaceUri);
            await store.init();

            await store.reconcileMetadata([
                { assignee: 'alice' },
                { assignee: 'bob' },
                { assignee: 'alice' },
            ]);

            const config = store.get();
            expect(config.users).toContain('alice');
            expect(config.users).toContain('bob');
        });

        it('should add unknown labels from tasks', async () => {
            vi.spyOn(workspace.fs, 'stat').mockRejectedValue(new Error('not found'));
            vi.spyOn(workspace.fs, 'readFile').mockRejectedValue(new Error('not found'));
            vi.spyOn(workspace.fs, 'createDirectory').mockResolvedValue(undefined);
            vi.spyOn(workspace.fs, 'writeFile').mockResolvedValue(undefined);

            const store = new BoardConfigStore(workspaceUri);
            await store.init();

            await store.reconcileMetadata([
                { labels: ['bug', 'frontend'] },
                { labels: ['bug', 'backend'] },
            ]);

            const config = store.get();
            expect(config.labels).toContain('bug');
            expect(config.labels).toContain('frontend');
            expect(config.labels).toContain('backend');
        });

        it('should not save if nothing new is found', async () => {
            vi.spyOn(workspace.fs, 'stat').mockRejectedValue(new Error('not found'));
            vi.spyOn(workspace.fs, 'readFile').mockRejectedValue(new Error('not found'));
            vi.spyOn(workspace.fs, 'createDirectory').mockResolvedValue(undefined);
            const writeSpy = vi.spyOn(workspace.fs, 'writeFile').mockResolvedValue(undefined);

            const store = new BoardConfigStore(workspaceUri);
            await store.init();

            const writeCountAfterInit = writeSpy.mock.calls.length;
            await store.reconcileMetadata([]);

            expect(writeSpy.mock.calls.length).toBe(writeCountAfterInit);
        });
    });
});
