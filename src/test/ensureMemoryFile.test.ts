import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Uri, workspace } from 'vscode';
import { ensureMemoryFile } from '../extension';

describe('ensureMemoryFile', () => {
    const workspaceUri = Uri.file('/test-workspace');

    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('creates memory.md with default content when missing', async () => {
        vi.spyOn(workspace.fs, 'stat').mockRejectedValue(new Error('not found'));
        const writeSpy = vi.spyOn(workspace.fs, 'writeFile').mockResolvedValue(undefined);

        const created = await ensureMemoryFile(workspaceUri);

        expect(created).toBe(true);
        expect(writeSpy).toHaveBeenCalledOnce();
        const [uri, bytes] = writeSpy.mock.calls[0];
        expect((uri as Uri).fsPath).toMatch(/memory\.md$/);
        expect(new TextDecoder().decode(bytes as Uint8Array)).toBe('# Memory\n');
    });

    it('does not overwrite an existing memory.md', async () => {
        vi.spyOn(workspace.fs, 'stat').mockResolvedValue({
            type: 1,
            ctime: 0,
            mtime: 0,
            size: 42,
        } as any);
        const writeSpy = vi.spyOn(workspace.fs, 'writeFile').mockResolvedValue(undefined);

        const created = await ensureMemoryFile(workspaceUri);

        expect(created).toBe(false);
        expect(writeSpy).not.toHaveBeenCalled();
    });
});
