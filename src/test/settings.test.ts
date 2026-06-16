import { describe, expect, it, vi, beforeEach } from 'vitest';
import { workspace } from 'vscode';
import {
    countTasksOutsideProfileLanes,
    getDefaultProfile,
    isEnforceWorktrees,
    resolveEnforcement,
    resolveWorktreePolicy,
} from '../settings';
import type { Task } from '../types';
import { DEFAULT_ENFORCEMENT } from '../types';

describe('settings', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('reads the default profile from configuration', () => {
        vi.spyOn(workspace, 'getConfiguration').mockReturnValue({
            get: (key: string, defaultValue?: unknown) => key === 'defaultProfile' ? 'lite' : defaultValue,
        } as any);

        expect(getDefaultProfile()).toBe('lite');
    });

    it('falls back to standard when the configured profile is invalid', () => {
        vi.spyOn(workspace, 'getConfiguration').mockReturnValue({
            get: (key: string, defaultValue?: unknown) => key === 'defaultProfile' ? 'custom' : defaultValue,
        } as any);

        expect(getDefaultProfile()).toBe('standard');
    });

    it('maps profile-default worktree setting to undefined', () => {
        vi.spyOn(workspace, 'getConfiguration').mockReturnValue({
            get: (key: string, defaultValue?: unknown) => key === 'worktreeRequiredForImplementation' ? 'profile-default' : defaultValue,
        } as any);

        expect(resolveWorktreePolicy('standard')).toBeUndefined();
    });

    it('maps required worktree setting to a required policy', () => {
        vi.spyOn(workspace, 'getConfiguration').mockReturnValue({
            get: (key: string, defaultValue?: unknown) => key === 'worktreeRequiredForImplementation' ? 'required' : defaultValue,
        } as any);

        expect(resolveWorktreePolicy('lite')).toEqual({ requiredForImplementation: true });
    });

    it('maps optional worktree setting to an optional policy', () => {
        vi.spyOn(workspace, 'getConfiguration').mockReturnValue({
            get: (key: string, defaultValue?: unknown) => key === 'worktreeRequiredForImplementation' ? 'optional' : defaultValue,
        } as any);

        expect(resolveWorktreePolicy('standard')).toEqual({ requiredForImplementation: false });
    });

    it('reads enforceWorktrees from configuration', () => {
        vi.spyOn(workspace, 'getConfiguration').mockReturnValue({
            get: (key: string, defaultValue?: unknown) => key === 'enforceWorktrees' ? true : defaultValue,
        } as any);

        expect(isEnforceWorktrees()).toBe(true);
    });

    it('maps profile-default enforcement setting to undefined', () => {
        vi.spyOn(workspace, 'getConfiguration').mockReturnValue({
            get: (key: string, defaultValue?: unknown) => key === 'enforcementMode' ? 'profile-default' : defaultValue,
        } as any);

        expect(resolveEnforcement('standard')).toBeUndefined();
    });

    it('maps strict enforcement setting to a strict policy with profile overrides', () => {
        vi.spyOn(workspace, 'getConfiguration').mockReturnValue({
            get: (key: string, defaultValue?: unknown) => key === 'enforcementMode' ? 'strict' : defaultValue,
        } as any);

        expect(resolveEnforcement('lite')).toEqual({
            mode: 'strict',
            overrides: DEFAULT_ENFORCEMENT.lite.overrides,
        });
    });

    it('maps warn enforcement setting to a warn policy with profile overrides', () => {
        vi.spyOn(workspace, 'getConfiguration').mockReturnValue({
            get: (key: string, defaultValue?: unknown) => key === 'enforcementMode' ? 'warn' : defaultValue,
        } as any);

        expect(resolveEnforcement('standard')).toEqual({
            mode: 'warn',
            overrides: DEFAULT_ENFORCEMENT.standard.overrides,
        });
    });

    it('counts tasks in lanes missing from the target profile', () => {
        const tasks: Task[] = [
            {
                id: 'task_1',
                title: 'Planning task',
                lane: 'planning',
                created: '',
                updated: '',
                description: '',
            },
            {
                id: 'task_2',
                title: 'Review task',
                lane: 'review',
                created: '',
                updated: '',
                description: '',
            },
            {
                id: 'task_3',
                title: 'Backlog task',
                lane: 'backlog',
                created: '',
                updated: '',
                description: '',
            },
        ];

        expect(countTasksOutsideProfileLanes(tasks, 'lite')).toEqual([
            { lane: 'planning', count: 1 },
            { lane: 'review', count: 1 },
        ]);
    });
});
