"use strict";

import * as vscode from 'vscode';
import { TaskStore } from './TaskStore';
import { BoardConfigStore } from './BoardConfigStore';
import type { Task, BoardConfig } from './types';
import { getReadyTasks } from './TaskReadiness';
import { interpolate, resolveVars, getLanePrompt } from './PromptTemplate';
import type { ProjectSkillService } from './ProjectSkillService';

/** A built stage driver prompt ready for injection. */
export interface StagePrompt {
    lane: string;
    task: Task;
    promptUri: vscode.Uri;
    content: string;
}

/** ============================================================================
 * Public API: Prompt builder service
 */

export async function buildStagePrompt(input: {
    taskStore: TaskStore;
    boardConfigStore: BoardConfigStore;
    skillService: ProjectSkillService;
    folderUri: vscode.Uri;
    extensionUri: vscode.Uri;
}): Promise<StagePrompt | null> {
    const { taskStore, boardConfigStore, skillService, folderUri, extensionUri } = input;

    const config = boardConfigStore.get();
    const allTasks = taskStore.getAll();

    // Find the first lane with a stage driver and ready tasks.
    for (const lane of config.lanes) {
        const promptName = getLanePrompt(config.profile, lane);
        if (!promptName) {
            continue;
        }

        const readyTasks = getReadyTasks(allTasks, { lane });
        if (readyTasks.length === 0) {
            continue;
        }

        // Select the first ready task deterministically.
        const task = readyTasks[0];

        // Load the prompt (workspace first, bundled fallback).
        const workspacePromptUri = vscode.Uri.joinPath(
            folderUri,
            '.agentkanban',
            'prompts',
            promptName
        );
        const bundledPromptUri = vscode.Uri.joinPath(extensionUri, 'assets', 'prompts', promptName);

        let promptUri = bundledPromptUri;
        let promptContent: string;

        try {
            const workspaceBytes = await vscode.workspace.fs.readFile(workspacePromptUri);
            promptUri = workspacePromptUri;
            promptContent = new TextDecoder().decode(workspaceBytes);
        } catch {
            try {
                const bundledBytes = await vscode.workspace.fs.readFile(bundledPromptUri);
                promptUri = bundledPromptUri;
                promptContent = new TextDecoder().decode(bundledBytes);
            } catch (err) {
                return null;
            }
        }

        // Build task-relative path.
        const taskUri = taskStore.getTaskUri(task.id);
        const taskRelPath = taskUri.fsPath.replace(
            folderUri.fsPath + (process.platform === 'win32' ? '\\' : '/'),
            ''
        );

        // Interpolate the prompt.
        const activeSkills = await skillService.getActiveSkills(folderUri);
        const vars = {
            ...resolveVars(config, activeSkills),
            taskTitle: task.title,
            taskFile: taskRelPath,
        };
        const content = interpolate(promptContent, vars);

        return { lane, task, promptUri, content };
    }

    return null;
}
