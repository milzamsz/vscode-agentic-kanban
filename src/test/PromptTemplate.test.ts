import { describe, it, expect } from 'vitest';
import { interpolate, resolveVars } from '../PromptTemplate';
import type { BoardConfig, StackPack } from '../types';

describe('PromptTemplate', () => {
    describe('interpolate', () => {
        it('should substitute simple variables', () => {
            const content = 'Stack is {{stack}} and skills are {{skills}}';
            const vars = { stack: 'Odoo', skills: '`odoo-19`' };
            const result = interpolate(content, vars);
            expect(result).toBe('Stack is Odoo and skills are `odoo-19`');
        });

        it('should resolve legacy <stack skill> placeholders', () => {
            const content = 'Stack: <stack skill>.';
            const vars = { stack: 'Odoo' };
            const result = interpolate(content, vars);
            expect(result).toBe('Stack: Odoo.');
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
            skills: ['git', 'workspace'],
            policies: {
                verification: {
                    testCommand: 'npm test',
                    lintCommand: 'npm run lint',
                    buildCommand: 'npm run build',
                },
            },
        };

        it('should resolve empty defaults when no active pack is provided', () => {
            const vars = resolveVars(mockConfig);
            expect(vars.stack).toBe('');
            expect(vars.skills).toBe('`git`, `workspace`');
            expect(vars.coverage).toBe('');
            expect(vars.verifyCmds).toBe('- `npm test`\n- `npm run lint`\n- `npm run build`');
            expect(vars.lint).toBe('npm run lint');
            expect(vars.test).toBe('npm test');
            expect(vars.build).toBe('npm run build');
        });

        it('should resolve pack stack, skills, and coverage', () => {
            const pack: StackPack = {
                name: 'odoo',
                stack: 'Odoo 18.0',
                skills: ['odoo-18', 'odoo-owl'],
                coverage: ['__manifest__.py', 'security rules'],
            };
            const vars = resolveVars(mockConfig, pack);
            expect(vars.stack).toBe('Odoo 18.0');
            // Union of config.skills ['git', 'workspace'] and pack.skills ['odoo-18', 'odoo-owl']
            expect(vars.skills).toBe('`git`, `workspace`, `odoo-18`, `odoo-owl`');
            expect(vars.coverage).toBe('- [ ] __manifest__.py\n- [ ] security rules');
        });

        it('should override verification commands with pack verifyCmds', () => {
            const pack: StackPack = {
                name: 'custom',
                verifyCmds: ['custom verify', 'another check'],
            };
            const vars = resolveVars(mockConfig, pack);
            expect(vars.verifyCmds).toBe('- `custom verify`\n- `another check`');
        });

        it('should resolve profile-aware lanes for standard', () => {
            const config: BoardConfig = { ...mockConfig, profile: 'standard' };
            const vars = resolveVars(config);
            expect(vars.profile).toBe('standard');
            expect(vars.lanes).toBe('backlog → planning → in-progress → review → done');
            expect(vars.advance).toContain('review');
        });

        it('should resolve profile-aware lanes for lite', () => {
            const config: BoardConfig = { ...mockConfig, profile: 'lite' };
            const vars = resolveVars(config);
            expect(vars.profile).toBe('lite');
            expect(vars.lanes).toBe('backlog → in-progress → done');
            expect(vars.advance).toContain('no separate review lane');
            expect(vars.advance).toContain('Worktree is optional');
        });

        it('should interpolate task-specific prompt with profile, lanes, taskTitle, taskFile', () => {
            const config: BoardConfig = { ...mockConfig, profile: 'lite' };
            const vars = resolveVars(config);
            const promptVars = { ...vars, taskTitle: 'Auth Feature', taskFile: '.agentkanban/tasks/task_1_auth.md' };
            const template = '# Work: {{taskTitle}}\nFile: {{taskFile}}\nProfile: {{profile}}\nLanes: {{lanes}}';
            const result = interpolate(template, promptVars);
            expect(result).toContain('Auth Feature');
            expect(result).toContain('.agentkanban/tasks/task_1_auth.md');
            expect(result).toContain('lite');
            expect(result).toContain('backlog → in-progress → done');
        });
    });
});
