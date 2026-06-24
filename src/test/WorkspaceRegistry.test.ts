import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as vscode from 'vscode';
import { WorkspaceRegistry } from '../WorkspaceRegistry';
import { TaskStore } from '../TaskStore';
import { BoardConfigStore } from '../BoardConfigStore';
import { WorktreeService } from '../WorktreeService';
import { LogService, NO_OP_LOGGER } from '../LogService';
import { ChatParticipant } from '../agents/ChatParticipant';
import { BoardViewProvider } from '../BoardViewProvider';

// Mock VS Code API
const mockWorkspaceFolders: vscode.WorkspaceFolder[] = [
    {
        uri: vscode.Uri.file('/test/project-a'),
        name: 'project-a',
        index: 0,
    },
    {
        uri: vscode.Uri.file('/test/project-b'),
        name: 'project-b',
        index: 1,
    },
];

const mockExtensionContext: vscode.ExtensionContext = {
    workspaceState: {
        get: vi.fn(),
        update: vi.fn().mockResolvedValue(undefined),
    },
    subscriptions: [],
    extensionUri: vscode.Uri.file('/test/extension'),
    globalState: { get: vi.fn(), update: vi.fn() },
    secrets: { get: vi.fn(), store: vi.fn(), delete: vi.fn() },
    storageUri: undefined,
    globalStorageUri: vscode.Uri.file('/test/global-storage'),
    logUri: vscode.Uri.file('/test/log'),
    extensionPath: '/test/extension',
    environmentVariableCollection: undefined,
    asAbsolutePath: (p: string) => `/test/extension/${p}`,
    extensionMode: (vscode as any).ExtensionMode?.Test ?? 1,
} as any;

const mockExtensionUri = vscode.Uri.file('/test/extension');

