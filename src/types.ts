export type Priority = 'critical' | 'high' | 'medium' | 'low' | 'none';
export type WorkflowProfile = 'lite' | 'standard';
export type Lane =
    | 'backlog'
    | 'planning'
    | 'in-progress'
    | 'review'
    | 'done';

export interface WorktreeInfo {
    branch: string;
    path: string;
    created: string;
}

export interface WorktreePolicy {
    requiredForImplementation: boolean;
}

export interface OverridePolicy {
    allowed: boolean;
    actors: Array<'human' | 'agent'>;
    requireReason: boolean;
}

export interface EnforcementPolicy {
    mode: 'strict' | 'warn';
    overrides: OverridePolicy;
}

export interface ReviewPolicyLevel {
    planning: string;
    implementation: string;
}

export interface ReviewPolicy {
    low: ReviewPolicyLevel;
    medium: ReviewPolicyLevel;
    high: ReviewPolicyLevel;
    critical: ReviewPolicyLevel;
}

export interface Task {
    id: string;
    title: string;
    lane: string;
    created: string;
    updated: string;
    description: string;
    priority?: Priority;
    assignee?: string;
    labels?: string[];
    dueDate?: string;
    sortOrder?: number;
    worktree?: WorktreeInfo;
    slug?: string;
    /**
     * Spec-driven change folder for this task, e.g. `.agentkanban/changes/<slug>`.
     * When set, the task's authoritative checklist is `<change>/tasks.md`.
     */
    change?: string;
    /**
     * Capability spec this task implements, e.g. `.agentkanban/specs/<capability>/spec.md`.
     */
    spec?: string;
    /** Slugs of tasks this one depends on (must be `done` before this is ready). */
    dependsOn?: string[];
    /**
     * Legacy field used by older builds when `blocked` was a dedicated lane.
     * Read for migration compatibility only; new serialisation never writes it.
     */
    resumeLane?: string;
    /**
     * Unknown frontmatter keys preserved verbatim across save round-trips so
     * conventions layered on top of the extension are not lost on re-write.
     */
    extras?: Record<string, unknown>;
    /**
     * Transient fields computed for board rendering only — never serialised to disk.
     */
    checklist?: { done: number; total: number };
    specMissing?: boolean;
    changeMissing?: boolean;
    laneInvalid?: boolean;
}

export interface BoardConfig {
    profile: WorkflowProfile;
    profileVersion: number;
    users?: string[];
    labels?: string[];
    enforcement?: EnforcementPolicy;
    reviewPolicy?: ReviewPolicy;
    worktreePolicy?: WorktreePolicy;
    lanes: string[];
}

export const PROFILE_VERSION = 3;

export const PROFILE_LANES: Record<WorkflowProfile, Lane[]> = {
    lite: ['backlog', 'in-progress', 'done'],
    standard: ['backlog', 'planning', 'in-progress', 'review', 'done'],
};

export const DEFAULT_PROFILE: WorkflowProfile = 'standard';

export const DEFAULT_ENFORCEMENT: Record<WorkflowProfile, EnforcementPolicy> = {
    lite: {
        mode: 'warn',
        overrides: {
            allowed: true,
            actors: ['human', 'agent'],
            requireReason: false,
        },
    },
    standard: {
        mode: 'strict',
        overrides: {
            allowed: true,
            actors: ['human'],
            requireReason: true,
        },
    },
};

export const DEFAULT_REVIEW_POLICY: ReviewPolicy = {
    low: { planning: 'self-agent', implementation: 'self-agent' },
    medium: { planning: 'self-agent', implementation: 'self-agent' },
    high: { planning: 'independent-agent', implementation: 'independent-agent' },
    critical: { planning: 'independent-agent', implementation: 'independent-agent+human' },
};

export const DEFAULT_WORKTREE_POLICY: Record<WorkflowProfile, WorktreePolicy> = {
    lite: { requiredForImplementation: false },
    standard: { requiredForImplementation: true },
};

export const DEFAULT_BOARD_CONFIG: BoardConfig = {
    profile: DEFAULT_PROFILE,
    profileVersion: PROFILE_VERSION,
    lanes: getProfileLanes(DEFAULT_PROFILE),
    users: undefined,
    labels: undefined,
    enforcement: DEFAULT_ENFORCEMENT[DEFAULT_PROFILE],
    reviewPolicy: DEFAULT_REVIEW_POLICY,
    worktreePolicy: DEFAULT_WORKTREE_POLICY[DEFAULT_PROFILE],
};

export const DONE_LANE: Lane = 'done';
export const ARCHIVE_LANE = 'archive';
export const PROTECTED_LANES = ['backlog', 'done'] as const;
export const RESERVED_LANES = ['archive'] as const;

export function getProfileLanes(profile: WorkflowProfile): Lane[] {
    return [...PROFILE_LANES[profile]];
}

export function getFirstLane(profile: WorkflowProfile): Lane {
    return PROFILE_LANES[profile][0];
}

export function normaliseProfile(profile: unknown): WorkflowProfile {
    return profile === 'lite' ? 'lite' : 'standard';
}

export function normaliseBoardConfig(config?: Partial<BoardConfig> | null): BoardConfig {
    const profile = normaliseProfile(config?.profile);
    return {
        profile,
        profileVersion: typeof config?.profileVersion === 'number' ? config.profileVersion : PROFILE_VERSION,
        users: config?.users,
        labels: config?.labels,
        enforcement: config?.enforcement ?? DEFAULT_ENFORCEMENT[profile],
        reviewPolicy: config?.reviewPolicy ?? DEFAULT_REVIEW_POLICY,
        worktreePolicy: config?.worktreePolicy ?? DEFAULT_WORKTREE_POLICY[profile],
        lanes: getProfileLanes(profile),
    };
}

export function isDoneLane(lane: string): boolean {
    return lane === DONE_LANE;
}

export function isArchiveLane(lane: string): boolean {
    return lane === ARCHIVE_LANE;
}

export function displayLane(slug: string): string {
    return slug.replace(/-/g, ' ').toUpperCase();
}

export function slugifyLane(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

export function isProtectedLane(slug: string): boolean {
    return PROTECTED_LANES.includes(slug as (typeof PROTECTED_LANES)[number]);
}

export function isReservedLane(slug: string): boolean {
    return RESERVED_LANES.includes(slug as (typeof RESERVED_LANES)[number]);
}
