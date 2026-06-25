import { afterEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { KanbanEditorPanel } from '../KanbanEditorPanel';
import { TaskStore } from '../TaskStore';
import { BoardConfigStore } from '../BoardConfigStore';

describe('KanbanEditorPanel multi-root wiring', () => {
    const extensionUri = vscode.Uri.file('/test-extension');
    const workspaceUri = vscode.Uri.file('/test-workspace');

    afterEach(() => {
        (KanbanEditorPanel.currentPanel as any)?._dispose?.();
        vi.restoreAllMocks();
    });

    it('passes the workspace registry through createOrShow', () => {
        const taskStore = new TaskStore(workspaceUri as any);
        const boardConfigStore = new BoardConfigStore(workspaceUri as any);
        const registry = { getActiveContext: vi.fn() } as any;

        const panel = KanbanEditorPanel.createOrShow(
            extensionUri as any,
            taskStore,
            boardConfigStore,
            undefined,
            true,
            undefined,
            undefined,
            registry,
        );

        expect((panel as any)._registry).toBe(registry);
    });

    it('passes the workspace registry through revive', () => {
        const taskStore = new TaskStore(workspaceUri as any);
        const boardConfigStore = new BoardConfigStore(workspaceUri as any);
        const registry = { getActiveContext: vi.fn() } as any;
        const webviewPanel = vscode.window.createWebviewPanel(
            'agentKanban.boardPanel',
            'Agentic Kanban',
            vscode.ViewColumn.One,
            { enableScripts: true },
        );

        KanbanEditorPanel.revive(
            webviewPanel as any,
            extensionUri as any,
            taskStore,
            boardConfigStore,
            undefined,
            true,
            undefined,
            undefined,
            registry,
        );

        expect((KanbanEditorPanel.currentPanel as any)?._registry).toBe(registry);
    });
});
