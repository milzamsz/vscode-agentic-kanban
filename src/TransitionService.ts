import type { BoardConfig, Task } from './types';
import { getFirstLane, isDoneLane } from './types';

export interface TransitionRequest {
    task: Task;
    toLane: string;
}

export interface TransitionResult {
    ok: boolean;
    warnings: string[];
    errors: string[];
}

const LITE_TRANSITIONS: Record<string, string[]> = {
    backlog: ['in-progress'],
    'in-progress': ['backlog', 'done'],
    done: ['in-progress'],
};

const STANDARD_TRANSITIONS: Record<string, string[]> = {
    backlog: ['planning'],
    planning: ['backlog', 'in-progress'],
    'in-progress': ['planning', 'review'],
    review: ['in-progress', 'done'],
    done: ['in-progress'],
};

export class TransitionService {
    validate(request: TransitionRequest, config: BoardConfig): TransitionResult {
        const { task, toLane } = request;
        const warnings: string[] = [];
        const errors: string[] = [];
        const fromLane = task.lane;

        if (fromLane === toLane) {
            return { ok: true, warnings, errors };
        }

        const allowed = this.getAllowedTargets(fromLane, config);
        if (!allowed.includes(toLane)) {
            errors.push(`Cannot move from ${fromLane} to ${toLane} in the ${config.profile} profile.`);
        }

        if (toLane === 'in-progress' && config.worktreePolicy?.requiredForImplementation && !task.worktree) {
            errors.push('This profile requires a worktree before a task can enter IN PROGRESS.');
        }

        if (config.profile === 'standard' && toLane === 'review' && !task.description.trim()) {
            warnings.push('Task has no description yet. Review will be easier once scope is written down.');
        }

        if (config.profile === 'standard' && toLane === 'done' && !task.worktree && !isDoneLane(fromLane)) {
            warnings.push('Task reached DONE without worktree metadata. Confirm the implementation audit trail is still sufficient.');
        }

        return {
            ok: errors.length === 0,
            warnings,
            errors,
        };
    }

    getAllowedTargets(fromLane: string, config: BoardConfig): string[] {
        if (config.profile === 'lite') {
            return LITE_TRANSITIONS[fromLane] ?? [getFirstLane(config.profile)];
        }
        return STANDARD_TRANSITIONS[fromLane] ?? [getFirstLane(config.profile)];
    }
}
