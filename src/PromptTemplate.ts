import type { BoardConfig, StackPack } from './types';

/**
 * Interpolates variables into prompt template content.
 * Substitutes {{key}} placeholders and resolves legacy <stack skill> placeholders.
 * Unknown variables collapse to empty strings.
 */
export function interpolate(content: string, vars: Record<string, string>): string {
    let result = content;

    // Resolve legacy <stack skill> placeholder for migration
    if (vars.stack !== undefined) {
        result = result.replace(/<stack skill>/g, vars.stack);
    }

    // Replace {{key}} placeholders
    return result.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (match, key) => {
        const value = vars[key];
        if (value !== undefined) {
            return value;
        }
        console.warn(`[PromptTemplate] Unknown variable: ${key}`);
        return '';
    });
}

/**
 * Resolves configuration values and active pack stack settings into variables
 * for prompt interpolation.
 */
export function resolveVars(config: BoardConfig, activePack?: StackPack): Record<string, string> {
    const stack = activePack?.stack ?? '';
    
    // Union of project-level skills and active pack skills
    const projectSkills = config.skills ?? [];
    const packSkills = activePack?.skills ?? [];
    const uniqueSkills = Array.from(new Set([...projectSkills, ...packSkills]));
    const skills = uniqueSkills.length > 0
        ? uniqueSkills.map(s => `\`${s}\``).join(', ')
        : '';

    // Coverage checklist lines formatted as bullet points
    const coverage = activePack?.coverage && activePack.coverage.length > 0
        ? activePack.coverage.map(line => `- [ ] ${line}`).join('\n')
        : '';

    // Default verification commands from board policies
    const verification = config.policies?.verification;
    const defaultCmds: string[] = [];
    if (verification?.testCommand) { defaultCmds.push(verification.testCommand); }
    if (verification?.lintCommand) { defaultCmds.push(verification.lintCommand); }
    if (verification?.buildCommand) { defaultCmds.push(verification.buildCommand); }

    // Resolve verifyCmds: active pack overrides board verification
    const verifyCmdsList = activePack?.verifyCmds && activePack.verifyCmds.length > 0
        ? activePack.verifyCmds
        : defaultCmds;

    const verifyCmds = verifyCmdsList.length > 0
        ? verifyCmdsList.map(cmd => `- \`${cmd}\``).join('\n')
        : '';

    const lint = verification?.lintCommand ?? '';
    const test = verification?.testCommand ?? '';
    const build = verification?.buildCommand ?? '';

    return {
        stack,
        skills,
        coverage,
        verifyCmds,
        lint,
        test,
        build,
    };
}
