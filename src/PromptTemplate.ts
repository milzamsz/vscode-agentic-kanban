import type { BoardConfig } from './types';
import { getFirstLane } from './types';

/**
 * Interpolates variables into prompt template content.
 * Substitutes {{key}} placeholders and resolves legacy <stack skill> placeholders.
 * Unknown variables collapse to empty strings.
 */
export function interpolate(content: string, vars: Record<string, string>): string {
    return content.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (match, key) => {
        const value = vars[key];
        if (value !== undefined) {
            return value;
        }
        console.warn(`[PromptTemplate] Unknown variable: ${key}`);
        return '';
    });
}

function getLanes(profile: 'standard' | 'lite'): string {
    return profile === 'lite'
        ? 'backlog → in-progress → done'
        : 'backlog → planning → in-progress → review → done';
}

function getAdvance(profile: 'standard' | 'lite'): string {
    if (profile === 'lite') {
        return [
            'Lite workflow:',
            '- Verify inside `in-progress` (no separate review lane).',
            '- Move directly to `done` after verification passes.',
            '- Worktree is optional unless board policy requires it.',
        ].join('\n');
    }
    return [
        'Standard workflow:',
        '- `in-progress` → implementation + verification.',
        '- Set `lane: review` after verification passes. Review is a human gate.',
        '- `review → done` only after the human review gate passes.',
        '- Worktree per board policy.',
    ].join('\n');
}

/**
 * Returns the default lane for `/loop` based on profile: the first lane (backlog).
 */
export function getDefaultLoopLane(profile: 'standard' | 'lite'): string {
    return getFirstLane(profile);
}

/**
 * Maps a profile+lane to the bundled stage-driver prompt filename (without path).
 * Returns null when no driver exists for that lane (e.g. `done`).
 */
export function getLanePrompt(profile: 'standard' | 'lite', lane: string): string | null {
    if (profile === 'lite') {
        if (lane === 'backlog') { return 'stage-backlog-to-inprogress.md'; }
        if (lane === 'in-progress') { return 'stage-inprogress-to-done.md'; }
        return null;
    }
    // Standard
    if (lane === 'backlog') { return 'stage-backlog-to-planning.md'; }
    if (lane === 'planning' || lane === 'in-progress') { return 'stage-planning-to-review.md'; }
    if (lane === 'review') { return 'stage-review-to-done.md'; }
    return null;
}

/**
 * Resolves configuration values and active project skills into variables
 * for prompt interpolation.
 */
export function resolveVars(config: BoardConfig, activeSkills: string[] = []): Record<string, string> {
    const profile = config.profile;
    const lanes = getLanes(profile);
    const advance = getAdvance(profile);

    const uniqueSkills = Array.from(new Set(activeSkills));
    const skills = uniqueSkills.length > 0
        ? uniqueSkills.map((skill) => `\`${skill}\``).join(', ')
        : '';

    // Default verification commands from board policies
    const verification = config.policies?.verification;
    const defaultCmds: string[] = [];
    if (verification?.testCommand) { defaultCmds.push(verification.testCommand); }
    if (verification?.lintCommand) { defaultCmds.push(verification.lintCommand); }
    if (verification?.buildCommand) { defaultCmds.push(verification.buildCommand); }

    const verifyCmds = defaultCmds.length > 0
        ? defaultCmds.map((cmd) => `- \`${cmd}\``).join('\n')
        : '';

    const lint = verification?.lintCommand ?? '';
    const test = verification?.testCommand ?? '';
    const build = verification?.buildCommand ?? '';

    return {
        skills,
        verifyCmds,
        lint,
        test,
        build,
        profile,
        lanes,
        advance,
    };
}
