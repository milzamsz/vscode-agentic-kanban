import * as vscode from 'vscode';
import type { Task, WorktreePolicy, WorkflowProfile } from './types';
import {
    DEFAULT_PROFILE,
    PROFILE_LANES,
    normaliseProfile,
} from './types';

type WorktreeRequirementSetting = 'profile-default' | 'required' | 'optional';

interface LaneConflict {
    lane: string;
    count: number;
}

function getConfig() {
    return vscode.workspace.getConfiguration('agentKanban');
}

export function getDefaultProfile(): WorkflowProfile {
    return normaliseProfile(getConfig().get<string>('defaultProfile', DEFAULT_PROFILE));
}

export function resolveWorktreePolicy(_profile: WorkflowProfile): WorktreePolicy | undefined {
    const setting = getConfig().get<WorktreeRequirementSetting>(
        'worktreeRequiredForImplementation',
        'profile-default',
    );
    if (setting === 'required') {
        return { requiredForImplementation: true };
    }
    if (setting === 'optional') {
        return { requiredForImplementation: false };
    }
    return undefined;
}

export function isEnforceWorktrees(): boolean {
    return getConfig().get<boolean>('enforceWorktrees', false);
}

export function countTasksOutsideProfileLanes(tasks: Task[], profile: WorkflowProfile): LaneConflict[] {
    const allowedLanes = new Set(PROFILE_LANES[profile]);
    const counts = new Map<string, number>();

    for (const task of tasks) {
        if (!allowedLanes.has(task.lane as any)) {
            counts.set(task.lane, (counts.get(task.lane) ?? 0) + 1);
        }
    }

    return Array.from(counts.entries())
        .map(([lane, count]) => ({ lane, count }))
        .sort((a, b) => a.lane.localeCompare(b.lane));
}
