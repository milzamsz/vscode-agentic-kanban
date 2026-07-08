import { describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { openBoardForContext } from '../extension';
import { KanbanEditorPanel } from '../KanbanEditorPanel';

describe('openBoardForContext', () => {
    it('awaits context refresh before opening settings', async () => {
        const order: string[] = [];
        const ctx = {
            isInitialised: true,
            boardConfigStore: {
                init: vi.fn(async () => { order.push('config:init'); }),
            },
            taskStore: {
                reload: vi.fn(async () => { order.push('tasks:reload'); }),
            },
        } as any;
        const panel = {
            triggerSettingsModal: vi.fn(() => { order.push('settings'); }),
        } as any;
        const createOrShow = vi.spyOn(KanbanEditorPanel, 'createOrShow').mockImplementation(() => {
            order.push('create');
            return panel;
        });

        await openBoardForContext({
            ctx,
            extensionUri: vscode.Uri.file('/test-extension') as any,
            taskStore: {} as any,
            boardConfigStore: {} as any,
            scaffolder: {} as any,
            registry: {} as any,
            afterShow: (openedPanel) => openedPanel.triggerSettingsModal(),
        });

        expect(order).toEqual(['config:init', 'tasks:reload', 'create', 'settings']);
        expect(createOrShow).toHaveBeenCalledOnce();
    });
});