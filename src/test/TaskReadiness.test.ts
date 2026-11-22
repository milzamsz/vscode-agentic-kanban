import { describe, it, expect } from 'vitest';
import {
    classifyTask,
    resolveTask,
    hasDependenciesResolved,
    isBlocked,
    findCycles,
    makeBoardSnapshot,
    getReadyTasks,
} from '../TaskReadiness';
import type { Task } from '../types';

describe('TaskReadiness', () => {
    const makeTask = (overrides: Partial<Task> = {}): Task => ({
        id: 'task_test_' + Math.random().toString(36).slice(2),
        title: 'Test Task',
        lane: 'backlog',
        created: '2026-03-08T10:00:00.000Z',
        updated: '2026-03-08T10:00:00.000Z',
        description: '',
        ...overrides,
    });

    describe('resolveTask', () => {
        it('should resolve a task by ID', () => {
            const tasks = [makeTask({ id: 'task_123', slug: 'my-task' })];
            expect(resolveTask('task_123', tasks)).toEqual(tasks[0]);
        });

        it('should resolve a task by slug', () => {
            const tasks = [makeTask({ id: 'task_123', slug: 'my-task' })];
            expect(resolveTask('my-task', tasks)).toEqual(tasks[0]);
        });

        it('should return undefined for unknown reference', () => {
            const tasks = [makeTask({ id: 'task_123', slug: 'my-task' })];
            expect(resolveTask('unknown', tasks)).toBeUndefined();
        });
    });

    describe('isBlocked', () => {
        it('should return true when task has blocked label', () => {
            const task = makeTask({ labels: ['blocked'] });
            expect(isBlocked(task)).toBe(true);
        });

        it('should return false when blockerResolved is set', () => {
            const task = makeTask({ labels: ['blocked'], blockerResolved: true });
            expect(isBlocked(task)).toBe(false);
        });

        it('should return false when no blocked label', () => {
            const task = makeTask({ labels: ['priority:high'] });
            expect(isBlocked(task)).toBe(false);
        });
    });

    describe('hasDependenciesResolved', () => {
        it('should return true when no dependencies', () => {
            const task = makeTask({ dependsOn: [] });
            const allTasks = [task];
            expect(hasDependenciesResolved(task, allTasks)).toBe(true);
        });

        it('should return true when all dependencies are done', () => {
            const dep1 = makeTask({ id: 'dep1', lane: 'done' });
            const dep2 = makeTask({ id: 'dep2', lane: 'done' });
            const task = makeTask({ dependsOn: ['dep1', 'dep2'] });
            const allTasks = [dep1, dep2, task];
            expect(hasDependenciesResolved(task, allTasks)).toBe(true);
        });

        it('should return true when all dependencies are archived', () => {
            const dep = makeTask({ id: 'dep1', lane: 'archive' });
            const task = makeTask({ dependsOn: ['dep1'] });
            expect(hasDependenciesResolved(task, [dep, task])).toBe(true);
        });

        it('should return false when a dependency is not done', () => {
            const dep = makeTask({ id: 'dep1', lane: 'in-progress' });
            const task = makeTask({ dependsOn: ['dep1'] });
            expect(hasDependenciesResolved(task, [dep, task])).toBe(false);
        });

        it('should return false when a dependency is unknown', () => {
            const task = makeTask({ dependsOn: ['unknown'] });
            expect(hasDependenciesResolved(task, [task])).toBe(false);
        });

        it('should resolve dependencies by slug', () => {
            const dep = makeTask({ id: 'id_123', slug: 'my-dep', lane: 'done' });
            const task = makeTask({ dependsOn: ['my-dep'] });
            expect(hasDependenciesResolved(task, [dep, task])).toBe(true);
        });
    });

    describe('classifyTask', () => {
        it('should classify done task as done', () => {
            const task = makeTask({ lane: 'done' });
            const result = classifyTask(task, [task]);
            expect(result.state).toBe('done');
        });

        it('should classify archived task as archive', () => {
            const task = makeTask({ lane: 'archive' });
            const result = classifyTask(task, [task]);
            expect(result.state).toBe('archive');
        });

        it('should classify blocked task as parked', () => {
            const task = makeTask({ lane: 'planning', labels: ['blocked'] });
            const result = classifyTask(task, [task]);
            expect(result.state).toBe('parked');
        });

        it('should classify task with unresolved dep as waiting', () => {
            const dep = makeTask({ id: 'dep1', lane: 'backlog' });
            const task = makeTask({ lane: 'planning', dependsOn: ['dep1'] });
            const result = classifyTask(task, [dep, task]);
            expect(result.state).toBe('waiting');
            expect(result.waitingOn).toContain('dep1');
        });

        it('should classify ready task as ready', () => {
            const dep = makeTask({ id: 'dep1', lane: 'done' });
            const task = makeTask({ lane: 'planning', dependsOn: ['dep1'] });
            const result = classifyTask(task, [dep, task]);
            expect(result.state).toBe('ready');
        });

        it('should classify task with unknown dep as waiting (not invalid)', () => {
            const task = makeTask({ lane: 'planning', dependsOn: ['unknown'] });
            const result = classifyTask(task, [task]);
            expect(result.state).toBe('waiting');
        });
    });

    describe('findCycles', () => {
        it('should return empty list for acyclic graph', () => {
            const t1 = makeTask({ id: 'task_1', dependsOn: [] });
            const t2 = makeTask({ id: 'task_2', dependsOn: ['task_1'] });
            const cycles = findCycles([t1, t2]);
            expect(cycles.length).toBe(0);
        });

        it('should detect self-cycle', () => {
            const t1 = makeTask({ id: 'task_1', dependsOn: ['task_1'] });
            const cycles = findCycles([t1]);
            expect(cycles.length).toBeGreaterThan(0);
            expect(cycles[0]).toContain('task_1');
        });

        it('should detect mutual cycle', () => {
            const t1 = makeTask({ id: 'task_1', dependsOn: ['task_2'] });
            const t2 = makeTask({ id: 'task_2', dependsOn: ['task_1'] });
            const cycles = findCycles([t1, t2]);
            expect(cycles.length).toBeGreaterThan(0);
        });

        it('should detect longer cycle', () => {
            const t1 = makeTask({ id: 'task_1', dependsOn: ['task_2'] });
            const t2 = makeTask({ id: 'task_2', dependsOn: ['task_3'] });
            const t3 = makeTask({ id: 'task_3', dependsOn: ['task_1'] });
            const cycles = findCycles([t1, t2, t3]);
            expect(cycles.length).toBeGreaterThan(0);
        });
    });

    describe('makeBoardSnapshot', () => {
        it('should create a deterministic resolver string', () => {
            const t1 = makeTask({ id: 'task_1', lane: 'backlog' });
            const t2 = makeTask({ id: 'task_2', lane: 'planning', dependsOn: ['task_1'] });
            const snapshot1 = makeBoardSnapshot([t1, t2]);
            const snapshot2 = makeBoardSnapshot([t2, t1]); // Different order
            // Same content, different order, should have same resolver (sorted deterministically).
            expect(snapshot1.resolver).toBe(snapshot2.resolver);
        });

        it('should capture spec folders', () => {
            const t1 = makeTask({ spec: '.agentkanban/specs/auth/spec.md' });
            const t2 = makeTask({ change: '.agentkanban/changes/auth-flow' });
            const snapshot = makeBoardSnapshot([t1, t2]);
            expect(snapshot.specFolders.has('.agentkanban/specs/auth/spec.md')).toBe(true);
            expect(snapshot.specFolders.has('.agentkanban/changes/auth-flow')).toBe(true);
        });
    });

    describe('getReadyTasks', () => {
        it('should return only ready tasks', () => {
            const dep = makeTask({ id: 'dep', lane: 'done' });
            const ready = makeTask({ lane: 'planning', dependsOn: ['dep'] });
            const blocked = makeTask({ lane: 'backlog', labels: ['blocked'] });
            const waiting = makeTask({ lane: 'planning', dependsOn: ['unknown'] });

            const result = getReadyTasks([dep, ready, blocked, waiting]);
            expect(result).toHaveLength(1);
            expect(result[0]).toEqual(ready);
        });

        it('should filter by lane', () => {
            const dep = makeTask({ id: 'dep', lane: 'done' });
            const readyInPlanning = makeTask({ id: 'ready_planning', lane: 'planning', dependsOn: ['dep'] });
            const readyInBacklog = makeTask({ id: 'ready_backlog', lane: 'backlog', dependsOn: ['dep'] });

            const result = getReadyTasks([dep, readyInPlanning, readyInBacklog], { lane: 'planning' });
            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('ready_planning');
        });

        it('should filter by label', () => {
            const dep = makeTask({ id: 'dep', lane: 'done' });
            const readyWithLabel = makeTask({ lane: 'planning', dependsOn: ['dep'], labels: ['priority:high'] });
            const readyWithoutLabel = makeTask({ lane: 'planning', dependsOn: ['dep'], labels: ['feature'] });

            const result = getReadyTasks([dep, readyWithLabel, readyWithoutLabel], { label: 'priority:high' });
            expect(result).toHaveLength(1);
            expect(result[0]).toEqual(readyWithLabel);
        });

        it('should filter by priority', () => {
            const dep = makeTask({ id: 'dep', lane: 'done' });
            const critical = makeTask({ lane: 'planning', dependsOn: ['dep'], priority: 'critical' });
            const high = makeTask({ lane: 'planning', dependsOn: ['dep'], priority: 'high' });

            const result = getReadyTasks([dep, critical, high], { priority: 'critical' });
            expect(result).toHaveLength(1);
            expect(result[0]).toEqual(critical);
        });
    });
});
