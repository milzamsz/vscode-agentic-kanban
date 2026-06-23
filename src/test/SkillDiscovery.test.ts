import { describe, expect, it, vi, beforeEach } from 'vitest';
import { workspace, Uri, FileType } from 'vscode';
import { discoverSkills } from '../SkillDiscovery';

vi.mock('os', () => ({ homedir: () => '/home/user' }));

const enc = (s: string) => new TextEncoder().encode(s);
const norm = (uri: any) => String(uri.fsPath).replace(/\\/g, '/');

describe('discoverSkills', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('dedupes by name, filters hidden/files, reads SKILL.md description, sorts', async () => {
        vi.spyOn(workspace.fs, 'readDirectory').mockImplementation(async (uri: any) => {
            const p = norm(uri);
            if (p.endsWith('.claude/skills')) {
                return [
                    ['skill-b', FileType.Directory],
                    ['skill-a', FileType.Directory],
                    ['notes.md', FileType.File],   // not a directory -> skip
                    ['.system', FileType.Directory], // hidden -> skip
                ] as Array<[string, number]>;
            }
            if (p.endsWith('.codex/skills')) {
                return [['skill-a', FileType.Directory]] as Array<[string, number]>; // duplicate name
            }
            throw new Error('ENOENT'); // every other dir is missing
        });

        vi.spyOn(workspace.fs, 'readFile').mockImplementation(async (uri: any) => {
            const p = norm(uri);
            if (p.endsWith('.claude/skills/skill-a/SKILL.md')) {
                return enc('---\nname: skill-a\ndescription: Does A\n---\n# Skill A');
            }
            throw new Error('ENOENT'); // skill-b has no SKILL.md
        });

        const skills = await discoverSkills(Uri.file('/test-workspace'));

        // hidden + file excluded; duplicate skill-a collapsed -> 2 results, sorted
        expect(skills.map((s) => s.name)).toEqual(['skill-a', 'skill-b']);
        // description parsed from frontmatter
        expect(skills[0].description).toBe('Does A');
        // missing SKILL.md -> no description
        expect(skills[1].description).toBeUndefined();
        // first source wins (.claude resolved before .codex; earlier dirs threw)
        expect(norm({ fsPath: skills[0].source })).toContain('.claude/skills');
    });

    it('returns empty when no skill directories exist', async () => {
        vi.spyOn(workspace.fs, 'readDirectory').mockRejectedValue(new Error('ENOENT'));
        const skills = await discoverSkills(Uri.file('/test-workspace'));
        expect(skills).toEqual([]);
    });

    it('expands ~ and relative extra dirs', async () => {
        const seen: string[] = [];
        vi.spyOn(workspace.fs, 'readDirectory').mockImplementation(async (uri: any) => {
            seen.push(norm(uri));
            return [] as Array<[string, number]>;
        });

        await discoverSkills(Uri.file('/test-workspace'), ['~/custom-skills', 'rel/skills']);

        expect(seen).toContain('/home/user/custom-skills');
        expect(seen).toContain('/test-workspace/rel/skills');
    });
});
