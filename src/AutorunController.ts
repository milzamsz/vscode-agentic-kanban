"use strict";

import * as vscode from 'vscode';
import { TaskStore } from './TaskStore';
import { BoardConfigStore } from './BoardConfigStore';
import { ProjectSkillService } from './ProjectSkillService';
import { buildStagePrompt } from './StagePromptBuilder';
import { makeBoardSnapshot } from './TaskReadiness';
import type { BoardSnapshot } from './TaskReadiness';

/** Explicit states for the autorun controller. */
export type AutorunState = 'stopped' | 'prompting' | 'awaiting' | 'fixed-point' | 'stalled';

/** ============================================================================
 * AutorunController: per-ProjectContext instance
 * Monitors the board, injects stage prompts, detects progress and fixed point.
 */
export class AutorunController {
    private state: AutorunState = 'stopped';
    private lastSnapshot?: BoardSnapshot;
    private disposable?: vscode.Disposable;
    private changeListener?: vscode.Disposable;

    constructor(
        private taskStore: TaskStore,
        private boardConfigStore: BoardConfigStore,
        private skillService: ProjectSkillService,
        private folderUri: vscode.Uri,
        private extensionUri: vscode.Uri,
        private statusBar?: vscode.StatusBarItem,
    ) {}

    /** Start the autonomous board driver. */
    async start(): Promise<void> {
        if (this.state !== 'stopped') {
            vscode.window.showInformationMessage('Autorun is already running.');
            return;
        }

        this.state = 'prompting';
        this.updateStatus();

        // Build and inject the first prompt
        const result = await buildStagePrompt({
            taskStore: this.taskStore,
            boardConfigStore: this.boardConfigStore,
            skillService: this.skillService,
            folderUri: this.folderUri,
            extensionUri: this.extensionUri,
        });

        if (!result) {
            this.state = 'fixed-point';
            vscode.window.showInformationMessage(
                'Autorun stopped: no ready stage-driver tasks in any lane.'
            );
            this.state = 'stopped';
            this.updateStatus();
            return;
        }

        // Take a snapshot before injecting the prompt
        this.lastSnapshot = makeBoardSnapshot(this.taskStore.getAll());

        // Inject the prompt into chat
        await vscode.commands.executeCommand('workbench.action.chat.open', {
            query: result.content,
        });

        this.state = 'awaiting';
        this.updateStatus(`Autorun awaiting progress after prompting "${result.task.title}"`);

        // Listen for task store changes (debounced via WorkspaceRegistry)
        this.changeListener = this.taskStore.onDidChange(async () => {
            await this.checkProgress();
        });

        this.disposable = this.changeListener;
    }

    /** Stop the autonomous board driver. */
    stop(): void {
        if (this.changeListener) {
            this.changeListener.dispose();
            this.changeListener = undefined;
        }
        if (this.disposable) {
            this.disposable.dispose();
            this.disposable = undefined;
        }
        this.state = 'stopped';
        this.lastSnapshot = undefined;
        vscode.window.showInformationMessage('Autorun stopped.');
        this.updateStatus();
    }

    private async checkProgress(): Promise<void> {
        if (this.state !== 'awaiting') {
            return;
        }

        const currentSnapshot = makeBoardSnapshot(this.taskStore.getAll());
        const lastResolver = this.lastSnapshot?.resolver ?? '';

        // Check if the board actually changed
        if (lastResolver === currentSnapshot.resolver) {
            // No meaningful workflow progress yet; keep waiting
            return;
        }

        // Board changed — did workflow advance?
        if (await this.didWorkflowAdvance(currentSnapshot)) {
            // Yes, build and inject the next prompt
            this.state = 'prompting';
            this.updateStatus();

            const result = await buildStagePrompt({
                taskStore: this.taskStore,
                boardConfigStore: this.boardConfigStore,
                skillService: this.skillService,
                folderUri: this.folderUri,
                extensionUri: this.extensionUri,
            });

            if (!result) {
                // Fixed point: no ready tasks remain
                this.state = 'fixed-point';
                vscode.window.showInformationMessage(
                    'Autorun stopped: no ready stage-driver tasks in any lane (fixed point).'
                );
                this.stop();
                return;
            }

            this.lastSnapshot = currentSnapshot;

            // Inject the next prompt
            await vscode.commands.executeCommand('workbench.action.chat.open', {
                query: result.content,
            });

            this.state = 'awaiting';
            this.updateStatus(`Autorun awaiting progress after prompting "${result.task.title}"`);
        } else {
            // Board changed but no workflow advance (e.g. task prose edited, unrelated task touched)
            this.state = 'stalled';
            vscode.window.showWarningMessage(
                'Autorun stopped: board changed but no task advanced. Review the task state and resume manually if needed.'
            );
            this.stop();
        }
    }

    private async didWorkflowAdvance(newSnapshot: BoardSnapshot): Promise<boolean> {
        if (!this.lastSnapshot) {
            return true;
        }

        const lastTasks = this.lastSnapshot.tasks;
        const newTasks = newSnapshot.tasks;

        // Did any task change lane or advance its state?
        for (const newTask of newTasks) {
            const oldTask = lastTasks.find((t) => t.id === newTask.id);
            if (!oldTask) continue;

            if (oldTask.lane !== newTask.lane) {
                return true;
            }

            // Check if checklist items were marked
            if (this.checklistAdvanced(oldTask, newTask)) {
                return true;
            }
        }

        // Did any new task appear that wasn't there before?
        const newTaskIds = new Set(newTasks.map((t) => t.id));
        const oldTaskIds = new Set(lastTasks.map((t) => t.id));
        if (newTaskIds.size > oldTaskIds.size) {
            return true;
        }

        return false;
    }

    private checklistAdvanced(oldTask: any, newTask: any): boolean {
        const oldChecked = (oldTask.description?.match(/- \[x\]/g) ?? []).length;
        const newChecked = (newTask.description?.match(/- \[x\]/g) ?? []).length;
        return newChecked > oldChecked;
    }

    private updateStatus(message?: string): void {
        if (!this.statusBar) {
            return;
        }

        if (this.state === 'stopped') {
            this.statusBar.hide();
        } else {
            this.statusBar.text = `$(sync~spin) Kanban Autorun: ${message ?? this.state}`;
            this.statusBar.show();
        }
    }

    isRunning(): boolean {
        return this.state !== 'stopped';
    }

    getState(): AutorunState {
        return this.state;
    }

    dispose(): void {
        this.stop();
    }
}
