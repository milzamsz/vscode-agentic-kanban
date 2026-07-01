import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FileType, Uri, workspace } from 'vscode';
import { ProjectSkillService } from '../ProjectSkillService';

vi.mock('os', () => ({ homedir: () => '/home/user' }));
vi.mock('fs/promises', () => ({
    lstat: vi.fn(),
    rm: vi.fn(),
    symlink: vi.fn(),
}));

import { lstat, rm, symlink } from 'fs/promises';

const enc = (s: string) => new TextEncoder().encode(s);
const norm = (uri: any) => String(uri.fsPath).replace(/\\/g, '/');

describe('ProjectSkillService', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('treats project-local .agents/skills as active and prefers it over machine sources', async () => {
        vi.spyOn(workspace.fs, 'readDirectory').mockImplementation(async (uri: any) => {
            const p = norm(uri);
            if (p.endsWith('/test-workspace/.agents/skills')) {
                return [['astro', FileType.Directory]] as Array<[string, number]>;
            }
            if (p.endsWith('/home/user/.agents/skills')) {
                return [['astro', FileType.Directory], ['release', FileType.Directory]] as Array<[string, number]>;
            }
            throw new Error('ENOENT');
        });
        vi.spyOn(workspace.fs, 'readFile').mockImplementation(async (uri: any) => {
            const p = norm(uri);
            if (p.endsWith('/test-workspace/.agents/skills/astro/SKILL.md')) {
                return enc('---\ndescription: Local Astro\n---\n');
            }
            if (p.endsWith('/home/user/.agents/skills/release/SKILL.md')) {
                return enc('---\ndescription: Release skill\n---\n');
            }
            throw new Error('ENOENT');
        });
        vi.mocked(lstat).mockResolvedValue({ isSymbolicLink: () => false } as any);

        const service = new ProjectSkillService();
        const skills = await service.discoverSkills(Uri.file('/test-workspace'));

        expect(skills.map((skill) => skill.name)).toEqual(['astro', 'release']);
        expect(skills.find((skill) => skill.name === 'astro')).toMatchObject({
            isActive: true,
            sourceLabel: 'project/.agents/skills',
            canDeactivate: false,
        });
        expect(skills.find((skill) => skill.name === 'release')).toMatchObject({
            isActive: false,
            sourceLabel: '~/.agents/skills',
        });
    });

    it('creates project links for newly selected machine skills', async () => {
        vi.spyOn(workspace.fs, 'readDirectory').mockImplementation(async (uri: any) => {
            const p = norm(uri);
            if (p.endsWith('/home/user/.agents/skills')) {
                return [['astro', FileType.Directory], ['release', FileType.Directory]] as Array<[string, number]>;
            }
            throw new Error('ENOENT');
        });
        vi.spyOn(workspace.fs, 'readFile').mockRejectedValue(new Error('ENOENT'));
        vi.mocked(lstat).mockRejectedValue(new Error('ENOENT'));

        const service = new ProjectSkillService();
        const result = await service.applySelection(Uri.file('/test-workspace'), ['astro']);

        const [sourceArg, targetArg, typeArg] = vi.mocked(symlink).mock.calls[0];
        expect(String(sourceArg).replace(/\\/g, '/')).toBe('/home/user/.agents/skills/astro');
        expect(String(targetArg).replace(/\\/g, '/')).toBe('/test-workspace/.agents/skills/astro');
        expect(typeArg).toBe('junction');
        expect(result.linked).toEqual(['astro']);
        expect(result.unlinked).toEqual([]);
        expect(result.protected).toEqual([]);
    });

    it('removes linked project skills on deselect but leaves real directories alone', async () => {
        vi.spyOn(workspace.fs, 'readDirectory').mockImplementation(async (uri: any) => {
            const p = norm(uri);
            if (p.endsWith('/test-workspace/.agents/skills')) {
                return [['astro', FileType.Directory], ['release', FileType.Directory]] as Array<[string, number]>;
            }
            throw new Error('ENOENT');
        });
        vi.spyOn(workspace.fs, 'readFile').mockRejectedValue(new Error('ENOENT'));
        vi.mocked(lstat).mockImplementation(async (path: any) => {
            const p = String(path).replace(/\\/g, '/');
            if (p.endsWith('/test-workspace/.agents/skills/astro')) {
                return { isSymbolicLink: () => true } as any;
            }
            if (p.endsWith('/test-workspace/.agents/skills/release')) {
                return { isSymbolicLink: () => false } as any;
            }
            throw new Error('ENOENT');
        });

        const service = new ProjectSkillService();
        const result = await service.applySelection(Uri.file('/test-workspace'), []);

        const [removedPath, removedOptions] = vi.mocked(rm).mock.calls[0];
        expect(String(removedPath).replace(/\\/g, '/')).toBe('/test-workspace/.agents/skills/astro');
        expect(removedOptions).toEqual({ force: true, recursive: true });
        expect(result.unlinked).toEqual(['astro']);
        expect(result.protected).toEqual(['release']);
    });
});
