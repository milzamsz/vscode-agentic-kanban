import { describe, expect, it, vi, beforeEach } from 'vitest';
import { workspace, Uri } from 'vscode';
import { StackTemplateStore } from '../StackTemplateStore';
import type { StackPack } from '../types';

vi.mock('os', () => ({ homedir: () => '/home/user' }));

const enc = (s: string) => new TextEncoder().encode(s);
const dec = (b: Uint8Array) => new TextDecoder().decode(b);

describe('StackTemplateStore', () => {
    let store: StackTemplateStore;

    beforeEach(() => {
        vi.restoreAllMocks();
        store = new StackTemplateStore();
    });

    it('returns empty array when templates file is missing', async () => {
        vi.spyOn(workspace.fs, 'readFile').mockRejectedValue(new Error('ENOENT'));
        const result = await store.loadGlobalTemplates();
        expect(result).toEqual([]);
    });

    it('loads templates from valid YAML file', async () => {
        const yaml = 'templates:\n  - name: odoo\n    stack: Odoo 18\n    skills:\n      - odoo-18\n';
        vi.spyOn(workspace.fs, 'readFile').mockResolvedValue(enc(yaml));
        const result = await store.loadGlobalTemplates();
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('odoo');
        expect(result[0].stack).toBe('Odoo 18');
        expect(result[0].skills).toEqual(['odoo-18']);
    });

    it('returns empty array when file content is malformed YAML', async () => {
        vi.spyOn(workspace.fs, 'readFile').mockResolvedValue(enc('not: valid: yaml: [[['));
        const result = await store.loadGlobalTemplates();
        expect(result).toEqual([]);
    });

    it('saves templates as YAML with templates key', async () => {
        vi.spyOn(workspace.fs, 'createDirectory').mockResolvedValue(undefined);
        let written = '';
        vi.spyOn(workspace.fs, 'writeFile').mockImplementation(async (_uri, data) => {
            written = dec(data as Uint8Array);
        });

        const templates: StackPack[] = [{ name: 'web', stack: 'Web', skills: ['react'] }];
        await store.saveGlobalTemplates(templates);
        expect(written).toContain('templates:');
        expect(written).toContain('name: web');
        expect(written).toContain('stack: Web');
        expect(written).toContain('react');
    });

    it('upsertGlobalTemplate adds a new template when name is absent', async () => {
        vi.spyOn(workspace.fs, 'readFile').mockResolvedValue(enc('templates:\n  - name: existing\n'));
        vi.spyOn(workspace.fs, 'createDirectory').mockResolvedValue(undefined);
        let written = '';
        vi.spyOn(workspace.fs, 'writeFile').mockImplementation(async (_uri, data) => {
            written = dec(data as Uint8Array);
        });

        await store.upsertGlobalTemplate({ name: 'new-pack', stack: 'New' });
        expect(written).toContain('name: existing');
        expect(written).toContain('name: new-pack');
    });

    it('upsertGlobalTemplate replaces template with same name', async () => {
        const initial = 'templates:\n  - name: odoo\n    stack: Old Label\n';
        vi.spyOn(workspace.fs, 'readFile').mockResolvedValue(enc(initial));
        vi.spyOn(workspace.fs, 'createDirectory').mockResolvedValue(undefined);
        let written = '';
        vi.spyOn(workspace.fs, 'writeFile').mockImplementation(async (_uri, data) => {
            written = dec(data as Uint8Array);
        });

        await store.upsertGlobalTemplate({ name: 'odoo', stack: 'New Label' });
        expect(written).toContain('New Label');
        expect(written).not.toContain('Old Label');
        const lines = written.match(/name: odoo/g);
        expect(lines).toHaveLength(1);
    });

    it('deleteGlobalTemplate removes the named template', async () => {
        const initial = 'templates:\n  - name: keep\n  - name: remove\n';
        vi.spyOn(workspace.fs, 'readFile').mockResolvedValue(enc(initial));
        vi.spyOn(workspace.fs, 'createDirectory').mockResolvedValue(undefined);
        let written = '';
        vi.spyOn(workspace.fs, 'writeFile').mockImplementation(async (_uri, data) => {
            written = dec(data as Uint8Array);
        });

        await store.deleteGlobalTemplate('remove');
        expect(written).toContain('name: keep');
        expect(written).not.toContain('name: remove');
    });
});