describe('WorkspaceRegistry', () => {
    let registry: WorkspaceRegistry;
    let originalWorkspaceFolders: typeof vscode.workspace.workspaceFolders;

    beforeEach(() => {
        originalWorkspaceFolders = vscode.workspace.workspaceFolders;
        vi.spyOn(vscode.workspace, 'workspaceFolders', 'get').mockReturnValue(mockWorkspaceFolders);
        vi.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
            get: vi.fn().mockReturnValue(false),
        } as any);
        // Mock fs.stat to reject so folders appear uninitialised
        vi.spyOn(vscode.workspace.fs, 'stat').mockRejectedValue(new Error('ENOENT'));
        (mockExtensionContext.workspaceState.get as any).mockReturnValue(undefined);

        registry = new WorkspaceRegistry(mockExtensionContext, mockExtensionUri);
    });

    afterEach(() => {
        registry.dispose();
        vi.restoreAllMocks();
    });

    it('should create contexts for all workspace folders', async () => {
        await registry.ensureContext(mockWorkspaceFolders[0]);
        await registry.ensureContext(mockWorkspaceFolders[1]);

        const contexts = registry.getContexts();
        expect(contexts).toHaveLength(2);
        expect(contexts[0].folder.uri.fsPath).toBe('/test/project-a');
        expect(contexts[1].folder.uri.fsPath).toBe('/test/project-b');
    });

    it('should not create .agentkanban on uninitialised folders', async () => {
        const ctx = await registry.ensureContext(mockWorkspaceFolders[0]);
        expect(ctx.isInitialised).toBe(false);
    });

    it('should track initialised state per folder', async () => {
        const ctxA = await registry.ensureContext(mockWorkspaceFolders[0]);
        const ctxB = await registry.ensureContext(mockWorkspaceFolders[1]);

        // Manually set initialised flag for testing
        (ctxA as any).isInitialised = true;

        expect(ctxA.isInitialised).toBe(true);
        expect(ctxB.isInitialised).toBe(false);
    });

    it('should resolve active context - prefers explicitly set', async () => {
        await registry.ensureContext(mockWorkspaceFolders[0]);
        await registry.ensureContext(mockWorkspaceFolders[1]);

        await registry.setActiveContext('/test/project-b');
        const active = registry.getActiveContext();
        expect(active?.folder.uri.fsPath).toBe('/test/project-b');
    });

    it('should fallback to first initialised context when none explicitly set', async () => {
        await registry.ensureContext(mockWorkspaceFolders[0]);
        await registry.ensureContext(mockWorkspaceFolders[1]);

        const ctxA = registry.getContextByFolder(mockWorkspaceFolders[0]);
        const ctxB = registry.getContextByFolder(mockWorkspaceFolders[1]);

        if (ctxA) (ctxA as any).isInitialised = true;
        if (ctxB) (ctxB as any).isInitialised = false;

        const active = registry.getActiveContext();
        expect(active?.folder.uri.fsPath).toBe('/test/project-a');
    });

    it('should fallback to first context when none initialised', async () => {
        await registry.ensureContext(mockWorkspaceFolders[0]);
        await registry.ensureContext(mockWorkspaceFolders[1]);

        const active = registry.getActiveContext();
        expect(active).toBeDefined();
    });

    it('should dispose context on workspace folder removal', async () => {
        await registry.ensureContext(mockWorkspaceFolders[0]);
        await registry.ensureContext(mockWorkspaceFolders[1]);

        await registry.disposeContext('/test/project-a');
        const contexts = registry.getContexts();
        expect(contexts).toHaveLength(1);
        expect(contexts[0].folder.uri.fsPath).toBe('/test/project-b');
    });

    it('should dispose all contexts on registry dispose', async () => {
        await registry.ensureContext(mockWorkspaceFolders[0]);
        await registry.ensureContext(mockWorkspaceFolders[1]);

        registry.dispose();
        expect(registry.getContexts()).toHaveLength(0);
    });

    it('should create scoped file watchers per context', async () => {
        const ctx = await registry.ensureContext(mockWorkspaceFolders[0]);
        expect(ctx.fileWatchers.length).toBeGreaterThan(0);
    });

    it('should fire onDidChangeActiveProject when active context changes', async () => {
        const listener = vi.fn();
        registry.onDidChangeActiveProject(listener);

        await registry.ensureContext(mockWorkspaceFolders[0]);
        await registry.ensureContext(mockWorkspaceFolders[1]);
        await registry.setActiveContext('/test/project-b');

        expect(listener).toHaveBeenCalledWith('/test/project-b');
    });

    it('should fire onDidChangeContexts when context added/removed', async () => {
        const listener = vi.fn();
        registry.onDidChangeContexts(listener);

        await registry.ensureContext(mockWorkspaceFolders[0]);
        expect(listener).toHaveBeenCalled();

        await registry.disposeContext('/test/project-a');
        expect(listener).toHaveBeenCalledTimes(2);
    });

    it('should persist active project URI in workspace state', async () => {
        await registry.ensureContext(mockWorkspaceFolders[0]);
        await registry.setActiveContext('/test/project-a');

        expect(mockExtensionContext.workspaceState.update).toHaveBeenCalledWith(
            'agentKanban.activeProjectUri',
            '/test/project-a'
        );
    });

    it('should restore active project from workspace state when project exists', async () => {
        // Simulate a restart: create registry, then add folders
        // stored value is read on first ensureContext call
        // If stored value matches an already-added folder, it will be used
        const registry2 = new WorkspaceRegistry(mockExtensionContext, mockExtensionUri);

        // Add project-b first
        await registry2.ensureContext(mockWorkspaceFolders[1]);
        const activeAfterFirst = registry2.getActiveContext();
        expect(activeAfterFirst?.folder.uri.fsPath).toBe('/test/project-b');

        // Add project-a - stored URI not changed
        await registry2.ensureContext(mockWorkspaceFolders[0]);
        const activeAfterSecond = registry2.getActiveContext();
        // stored URI was already used, so active stays as project-b
        expect(activeAfterSecond?.folder.uri.fsPath).toBe('/test/project-b');

        registry2.dispose();
    });
});

