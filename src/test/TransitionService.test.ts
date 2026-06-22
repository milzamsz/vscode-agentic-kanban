import { describe, expect, it } from 'vitest';
import { TransitionService } from '../TransitionService';
import type { BoardConfig, Task } from '../types';
import { DEFAULT_ENFORCEMENT, PROFILE_LANES } from '../types';

const service = new TransitionService();

const standardConfig: BoardConfig = {
    profile: 'standard',
    profileVersion: 3,
    lanes: PROFILE_LANES.standard,
    enforcement: DEFAULT_ENFORCEMENT.standard,
    worktreePolicy: { requiredForImplementation: true },
};

function makeTask(overrides: Partial<Task>): Task {
    return {
        id: 'task_1',
        title: 'Test Task',
        lane: 'planning',
        created: '2026-06-15T00:00:00.000Z',
        updated: '2026-06-15T00:00:00.000Z',
        description: 'Task scope',
        ...overrides,
    };
}

describe('TransitionService', () => {
    it('allows planning to move into in-progress', () => {
        const result = service.validate({
            task: makeTask({ lane: 'planning' }),
            toLane: 'in-progress',
        }, standardConfig);

        expect(result.ok).toBe(false);
        expect(result.errors).toContain('This profile requires a worktree before a task can enter IN PROGRESS.');
    });

    it('requires a worktree before entering in-progress in standard profile', () => {
        const result = service.validate({
            task: makeTask({ lane: 'planning', worktree: undefined }),
            toLane: 'in-progress',
        }, standardConfig);

        expect(result.ok).toBe(false);
        expect(result.errors).toContain('This profile requires a worktree before a task can enter IN PROGRESS.');
    });

    it('prevents planning from going straight to review', () => {
        const result = service.validate({
            task: makeTask({ lane: 'planning', worktree: { branch: 'agentic/task', path: '/tmp/task', created: '2026-06-15T01:00:00.000Z' } }),
            toLane: 'review',
        }, standardConfig);

        expect(result.ok).toBe(false);
        expect(result.errors.some((msg) => msg.includes('Cannot move from planning to review'))).toBe(true);
    });

    it('allows implementation review to move to done', () => {
        const result = service.validate({
            task: makeTask({
                lane: 'review',
                worktree: { branch: 'agentic/task', path: '/tmp/task', created: '2026-06-15T01:00:00.000Z' },
                evidence: {
                    lint: { ran: true, passed: true, output: 'OK' },
                    test: { ran: true, passed: true, output: 'OK' },
                    build: { ran: true, passed: true, output: 'OK' },
                    behavior: { ran: true, passed: true, output: 'Verified' },
                },
            }),
            toLane: 'done',
        }, standardConfig);

        expect(result.ok).toBe(true);
    });

    it('allows in-progress to move back to planning', () => {
        const result = service.validate({
            task: makeTask({ lane: 'in-progress', worktree: { branch: 'agentic/task', path: '/tmp/task', created: '2026-06-15T01:00:00.000Z' } }),
            toLane: 'planning',
        }, standardConfig);

        expect(result.ok).toBe(true);
    });

    it('returns blocked reasons in strict mode for illegal transitions', () => {
        const result = service.validate({
            task: makeTask({ lane: 'planning', worktree: undefined }),
            toLane: 'review',
        }, standardConfig);

        expect(result.ok).toBe(false);
        expect(result.blockedReasons).toEqual([
            'Cannot move from planning to review in the standard profile.',
        ]);
    });

    it('downgrades blocking transition problems to warnings in warn mode', () => {
        const result = service.validate({
            task: makeTask({ lane: 'planning', worktree: undefined }),
            toLane: 'review',
        }, {
            ...standardConfig,
            enforcement: {
                ...DEFAULT_ENFORCEMENT.standard,
                mode: 'warn',
            },
        });

        expect(result.ok).toBe(true);
        expect(result.errors).toEqual([]);
        expect(result.warnings).toContain('Cannot move from planning to review in the standard profile.');
        expect(result.blockedReasons).toEqual([]);
    });

    it('requires evidence before moving to done in standard profile', () => {
        const result = service.validate({
            task: makeTask({
                lane: 'review',
                worktree: { branch: 'agentic/task', path: '/tmp/task', created: '2026-06-15T01:00:00.000Z' },
                evidence: undefined, // No evidence
            }),
            toLane: 'done',
        }, standardConfig);

        expect(result.ok).toBe(false);
        expect(result.errors.some(msg => msg.includes('No evidence recorded'))).toBe(true);
    });

    it('requires evidence before moving to done in lite profile', () => {
        const liteConfig: BoardConfig = {
            profile: 'lite',
            profileVersion: 3,
            lanes: PROFILE_LANES.lite,
            enforcement: { mode: 'strict', overrides: { allowed: true, actors: ['agent'], requireReason: false } },
        };

        const result = service.validate({
            task: makeTask({
                lane: 'in-progress',
                evidence: undefined, // No evidence
            }),
            toLane: 'done',
        }, liteConfig);

        expect(result.ok).toBe(false);
        expect(result.errors.some(msg => msg.includes('No evidence recorded'))).toBe(true);
    });

    it('downgrades worktree-required checks to warnings in warn mode', () => {
        const result = service.validate({
            task: makeTask({ lane: 'planning', worktree: undefined }),
            toLane: 'in-progress',
        }, {
            ...standardConfig,
            enforcement: {
                ...DEFAULT_ENFORCEMENT.standard,
                mode: 'warn',
            },
        });

        expect(result.ok).toBe(true);
        expect(result.warnings).toContain('This profile requires a worktree before a task can enter IN PROGRESS.');
        expect(result.blockedReasons).toEqual([]);
    });

    it('requires a checklist before planning can transition to in-progress in standard profile', () => {
        const result = service.validate({
            task: makeTask({
                lane: 'planning',
                worktree: { branch: 'agentic/task', path: '/tmp/task', created: '2026-06-15T01:00:00.000Z' },
                checklist: undefined,
            }),
            toLane: 'in-progress',
        }, standardConfig);

        expect(result.ok).toBe(false);
        expect(result.errors).toContain('This profile requires a checklist with at least one item before entering IN PROGRESS.');
    });

    it('requires a checklist with at least one item before planning can transition to in-progress', () => {
        const result = service.validate({
            task: makeTask({
                lane: 'planning',
                worktree: { branch: 'agentic/task', path: '/tmp/task', created: '2026-06-15T01:00:00.000Z' },
                checklist: { done: 0, total: 0 },
            }),
            toLane: 'in-progress',
        }, standardConfig);

        expect(result.ok).toBe(false);
        expect(result.errors).toContain('This profile requires a checklist with at least one item before entering IN PROGRESS.');
    });

    it('requires spec and change files if task has spec-driven properties', () => {
        const result = service.validate({
            task: makeTask({
                lane: 'planning',
                worktree: { branch: 'agentic/task', path: '/tmp/task', created: '2026-06-15T01:00:00.000Z' },
                checklist: { done: 0, total: 2 },
                spec: '.agentkanban/specs/auth/spec.md',
                specMissing: true,
                change: '.agentkanban/changes/task-1',
                changeMissing: true,
            }),
            toLane: 'in-progress',
        }, standardConfig);

        expect(result.ok).toBe(false);
        expect(result.errors).toContain('This task is spec-driven and requires a valid spec file before entering IN PROGRESS.');
        expect(result.errors).toContain('This task is spec-driven and requires a valid change folder before entering IN PROGRESS.');
    });

    it('requires spec and change files if task has spec-driven label', () => {
        const result = service.validate({
            task: makeTask({
                lane: 'planning',
                worktree: { branch: 'agentic/task', path: '/tmp/task', created: '2026-06-15T01:00:00.000Z' },
                checklist: { done: 0, total: 2 },
                labels: ['spec-driven'],
                spec: undefined,
                change: undefined,
            }),
            toLane: 'in-progress',
        }, standardConfig);

        expect(result.ok).toBe(false);
        expect(result.errors).toContain('This task is spec-driven and requires a valid spec file before entering IN PROGRESS.');
        expect(result.errors).toContain('This task is spec-driven and requires a valid change folder before entering IN PROGRESS.');
    });

    it('allows planning to transition to in-progress if checklist is present and spec-driven details are valid', () => {
        const result = service.validate({
            task: makeTask({
                lane: 'planning',
                worktree: { branch: 'agentic/task', path: '/tmp/task', created: '2026-06-15T01:00:00.000Z' },
                checklist: { done: 0, total: 2 },
                spec: '.agentkanban/specs/auth/spec.md',
                specMissing: false,
                change: '.agentkanban/changes/task-1',
                changeMissing: false,
            }),
            toLane: 'in-progress',
        }, standardConfig);

        expect(result.ok).toBe(true);
        expect(result.errors).toEqual([]);
    });

    it('respects custom transition policies configured in board config', () => {
        const customConfig: BoardConfig = {
            profile: 'standard',
            profileVersion: 3,
            lanes: PROFILE_LANES.standard,
            policies: {
                transition: {
                    requireChecklistForInProgress: false,
                    requireSpecForInProgress: false,
                    requireWorktreeForInProgress: false,
                },
            },
        };

        const result = service.validate({
            task: makeTask({
                lane: 'planning',
                worktree: undefined,
                checklist: undefined,
                labels: ['spec-driven'],
                spec: undefined,
                change: undefined,
            }),
            toLane: 'in-progress',
        }, customConfig);

        expect(result.ok).toBe(true);
        expect(result.errors).toEqual([]);
    });
});
