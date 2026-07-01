import { describe, it, expect } from 'vitest';
import { getLanePrompt, interpolate, resolveVars } from '../PromptTemplate';
import type { BoardConfig } from '../types';

describe('PromptTemplate', () => {
    describe('interpolate', () => {
        it('should substitute simple variables', () => {
            const content = 'Skills are {{skills}}';
            const vars = { skills: '`odoo-19`' };
            const result = interpolate(content, vars);
            expect(result).toBe('Skills are `odoo-19`');
        });

        it('should collapse unknown variables to empty strings', () => {
            const content = 'Unknown variable {{unknown_var}} should collapse.';
            const result = interpolate(content, {});
            expect(result).toBe('Unknown variable  should collapse.');
        });
    });

    describe('resolveVars', () => {
        const mockConfig: BoardConfig = {
            profile: 'standard',
            profileVersion: 3,
            lanes: [],
            policies: {
                verification: {
                    testCommand: 'npm test',
                    lintCommand: 'npm run lint',
                    buildCommand: 'npm run build',
                },
            },
        };

        it('should resolve skills from the active project skill list', () => {
            const vars = resolveVars(mockConfig, ['git', 'workspace']);
            expect(vars.skills).toBe('`git`, `workspace`');
            expect(vars.verifyCmds).toBe('- `npm test`\n- `npm run lint`\n- `npm run build`');
            expect(vars.lint).toBe('npm run lint');
            expect(vars.test).toBe('npm test');
            expect(vars.build).toBe('npm run build');
        });

        it('should not expose removed stack-pack prompt variables', () => {
            const vars = resolveVars(mockConfig, ['astro']);
            expect(vars.skills).toBe('`astro`');
            expect(vars.stack).toBeUndefined();
            expect(vars.coverage).toBeUndefined();
        });

        it('should resolve profile-aware lanes for standard', () => {
            const config: BoardConfig = { ...mockConfig, profile: 'standard' };
            const vars = resolveVars(config, []);
            expect(vars.profile).toBe('standard');
            expect(vars.lanes).toBe('backlog → planning → in-progress → review → done');
            expect(vars.advance).toContain('review');
        });

        it('should resolve profile-aware lanes for lite', () => {
            const config: BoardConfig = { ...mockConfig, profile: 'lite' };
            const vars = resolveVars(config, []);
            expect(vars.profile).toBe('lite');
            expect(vars.lanes).toBe('backlog → in-progress → done');
            expect(vars.advance).toContain('no separate review lane');
            expect(vars.advance).toContain('Worktree is optional');
        });

        it('should interpolate task-specific prompt with profile, lanes, taskTitle, taskFile', () => {
            const config: BoardConfig = { ...mockConfig, profile: 'lite' };
            const vars = resolveVars(config, ['agentic-kanban']);
            const promptVars = { ...vars, taskTitle: 'Auth Feature', taskFile: '.agentkanban/tasks/task_1_auth.md' };
            const template = '# Work: {{taskTitle}}\nFile: {{taskFile}}\nProfile: {{profile}}\nLanes: {{lanes}}';
            const result = interpolate(template, promptVars);
            expect(result).toContain('Auth Feature');
            expect(result).toContain('.agentkanban/tasks/task_1_auth.md');
            expect(result).toContain('lite');
            expect(result).toContain('backlog → in-progress → done');
        });
    });

    describe('getLanePrompt', () => {
        it('maps Standard lanes to the existing stage prompts', () => {
            expect(getLanePrompt('standard', 'backlog')).toBe('stage-backlog-to-planning.md');
            expect(getLanePrompt('standard', 'planning')).toBe('stage-planning-to-review.md');
            expect(getLanePrompt('standard', 'in-progress')).toBe('stage-planning-to-review.md');
            expect(getLanePrompt('standard', 'review')).toBe('stage-review-to-done.md');
        });

        it('maps Lite lanes to the dedicated Lite stage prompts', () => {
            expect(getLanePrompt('lite', 'backlog')).toBe('stage-backlog-to-inprogress.md');
            expect(getLanePrompt('lite', 'in-progress')).toBe('stage-inprogress-to-done.md');
            expect(getLanePrompt('lite', 'done')).toBeNull();
        });
    });
});