describe('WorkspaceRegistry - edge cases', () => {
    let registry: WorkspaceRegistry;

    beforeEach(() => {
        vi.spyOn(vscode.workspace, 'workspaceFolders', 'get').mockReturnValue(mockWorkspaceFolders);
        vi.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
            get: vi.fn().mockReturnValue(false),
        } as any);

        registry = new WorkspaceRegistry(mockExtensionContext, mockExtensionUri);
    });

    afterEach(() => {
        registry.dispose();
        vi.restoreAllMocks();
    });

    it('should throw when setting active context for non-existent folder', async () => {
        await registry.ensureContext(mockWorkspaceFolders[0]);
        await expect(registry.setActiveContext('/test/nonexistent')).rejects.toThrow(
            'No context for folder /test/nonexistent'
        );
    });

    it('should handle single folder workspaces', async () => {
        vi.spyOn(vscode.workspace, 'workspaceFolders', 'get').mockReturnValue([mockWorkspaceFolders[0]]);

        const singleRegistry = new WorkspaceRegistry(mockExtensionContext, mockExtensionUri);
        await singleRegistry.ensureContext(mockWorkspaceFolders[0]);

        const active = singleRegistry.getActiveContext();
        expect(active?.folder.uri.fsPath).toBe('/test/project-a');

        singleRegistry.dispose();
    });

    it('should not create duplicate contexts for same folder', async () => {
        await registry.ensureContext(mockWorkspaceFolders[0]);
        const ctx1 = registry.getContextByFolder(mockWorkspaceFolders[0]);
        await registry.ensureContext(mockWorkspaceFolders[0]);
        const ctx2 = registry.getContextByFolder(mockWorkspaceFolders[0]);

        expect(ctx1).toBe(ctx2);
    });

    it('should handle context with disabled logging (uninitialised)', async () => {
        const ctx = await registry.ensureContext(mockWorkspaceFolders[0]);
        expect(ctx.logService).toBe(NO_OP_LOGGER);
    });
});

describe('Multi-root integration with ChatParticipant', () => {
    let registry: WorkspaceRegistry;
    let chatParticipant: ChatParticipant;

    beforeEach(() => {
        vi.spyOn(vscode.workspace, 'workspaceFolders', 'get').mockReturnValue(mockWorkspaceFolders);
        vi.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
            get: vi.fn().mockReturnValue(false),
        } as any);

        registry = new WorkspaceRegistry(mockExtensionContext, mockExtensionUri);
    });

    afterEach(() => {
        registry.dispose();
        vi.restoreAllMocks();
    });

    it('should resolve active folder through registry', async () => {
        await registry.ensureContext(mockWorkspaceFolders[0]);
        await registry.setActiveContext('/test/project-a');

        chatParticipant = new ChatParticipant(
            new TaskStore(vscode.Uri.file('/test/project-a')),
            new BoardConfigStore(vscode.Uri.file('/test/project-a')),
            mockExtensionUri,
            () => true,
            NO_OP_LOGGER,
            undefined,
            registry
        );

        // _resolveActiveFolderUri is private, test through behavior
        const folderUri = (chatParticipant as any)._resolveActiveFolderUri();
        expect(folderUri?.fsPath).toBe('/test/project-a');
    });

    it('should fall back to first workspace folder when no registry', () => {
        chatParticipant = new ChatParticipant(
            new TaskStore(vscode.Uri.file('/test/project-a')),
            new BoardConfigStore(vscode.Uri.file('/test/project-a')),
            mockExtensionUri,
            () => true,
            NO_OP_LOGGER
        );

        const folderUri = (chatParticipant as any)._resolveActiveFolderUri();
        expect(folderUri?.fsPath).toBe('/test/project-a');
    });
});

describe('Multi-root integration with BoardViewProvider', () => {
    let registry: WorkspaceRegistry;

    beforeEach(() => {
        vi.spyOn(vscode.workspace, 'workspaceFolders', 'get').mockReturnValue(mockWorkspaceFolders);
        vi.spyOn(vscode.workspace, 'getConfiguration').mockReturnValue({
            get: vi.fn().mockReturnValue(false),
        } as any);

        registry = new WorkspaceRegistry(mockExtensionContext, mockExtensionUri);
    });

    afterEach(() => {
        registry.dispose();
        vi.restoreAllMocks();
    });

    it('should track isInitialised dynamically', async () => {
        await registry.ensureContext(mockWorkspaceFolders[0]);
        const ctx = registry.getContextByFolder(mockWorkspaceFolders[0]);

        if (ctx) (ctx as any).isInitialised = false;

        const provider = new BoardViewProvider(
            mockExtensionUri,
            new TaskStore(vscode.Uri.file('/test/project-a')),
            new BoardConfigStore(vscode.Uri.file('/test/project-a')),
            () => ctx?.isInitialised ?? false,
            NO_OP_LOGGER
        );

        expect(provider.isCurrentlyInitialised).toBe(false);

        if (ctx) (ctx as any).isInitialised = true;
        expect(provider.isCurrentlyInitialised).toBe(true);
    });
});