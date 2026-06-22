import * as vscode from 'vscode';
import type { TaskStore } from './TaskStore';
import type { BoardConfigStore } from './BoardConfigStore';
import type { WorktreeService } from './WorktreeService';
import type { Task } from './types';

export interface DiagnosticIssue {
    severity: 'error' | 'warning' | 'info';
    category: 'LANE' | 'BLOCKER' | 'CYCLE' | 'WORKTREE' | 'DRIFT' | 'ORPHAN';
    taskId: string;
    message: string;
    detail?: string;
}

export class WorkflowDoctor {
    constructor(
        private readonly taskStore: TaskStore,
        private readonly boardConfigStore: BoardConfigStore,
        private readonly workspaceUri: vscode.Uri,
        private readonly worktreeService?: WorktreeService,
    ) {}

    async diagnose(): Promise<DiagnosticIssue[]> {
        const issues: DiagnosticIssue[] = [];
        const config = this.boardConfigStore.get();
        const allTasks = this.taskStore.getAll();

        // Build slug → task id map for dependsOn resolution
        const slugToId = new Map<string, string>();
        for (const task of allTasks) {
            if (task.slug) slugToId.set(task.slug, task.id);
            // Also index by id for direct id references
            slugToId.set(task.id, task.id);
        }
        const allSlugs = new Set(slugToId.keys());

        // 1. Invalid lane assignments
        issues.push(...this.checkInvalidLanes(allTasks, config));

        // 2. Stale blockers
        issues.push(...this.checkStaleBlockers(allTasks));

        // 3. Dependency cycles
        issues.push(...this.checkDependencyCycles(allTasks, slugToId));

        // 4. Stale worktree metadata
        issues.push(...(await this.checkStaleWorktrees(allTasks)));

        // 5. Spec/change drift
        issues.push(...this.checkSpecDrift(allTasks));

        // 6. Orphaned dependencies
        issues.push(...this.checkOrphanedDeps(allTasks, allSlugs));

        return issues;
    }

    private checkInvalidLanes(tasks: Task[], config: any): DiagnosticIssue[] {
        const issues: DiagnosticIssue[] = [];
        const laneSet = new Set(config.lanes);

        for (const task of tasks) {
            if (!laneSet.has(task.lane)) {
                issues.push({
                    severity: 'error',
                    category: 'LANE',
                    taskId: task.id,
                    message: `Task is in lane "${task.lane}" but this lane doesn't exist in the current profile.`,
                    detail: `Available lanes: ${Array.from(laneSet).join(', ')}`,
                });
            }
        }

        return issues;
    }

    private checkStaleBlockers(tasks: Task[]): DiagnosticIssue[] {
        const issues: DiagnosticIssue[] = [];

        for (const task of tasks) {
            if (task.lane === 'done' && task.labels?.some(l => l.startsWith('blocked-by:') || l === 'blocked')) {
                issues.push({
                    severity: 'warning',
                    category: 'BLOCKER',
                    taskId: task.id,
                    message: `Task is in DONE lane but still has blocker labels.`, 
                    detail: `Labels: ${task.labels?.filter(l => l.startsWith('blocked-by:') || l === 'blocked').join(', ')}`,
                });
            }
        }

        return issues;
    }

    private checkDependencyCycles(tasks: Task[], slugToId: Map<string, string>): DiagnosticIssue[] {
        const issues: DiagnosticIssue[] = [];
        const adjacencyList: Map<string, string[]> = new Map();

        // Build adjacency list: resolve dependsOn slugs to task ids
        for (const task of tasks) {
            if (!task.dependsOn || task.dependsOn.length === 0) {
                adjacencyList.set(task.id, []);
                continue;
            }
            const deps = task.dependsOn
                .map(dep => slugToId.get(dep))
                .filter((id): id is string => id !== undefined && id !== task.id);
            adjacencyList.set(task.id, deps);
        }

        const visited = new Set<string>();
        const recursionStack = new Set<string>();

        const dfs = (node: string, path: string[]): boolean => {
            if (recursionStack.has(node)) {
                const cycleStart = path.indexOf(node);
                const cycle = path.slice(cycleStart, path.length - 1);
                issues.push({
                    severity: 'error',
                    category: 'CYCLE',
                    taskId: node,
                    message: `Dependency cycle detected: ${cycle.join(' -> ')} -> ${node}`,
                    detail: "Cycle would prevent progression of these tasks.",
                });
                return true;
            }
            if (visited.has(node)) {
                return false;
            }

            visited.add(node);
            recursionStack.add(node);
            path.push(node);

            const neighbors = adjacencyList.get(node) || [];
            for (const neighbor of neighbors) {
                dfs(neighbor, [...path]);
            }

            recursionStack.delete(node);
            path.pop();
            return false;
        };

        for (const task of tasks) {
            if (!visited.has(task.id)) {
                dfs(task.id, []);
            }
        }

        return issues;
    }

    private async checkStaleWorktrees(tasks: Task[]): Promise<DiagnosticIssue[]> {
        const issues: DiagnosticIssue[] = [];

        for (const task of tasks) {
            if (task.worktree?.path) {
                try {
                    await vscode.workspace.fs.stat(vscode.Uri.file(task.worktree.path));
                } catch {
                    issues.push({
                        severity: 'warning',
                        category: 'WORKTREE',
                        taskId: task.id,
                        message: `Worktree path no longer exists: ${task.worktree.path}`, 
                        detail: `Task may be stuck or orphaned.`,
                    });
                }
            }
        }

        return issues;
    }

    private checkSpecDrift(tasks: Task[]): DiagnosticIssue[] {
        const issues: DiagnosticIssue[] = [];

        for (const task of tasks) {
            if (task.specMissing) {
                issues.push({
                    severity: 'error',
                    category: 'DRIFT',
                    taskId: task.id,
                    message: `Spec file is missing.`, 
                    detail: "Task is spec-driven but the capability spec file is not accessible.",
                });
            }
            if (task.changeMissing) {
                issues.push({
                    severity: 'error',
                    category: 'DRIFT',
                    taskId: task.id,
                    message: `Change folder is missing.`, 
                    detail: "Task's change artifacts are not accessible.",
                });
            }
        }

        return issues;
    }

    private checkOrphanedDeps(tasks: Task[], allSlugs: Set<string>): DiagnosticIssue[] {
        const issues: DiagnosticIssue[] = [];

        for (const task of tasks) {
            if (task.dependsOn) {
                for (const dep of task.dependsOn) {
                    if (!allSlugs.has(dep)) {
                        issues.push({
                            severity: 'warning',
                            category: 'ORPHAN',
                            taskId: task.id,
                            message: `Depends on non-existent task slug: ${dep}`, 
                            detail: "This dependency can never be resolved.",
                        });
                    }
                }
            }
        }

        return issues;
    }
}