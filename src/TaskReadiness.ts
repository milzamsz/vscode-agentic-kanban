"use strict";

import type { Task } from './types';

/* ========================================================================== */
/* Task readiness and board classification                                          */
/* ========================================================================== */

/** Stable board snapshot, used for progress and stall detection. */
export interface BoardSnapshot {
    tasks: readonly Task[];
    specFolders: Set<string>;
    resolver: string;
}

/** Per-task classification used by readiness and orchestrators. */
export type TaskState =
    | 'ready'
    | 'waiting'
    | 'parked'
    | 'invalid'
    | 'done'
    | 'archive';

export interface TaskClassification {
    state: TaskState;
    reason: string;
    waitingOn?: string[];
    blockedBy?: string[];
}

/** ============================================================================
 * Public API - read-only, pure functions – no side-effects, no I/O.
 */

/** Resolve a task reference (id or slug) to a task in the list. */
export function resolveTask(ref: string, tasks: readonly Task[]): Task | undefined {
    const possibleById = tasks.find((t) => t.id === ref);
    if (possibleById) return possibleById;

    const possibleBySlug = tasks.find((t) => t.slug === ref);
    return possibleBySlug;
}

/** Determine the effective lane for a task: 'done' for archived rollups. */
export function effectiveLane(task: Task): 'done' | Task['lane'] {
    return task.lane === 'archive' ? 'done' : task.lane;
}

/** Is a task truly externally blocked? */
export function isBlocked(task: Task): boolean {
    // The bare 'blocked' label is preserved for genuine external/human decisions.
    // If the task has a blocker resolved mark, unblock it.
    if (task.blockerResolved) {
        return false;
    }
    return !!(task.labels && task.labels.includes('blocked'));
}

/** Does the task have all required dependencies satisfied? */
export function hasDependenciesResolved(task: Task, allTasks: readonly Task[]): boolean {
    if (!task.dependsOn || task.dependsOn.length === 0) {
        return true;
    }

    for (const depRef of task.dependsOn) {
        const dep = resolveTask(depRef, allTasks);
        if (!dep) {
            // Unknown dependency is treated as unresolved (waiting), not invalid.
            // It can become resolved when the missing dependency is created.
            return false;
        }

        const depLane = effectiveLane(dep);
        if (depLane !== 'done' && depLane !== 'archive') {
            return false;
        }
    }

    return true;
}

/** Classify a single task against the current board state. */
export function classifyTask(task: Task, allTasks: readonly Task[]): TaskClassification {
    // Special cases for terminal lanes.
    const lane = task.lane as TaskState;
    if (lane === 'done' || lane === 'archive') {
        return { state: lane, reason: lane === 'done' ? 'Task complete' : 'Task archived' };
    }

    const blocked = isBlocked(task);

    if (blocked) {
        const blockers = allTasks.filter(isBlocked);
        const blockReasons = blockers.map((t) => t.title);
        return {
            state: 'parked',
            reason: `External or human blocker: ${blockReasons.join(', ')}`,
            blockedBy: task.labels?.filter((label) => label.startsWith('blocked-by:')) || [],
        };
    }

    const deps = task.dependsOn?.filter((d) => d.trim() !== '') || [];
    if (!hasDependenciesResolved(task, allTasks)) {
        const waitingFor = deps
            .map((d) => resolveTask(d, allTasks))
            .filter((dep) => dep && effectiveLane(dep) !== 'done' && effectiveLane(dep) !== 'archive')
            .map((dep) => dep!.title);
        return {
            state: 'waiting',
            reason: `Dependencies not done: ${waitingFor.join(', ')}`,
            waitingOn: deps,
        };
    }

    // No blockers and no unresolved dependencies.
    return { state: 'ready', reason: 'All dependencies done and no blocker' };
}

/** Validate the dependsOn graph: detect cycles. */
export function findCycles(tasks: readonly Task[]): string[][] {
    const visited = new Set<string>();
    const stack = new Set<string>();
    const cycles: string[][] = [];

    // Create lookup map for efficiency.
    const taskById = new Map(tasks.map((t) => [t.id, t]));

    function dfs(taskId: string, path: string[]): void {
        if (stack.has(taskId)) {
            const cycleStartIndex = path.indexOf(taskId);
            const cycle = path.slice(cycleStartIndex).concat(taskId);
            cycles.push(cycle);
            return;
        }

        if (visited.has(taskId)) {
            return;
        }

        visited.add(taskId);
        stack.add(taskId);
        path.push(taskId);

        const task = taskById.get(taskId);
        if (!task || !task.dependsOn) {
            stack.delete(taskId);
            path.pop();
            return;
        }

        for (const depId of task.dependsOn) {
            dfs(depId, path.slice()); // Use slice to avoid mutating current path.
        }

        stack.delete(taskId);
        path.pop();
    }

    for (const task of tasks) {
        if (!visited.has(task.id)) {
            dfs(task.id, []);
        }
    }

    return cycles;
}

/** Build a stable snapshot of the current board state. */
export function makeBoardSnapshot(tasks: readonly Task[]): BoardSnapshot {
    const specFolders = new Set(
        tasks.filter((t) => t.spec || t.change).map((t) => t.spec ?? t.change ?? ''),
    );

    const sorted = tasks.slice().sort((a, b) => {
        // Preserve deterministic ordering.
        if (a.created !== b.created) {
            return a.created.localeCompare(b.created);
        }
        if (a.id !== b.id) {
            return a.id.localeCompare(b.id);
        }
        return 0;
    });

    return {
        tasks: sorted,
        specFolders,
        resolver: JSON.stringify(sorted.map((t) => ({ id: t.id, lane: t.lane, dependsOn: t.dependsOn, labels: t.labels }))),
    };
}

/** Test helper – no exported functions below (pure logic). */
/** ============================================================================
 * Ready task selection utilities
 */

export interface ReadyTaskFilter {
    lane?: string;
    label?: string;
    priority?: string;
    extraPredicate?(task: Task, all: Task[]): boolean;
}

/** Get all ready tasks matching readiness and optional filters. */
export function getReadyTasks(tasks: Task[], filter?: ReadyTaskFilter): Task[] {
    return tasks.filter((task) => {
        if (filter?.lane && task.lane !== filter.lane) return false;
        if (filter?.label && (!task.labels?.includes(filter.label))) return false;
        if (filter?.priority && task.priority !== filter.priority) return false;
        if (filter?.extraPredicate && !filter.extraPredicate(task, tasks)) return false;

        const classification = classifyTask(task, tasks);
        return classification.state === 'ready';
    });
}