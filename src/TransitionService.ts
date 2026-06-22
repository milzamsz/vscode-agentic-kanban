import type { BoardConfig, Task } from './types';
import { getFirstLane, isDoneLane } from './types';
import { TaskEvidenceValidator } from './TaskEvidenceValidator';

export interface TransitionRequest {
    task: Task;
    toLane: string;
}

export interface TransitionResult {
    ok: boolean;
    warnings: string[];
    errors: string[];
    blockedReasons: string[];
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
        const blockedReasons: string[] = [];
        const fromLane = task.lane;
        const enforcementMode = config.enforcement?.mode ?? 'strict';

        const addBlockingRule = (message: string) => {
            if (enforcementMode === 'warn') {
                warnings.push(message);
                return;
            }
            errors.push(message);
            blockedReasons.push(message);
        };

        if (fromLane === toLane) {
            return { ok: true, warnings, errors, blockedReasons };
        }

        const allowed = this.getAllowedTargets(fromLane, config);
        if (!allowed.includes(toLane)) {
            addBlockingRule(`Cannot move from ${fromLane} to ${toLane} in the ${config.profile} profile.`);
        }

        const transPolicies = config.policies?.transition;
        const reqChecklist = transPolicies?.requireChecklistForInProgress ?? (config.profile === 'standard');
        const reqSpec = transPolicies?.requireSpecForInProgress ?? (config.profile === 'standard');
        const reqDescription = transPolicies?.requireDescriptionForReview ?? (config.profile === 'standard');
        const reqWorktree = transPolicies?.requireWorktreeForInProgress ?? (config.worktreePolicy?.requiredForImplementation ?? (config.profile === 'standard'));

        if (toLane === 'in-progress' && reqWorktree && !task.worktree) {
            addBlockingRule('This profile requires a worktree before a task can enter IN PROGRESS.');
        }

        if (fromLane === 'planning' && toLane === 'in-progress') {
            if (reqSpec) {
                const hasSpecLabel = task.labels?.includes('spec-driven');
                const isSpecDriven = !!(task.spec || task.change || hasSpecLabel);

                if (isSpecDriven) {
                    if (!task.spec || task.specMissing) {
                        addBlockingRule('This task is spec-driven and requires a valid spec file before entering IN PROGRESS.');
                    }
                    if (!task.change || task.changeMissing) {
                        addBlockingRule('This task is spec-driven and requires a valid change folder before entering IN PROGRESS.');
                    }
                }
            }

            if (reqChecklist) {
                if (!task.checklist || task.checklist.total === 0) {
                    addBlockingRule('This profile requires a checklist with at least one item before entering IN PROGRESS.');
                }
            }
        }

        if (toLane === 'review' && reqDescription && !task.description.trim()) {
            warnings.push('Task has no description yet. Review will be easier once scope is written down.');
        }

        if (toLane === 'done') {
            const isStandard = config.profile === 'standard';
            const evResult = TaskEvidenceValidator.validate(task, isStandard);

            if (evResult.missing.includes('ALL')) {
                addBlockingRule('No evidence recorded. Run production-readiness audit and record results before moving to DONE.');
            } else {
                for (const key of evResult.missing) {
                    addBlockingRule(`Required evidence "${key}" is missing. Record evidence before moving to DONE.`);
                }
                for (const key of evResult.failed) {
                    addBlockingRule(`Required evidence "${key}" did not pass. Fix issues before DONE.`);
                }
                for (const warn of evResult.warnings) {
                    warnings.push(warn);
                }
            }

            // If verification commands are configured, warn if evidence wasn't recorded
            const verPolicies = config.policies?.verification;
            if (verPolicies && evResult.missing.length === 0) {
                const configured: string[] = [];
                if (verPolicies.lintCommand) configured.push('lint');
                if (verPolicies.testCommand) configured.push('test');
                if (verPolicies.buildCommand) configured.push('build');
                for (const key of configured) {
                    if (!task.evidence?.[key as keyof typeof task.evidence]) {
                        warnings.push(`Configured verification "${key}" was not recorded as evidence.`);
                    }
                }
            }
        }

        if (toLane === 'done' && reqWorktree && !task.worktree && !isDoneLane(fromLane)) {
            warnings.push('Task reached DONE without worktree metadata. Confirm the implementation audit trail is still sufficient.');
        }

        return {
            ok: errors.length === 0,
            warnings,
            errors,
            blockedReasons,
        };
    }

    getAllowedTargets(fromLane: string, config: BoardConfig): string[] {
        if (config.profile === 'lite') {
            return LITE_TRANSITIONS[fromLane] ?? [getFirstLane(config.profile)];
        }
        return STANDARD_TRANSITIONS[fromLane] ?? [getFirstLane(config.profile)];
    }
}
