import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChatParticipant } from '../agents/ChatParticipant';
import { TaskStore } from '../TaskStore';
import { BoardConfigStore } from '../BoardConfigStore';
import type { Task, BoardConfig } from '../types';
import { DEFAULT_ENFORCEMENT, DEFAULT_REVIEW_POLICY, PROFILE_LANES } from '../types';
import { Uri, commands, workspace, window, env } from 'vscode';

const execMock = vi.hoisted(() => vi.fn());
vi.mock('child_process', () => {
    const { promisify } = require('util');
    const fn = (cmd: string, opts: any, cb: any) => {
        const callback = typeof opts === 'function' ? opts : cb;
        execMock(cmd, opts).then(
            (r: any) => callback ? callback(null, r?.stdout ?? '', r?.stderr ?? '') : null,
            (e: any) => callback ? callback(e) : null,
        );
    };
    fn[promisify.custom] = execMock;
    return { exec: fn };
});

// Helpers to build mock request/response objects
function mockRequest(command: string | undefined, prompt: string) {
    return { command, prompt } as any;
}

function mockResponse() {
    const messages: string[] = [];
    const references: any[] = [];
    const buttons: any[] = [];
    return {
        markdown: (text: string) => { messages.push(text); },
        reference: (uri: any) => { references.push(uri); },
        button: (cmd: any) => { buttons.push(cmd); },
        messages,
        references,
        buttons,
    } as any;
}

const mockToken = { isCancellationRequested: false } as any;

/** Mock extensionUri for tests */
const extensionUri = Uri.file('/test-extension') as any;

function installMockFs(initialFiles: Record<string, string> = {}) {
    const files = new Map<string, Uint8Array>();
    const dirs = new Set<string>();
    const normalise = (uri: any) => (uri.fsPath || uri.path || String(uri)).replace(/\\/g, '/');
    const ensureParents = (filePath: string) => {
        const parts = filePath.split('/');
        for (let i = 1; i < parts.length; i++) {
            dirs.add(parts.slice(0, i).join('/') || '/');
        }
    };

    for (const [filePath, content] of Object.entries(initialFiles)) {
        const normalised = filePath.replace(/\\/g, '/');
        files.set(normalised, new TextEncoder().encode(content));
        ensureParents(normalised);
    }

    vi.spyOn(workspace.fs, 'readFile').mockImplementation(async (uri: any) => {
        const filePath = normalise(uri);
        const bytes = files.get(filePath);
        if (!bytes) {
            throw new Error(`File not found: ${filePath}`);
        }
        return bytes;
    });
    vi.spyOn(workspace.fs, 'writeFile').mockImplementation(async (uri: any, content: Uint8Array) => {
        const filePath = normalise(uri);
        ensureParents(filePath);
        files.set(filePath, content);
    });
    vi.spyOn(workspace.fs, 'stat').mockImplementation(async (uri: any) => {
        const filePath = normalise(uri);
        if (files.has(filePath)) {
            return { type: 1, ctime: 0, mtime: 0, size: files.get(filePath)!.length } as any;
        }
        if (dirs.has(filePath)) {
            return { type: 2, ctime: 0, mtime: 0, size: 0 } as any;
        }
        throw new Error(`File not found: ${filePath}`);
    });
    vi.spyOn(workspace.fs, 'createDirectory').mockImplementation(async (uri: any) => {
        dirs.add(normalise(uri));
    });
    vi.spyOn(workspace.fs, 'rename').mockImplementation(async (src: any, dest: any) => {
        const s = normalise(src);
        const d = normalise(dest);
        for (const [k, v] of [...files]) {
            if (k === s || k.startsWith(s + '/')) {
                files.delete(k);
                const nk = d + k.slice(s.length);
                files.set(nk, v);
                ensureParents(nk);
            }
        }
        dirs.add(d);
    });
    vi.spyOn(workspace.fs, 'delete').mockImplementation(async (uri: any) => {
        files.delete(normalise(uri));
    });

    return {
        files,
        text: (filePath: string) => new TextDecoder().decode(files.get(filePath.replace(/\\/g, '/')) ?? new Uint8Array()),
        has: (filePath: string) => files.has(filePath.replace(/\\/g, '/')),
    };
}

describe('ChatParticipant', () => {
    let taskStore: TaskStore;
    let boardConfigStore: BoardConfigStore;
    let participant: ChatParticipant;

    beforeEach(() => {
        const uri = { scheme: 'file', fsPath: '/test-workspace', path: '/test-workspace', toString: () => '/test-workspace' } as any;
        taskStore = new TaskStore(uri);
        boardConfigStore = new BoardConfigStore(uri);
        participant = new ChatParticipant(taskStore, boardConfigStore, extensionUri);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('handleRequest routing', () => {
        it('should show help for unknown command', async () => {
            const response = mockResponse();
            await participant.handleRequest(mockRequest(undefined, ''), {} as any, response, mockToken);

            expect(response.messages.length).toBeGreaterThan(0);
            expect(response.messages[0]).toContain('Available commands');
            expect(response.messages[0]).toContain('/refresh');
        });

        it('should route /new command', async () => {
            const response = mockResponse();
            vi.spyOn(taskStore, 'createTask').mockReturnValue({
                id: 'task_001_test', title: 'Test', lane: 'todo',
                created: '', updated: '', description: '',
            });
            vi.spyOn(taskStore, 'save').mockResolvedValue(undefined);

            await participant.handleRequest(mockRequest('new', 'Test Task'), {} as any, response, mockToken);

            expect(response.messages.some((m: string) => m.includes('Created task'))).toBe(true);
        });

        it('should route /task command', async () => {
            const task: Task = {
                id: 'task_1', title: 'My Task', lane: 'doing',
                created: '2026-03-08T10:00:00.000Z', updated: '2026-03-08T10:00:00.000Z', description: '',
            };
            (taskStore as any).tasks.set(task.id, task);

            vi.spyOn(workspace.fs, 'readFile').mockResolvedValue(new TextEncoder().encode('# Template'));
            vi.spyOn(workspace.fs, 'writeFile').mockResolvedValue(undefined);
            vi.spyOn(workspace, 'openTextDocument').mockResolvedValue({} as any);
            vi.spyOn(window, 'showTextDocument').mockResolvedValue(undefined as any);

            const response = mockResponse();
            await participant.handleRequest(mockRequest('task', 'My Task'), {} as any, response, mockToken);

            expect(response.messages.some((m: string) => m.includes('My Task'))).toBe(true);
        });

        it('should route /refresh command to verb handler', async () => {
            const task: Task = {
                id: 'task_refresh_1', title: 'Refresh Task', lane: 'doing',
                created: '2026-03-08T10:00:00.000Z', updated: '2026-03-08T10:00:00.000Z', description: '',
            };
            (taskStore as any).tasks.set(task.id, task);
            participant.lastSelectedTaskId = task.id;

            vi.spyOn(workspace.fs, 'readFile').mockResolvedValue(new TextEncoder().encode('# Template'));
            vi.spyOn(workspace.fs, 'writeFile').mockResolvedValue(undefined);
            vi.spyOn(workspace, 'openTextDocument').mockResolvedValue({} as any);
            vi.spyOn(window, 'showTextDocument').mockResolvedValue(undefined as any);

            const response = mockResponse();
            await participant.handleRequest(mockRequest('refresh', ''), {} as any, response, mockToken);

            expect(response.messages.some((m: string) => m.includes('REFRESH'))).toBe(true);
            expect(response.messages.some((m: string) => m.includes('Refresh Task'))).toBe(true);
        });

        it('should include /refresh in help text', async () => {
            const response = mockResponse();
            await participant.handleRequest(mockRequest(undefined, ''), {} as any, response, mockToken);
            expect(response.messages.some((m: string) => m.includes('/refresh'))).toBe(true);
        });

        it('should include /spec in help text', async () => {
            const response = mockResponse();
            await participant.handleRequest(mockRequest(undefined, ''), {} as any, response, mockToken);
            expect(response.messages.some((m: string) => m.includes('/spec'))).toBe(true);
        });
    });

    describe('handleNew', () => {
        beforeEach(() => {
            vi.spyOn(workspace.fs, 'readFile').mockResolvedValue(new TextEncoder().encode('# Template'));
            vi.spyOn(workspace.fs, 'writeFile').mockResolvedValue(undefined);
        });

        it('should show usage when no title given', async () => {
            const response = mockResponse();
            await participant.handleRequest(mockRequest('new', ''), {} as any, response, mockToken);

            expect(response.messages[0]).toContain('Usage');
        });

        it('should create task and report file path', async () => {
            const response = mockResponse();
            vi.spyOn(taskStore, 'createTask').mockReturnValue({
                id: 'task_20260308_143045123_abc123_my_task',
                title: 'My Task', lane: 'todo',
                created: '', updated: '', description: '',
            });
            vi.spyOn(taskStore, 'save').mockResolvedValue(undefined);

            await participant.handleRequest(mockRequest('new', 'My Task'), {} as any, response, mockToken);

            expect(response.messages.some((m: string) => m.includes('**My Task**'))).toBe(true);
            expect(response.messages.some((m: string) => m.includes('File:'))).toBe(true);
        });

        it('should suggest /task after creating', async () => {
            const response = mockResponse();
            vi.spyOn(taskStore, 'createTask').mockReturnValue({
                id: 'task_1', title: 'New Feature', lane: 'todo',
                created: '', updated: '', description: '',
            });
            vi.spyOn(taskStore, 'save').mockResolvedValue(undefined);

            await participant.handleRequest(mockRequest('new', 'New Feature'), {} as any, response, mockToken);

            expect(response.messages.some((m: string) => m.includes('/task'))).toBe(true);
        });

        it('should auto-initialise with the configured default profile', async () => {
            const uninitialisedParticipant = new ChatParticipant(
                taskStore,
                boardConfigStore,
                extensionUri,
                () => false,
            );
            vi.spyOn(workspace, 'getConfiguration').mockReturnValue({
                get: (key: string, defaultValue?: any) => key === 'defaultProfile' ? 'lite' : defaultValue,
                update: async () => { },
            } as any);
            const execSpy = vi.spyOn(commands, 'executeCommand').mockResolvedValue(undefined);
            vi.spyOn(taskStore, 'createTask').mockReturnValue({
                id: 'task_new_default',
                title: 'Default Profile Task',
                lane: 'todo',
                created: '',
                updated: '',
                description: '',
            });
            vi.spyOn(taskStore, 'save').mockResolvedValue(undefined);

            const response = mockResponse();
            await uninitialisedParticipant.handleRequest(mockRequest('new', 'Default Profile Task'), {} as any, response, mockToken);

            expect(execSpy).toHaveBeenCalledWith('agentKanban.initialise', 'lite');
        });
    });

    describe('handleTask', () => {
        let task: Task;

        beforeEach(() => {
            task = {
                id: 'task_20260308_143045123_abc123_auth',
                title: 'Auth Feature',
                lane: 'doing',
                created: '2026-03-08T10:00:00.000Z',
                updated: '2026-03-08T10:00:00.000Z',
                description: '',
            };
            (taskStore as any).tasks.set(task.id, task);

            vi.spyOn(workspace.fs, 'readFile').mockResolvedValue(
                new TextEncoder().encode('# Agentic Kanban — Instruction'),
            );
            vi.spyOn(workspace.fs, 'writeFile').mockResolvedValue(undefined);
            vi.spyOn(workspace, 'openTextDocument').mockResolvedValue({} as any);
            vi.spyOn(window, 'showTextDocument').mockResolvedValue(undefined as any);
        });

        it('should list active tasks when no name given', async () => {
            const response = mockResponse();
            await participant.handleRequest(mockRequest('task', ''), {} as any, response, mockToken);

            expect(response.messages.some((m: string) => m.includes('Auth Feature'))).toBe(true);
            expect(response.messages.some((m: string) => m.includes('Active tasks'))).toBe(true);
        });

        it('should show no-tasks message when board is empty', async () => {
            (taskStore as any).tasks.clear();
            const response = mockResponse();
            await participant.handleRequest(mockRequest('task', ''), {} as any, response, mockToken);

            expect(response.messages.some((m: string) => m.includes('No active tasks'))).toBe(true);
        });

        it('should select task and show context', async () => {
            const response = mockResponse();
            await participant.handleRequest(mockRequest('task', 'Auth Feature'), {} as any, response, mockToken);

            expect(response.messages.some((m: string) => m.includes('Working on task: **Auth Feature**'))).toBe(true);
            expect(response.messages.some((m: string) => m.includes('INSTRUCTION.md'))).toBe(true);
            expect(response.messages.some((m: string) => m.includes('Task file:'))).toBe(true);
        });

        it('should open the task file in the editor', async () => {
            const openSpy = vi.spyOn(workspace, 'openTextDocument');
            const showSpy = vi.spyOn(window, 'showTextDocument');

            const response = mockResponse();
            await participant.handleRequest(mockRequest('task', 'Auth Feature'), {} as any, response, mockToken);

            expect(openSpy).toHaveBeenCalled();
            expect(showSpy).toHaveBeenCalledWith(expect.anything(), { preview: false });
        });

        it('should guide user to use /refresh or /worktree', async () => {
            const response = mockResponse();
            await participant.handleRequest(mockRequest('task', 'Auth Feature'), {} as any, response, mockToken);

            expect(response.messages.some((m: string) =>
                m.includes('/refresh') || m.includes('/worktree'),
            )).toBe(true);
        });

        it('should report no match for unknown task', async () => {
            const response = mockResponse();
            await participant.handleRequest(mockRequest('task', 'Nonexistent'), {} as any, response, mockToken);

            expect(response.messages.some((m: string) =>
                m.includes('No task found') || m.includes('No task match'),
            )).toBe(true);
        });

        it('should match case-insensitively', async () => {
            const response = mockResponse();
            await participant.handleRequest(mockRequest('task', 'auth feature'), {} as any, response, mockToken);

            expect(response.messages.some((m: string) => m.includes('Auth Feature'))).toBe(true);
            expect(response.messages.some((m: string) => m.includes('No task'))).toBe(false);
        });

        it('should match partial first word', async () => {
            const tasks: Task[] = [
                { id: 'task_2', title: 'Login Bug', lane: 'todo', created: '', updated: '', description: '' },
            ];
            for (const t of tasks) {
                (taskStore as any).tasks.set(t.id, t);
            }

            const response = mockResponse();
            await participant.handleRequest(mockRequest('task', 'Login'), {} as any, response, mockToken);

            expect(response.messages.some((m: string) => m.includes('Login Bug'))).toBe(true);
        });

        it('should exclude done tasks from matching', async () => {
            (taskStore as any).tasks.clear();
            const doneTask: Task = {
                id: 'task_done', title: 'Done Task', lane: 'done',
                created: '2026-03-08T10:00:00.000Z', updated: '2026-03-08T10:00:00.000Z', description: '',
            };
            (taskStore as any).tasks.set(doneTask.id, doneTask);

            const response = mockResponse();
            await participant.handleRequest(mockRequest('task', 'Done Task'), {} as any, response, mockToken);

            expect(response.messages.some((m: string) =>
                m.includes('No task found') || m.includes('No task match'),
            )).toBe(true);
        });

        it('should include custom instruction file reference when setting is configured', async () => {
            vi.spyOn(workspace, 'getConfiguration').mockReturnValue({
                get: (key: string, defaultValue?: any) => {
                    if (key === 'customInstructionFile') { return 'my-instructions.md'; }
                    return defaultValue;
                },
                update: async () => { },
            } as any);
            vi.spyOn(workspace.fs, 'stat').mockResolvedValue({ type: 1, ctime: 0, mtime: 0, size: 100 } as any);

            const response = mockResponse();
            await participant.handleRequest(mockRequest('task', 'Auth Feature'), {} as any, response, mockToken);

            expect(response.messages.some((m: string) =>
                m.includes('my-instructions.md') && m.includes('additional instructions'),
            )).toBe(true);
        });

        it('should not include custom instruction reference when setting is empty', async () => {
            vi.spyOn(workspace, 'getConfiguration').mockReturnValue({
                get: (key: string, defaultValue?: any) => {
                    if (key === 'customInstructionFile') { return ''; }
                    return defaultValue;
                },
                update: async () => { },
            } as any);

            const response = mockResponse();
            await participant.handleRequest(mockRequest('task', 'Auth Feature'), {} as any, response, mockToken);

            expect(response.messages.every((m: string) => !m.includes('additional instructions'))).toBe(true);
        });

        it('should skip custom instruction reference when file does not exist', async () => {
            vi.spyOn(workspace, 'getConfiguration').mockReturnValue({
                get: (key: string, defaultValue?: any) => {
                    if (key === 'customInstructionFile') { return 'nonexistent.md'; }
                    return defaultValue;
                },
                update: async () => { },
            } as any);
            vi.spyOn(workspace.fs, 'stat').mockRejectedValue(new Error('File not found'));

            const response = mockResponse();
            await participant.handleRequest(mockRequest('task', 'Auth Feature'), {} as any, response, mockToken);

            expect(response.messages.every((m: string) => !m.includes('additional instructions'))).toBe(true);
        });

        it('should place custom instruction reference after INSTRUCTION.md and before task context', async () => {
            vi.spyOn(workspace, 'getConfiguration').mockReturnValue({
                get: (key: string, defaultValue?: any) => {
                    if (key === 'customInstructionFile') { return 'custom.md'; }
                    return defaultValue;
                },
                update: async () => { },
            } as any);
            vi.spyOn(workspace.fs, 'stat').mockResolvedValue({ type: 1, ctime: 0, mtime: 0, size: 100 } as any);

            const response = mockResponse();
            await participant.handleRequest(mockRequest('task', 'Auth Feature'), {} as any, response, mockToken);

            const instrIdx = response.messages.findIndex((m: string) => m.includes('INSTRUCTION.md'));
            const customIdx = response.messages.findIndex((m: string) => m.includes('custom.md'));
            const taskIdx = response.messages.findIndex((m: string) => m.includes('Working on task'));

            expect(instrIdx).toBeGreaterThanOrEqual(0);
            expect(customIdx).toBeGreaterThan(instrIdx);
            expect(taskIdx).toBeGreaterThan(customIdx);
        });
    });

    describe('handleSpec', () => {
        const taskFilePath = '/test-workspace/.agentkanban/tasks/task_20260615_abc123_auth_feature.md';
        const proposalTemplate = '# Change Proposal: {{TASK_TITLE}}\n';
        const designTemplate = '# Design: {{TASK_TITLE}}\n';
        const tasksTemplate = '# Tasks: {{TASK_TITLE}}\n';
        const specTemplate = '# Delta Spec: {{CAPABILITY}}\n';

        beforeEach(() => {
            vi.spyOn(workspace, 'openTextDocument').mockResolvedValue({} as any);
            vi.spyOn(window, 'showTextDocument').mockResolvedValue(undefined as any);
        });

        it('should require a selected task', async () => {
            const response = mockResponse();
            await participant.handleRequest(mockRequest('spec', ''), {} as any, response, mockToken);

            expect(response.messages.some((m: string) => m.includes('No task selected'))).toBe(true);
        });

        it('should scaffold standard profile spec artifacts and save change metadata', async () => {
            const fs = installMockFs({
                '/test-extension/assets/spec-templates/proposal.md': proposalTemplate,
                '/test-extension/assets/spec-templates/design.md': designTemplate,
                '/test-extension/assets/spec-templates/tasks.md': tasksTemplate,
                '/test-extension/assets/spec-templates/spec.md': specTemplate,
                taskFilePath: TaskStore.serialise({
                    id: 'task_20260615_abc123_auth_feature',
                    title: 'Auth Feature',
                    lane: 'planning',
                    created: '2026-06-15T00:00:00.000Z',
                    updated: '2026-06-15T00:00:00.000Z',
                    description: 'Implement auth',
                    slug: 'auth_feature',
                }, '\n## Conversation\n\n### user\n\n'),
            });
            const task: Task = {
                id: 'task_20260615_abc123_auth_feature',
                title: 'Auth Feature',
                lane: 'planning',
                created: '2026-06-15T00:00:00.000Z',
                updated: '2026-06-15T00:00:00.000Z',
                description: 'Implement auth',
                slug: 'auth_feature',
            };
            (taskStore as any).tasks.set(task.id, task);
            participant.lastSelectedTaskId = task.id;

            const response = mockResponse();
            await participant.handleRequest(mockRequest('spec', 'authentication'), {} as any, response, mockToken);

            expect(fs.has('/test-workspace/.agentkanban/changes/auth_feature/proposal.md')).toBe(true);
            expect(fs.has('/test-workspace/.agentkanban/changes/auth_feature/design.md')).toBe(true);
            expect(fs.has('/test-workspace/.agentkanban/changes/auth_feature/tasks.md')).toBe(true);
            // Capability spec lives once under specs/<capability>/, not nested per change.
            expect(fs.has('/test-workspace/.agentkanban/specs/authentication/spec.md')).toBe(true);
            expect(fs.has('/test-workspace/.agentkanban/changes/auth_feature/specs/authentication/spec.md')).toBe(false);
            expect(task.change).toBe('.agentkanban/changes/auth_feature');
            expect(task.spec).toBe('.agentkanban/specs/authentication/spec.md');
            expect(fs.text(taskFilePath)).toContain('change: .agentkanban/changes/auth_feature');
            expect(fs.text(taskFilePath)).toContain('spec: .agentkanban/specs/authentication/spec.md');
            expect(response.references.map((ref: any) => ref.fsPath || ref.path)).toContain('/test-workspace/.agentkanban/changes/auth_feature/proposal.md');
            expect(response.references.map((ref: any) => ref.fsPath || ref.path)).toContain('/test-workspace/.agentkanban/specs/authentication/spec.md');
            expect(response.messages.some((m: string) => m.includes('Spec change scaffolded'))).toBe(true);
        });

        it('should scaffold lite profile without design or delta spec', async () => {
            (boardConfigStore as any).config = { ...(boardConfigStore as any).config, profile: 'lite', lanes: ['backlog', 'in-progress', 'done'] };
            const fs = installMockFs({
                '/test-extension/assets/spec-templates/proposal.md': proposalTemplate,
                '/test-extension/assets/spec-templates/design.md': designTemplate,
                '/test-extension/assets/spec-templates/tasks.md': tasksTemplate,
                '/test-extension/assets/spec-templates/spec.md': specTemplate,
                taskFilePath: TaskStore.serialise({
                    id: 'task_20260615_abc123_auth_feature',
                    title: 'Auth Feature',
                    lane: 'backlog',
                    created: '2026-06-15T00:00:00.000Z',
                    updated: '2026-06-15T00:00:00.000Z',
                    description: '',
                    slug: 'auth_feature',
                }, '\n## Conversation\n\n### user\n\n'),
            });
            const task: Task = {
                id: 'task_20260615_abc123_auth_feature',
                title: 'Auth Feature',
                lane: 'backlog',
                created: '2026-06-15T00:00:00.000Z',
                updated: '2026-06-15T00:00:00.000Z',
                description: '',
                slug: 'auth_feature',
            };
            (taskStore as any).tasks.set(task.id, task);
            participant.lastSelectedTaskId = task.id;

            const response = mockResponse();
            await participant.handleRequest(mockRequest('spec', ''), {} as any, response, mockToken);

            expect(fs.has('/test-workspace/.agentkanban/changes/auth_feature/proposal.md')).toBe(true);
            expect(fs.has('/test-workspace/.agentkanban/changes/auth_feature/tasks.md')).toBe(true);
            expect(fs.has('/test-workspace/.agentkanban/changes/auth_feature/design.md')).toBe(false);
            // Lite still gets a capability spec (defaults capability to the slug); never nested.
            expect(fs.has('/test-workspace/.agentkanban/specs/auth_feature/spec.md')).toBe(true);
            expect(fs.has('/test-workspace/.agentkanban/changes/auth_feature/specs/auth_feature/spec.md')).toBe(false);
            expect(response.messages.some((m: string) => m.includes('Profile: `lite`'))).toBe(true);
        });

        it('should preserve existing spec files on rerun', async () => {
            const fs = installMockFs({
                '/test-extension/assets/spec-templates/proposal.md': proposalTemplate,
                '/test-extension/assets/spec-templates/design.md': designTemplate,
                '/test-extension/assets/spec-templates/tasks.md': tasksTemplate,
                '/test-extension/assets/spec-templates/spec.md': specTemplate,
                taskFilePath: TaskStore.serialise({
                    id: 'task_20260615_abc123_auth_feature',
                    title: 'Auth Feature',
                    lane: 'planning',
                    created: '2026-06-15T00:00:00.000Z',
                    updated: '2026-06-15T00:00:00.000Z',
                    description: '',
                    slug: 'auth_feature',
                }, '\n## Conversation\n\n### user\n\n'),
                '/test-workspace/.agentkanban/changes/auth_feature/proposal.md': 'existing proposal',
                '/test-workspace/.agentkanban/changes/auth_feature/design.md': 'existing design',
                '/test-workspace/.agentkanban/changes/auth_feature/tasks.md': 'existing tasks',
                '/test-workspace/.agentkanban/changes/auth_feature/specs/auth_feature/spec.md': 'existing spec',
            });
            const task: Task = {
                id: 'task_20260615_abc123_auth_feature',
                title: 'Auth Feature',
                lane: 'planning',
                created: '2026-06-15T00:00:00.000Z',
                updated: '2026-06-15T00:00:00.000Z',
                description: '',
                slug: 'auth_feature',
            };
            (taskStore as any).tasks.set(task.id, task);
            participant.lastSelectedTaskId = task.id;

            const response = mockResponse();
            await participant.handleRequest(mockRequest('spec', ''), {} as any, response, mockToken);

            expect(fs.text('/test-workspace/.agentkanban/changes/auth_feature/proposal.md')).toBe('existing proposal');
            expect(response.messages.some((m: string) => m.includes('Preserved existing files'))).toBe(true);
        });

        it('should persist extras.change when saving through TaskStore', async () => {
            const fs = installMockFs({
                taskFilePath: TaskStore.serialise({
                    id: 'task_20260615_abc123_auth_feature',
                    title: 'Auth Feature',
                    lane: 'planning',
                    created: '2026-06-15T00:00:00.000Z',
                    updated: '2026-06-15T00:00:00.000Z',
                    description: '',
                    slug: 'auth_feature',
                }, '\n## Conversation\n\n### user\n\n'),
            });
            const task: Task = {
                id: 'task_20260615_abc123_auth_feature',
                title: 'Auth Feature',
                lane: 'planning',
                created: '2026-06-15T00:00:00.000Z',
                updated: '2026-06-15T00:00:00.000Z',
                description: '',
                slug: 'auth_feature',
                extras: { change: '.agentkanban/changes/auth_feature' },
            };

            await taskStore.save(task);

            expect(fs.text(taskFilePath)).toContain('change: .agentkanban/changes/auth_feature');
        });
    });

    describe('handleArchive', () => {
        it('moves a change folder to changes/archive and leaves the capability spec', async () => {
            const fs = installMockFs({
                '/test-workspace/.agentkanban/changes/auth_feature/proposal.md': 'p',
                '/test-workspace/.agentkanban/changes/auth_feature/tasks.md': 't',
                '/test-workspace/.agentkanban/specs/authentication/spec.md': 'spec',
            });
            const task: Task = {
                id: 'task_20260615_abc123_auth_feature',
                title: 'Auth Feature', lane: 'done',
                created: '2026-06-15T00:00:00.000Z', updated: '2026-06-15T00:00:00.000Z',
                description: '', slug: 'auth_feature',
                change: '.agentkanban/changes/auth_feature',
                spec: '.agentkanban/specs/authentication/spec.md',
            };
            (taskStore as any).tasks.set(task.id, task);
            participant.lastSelectedTaskId = task.id;

            const response = mockResponse();
            await participant.handleRequest(mockRequest('archive', ''), {} as any, response, mockToken);

            expect(fs.has('/test-workspace/.agentkanban/changes/archive/auth_feature/tasks.md')).toBe(true);
            expect(fs.has('/test-workspace/.agentkanban/changes/auth_feature/tasks.md')).toBe(false);
            // Capability spec is shared — left in place.
            expect(fs.has('/test-workspace/.agentkanban/specs/authentication/spec.md')).toBe(true);
            expect(response.messages.some((m: string) => m.includes('Archived change'))).toBe(true);
        });

        it('reports when the change folder is missing', async () => {
            installMockFs({});
            const response = mockResponse();
            await participant.handleRequest(mockRequest('archive', 'no_such_slug'), {} as any, response, mockToken);
            expect(response.messages.some((m: string) => m.includes('No change folder'))).toBe(true);
        });
    });

    describe('scaffoldPrompts / handlePrompts', () => {
        const PROMPT_NAMES = [
            'README.md', 'new-task-intake.md', 'stage-backlog-to-planning.md',
            'stage-planning-to-review.md', 'stage-review-to-in-progress.md',
            'stage-review-to-done.md', 'stage-blocked-and-resume.md', 'production-readiness-audit.md',
            'work-on-task.md', 'stage-backlog-to-inprogress.md', 'stage-inprogress-to-done.md',
        ];
        const seedAssets = (extra: Record<string, string> = {}) => {
            const files: Record<string, string> = { ...extra };
            for (const n of PROMPT_NAMES) {
                files[`/test-extension/assets/prompts/${n}`] = `# bundled ${n}`;
            }
            return installMockFs(files);
        };

        it('writes all bundled prompts on init, skipping ones that already exist', async () => {
            const fs = seedAssets({
                '/test-workspace/.agentkanban/prompts/README.md': '# my edited readme',
            });

            const res = await participant.scaffoldPrompts(false);

            expect(res.skipped).toContain('README.md');
            expect(res.created).toContain('stage-planning-to-review.md');
            // Edited file preserved on init.
            expect(fs.text('/test-workspace/.agentkanban/prompts/README.md')).toBe('# my edited readme');
            expect(fs.has('/test-workspace/.agentkanban/prompts/stage-planning-to-review.md')).toBe(true);
        });

        it('/prompts refresh overwrites to the bundled versions', async () => {
            const fs = seedAssets({
                '/test-workspace/.agentkanban/prompts/README.md': '# my edited readme',
            });

            const response = mockResponse();
            await participant.handleRequest(mockRequest('prompts', 'refresh'), {} as any, response, mockToken);

            expect(fs.text('/test-workspace/.agentkanban/prompts/README.md')).toBe('# bundled README.md');
            expect(response.messages.some((m: string) => m.includes('Refreshed stage-driver prompts'))).toBe(true);
        });

        it('prunes stale Standard-only prompt files when refreshing a Lite workspace', async () => {
            const fs = seedAssets({
                '/test-workspace/.agentkanban/prompts/stage-backlog-to-planning.md': '# stale standard prompt',
            });
            const config = boardConfigStore.get();
            config.profile = 'lite';
            config.lanes = ['backlog', 'in-progress', 'done'];

            await participant.scaffoldPrompts(true);

            expect(fs.has('/test-workspace/.agentkanban/prompts/stage-backlog-to-planning.md')).toBe(false);
            expect(fs.has('/test-workspace/.agentkanban/prompts/stage-backlog-to-inprogress.md')).toBe(true);
            expect(fs.has('/test-workspace/.agentkanban/prompts/stage-inprogress-to-done.md')).toBe(true);
        });
    });

    describe('resolveTaskFromPrompt', () => {
        beforeEach(() => {
            const tasks: Task[] = [
                { id: 'task_1', title: 'Auth Feature', lane: 'doing', created: '', updated: '', description: '' },
                { id: 'task_2', title: 'Login Bug', lane: 'todo', created: '', updated: '', description: '' },
                { id: 'task_3', title: 'Done Task', lane: 'done', created: '', updated: '', description: '' },
            ];
            for (const t of tasks) {
                (taskStore as any).tasks.set(t.id, t);
            }
        });

        it('should match exact title (case-insensitive)', () => {
            const result = participant.resolveTaskFromPrompt('auth feature');

            expect(result.task).toBeDefined();
            expect(result.task!.title).toBe('Auth Feature');
            expect(result.freeText).toBe('');
        });

        it('should extract free text after title match', () => {
            const result = participant.resolveTaskFromPrompt('Auth Feature focus on OAuth2');

            expect(result.task!.title).toBe('Auth Feature');
            expect(result.freeText).toBe('focus on OAuth2');
        });

        it('should exclude done lane tasks', () => {
            const result = participant.resolveTaskFromPrompt('Done Task');

            expect(result.task).toBeUndefined();
        });

        it('should match partial first word', () => {
            const result = participant.resolveTaskFromPrompt('Login fix the issue');

            expect(result.task!.title).toBe('Login Bug');
            expect(result.freeText).toBe('fix the issue');
        });

        it('should return undefined for no match', () => {
            const result = participant.resolveTaskFromPrompt('Nonexistent');

            expect(result.task).toBeUndefined();
            expect(result.freeText).toBe('Nonexistent');
        });

        it('should return undefined for empty prompt', () => {
            const result = participant.resolveTaskFromPrompt('');

            expect(result.task).toBeUndefined();
            expect(result.freeText).toBe('');
        });
    });

    describe('getActiveTaskTitles', () => {
        it('should return titles of non-done tasks', () => {
            const tasks: Task[] = [
                { id: 'task_1', title: 'Active Task', lane: 'doing', created: '', updated: '', description: '' },
                { id: 'task_2', title: 'Completed', lane: 'done', created: '', updated: '', description: '' },
            ];
            for (const t of tasks) {
                (taskStore as any).tasks.set(t.id, t);
            }

            const titles = participant.getActiveTaskTitles();

            expect(titles).toEqual(['Active Task']);
        });

        it('should return empty array when no active tasks', () => {
            expect(participant.getActiveTaskTitles()).toEqual([]);
        });
    });

    describe('syncInstructionFile', () => {
        it('should create INSTRUCTION.md when it does not exist', async () => {
            const readSpy = vi.spyOn(workspace.fs, 'readFile').mockResolvedValueOnce(
                new TextEncoder().encode('# Template content'),
            );
            const writeSpy = vi.spyOn(workspace.fs, 'writeFile').mockResolvedValue(undefined);

            const uri = await participant.syncInstructionFile();

            expect(uri).toBeDefined();
            expect(readSpy).toHaveBeenCalled();
            expect(writeSpy).toHaveBeenCalled();
        });

        it('should overwrite INSTRUCTION.md when it already exists', async () => {
            const templateContent = new TextEncoder().encode('# Updated template');
            const readSpy = vi.spyOn(workspace.fs, 'readFile').mockResolvedValueOnce(templateContent);
            const writeSpy = vi.spyOn(workspace.fs, 'writeFile').mockResolvedValue(undefined);

            const uri = await participant.syncInstructionFile();

            expect(uri).toBeDefined();
            expect(readSpy).toHaveBeenCalled();
            expect(writeSpy).toHaveBeenCalled();
        });

        it('should write the exact template content to the workspace', async () => {
            const templateContent = new TextEncoder().encode('# Exact template bytes');
            vi.spyOn(workspace.fs, 'readFile').mockResolvedValueOnce(templateContent);
            const writeSpy = vi.spyOn(workspace.fs, 'writeFile').mockResolvedValue(undefined);

            await participant.syncInstructionFile();

            expect(writeSpy).toHaveBeenCalledWith(expect.anything(), templateContent);
        });
    });

    describe('syncAgentsMdSection', () => {
        it('should create AGENTS.md with sentinel section when file does not exist', async () => {
            // readFile throws → file doesn't exist
            vi.spyOn(workspace.fs, 'readFile').mockRejectedValueOnce(new Error('File not found'));
            const writeSpy = vi.spyOn(workspace.fs, 'writeFile').mockResolvedValue(undefined);

            await participant.syncAgentsMdSection();

            expect(writeSpy).toHaveBeenCalled();
            const written = new TextDecoder().decode(writeSpy.mock.calls[0][1] as Uint8Array);
            expect(written).toContain('<!-- BEGIN AGENTIC KANBAN');
            expect(written).toContain('<!-- END AGENTIC KANBAN -->');
            expect(written).toContain('INSTRUCTION.md');
            expect(written).toContain('memory.md');
            expect(written).toContain('re-read it before responding');
        });

        it('should append sentinel section to existing AGENTS.md preserving user content', async () => {
            const existingContent = '# My AGENTS\n\nSome user instructions.\n';
            vi.spyOn(workspace.fs, 'readFile').mockResolvedValueOnce(
                new TextEncoder().encode(existingContent),
            );
            const writeSpy = vi.spyOn(workspace.fs, 'writeFile').mockResolvedValue(undefined);

            await participant.syncAgentsMdSection();

            expect(writeSpy).toHaveBeenCalled();
            const written = new TextDecoder().decode(writeSpy.mock.calls[0][1] as Uint8Array);
            expect(written).toContain('# My AGENTS');
            expect(written).toContain('Some user instructions.');
            expect(written).toContain('<!-- BEGIN AGENTIC KANBAN');
            expect(written).toContain('<!-- END AGENTIC KANBAN -->');
        });

        it('should replace a legacy AGENT KANBAN sentinel and upgrade it to AGENTIC KANBAN markers', async () => {
            const existingContent = [
                '# My AGENTS',
                '',
                '<!-- BEGIN AGENT KANBAN — DO NOT EDIT THIS SECTION -->',
                '## Old Content',
                '<!-- END AGENT KANBAN -->',
                '',
                'User content below.',
            ].join('\n');
            vi.spyOn(workspace.fs, 'readFile').mockResolvedValueOnce(
                new TextEncoder().encode(existingContent),
            );
            const writeSpy = vi.spyOn(workspace.fs, 'writeFile').mockResolvedValue(undefined);

            await participant.syncAgentsMdSection();

            const written = new TextDecoder().decode(writeSpy.mock.calls[0][1] as Uint8Array);
            expect(written).toContain('# My AGENTS');
            expect(written).toContain('User content below.');
            expect(written).toContain('INSTRUCTION.md');
            expect(written).not.toContain('## Old Content');
            // Legacy markers are upgraded in place; no old markers remain.
            expect(written).toContain('<!-- BEGIN AGENTIC KANBAN');
            expect(written).toContain('<!-- END AGENTIC KANBAN -->');
            expect(written).not.toContain('<!-- BEGIN AGENT KANBAN —');
            expect(written).not.toContain('<!-- END AGENT KANBAN -->');
        });

        it('should return undefined when no workspace folder', async () => {
            const orig = workspace.workspaceFolders;
            (workspace as any).workspaceFolders = undefined;

            const result = await participant.syncAgentsMdSection();

            expect(result).toBeUndefined();
            (workspace as any).workspaceFolders = orig;
        });

        it('should return undefined on write failure', async () => {
            vi.spyOn(workspace.fs, 'readFile').mockRejectedValueOnce(new Error('not found'));
            vi.spyOn(workspace.fs, 'writeFile').mockRejectedValueOnce(new Error('write failed'));

            const result = await participant.syncAgentsMdSection();

            expect(result).toBeUndefined();
        });

        it('should preserve worktree-enhanced sentinel when called without worktreeTask', async () => {
            // Simulate an AGENTS.md that already has a worktree-enhanced sentinel
            const enhanced = [
                '# My AGENTS',
                '',
                '<!-- BEGIN AGENT KANBAN — DO NOT EDIT THIS SECTION -->',
                '## Agent Kanban',
                '',
                '**Active Task:** My Task',
                '**Task File:** `.agentkanban/tasks/todo/task_123.md`',
                '',
                'Read the task file above before responding.',
                '<!-- END AGENT KANBAN -->',
            ].join('\n');
            vi.spyOn(workspace.fs, 'readFile').mockResolvedValueOnce(
                new TextEncoder().encode(enhanced),
            );
            const writeSpy = vi.spyOn(workspace.fs, 'writeFile').mockResolvedValue(undefined);

            // Call WITHOUT worktreeTask — should NOT overwrite the enhanced sentinel
            await participant.syncAgentsMdSection();

            expect(writeSpy).toHaveBeenCalled();
            const written = new TextDecoder().decode(writeSpy.mock.calls[0][1] as Uint8Array);
            expect(written).not.toContain('**Active Task:**');
            expect(written).toContain('Read `.agentkanban/INSTRUCTION.md` for task workflow rules.');
        });

        it('should overwrite standard sentinel normally when no enhanced sentinel exists', async () => {
            const standard = [
                '<!-- BEGIN AGENT KANBAN — DO NOT EDIT THIS SECTION -->',
                '## Agent Kanban',
                '<!-- END AGENT KANBAN -->',
            ].join('\n');
            vi.spyOn(workspace.fs, 'readFile').mockResolvedValueOnce(
                new TextEncoder().encode(standard),
            );
            const writeSpy = vi.spyOn(workspace.fs, 'writeFile').mockResolvedValue(undefined);

            await participant.syncAgentsMdSection();

            expect(writeSpy).toHaveBeenCalled();
        });

        it('should rebuild the enhanced sentinel from the linked worktree task when called without worktreeTask', async () => {
            const linkedTask: Task = {
                id: 'task_worktree_1',
                title: 'Linked Task',
                lane: 'review',
                created: '2026-06-24T00:00:00.000Z',
                updated: '2026-06-24T00:00:00.000Z',
                description: 'Repair AGENTS sync',
                priority: 'medium',
                worktree: {
                    path: '/test-workspace',
                    branch: 'agentkanban/task_worktree_1',
                    created: '2026-06-24T00:00:00.000Z',
                },
                extras: {
                    change: '.agentkanban/changes/linked-task',
                    spec: '.agentkanban/specs/linked-task/spec.md',
                },
            };
            (taskStore as any).tasks.set(linkedTask.id, linkedTask);
            vi.spyOn(workspace.fs, 'readFile').mockResolvedValueOnce(new TextEncoder().encode('# My AGENTS\n'));
            const writeSpy = vi.spyOn(workspace.fs, 'writeFile').mockResolvedValue(undefined);

            await participant.syncAgentsMdSection();

            expect(writeSpy).toHaveBeenCalled();
            const written = new TextDecoder().decode(writeSpy.mock.calls[0][1] as Uint8Array);
            expect(written).toContain('**Active Task:** Linked Task');
            expect(written).toContain('**Task File:** `.agentkanban/tasks/task_worktree_1.md`');
            expect(written).toContain('**Checklist File:** `.agentkanban/changes/linked-task/tasks.md`');
        });

        it('should overwrite enhanced sentinel when called WITH worktreeTask', async () => {
            const enhanced = [
                '<!-- BEGIN AGENT KANBAN — DO NOT EDIT THIS SECTION -->',
                '## Agent Kanban',
                '',
                '**Active Task:** Old Task',
                '**Task File:** `.agentkanban/tasks/todo/task_old.md`',
                '<!-- END AGENT KANBAN -->',
            ].join('\n');
            vi.spyOn(workspace.fs, 'readFile').mockResolvedValueOnce(
                new TextEncoder().encode(enhanced),
            );
            const writeSpy = vi.spyOn(workspace.fs, 'writeFile').mockResolvedValue(undefined);

            await participant.syncAgentsMdSection({ title: 'New Task', taskRelPath: '.agentkanban/tasks/todo/task_new.md' });

            expect(writeSpy).toHaveBeenCalled();
            const written = new TextDecoder().decode(writeSpy.mock.calls[0][1] as Uint8Array);
            expect(written).toContain('**Active Task:** New Task');
            expect(written).toContain('task_new.md');
        });
    });

    describe('response.reference() calls', () => {
        let task: Task;

        beforeEach(() => {
            task = {
                id: 'task_ref_1',
                title: 'Ref Task',
                lane: 'doing',
                created: '2026-03-08T10:00:00.000Z',
                updated: '2026-03-08T10:00:00.000Z',
                description: '',
            };
            (taskStore as any).tasks.set(task.id, task);

            vi.spyOn(workspace.fs, 'readFile').mockResolvedValue(
                new TextEncoder().encode('# Template'),
            );
            vi.spyOn(workspace.fs, 'writeFile').mockResolvedValue(undefined);
            vi.spyOn(workspace, 'openTextDocument').mockResolvedValue({} as any);
            vi.spyOn(window, 'showTextDocument').mockResolvedValue(undefined as any);
        });

        it('should attach INSTRUCTION.md and task file references on /task', async () => {
            const response = mockResponse();
            await participant.handleRequest(mockRequest('task', 'Ref Task'), {} as any, response, mockToken);

            expect(response.references.length).toBe(2);
            // First reference is INSTRUCTION.md
            const instrRef = response.references[0];
            expect(instrRef.fsPath || instrRef.path).toContain('INSTRUCTION.md');
            // Second reference is the task file
            const taskRef = response.references[1];
            expect(taskRef.fsPath || taskRef.path).toContain('task_ref_1');
        });

        it('should attach INSTRUCTION.md and task file references on /refresh', async () => {
            participant.lastSelectedTaskId = task.id;
            const response = mockResponse();
            await participant.handleRequest(mockRequest('refresh', ''), {} as any, response, mockToken);

            expect(response.references.length).toBe(2);
            const instrRef = response.references[0];
            expect(instrRef.fsPath || instrRef.path).toContain('INSTRUCTION.md');
            const taskRef = response.references[1];
            expect(taskRef.fsPath || taskRef.path).toContain('task_ref_1');
        });

        it('should still attach task reference even if syncInstructionFile fails', async () => {
            vi.spyOn(workspace.fs, 'readFile').mockRejectedValue(new Error('sync failed'));

            const response = mockResponse();
            await participant.handleRequest(mockRequest('task', 'Ref Task'), {} as any, response, mockToken);

            // Only the task file reference (INSTRUCTION.md sync failed)
            expect(response.references.length).toBe(1);
            const taskRef = response.references[0];
            expect(taskRef.fsPath || taskRef.path).toContain('task_ref_1');
        });
    });

    describe('getFollowups', () => {
        it('should return /task followup for most recent active task when no task selected', () => {
            const tasks: Task[] = [
                { id: 'task_1', title: 'Old Task', lane: 'doing', created: '2026-03-01T00:00:00.000Z', updated: '2026-03-01T00:00:00.000Z', description: '' },
                { id: 'task_2', title: 'New Task', lane: 'todo', created: '2026-03-08T00:00:00.000Z', updated: '2026-03-08T00:00:00.000Z', description: '' },
                { id: 'task_3', title: 'Done Task', lane: 'done', created: '2026-03-09T00:00:00.000Z', updated: '2026-03-09T00:00:00.000Z', description: '' },
            ];
            for (const t of tasks) {
                (taskStore as any).tasks.set(t.id, t);
            }

            const followups = participant.getFollowups();

            expect(followups).toHaveLength(1);
            expect(followups[0]).toEqual({ prompt: 'New Task', command: 'task', label: 'Task: New Task' });
        });

        it('should return empty array when no active tasks', () => {
            expect(participant.getFollowups()).toEqual([]);
        });

        it('should exclude done lane tasks', () => {
            const tasks: Task[] = [
                { id: 'task_1', title: 'Done Task', lane: 'done', created: '2026-03-09T00:00:00.000Z', updated: '2026-03-09T00:00:00.000Z', description: '' },
            ];
            for (const t of tasks) {
                (taskStore as any).tasks.set(t.id, t);
            }

            expect(participant.getFollowups()).toEqual([]);
        });

        it('should return refresh followup when a task is selected', () => {
            const task: Task = {
                id: 'task_sel', title: 'Selected Task', lane: 'doing',
                created: '2026-03-08T10:00:00.000Z', updated: '2026-03-08T10:00:00.000Z', description: '',
            };
            (taskStore as any).tasks.set(task.id, task);
            participant.lastSelectedTaskId = 'task_sel';

            const followups = participant.getFollowups();

            expect(followups).toHaveLength(1);
            expect(followups[0]).toEqual({ prompt: '', command: 'refresh', label: 'Refresh: Selected Task' });
        });

        it('should fall back to /task followup when selected task is done', () => {
            const tasks: Task[] = [
                { id: 'task_done', title: 'Done Task', lane: 'done', created: '2026-03-08T10:00:00.000Z', updated: '2026-03-08T10:00:00.000Z', description: '' },
                { id: 'task_active', title: 'Active Task', lane: 'doing', created: '2026-03-07T10:00:00.000Z', updated: '2026-03-07T10:00:00.000Z', description: '' },
            ];
            for (const t of tasks) {
                (taskStore as any).tasks.set(t.id, t);
            }
            participant.lastSelectedTaskId = 'task_done';

            const followups = participant.getFollowups();

            expect(followups).toHaveLength(1);
            expect(followups[0].command).toBe('task');
            expect(participant.lastSelectedTaskId).toBeUndefined();
        });

    });

    describe('handleRefresh', () => {
        let task: Task;

        beforeEach(() => {
            task = {
                id: 'task_verb_1',
                title: 'Verb Task',
                lane: 'doing',
                created: '2026-03-08T10:00:00.000Z',
                updated: '2026-03-08T10:00:00.000Z',
                description: '',
            };
            (taskStore as any).tasks.set(task.id, task);

            vi.spyOn(workspace.fs, 'readFile').mockResolvedValue(
                new TextEncoder().encode('# Agentic Kanban — Instruction'),
            );
            vi.spyOn(workspace.fs, 'writeFile').mockResolvedValue(undefined);
            vi.spyOn(workspace, 'openTextDocument').mockResolvedValue({} as any);
            vi.spyOn(window, 'showTextDocument').mockResolvedValue(undefined as any);
        });

        it('should prompt to select a task when no task is selected', async () => {
            const response = mockResponse();
            await participant.handleRequest(mockRequest('refresh', ''), {} as any, response, mockToken);

            expect(response.messages.some((m: string) => m.includes('No task selected'))).toBe(true);
        });

        it('should show no-tasks message when board is empty and no task selected', async () => {
            (taskStore as any).tasks.clear();
            const response = mockResponse();
            await participant.handleRequest(mockRequest('refresh', ''), {} as any, response, mockToken);

            expect(response.messages.some((m: string) => m.includes('No active tasks'))).toBe(true);
        });

        it('should re-inject context for the selected task', async () => {
            participant.lastSelectedTaskId = task.id;
            const response = mockResponse();
            await participant.handleRequest(mockRequest('refresh', ''), {} as any, response, mockToken);

            expect(response.messages.some((m: string) => m.includes('INSTRUCTION.md'))).toBe(true);
            expect(response.messages.some((m: string) => m.includes('REFRESH'))).toBe(true);
            expect(response.messages.some((m: string) => m.includes('Verb Task'))).toBe(true);
            expect(response.messages.some((m: string) => m.includes('Task file:'))).toBe(true);
        });

        it('should include additional context from prompt', async () => {
            participant.lastSelectedTaskId = task.id;
            const response = mockResponse();
            await participant.handleRequest(mockRequest('refresh', 'focus on error handling'), {} as any, response, mockToken);

            expect(response.messages.some((m: string) => m.includes('Additional context: focus on error handling'))).toBe(true);
        });

        it('should handle done task by clearing selection', async () => {
            task.lane = 'done';
            participant.lastSelectedTaskId = task.id;
            const response = mockResponse();
            await participant.handleRequest(mockRequest('refresh', ''), {} as any, response, mockToken);

            expect(response.messages.some((m: string) => m.includes('no longer active'))).toBe(true);
            expect(participant.lastSelectedTaskId).toBeUndefined();
        });

        it('should open task file in editor with preserveFocus', async () => {
            participant.lastSelectedTaskId = task.id;
            const openSpy = vi.spyOn(workspace, 'openTextDocument');
            const showSpy = vi.spyOn(window, 'showTextDocument');

            const response = mockResponse();
            await participant.handleRequest(mockRequest('refresh', ''), {} as any, response, mockToken);

            expect(openSpy).toHaveBeenCalled();
            expect(showSpy).toHaveBeenCalledWith(expect.anything(), { preview: false, preserveFocus: true });
        });

        it('should end with the updated workflow prompt', async () => {
            participant.lastSelectedTaskId = task.id;
            const response = mockResponse();
            await participant.handleRequest(mockRequest('refresh', ''), {} as any, response, mockToken);

            const last = response.messages[response.messages.length - 1];
            expect(last).toContain('plan');
            expect(last).toContain('checklist');
            expect(last).toContain('implement');
            expect(last).toContain('review');
        });

        it('should show in-worktree hint on /refresh when in task worktree', async () => {
            const wtTask: Task = {
                id: 'task_refwt', title: 'Refresh WT Task', lane: 'doing',
                created: '2026-01-01T00:00:00.000Z', updated: '2026-01-01T00:00:00.000Z',
                description: '',
                worktree: { branch: 'agentkanban/refwt', path: '/test-workspace', created: '' },
            };
            (taskStore as any).tasks.set(wtTask.id, wtTask);
            participant.lastSelectedTaskId = wtTask.id;

            const response = mockResponse();
            await participant.handleRequest(mockRequest('refresh', ''), {} as any, response, mockToken);

            expect(response.messages.some((m: string) => m.includes('Worktree workspace'))).toBe(true);
        });

        it('should NOT show in-worktree hint on /refresh when not in worktree', async () => {
            participant.lastSelectedTaskId = task.id;

            const response = mockResponse();
            await participant.handleRequest(mockRequest('refresh', ''), {} as any, response, mockToken);

            expect(response.messages.every((m: string) => !m.includes('Worktree workspace'))).toBe(true);
        });

        it('should auto-detect worktree task on /refresh when no task selected', async () => {
            // Task with worktree matching the mock workspace path
            const wtTask: Task = {
                id: 'task_autowt', title: 'Auto WT Refresh', lane: 'doing',
                created: '2026-01-01T00:00:00.000Z', updated: '2026-01-01T00:00:00.000Z',
                description: '',
                worktree: { branch: 'agentkanban/auto', path: '/test-workspace', created: '' },
            };
            (taskStore as any).tasks.set(wtTask.id, wtTask);
            // lastSelectedTaskId is NOT set

            const response = mockResponse();
            await participant.handleRequest(mockRequest('refresh', ''), {} as any, response, mockToken);

            expect(response.messages.some((m: string) => m.includes('REFRESH'))).toBe(true);
            expect(response.messages.some((m: string) => m.includes('Auto WT Refresh'))).toBe(true);
            expect(response.messages.some((m: string) => m.includes('Worktree workspace'))).toBe(true);
            expect(participant.lastSelectedTaskId).toBe('task_autowt');
        });

        it('should gate refresh when enforceWorktrees is enabled and the task has no worktree', async () => {
            participant.lastSelectedTaskId = task.id;
            vi.spyOn(workspace, 'getConfiguration').mockReturnValue({
                get: (key: string, defaultValue?: any) => key === 'enforceWorktrees' ? true : defaultValue,
                update: async () => { },
            } as any);

            const response = mockResponse();
            await participant.handleRequest(mockRequest('refresh', ''), {} as any, response, mockToken);

            expect(response.messages.some((m: string) => m.includes('requires a git worktree'))).toBe(true);
            expect(response.messages.some((m: string) => m.includes('@kanban /worktree'))).toBe(true);
            expect(response.messages.every((m: string) => !m.includes('REFRESH'))).toBe(true);
        });

        it('should allow refresh when enforceWorktrees is enabled but the task already has a worktree', async () => {
            const wtTask: Task = {
                id: 'task_gate_wt',
                title: 'Refresh With Worktree',
                lane: 'doing',
                created: '2026-01-01T00:00:00.000Z',
                updated: '2026-01-01T00:00:00.000Z',
                description: '',
                worktree: { branch: 'agentkanban/gated', path: '/other-workspace', created: '' },
            };
            (taskStore as any).tasks.set(wtTask.id, wtTask);
            participant.lastSelectedTaskId = wtTask.id;
            vi.spyOn(workspace, 'getConfiguration').mockReturnValue({
                get: (key: string, defaultValue?: any) => key === 'enforceWorktrees' ? true : defaultValue,
                update: async () => { },
            } as any);

            const response = mockResponse();
            await participant.handleRequest(mockRequest('refresh', ''), {} as any, response, mockToken);

            expect(response.messages.some((m: string) => m.includes('REFRESH'))).toBe(true);
        });
    });

    describe('lastSelectedTaskId tracking', () => {
        it('should set lastSelectedTaskId on /task', async () => {
            const task: Task = {
                id: 'task_track_1', title: 'Track Task', lane: 'doing',
                created: '2026-03-08T10:00:00.000Z', updated: '2026-03-08T10:00:00.000Z', description: '',
            };
            (taskStore as any).tasks.set(task.id, task);

            vi.spyOn(workspace.fs, 'readFile').mockResolvedValue(new TextEncoder().encode('# Template'));
            vi.spyOn(workspace.fs, 'writeFile').mockResolvedValue(undefined);
            vi.spyOn(workspace, 'openTextDocument').mockResolvedValue({} as any);
            vi.spyOn(window, 'showTextDocument').mockResolvedValue(undefined as any);

            const response = mockResponse();
            await participant.handleRequest(mockRequest('task', 'Track Task'), {} as any, response, mockToken);

            expect(participant.lastSelectedTaskId).toBe('task_track_1');
        });

        it('should clear lastSelectedTaskId on /new', async () => {
            participant.lastSelectedTaskId = 'task_old';

            vi.spyOn(taskStore, 'createTask').mockReturnValue({
                id: 'task_new', title: 'New', lane: 'todo',
                created: '', updated: '', description: '',
            });
            vi.spyOn(taskStore, 'save').mockResolvedValue(undefined);

            const response = mockResponse();
            await participant.handleRequest(mockRequest('new', 'New Task'), {} as any, response, mockToken);

            expect(participant.lastSelectedTaskId).toBeUndefined();
        });
    });

    describe('syncAgentsMdSection with worktree task', () => {
        it('should write enhanced sentinel when worktreeTask is provided', async () => {
            vi.spyOn(workspace.fs, 'readFile').mockRejectedValueOnce(new Error('not found'));
            const writeSpy = vi.spyOn(workspace.fs, 'writeFile').mockResolvedValue(undefined);

            await participant.syncAgentsMdSection({
                title: 'My Feature',
                taskRelPath: '.agentkanban/tasks/doing/task_001.md',
            });

            expect(writeSpy).toHaveBeenCalled();
            const written = new TextDecoder().decode(writeSpy.mock.calls[0][1] as Uint8Array);
            expect(written).toContain('**Active Task:** My Feature');
            expect(written).toContain('**Task File:** `.agentkanban/tasks/doing/task_001.md`');
            expect(written).toContain('Read the task file above before responding');
            expect(written).toContain('<!-- BEGIN AGENTIC KANBAN');
            expect(written).toContain('<!-- END AGENTIC KANBAN -->');
        });

        it('should include linked spec change guidance when changeRelPath is provided', async () => {
            vi.spyOn(workspace.fs, 'readFile').mockRejectedValueOnce(new Error('not found'));
            const writeSpy = vi.spyOn(workspace.fs, 'writeFile').mockResolvedValue(undefined);

            await participant.syncAgentsMdSection({
                title: 'My Feature',
                taskRelPath: '.agentkanban/tasks/task_001.md',
                todoRelPath: '.agentkanban/tasks/todo_001.md',
                changeRelPath: '.agentkanban/changes/my_feature',
            });

            const written = new TextDecoder().decode(writeSpy.mock.calls[0][1] as Uint8Array);
            expect(written).toContain('**Spec Change:** `.agentkanban/changes/my_feature`');
            expect(written).toContain('**Spec Proposal:** `.agentkanban/changes/my_feature/proposal.md`');
            expect(written).toContain('Read the linked spec change artifacts before planning, implementing, reviewing, or marking done.');
        });

        it('should write a warning if the task has a worktree path but we are not inside the worktree workspace', async () => {
            vi.spyOn(workspace.fs, 'readFile').mockRejectedValueOnce(new Error('not found'));
            const writeSpy = vi.spyOn(workspace.fs, 'writeFile').mockResolvedValue(undefined);

            await participant.syncAgentsMdSection({
                title: 'My Feature',
                taskRelPath: '.agentkanban/tasks/task_001.md',
                worktreePath: '/other/worktree/path',
            });

            const written = new TextDecoder().decode(writeSpy.mock.calls[0][1] as Uint8Array);
            expect(written).toContain('⚠️ **Worktree Warning:**');
            expect(written).toContain('Do NOT implement changes in this root workspace');
        });

        it('should not write a warning if we are inside the worktree workspace', async () => {
            vi.spyOn(workspace.fs, 'readFile').mockRejectedValueOnce(new Error('not found'));
            const writeSpy = vi.spyOn(workspace.fs, 'writeFile').mockResolvedValue(undefined);

            await participant.syncAgentsMdSection({
                title: 'My Feature',
                taskRelPath: '.agentkanban/tasks/task_001.md',
                worktreePath: '/test-workspace',
            });

            const written = new TextDecoder().decode(writeSpy.mock.calls[0][1] as Uint8Array);
            expect(written).not.toContain('⚠️ **Worktree Warning:**');
        });

        it('should write default sentinel when no worktreeTask is provided', async () => {
            vi.spyOn(workspace.fs, 'readFile').mockRejectedValueOnce(new Error('not found'));
            const writeSpy = vi.spyOn(workspace.fs, 'writeFile').mockResolvedValue(undefined);

            await participant.syncAgentsMdSection();

            const written = new TextDecoder().decode(writeSpy.mock.calls[0][1] as Uint8Array);
            expect(written).not.toContain('**Active Task:**');
            expect(written).toContain('INSTRUCTION.md');
            expect(written).toContain('memory.md');
        });
    });

    describe('agent policy injection', () => {
        beforeEach(() => {
            vi.spyOn(workspace.fs, 'readFile').mockRejectedValue(new Error('not found'));
        });

        it('should include enforcement mode and review policy in the standard AGENTS section', async () => {
            const writeSpy = vi.spyOn(workspace.fs, 'writeFile').mockResolvedValue(undefined);
            vi.spyOn(boardConfigStore, 'get').mockReturnValue({
                profile: 'standard',
                profileVersion: 3,
                lanes: PROFILE_LANES.standard,
                enforcement: DEFAULT_ENFORCEMENT.standard,
                reviewPolicy: DEFAULT_REVIEW_POLICY,
            } as BoardConfig);

            await participant.syncAgentsMdSection();

            const content = new TextDecoder().decode(writeSpy.mock.calls[0][1] as Uint8Array);
            expect(content).toContain('Enforcement mode: `strict`');
            expect(content).toContain('high: planning=independent-agent, implementation=independent-agent');
        });

        it('should include task-priority review guidance in the worktree AGENTS section', async () => {
            const writeSpy = vi.spyOn(workspace.fs, 'writeFile').mockResolvedValue(undefined);
            vi.spyOn(boardConfigStore, 'get').mockReturnValue({
                profile: 'standard',
                profileVersion: 3,
                lanes: PROFILE_LANES.standard,
                enforcement: DEFAULT_ENFORCEMENT.standard,
                reviewPolicy: DEFAULT_REVIEW_POLICY,
            } as BoardConfig);
            const highTask: Task = {
                id: 'task_high_1',
                title: 'High Priority Task',
                lane: 'planning',
                created: '2026-06-16T00:00:00.000Z',
                updated: '2026-06-16T00:00:00.000Z',
                description: 'Task scope',
                priority: 'high',
            };
            (taskStore as any).tasks.set(highTask.id, highTask);

            await participant.syncAgentsMdSection({
                title: highTask.title,
                taskRelPath: '.agentkanban/tasks/task_high_1.md',
                todoRelPath: '.agentkanban/tasks/todo_high_1.md',
                priority: highTask.priority,
            } as any);

            const content = new TextDecoder().decode(writeSpy.mock.calls[0][1] as Uint8Array);
            expect(content).toContain('Priority high: planning review by independent-agent, implementation review by independent-agent');
        });
    });

    describe('/work command', () => {
        let task: Task;

        beforeEach(() => {
            task = {
                id: 'task_work_1',
                title: 'Auth Feature',
                lane: 'planning',
                created: '2026-03-08T10:00:00.000Z',
                updated: '2026-03-08T10:00:00.000Z',
                description: '',
            };
            (taskStore as any).tasks.clear();
            (taskStore as any).tasks.set(task.id, task);

            vi.spyOn(workspace.fs, 'readFile').mockResolvedValue(
                new TextEncoder().encode('# bundled work-on-task.md\n{{taskTitle}}\n{{taskFile}}\n{{profile}}\n{{lanes}}'),
            );
            vi.spyOn(workspace.fs, 'writeFile').mockResolvedValue(undefined);
            vi.spyOn(workspace, 'openTextDocument').mockResolvedValue({} as any);
            vi.spyOn(window, 'showTextDocument').mockResolvedValue(undefined as any);
            vi.spyOn(window, 'showQuickPick').mockResolvedValue(undefined);
            vi.spyOn(env.clipboard, 'writeText').mockResolvedValue(undefined);
        });

        it('should list /work in available commands', async () => {
            const response = mockResponse();
            await participant.handleRequest(mockRequest(undefined, ''), {} as any, response, mockToken);

            expect(response.messages.some((m: string) => m.includes('/work'))).toBe(true);
        });

        it('should copy work prompt to clipboard when task name is given', async () => {
            const clipSpy = vi.spyOn(env.clipboard, 'writeText');

            const response = mockResponse();
            await participant.handleRequest(mockRequest('work', 'Auth Feature'), {} as any, response, mockToken);

            expect(clipSpy).toHaveBeenCalled();
            const prompt = clipSpy.mock.calls[0][0] as string;
            expect(prompt).toContain('Auth Feature');
            expect(prompt).toContain('.agentkanban/tasks/task_work_1.md');
            expect(prompt).toContain('standard');
            expect(prompt).toContain('backlog → planning → in-progress → review → done');
        });

        it('should show message when no not-done tasks exist', async () => {
            (taskStore as any).tasks.clear();

            const response = mockResponse();
            await participant.handleRequest(mockRequest('work', ''), {} as any, response, mockToken);

            expect(response.messages.some((m: string) => m.includes('No not-done tasks'))).toBe(true);
        });

        it('should report no match for unknown task name', async () => {
            const response = mockResponse();
            await participant.handleRequest(mockRequest('work', 'Nonexistent'), {} as any, response, mockToken);

            expect(response.messages.some((m: string) => m.includes('No not-done tasks'))).toBe(true);
        });
    });

    describe('/worktree command', () => {
        it('should show help listing /worktree for unknown command', async () => {
            const response = mockResponse();
            await participant.handleRequest(mockRequest(undefined, ''), {} as any, response, mockToken);

            expect(response.messages.some((m: string) => m.includes('/worktree'))).toBe(true);
        });

        it('should report no worktree service when not provided', async () => {
            // participant has no worktreeService by default
            participant.lastSelectedTaskId = 'task_1';
            const task: Task = {
                id: 'task_1', title: 'Test', lane: 'doing',
                created: '', updated: '', description: '',
            };
            (taskStore as any).tasks.set(task.id, task);

            const response = mockResponse();
            await participant.handleRequest(mockRequest('worktree', ''), {} as any, response, mockToken);

            expect(response.messages.some((m: string) => m.includes('not available'))).toBe(true);
        });

        it('should require task selection before /worktree', async () => {
            const mockWs = {
                isGitRepo: vi.fn().mockResolvedValue(true),
            } as any;
            const wsParticipant = new ChatParticipant(taskStore, boardConfigStore, extensionUri, undefined, undefined, mockWs);

            const response = mockResponse();
            await wsParticipant.handleRequest(mockRequest('worktree', ''), {} as any, response, mockToken);

            expect(response.messages.some((m: string) => m.includes('No task selected'))).toBe(true);
        });

        it('should auto-detect worktree task on /worktree when no task selected', async () => {
            const mockWs = {
                isGitRepo: vi.fn().mockResolvedValue(true),
                exists: vi.fn().mockResolvedValue(true),
            } as any;
            const wsParticipant = new ChatParticipant(taskStore, boardConfigStore, extensionUri, undefined, undefined, mockWs);

            const wtTask: Task = {
                id: 'task_wt_auto', title: 'WT Auto Task', lane: 'doing',
                created: '', updated: '', description: '',
                worktree: { branch: 'agentkanban/auto', path: '/test-workspace', created: '' },
            };
            (taskStore as any).tasks.set(wtTask.id, wtTask);
            // NO lastSelectedTaskId set

            const response = mockResponse();
            await wsParticipant.handleRequest(mockRequest('worktree', ''), {} as any, response, mockToken);

            // Should auto-detect and handle the existing worktree
            expect(response.messages.some((m: string) => m.includes('already has a worktree'))).toBe(true);
            expect(response.messages.some((m: string) => m.includes('Worktree workspace'))).toBe(true);
        });

        it('should require git repo for /worktree', async () => {
            const mockWs = {
                isGitRepo: vi.fn().mockResolvedValue(false),
            } as any;
            const wsParticipant = new ChatParticipant(taskStore, boardConfigStore, extensionUri, undefined, undefined, mockWs);

            wsParticipant.lastSelectedTaskId = 'task_1';
            const task: Task = {
                id: 'task_1', title: 'Test', lane: 'doing',
                created: '', updated: '', description: '',
            };
            (taskStore as any).tasks.set(task.id, task);

            const response = mockResponse();
            await wsParticipant.handleRequest(mockRequest('worktree', ''), {} as any, response, mockToken);

            expect(response.messages.some((m: string) => m.includes('not a git repository'))).toBe(true);
        });

        it('should report existing worktree when task already has one', async () => {
            const mockWs = {
                isGitRepo: vi.fn().mockResolvedValue(true),
                exists: vi.fn().mockResolvedValue(true),
            } as any;
            const wsParticipant = new ChatParticipant(taskStore, boardConfigStore, extensionUri, undefined, undefined, mockWs);

            const task: Task = {
                id: 'task_wt', title: 'WT Task', lane: 'doing',
                created: '', updated: '', description: '',
                worktree: { branch: 'agentkanban/test', path: '/wt/test', created: '' },
            };
            (taskStore as any).tasks.set(task.id, task);
            wsParticipant.lastSelectedTaskId = task.id;

            const response = mockResponse();
            await wsParticipant.handleRequest(mockRequest('worktree', ''), {} as any, response, mockToken);

            expect(response.messages.some((m: string) => m.includes('already has a worktree'))).toBe(true);
        });

        it('should open worktree on "open" subcommand', async () => {
            const openSpy = vi.fn().mockResolvedValue(undefined);
            const existsSpy = vi.fn().mockResolvedValue(true);
            const mockWs = {
                isGitRepo: vi.fn().mockResolvedValue(true),
                exists: existsSpy,
                openInVSCode: openSpy,
            } as any;
            const wsParticipant = new ChatParticipant(taskStore, boardConfigStore, extensionUri, undefined, undefined, mockWs);

            const task: Task = {
                id: 'task_open', title: 'Open Task', lane: 'doing',
                created: '', updated: '', description: '',
                worktree: { branch: 'agentkanban/test', path: '/wt/test', created: '' },
            };
            (taskStore as any).tasks.set(task.id, task);
            wsParticipant.lastSelectedTaskId = task.id;

            const response = mockResponse();
            await wsParticipant.handleRequest(mockRequest('worktree', 'open'), {} as any, response, mockToken);

            expect(openSpy).toHaveBeenCalledWith('/wt/test');
            expect(response.messages.some((m: string) => m.includes('Opening worktree'))).toBe(true);
        });

        it('should show worktree reminder on "open" when already in worktree', async () => {
            const openSpy = vi.fn().mockResolvedValue(undefined);
            const existsSpy = vi.fn().mockResolvedValue(true);
            const mockWs = {
                isGitRepo: vi.fn().mockResolvedValue(true),
                exists: existsSpy,
                openInVSCode: openSpy,
            } as any;
            const wsParticipant = new ChatParticipant(taskStore, boardConfigStore, extensionUri, undefined, undefined, mockWs);

            const task: Task = {
                id: 'task_openwt', title: 'Open WT Here', lane: 'doing',
                created: '', updated: '', description: '',
                worktree: { branch: 'agentkanban/here', path: '/test-workspace', created: '' },
            };
            (taskStore as any).tasks.set(task.id, task);
            wsParticipant.lastSelectedTaskId = task.id;

            const response = mockResponse();
            await wsParticipant.handleRequest(mockRequest('worktree', 'open'), {} as any, response, mockToken);

            expect(response.messages.some((m: string) => m.includes('Worktree workspace'))).toBe(true);
        });

        it('should clean up stale worktree metadata on "open" when directory is gone', async () => {
            const existsSpy = vi.fn().mockResolvedValue(false);
            const saveSpy = vi.spyOn(taskStore, 'save').mockResolvedValue(undefined);
            const mockWs = {
                isGitRepo: vi.fn().mockResolvedValue(true),
                exists: existsSpy,
            } as any;
            const wsParticipant = new ChatParticipant(taskStore, boardConfigStore, extensionUri, undefined, undefined, mockWs);

            const task: Task = {
                id: 'task_stale', title: 'Stale Task', lane: 'doing',
                created: '', updated: '', description: '',
                worktree: { branch: 'agentkanban/old', path: '/wt/old', created: '' },
            };
            (taskStore as any).tasks.set(task.id, task);
            wsParticipant.lastSelectedTaskId = task.id;

            const response = mockResponse();
            await wsParticipant.handleRequest(mockRequest('worktree', 'open'), {} as any, response, mockToken);

            expect(response.messages.some((m: string) => m.includes('no longer exists'))).toBe(true);
            expect(saveSpy).toHaveBeenCalled();
            expect(task.worktree).toBeUndefined();
        });

        it('should report no worktree on "open" when task has none', async () => {
            const mockWs = {
                isGitRepo: vi.fn().mockResolvedValue(true),
            } as any;
            const wsParticipant = new ChatParticipant(taskStore, boardConfigStore, extensionUri, undefined, undefined, mockWs);

            const task: Task = {
                id: 'task_nowt', title: 'No WT', lane: 'doing',
                created: '', updated: '', description: '',
            };
            (taskStore as any).tasks.set(task.id, task);
            wsParticipant.lastSelectedTaskId = task.id;

            const response = mockResponse();
            await wsParticipant.handleRequest(mockRequest('worktree', 'open'), {} as any, response, mockToken);

            expect(response.messages.some((m: string) => m.includes('has no worktree'))).toBe(true);
        });

        it('should remove worktree on "remove" subcommand', async () => {
            const removeSpy = vi.fn().mockResolvedValue(undefined);
            const saveSpy = vi.spyOn(taskStore, 'save').mockResolvedValue(undefined);
            const mockWs = {
                isGitRepo: vi.fn().mockResolvedValue(true),
                remove: removeSpy,
            } as any;
            const wsParticipant = new ChatParticipant(taskStore, boardConfigStore, extensionUri, undefined, undefined, mockWs);

            const worktreeInfo = { branch: 'agentkanban/rm', path: '/wt/rm', created: '' };
            const task: Task = {
                id: 'task_rm', title: 'Remove Task', lane: 'doing',
                created: '', updated: '', description: '',
                worktree: { ...worktreeInfo },
            };
            (taskStore as any).tasks.set(task.id, task);
            wsParticipant.lastSelectedTaskId = task.id;

            const response = mockResponse();
            await wsParticipant.handleRequest(mockRequest('worktree', 'remove'), {} as any, response, mockToken);

            expect(removeSpy).toHaveBeenCalled();
            expect(saveSpy).toHaveBeenCalled();
            expect(task.worktree).toBeUndefined();
            expect(response.messages.some((m: string) => m.includes('Worktree removed'))).toBe(true);
        });

        it('should report no worktree on "remove" when task has none', async () => {
            const mockWs = {
                isGitRepo: vi.fn().mockResolvedValue(true),
            } as any;
            const wsParticipant = new ChatParticipant(taskStore, boardConfigStore, extensionUri, undefined, undefined, mockWs);

            const task: Task = {
                id: 'task_nrm', title: 'No WT Remove', lane: 'doing',
                created: '', updated: '', description: '',
            };
            (taskStore as any).tasks.set(task.id, task);
            wsParticipant.lastSelectedTaskId = task.id;

            const response = mockResponse();
            await wsParticipant.handleRequest(mockRequest('worktree', 'remove'), {} as any, response, mockToken);

            expect(response.messages.some((m: string) => m.includes('has no worktree to remove'))).toBe(true);
        });
    });

    describe('getFollowups with worktree', () => {
        it('should include "Create Worktree" followup when task has no worktree and service exists', () => {
            const mockWs = {} as any;
            const wsParticipant = new ChatParticipant(taskStore, boardConfigStore, extensionUri, undefined, undefined, mockWs);

            const task: Task = {
                id: 'task_fu', title: 'Followup Task', lane: 'doing',
                created: '2026-03-08T10:00:00.000Z', updated: '2026-03-08T10:00:00.000Z', description: '',
            };
            (taskStore as any).tasks.set(task.id, task);
            wsParticipant.lastSelectedTaskId = task.id;

            const followups = wsParticipant.getFollowups();

            expect(followups.some(f => f.command === 'worktree' && f.label?.includes('Create Worktree'))).toBe(true);
        });

        it('should include "Open Worktree" followup when task has a worktree', () => {
            const mockWs = {} as any;
            const wsParticipant = new ChatParticipant(taskStore, boardConfigStore, extensionUri, undefined, undefined, mockWs);

            const task: Task = {
                id: 'task_owt', title: 'Open WT Task', lane: 'doing',
                created: '2026-03-08T10:00:00.000Z', updated: '2026-03-08T10:00:00.000Z', description: '',
                worktree: { branch: 'agentkanban/test', path: '/wt/test', created: '' },
            };
            (taskStore as any).tasks.set(task.id, task);
            wsParticipant.lastSelectedTaskId = task.id;

            const followups = wsParticipant.getFollowups();

            expect(followups.some(f => f.command === 'worktree' && f.prompt === 'open' && f.label?.includes('Open Worktree'))).toBe(true);
        });

        it('should not include worktree followups when no worktreeService', () => {
            const task: Task = {
                id: 'task_nows', title: 'No WS', lane: 'doing',
                created: '2026-03-08T10:00:00.000Z', updated: '2026-03-08T10:00:00.000Z', description: '',
            };
            (taskStore as any).tasks.set(task.id, task);
            participant.lastSelectedTaskId = task.id;

            const followups = participant.getFollowups();

            // Standard participant has no worktreeService, so only verb followups
            expect(followups.every(f => f.command !== 'worktree')).toBe(true);
        });
    });

    describe('resolveTaskFromPrompt — slug matching', () => {
        beforeEach(() => {
            const tasks: Task[] = [
                { id: 'task_1', title: 'Auth Feature', lane: 'doing', created: '', updated: '', description: '', slug: 'auth_feature' },
                { id: 'task_2', title: 'Login Bug', lane: 'todo', created: '', updated: '', description: '', slug: 'login_bug' },
                { id: 'task_3', title: 'Consider Git Worktree Based Flows', lane: 'doing', created: '', updated: '', description: '', slug: 'consider_git_worktree_based_flows' },
            ];
            for (const t of tasks) {
                (taskStore as any).tasks.set(t.id, t);
            }
        });

        it('should match exact slug (case-insensitive)', () => {
            const result = participant.resolveTaskFromPrompt('auth_feature');
            expect(result.task).toBeDefined();
            expect(result.task!.title).toBe('Auth Feature');
            expect(result.freeText).toBe('');
        });

        it('should match slug case-insensitively', () => {
            const result = participant.resolveTaskFromPrompt('AUTH_FEATURE');
            expect(result.task).toBeDefined();
            expect(result.task!.title).toBe('Auth Feature');
        });

        it('should prefer slug match over other methods', () => {
            const result = participant.resolveTaskFromPrompt('login_bug');
            expect(result.task).toBeDefined();
            expect(result.task!.title).toBe('Login Bug');
        });

        it('should match long slug', () => {
            const result = participant.resolveTaskFromPrompt('consider_git_worktree_based_flows');
            expect(result.task).toBeDefined();
            expect(result.task!.title).toBe('Consider Git Worktree Based Flows');
        });
    });

    describe('resolveTaskFromPrompt — alphanumeric fuzzy', () => {
        beforeEach(() => {
            const tasks: Task[] = [
                { id: 'task_1', title: 'Auth Feature', lane: 'doing', created: '', updated: '', description: '' },
                { id: 'task_2', title: 'Consider Git Worktree Based Flows', lane: 'doing', created: '', updated: '', description: '' },
                { id: 'task_3', title: 'Login Bug Fix', lane: 'todo', created: '', updated: '', description: '' },
            ];
            for (const t of tasks) {
                (taskStore as any).tasks.set(t.id, t);
            }
        });

        it('should match when stripped query is substring of stripped title', () => {
            const result = participant.resolveTaskFromPrompt('worktree');
            expect(result.task).toBeDefined();
            expect(result.task!.title).toBe('Consider Git Worktree Based Flows');
        });

        it('should match ignoring spaces and punctuation', () => {
            const result = participant.resolveTaskFromPrompt('gitworktree');
            expect(result.task).toBeDefined();
            expect(result.task!.title).toBe('Consider Git Worktree Based Flows');
        });

        it('should match partial alphanumeric query', () => {
            const result = participant.resolveTaskFromPrompt('bugfix');
            expect(result.task).toBeDefined();
            expect(result.task!.title).toBe('Login Bug Fix');
        });

        it('should not match when ambiguous (equal length titles)', () => {
            // Add another task with same alnum length — both contain "feature"
            const t: Task = { id: 'task_4', title: 'Cool Feature', lane: 'todo', created: '', updated: '', description: '' };
            (taskStore as any).tasks.set(t.id, t);

            // "feature" matches both "Auth Feature" and "Cool Feature" — these have same alnum length (11 and 11)
            // The function picks the longer alnum title, but Auth Feature = "authfeature" (11) and "coolfeature" (11)
            // This should be ambiguous and fall through to first-word partial
            const result = participant.resolveTaskFromPrompt('feature');
            // Should still match via first-word partial (step 5) — "feature" found in a title
            expect(result.task).toBeDefined();
        });
    });

    describe('/task worktree awareness', () => {
        it('should show worktree status when task has worktree', async () => {
            const task: Task = {
                id: 'task_wt', title: 'Worktree Task', lane: 'doing',
                created: '2026-01-01T00:00:00.000Z', updated: '2026-01-01T00:00:00.000Z',
                description: '',
                worktree: { branch: 'agentkanban/wt', path: '/wt/path', created: '' },
            };
            (taskStore as any).tasks.set(task.id, task);

            vi.spyOn(workspace, 'openTextDocument').mockResolvedValue({} as any);
            vi.spyOn(window, 'showTextDocument').mockResolvedValue(undefined as any);

            const response = mockResponse();
            await participant.handleRequest(mockRequest('task', 'Worktree Task'), {} as any, response, mockToken);

            expect(response.messages.some((m: string) => m.includes('/wt/path'))).toBe(true);
            expect(response.messages.some((m: string) => m.includes('agentkanban/wt'))).toBe(true);
        });

        it('should not show worktree info when task has no worktree', async () => {
            const task: Task = {
                id: 'task_plain', title: 'Plain Task', lane: 'doing',
                created: '2026-01-01T00:00:00.000Z', updated: '2026-01-01T00:00:00.000Z',
                description: '',
            };
            (taskStore as any).tasks.set(task.id, task);

            vi.spyOn(workspace, 'openTextDocument').mockResolvedValue({} as any);
            vi.spyOn(window, 'showTextDocument').mockResolvedValue(undefined as any);

            const response = mockResponse();
            await participant.handleRequest(mockRequest('task', 'Plain Task'), {} as any, response, mockToken);

            expect(response.messages.every((m: string) => !m.includes('Worktree:'))).toBe(true);
        });

        it('should show in-worktree hint when workspace IS the task worktree', async () => {
            const task: Task = {
                id: 'task_inwt', title: 'In WT Task', lane: 'doing',
                created: '2026-01-01T00:00:00.000Z', updated: '2026-01-01T00:00:00.000Z',
                description: '',
                worktree: { branch: 'agentkanban/inwt', path: '/test-workspace', created: '' },
            };
            (taskStore as any).tasks.set(task.id, task);

            vi.spyOn(workspace, 'openTextDocument').mockResolvedValue({} as any);
            vi.spyOn(window, 'showTextDocument').mockResolvedValue(undefined as any);

            const response = mockResponse();
            await participant.handleRequest(mockRequest('task', 'In WT Task'), {} as any, response, mockToken);

            expect(response.messages.some((m: string) => m.includes('Worktree workspace'))).toBe(true);
        });

        it('should NOT show in-worktree hint when workspace differs from worktree path', async () => {
            const task: Task = {
                id: 'task_diffwt', title: 'Diff WT Task', lane: 'doing',
                created: '2026-01-01T00:00:00.000Z', updated: '2026-01-01T00:00:00.000Z',
                description: '',
                worktree: { branch: 'agentkanban/diffwt', path: '/other-workspace', created: '' },
            };
            (taskStore as any).tasks.set(task.id, task);

            vi.spyOn(workspace, 'openTextDocument').mockResolvedValue({} as any);
            vi.spyOn(window, 'showTextDocument').mockResolvedValue(undefined as any);

            const response = mockResponse();
            await participant.handleRequest(mockRequest('task', 'Diff WT Task'), {} as any, response, mockToken);

            expect(response.messages.every((m: string) => !m.includes('Worktree workspace'))).toBe(true);
        });

        it('should auto-detect worktree task on /task with no args', async () => {
            const wtTask: Task = {
                id: 'task_taskwt', title: 'WT Task Auto', lane: 'doing',
                created: '2026-01-01T00:00:00.000Z', updated: '2026-01-01T00:00:00.000Z',
                description: '',
                worktree: { branch: 'agentkanban/tauto', path: '/test-workspace', created: '' },
            };
            (taskStore as any).tasks.set(wtTask.id, wtTask);

            const response = mockResponse();
            await participant.handleRequest(mockRequest('task', ''), {} as any, response, mockToken);

            expect(response.messages.some((m: string) => m.includes('WT Task Auto'))).toBe(true);
            expect(response.messages.some((m: string) => m.includes('Worktree workspace'))).toBe(true);
        });
    });

    describe('/loop command', () => {
        const STAGE_BACKLOG = '# Stage: Backlog to Planning\n\nProfile: {{profile}}\nLanes: {{lanes}}\n';
        const STAGE_PLANNING = '# Stage: Planning to Review\n\nProfile: {{profile}}\n';
        const STAGE_REVIEW = '# Stage: Review to Done\n\nProfile: {{profile}}\n';
        const WORK_ON_TASK = '# Work on Task\n\nTask: {{taskTitle}}\nFile: {{taskFile}}\n';

        beforeEach(() => {
            execMock.mockReset();
            vi.clearAllMocks();
        });

        afterEach(() => {
            vi.restoreAllMocks();
        });

        it('Standard /loop (no arg) defaults to backlog and emits stage-backlog-to-planning', async () => {
            const config = boardConfigStore.get();
            config.profile = 'standard';
            config.lanes = ['backlog', 'planning', 'in-progress', 'review', 'done'];

            const task: Task = {
                id: 'task_loop_backlog', title: 'Backlog Task', lane: 'backlog',
                created: '2026-01-01T00:00:00.000Z', updated: '2026-01-01T00:00:00.000Z', description: '',
            };
            (taskStore as any).tasks.set(task.id, task);
            installMockFs({
                '/test-extension/assets/prompts/stage-backlog-to-planning.md': STAGE_BACKLOG,
            });

            const clipboardSpy = vi.spyOn(env.clipboard, 'writeText').mockResolvedValue(undefined);
            const response = mockResponse();
            await participant.handleRequest(mockRequest('loop', ''), {} as any, response, mockToken);

            expect(execMock).not.toHaveBeenCalled();
            expect(clipboardSpy).toHaveBeenCalledOnce();
            const pasted = clipboardSpy.mock.calls[0][0] as string;
            expect(pasted).toContain('Backlog to Planning');
            expect(pasted).not.toMatch(/\{\{[a-zA-Z0-9_]+\}\}/);
            expect(response.references.length).toBeGreaterThan(0);
            expect(taskStore.get(task.id)?.lane).toBe('backlog'); // no lane mutation
            clipboardSpy.mockRestore();
        });

        it('/loop planning emits stage-planning-to-review', async () => {
            const config = boardConfigStore.get();
            config.profile = 'standard';
            config.lanes = ['backlog', 'planning', 'in-progress', 'review', 'done'];

            const task: Task = {
                id: 'task_loop_planning', title: 'Planning Task', lane: 'planning',
                created: '2026-01-01T00:00:00.000Z', updated: '2026-01-01T00:00:00.000Z', description: '',
            };
            (taskStore as any).tasks.set(task.id, task);
            installMockFs({
                '/test-extension/assets/prompts/stage-planning-to-review.md': STAGE_PLANNING,
            });

            const clipboardSpy = vi.spyOn(env.clipboard, 'writeText').mockResolvedValue(undefined);
            const response = mockResponse();
            await participant.handleRequest(mockRequest('loop', 'planning'), {} as any, response, mockToken);

            expect(execMock).not.toHaveBeenCalled();
            expect(clipboardSpy).toHaveBeenCalledOnce();
            expect(clipboardSpy.mock.calls[0][0]).toContain('Planning to Review');
            expect(taskStore.get(task.id)?.lane).toBe('planning');
            clipboardSpy.mockRestore();
        });

        it('/loop review emits stage-review-to-done (no longer a refused gate)', async () => {
            const config = boardConfigStore.get();
            config.profile = 'standard';
            config.lanes = ['backlog', 'planning', 'in-progress', 'review', 'done'];

            const task: Task = {
                id: 'task_loop_review', title: 'Review Task', lane: 'review',
                created: '2026-01-01T00:00:00.000Z', updated: '2026-01-01T00:00:00.000Z', description: '',
            };
            (taskStore as any).tasks.set(task.id, task);
            installMockFs({
                '/test-extension/assets/prompts/stage-review-to-done.md': STAGE_REVIEW,
            });

            const clipboardSpy = vi.spyOn(env.clipboard, 'writeText').mockResolvedValue(undefined);
            const response = mockResponse();
            await participant.handleRequest(mockRequest('loop', 'review'), {} as any, response, mockToken);

            expect(execMock).not.toHaveBeenCalled();
            expect(clipboardSpy).toHaveBeenCalledOnce();
            expect(clipboardSpy.mock.calls[0][0]).toContain('Review to Done');
            clipboardSpy.mockRestore();
        });

        it('Lite /loop (no arg) defaults to backlog and emits stage-backlog-to-inprogress', async () => {
            const config = boardConfigStore.get();
            config.profile = 'lite';
            config.lanes = ['backlog', 'in-progress', 'done'];

            const task: Task = {
                id: 'task_loop_lite', title: 'Lite Task', lane: 'backlog',
                created: '2026-01-01T00:00:00.000Z', updated: '2026-01-01T00:00:00.000Z', description: '',
            };
            (taskStore as any).tasks.set(task.id, task);
            installMockFs({
                '/test-extension/assets/prompts/stage-backlog-to-inprogress.md': '# Backlog to In Progress\n{{taskTitle}}',
            });

            const clipboardSpy = vi.spyOn(env.clipboard, 'writeText').mockResolvedValue(undefined);
            const response = mockResponse();
            await participant.handleRequest(mockRequest('loop', ''), {} as any, response, mockToken);

            expect(execMock).not.toHaveBeenCalled();
            expect(clipboardSpy).toHaveBeenCalledOnce();
            expect(clipboardSpy.mock.calls[0][0]).toContain('Lite Task');
            clipboardSpy.mockRestore();
        });

        it('Lite /loop in-progress emits stage-inprogress-to-done', async () => {
            const config = boardConfigStore.get();
            config.profile = 'lite';
            config.lanes = ['backlog', 'in-progress', 'done'];

            const task: Task = {
                id: 'task_loop_lite_done', title: 'Lite Finish Task', lane: 'in-progress',
                created: '2026-01-01T00:00:00.000Z', updated: '2026-01-01T00:00:00.000Z', description: '',
            };
            (taskStore as any).tasks.set(task.id, task);
            installMockFs({
                '/test-extension/assets/prompts/stage-inprogress-to-done.md': '# In Progress to Done\n{{taskTitle}}',
            });

            const clipboardSpy = vi.spyOn(env.clipboard, 'writeText').mockResolvedValue(undefined);
            const response = mockResponse();
            await participant.handleRequest(mockRequest('loop', 'in-progress'), {} as any, response, mockToken);

            expect(execMock).not.toHaveBeenCalled();
            expect(clipboardSpy).toHaveBeenCalledOnce();
            expect(clipboardSpy.mock.calls[0][0]).toContain('Lite Finish Task');
            clipboardSpy.mockRestore();
        });

        it('reports no ready tasks when lane is empty', async () => {
            const config = boardConfigStore.get();
            config.profile = 'standard';
            config.lanes = ['backlog', 'planning', 'in-progress', 'review', 'done'];

            const response = mockResponse();
            await participant.handleRequest(mockRequest('loop', 'backlog'), {} as any, response, mockToken);

            expect(response.messages.some((m: string) => m.includes('No ready tasks'))).toBe(true);
            expect(execMock).not.toHaveBeenCalled();
        });

        it('reports no driver for done lane', async () => {
            const config = boardConfigStore.get();
            config.profile = 'standard';
            config.lanes = ['backlog', 'planning', 'in-progress', 'review', 'done'];

            const task: Task = {
                id: 'task_loop_done', title: 'Done Task', lane: 'done',
                created: '2026-01-01T00:00:00.000Z', updated: '2026-01-01T00:00:00.000Z', description: '',
            };
            (taskStore as any).tasks.set(task.id, task);

            const response = mockResponse();
            await participant.handleRequest(mockRequest('loop', 'done'), {} as any, response, mockToken);

            expect(response.messages.some((m: string) => m.includes('No stage-driver prompt'))).toBe(true);
            expect(execMock).not.toHaveBeenCalled();
        });

        it('filters tasks by label', async () => {
            const config = boardConfigStore.get();
            config.profile = 'standard';
            config.lanes = ['backlog', 'planning', 'in-progress', 'review', 'done'];

            const taskFeat: Task = {
                id: 'task_loop_feat', title: 'Feat Task', lane: 'backlog', labels: ['feat'],
                created: '2026-01-01T00:00:00.000Z', updated: '2026-01-01T00:00:00.000Z', description: '',
            };
            const taskOther: Task = {
                id: 'task_loop_other', title: 'Other Task', lane: 'backlog', labels: ['chore'],
                created: '2026-01-01T00:00:00.000Z', updated: '2026-01-01T00:00:00.000Z', description: '',
            };
            (taskStore as any).tasks.set(taskFeat.id, taskFeat);
            (taskStore as any).tasks.set(taskOther.id, taskOther);
            installMockFs({
                '/test-extension/assets/prompts/stage-backlog-to-planning.md': STAGE_BACKLOG,
            });

            const clipboardSpy = vi.spyOn(env.clipboard, 'writeText').mockResolvedValue(undefined);
            const response = mockResponse();
            await participant.handleRequest(mockRequest('loop', 'backlog --label=feat'), {} as any, response, mockToken);

            expect(clipboardSpy).toHaveBeenCalledOnce();
            const taskListOutput = response.messages.join('');
            expect(taskListOutput).toContain('Feat Task');
            expect(taskListOutput).not.toContain('Other Task');
            clipboardSpy.mockRestore();
        });

        it('excludes blocked tasks from the ready list', async () => {
            const config = boardConfigStore.get();
            config.profile = 'standard';
            config.lanes = ['backlog', 'planning', 'in-progress', 'review', 'done'];

            const blocked: Task = {
                id: 'task_loop_blocked', title: 'Blocked Task', lane: 'backlog', labels: ['blocked'],
                created: '2026-01-01T00:00:00.000Z', updated: '2026-01-01T00:00:00.000Z', description: '',
            };
            (taskStore as any).tasks.set(blocked.id, blocked);

            const response = mockResponse();
            await participant.handleRequest(mockRequest('loop', 'backlog'), {} as any, response, mockToken);

            expect(response.messages.some((m: string) => m.includes('No ready tasks'))).toBe(true);
        });

        it('workspace prompt takes priority over bundled', async () => {
            const config = boardConfigStore.get();
            config.profile = 'standard';
            config.lanes = ['backlog', 'planning', 'in-progress', 'review', 'done'];

            const task: Task = {
                id: 'task_loop_ws', title: 'WS Task', lane: 'backlog',
                created: '2026-01-01T00:00:00.000Z', updated: '2026-01-01T00:00:00.000Z', description: '',
            };
            (taskStore as any).tasks.set(task.id, task);
            installMockFs({
                '/test-workspace/.agentkanban/prompts/stage-backlog-to-planning.md': '# Custom Workspace Prompt\n',
                '/test-extension/assets/prompts/stage-backlog-to-planning.md': STAGE_BACKLOG,
            });

            const clipboardSpy = vi.spyOn(env.clipboard, 'writeText').mockResolvedValue(undefined);
            const response = mockResponse();
            await participant.handleRequest(mockRequest('loop', 'backlog'), {} as any, response, mockToken);

            expect(clipboardSpy.mock.calls[0][0]).toContain('Custom Workspace Prompt');
            clipboardSpy.mockRestore();
        });

    });

    describe('/goal command', () => {
        beforeEach(() => {
            execMock.mockReset();
            execMock.mockResolvedValue({ stdout: '', stderr: '' });
        });

        it('should create epic task and scaffold goal artifact on /goal new', async () => {
            installMockFs({
                '/test-workspace/.agentkanban/board.yaml': 'profile: standard\nprofileVersion: 3\nlanes: [backlog,planning,in-progress,review,done]\n',
                '/test-extension/assets/goal-templates/goal.md': '# {{GOAL_TITLE}}\n\n> Goal slug: `{{GOAL_SLUG}}`\n\n## Objective\n\n{{GOAL_DESCRIPTION}}\n',
                '/test-extension/assets/prompts/goal-decompose.md': '# Goal Decompose\n\n**Goal:** {{goalTitle}}\n**Slug:** `{{goalSlug}}`\n\nProfile: {{profile}}\nLanes: {{lanes}}\n',
            });

            const clipboardSpy = vi.spyOn(env.clipboard, 'writeText').mockResolvedValue(undefined);

            const response = mockResponse();
            await participant.handleRequest(mockRequest('goal', 'new Ship onboarding flow'), {} as any, response, mockToken);

            // Epic task created in backlog
            const all = taskStore.getAll();
            const epic = all.find(t => t.labels?.includes('goal'));
            expect(epic).toBeDefined();
            expect(epic?.labels).toContain('epic');
            expect(epic?.goal).toBeDefined();

            // Decompose prompt copied to clipboard
            expect(clipboardSpy).toHaveBeenCalled();
            const clipboardContent = clipboardSpy.mock.calls[0][0] as string;
            expect(clipboardContent).not.toMatch(/\{\{[a-zA-Z0-9_]+\}\}/); // no unresolved placeholders

            // Response mentions goal creation
            expect(response.messages.some((m: string) => m.includes('Goal created'))).toBe(true);

            clipboardSpy.mockRestore();
        });

        it('should show goal dashboard when called bare', async () => {
            const epic: Task = {
                id: 'task_goal_epic',
                title: 'My Goal',
                lane: 'backlog',
                labels: ['goal', 'epic'],
                goal: '.agentkanban/goals/my_goal',
                created: '2026-01-01T00:00:00.000Z',
                updated: '2026-01-01T00:00:00.000Z',
                description: '',
            };
            const child1: Task = { id: 'task_goal_c1', title: 'Child 1', lane: 'done', parent: 'task_goal_epic', created: '2026-01-01T00:00:00.000Z', updated: '2026-01-01T00:00:00.000Z', description: '' };
            const child2: Task = { id: 'task_goal_c2', title: 'Child 2', lane: 'in-progress', parent: 'task_goal_epic', created: '2026-01-01T00:00:00.000Z', updated: '2026-01-01T00:00:00.000Z', description: '' };
            const child3: Task = { id: 'task_goal_c3', title: 'Child 3', lane: 'backlog', parent: 'task_goal_epic', created: '2026-01-01T00:00:00.000Z', updated: '2026-01-01T00:00:00.000Z', description: '' };
            (taskStore as any).tasks.set(epic.id, epic);
            (taskStore as any).tasks.set(child1.id, child1);
            (taskStore as any).tasks.set(child2.id, child2);
            (taskStore as any).tasks.set(child3.id, child3);

            const response = mockResponse();
            await participant.handleRequest(mockRequest('goal', ''), {} as any, response, mockToken);

            expect(response.messages.some((m: string) => m.includes('1/3') || m.includes('Goal Dashboard'))).toBe(true);
        });

        it('TaskStore round-trip preserves goal and parent fields', async () => {
            const task: Task = {
                id: 'task_roundtrip_goal',
                title: 'Round Trip Goal Task',
                lane: 'backlog',
                goal: '.agentkanban/goals/my_goal',
                parent: 'task_epic_1',
                created: '2026-01-01T00:00:00.000Z',
                updated: '2026-01-01T00:00:00.000Z',
                description: '',
            };
            (taskStore as any).tasks.set(task.id, task);
            installMockFs({
                '/test-workspace/.agentkanban/tasks/task_roundtrip_goal.md': '---\ntitle: Round Trip Goal Task\nlane: backlog\ngoal: .agentkanban/goals/my_goal\nparent: task_epic_1\n---\n',
            });

            const serialised = TaskStore.serialise(task);
            const deserialised = TaskStore.deserialise(serialised);
            expect(deserialised?.goal).toBe('.agentkanban/goals/my_goal');
            expect(deserialised?.parent).toBe('task_epic_1');
        });
    });

    describe('multi-root context-specific helpers', () => {
        it('scaffoldPromptsForContext uses the provided context config instead of the active config', async () => {
            installMockFs({
                '/test-extension/assets/prompts/README.md': 'Profile {{profile}}',
                '/test-extension/assets/prompts/new-task-intake.md': 'Intake',
                '/test-extension/assets/prompts/stage-backlog-to-planning.md': 'Backlog',
                '/test-extension/assets/prompts/stage-backlog-to-inprogress.md': 'Lite backlog',
                '/test-extension/assets/prompts/stage-inprogress-to-done.md': 'Lite done',
                '/test-extension/assets/prompts/work-on-task.md': 'Work',
                '/test-extension/assets/prompts/goal-decompose.md': 'Goal',
            });

            const otherBoardConfigStore = new BoardConfigStore(Uri.file('/other-workspace') as any);
            const otherConfig = otherBoardConfigStore.get();
            otherConfig.profile = 'lite';

            await participant.scaffoldPromptsForContext({
                folder: { uri: Uri.file('/other-workspace'), name: 'other', index: 1 } as any,
                boardConfigStore: otherBoardConfigStore,
            });

            const written = (workspace.fs.writeFile as any).mock.calls
                .map((call: any[]) => ({ path: call[0].fsPath || call[0].path, text: new TextDecoder().decode(call[1]) }));
            const readmeWrite = written.find((entry: any) => entry.path.includes('/other-workspace/.agentkanban/prompts/README.md'));
            const liteBacklogWrite = written.find((entry: any) => entry.path.includes('/other-workspace/.agentkanban/prompts/stage-backlog-to-inprogress.md'));
            const liteDoneWrite = written.find((entry: any) => entry.path.includes('/other-workspace/.agentkanban/prompts/stage-inprogress-to-done.md'));
            expect(readmeWrite?.text).toContain('Profile lite');
            expect(liteBacklogWrite?.text).toBe('Lite backlog');
            expect(liteDoneWrite?.text).toBe('Lite done');
        });

        it('syncAgentsMdSectionForContext uses the provided task store, not the active store', async () => {
            installMockFs({
                '/other-workspace/AGENTS.md': '',
            });

            const otherTaskStore = new TaskStore(Uri.file('/other-workspace') as any);
            const otherBoardConfigStore = new BoardConfigStore(Uri.file('/other-workspace') as any);
            const linkedTask: Task = {
                id: 'task_other_1',
                title: 'Other Workspace Task',
                lane: 'in-progress',
                created: '2026-01-01T00:00:00.000Z',
                updated: '2026-01-01T00:00:00.000Z',
                description: '',
                worktree: { branch: 'agentkanban/other', path: '/other-workspace', created: '' },
            };
            (otherTaskStore as any).tasks.set(linkedTask.id, linkedTask);

            await participant.syncAgentsMdSectionForContext({
                folder: { uri: Uri.file('/other-workspace'), name: 'other', index: 1 } as any,
                taskStore: otherTaskStore,
                boardConfigStore: otherBoardConfigStore,
            });

            const content = new TextDecoder().decode((workspace.fs.writeFile as any).mock.calls.at(-1)[1]);
            expect(content).toContain('Other Workspace Task');
        });

        it('worktree commands resolve the service from the active registry context', async () => {
            const task: Task = {
                id: 'task_registry_wt',
                title: 'Registry Worktree Task',
                lane: 'in-progress',
                created: '2026-01-01T00:00:00.000Z',
                updated: '2026-01-01T00:00:00.000Z',
                description: '',
            };
            (taskStore as any).tasks.set(task.id, task);

            const mockWorktreeService = {
                isGitRepo: vi.fn().mockResolvedValue(true),
                exists: vi.fn().mockResolvedValue(false),
                create: vi.fn().mockResolvedValue({
                    branch: 'agentkanban/registry-worktree-task',
                    path: '/test-workspace-worktrees/registry-worktree-task',
                    created: '2026-01-01T00:00:00.000Z',
                }),
                openInVSCode: vi.fn().mockResolvedValue(undefined),
            };
            const mockRegistry = {
                getActiveContext: () => ({
                    folder: { uri: Uri.file('/test-workspace'), name: 'test', index: 0 },
                    worktreeService: mockWorktreeService,
                }),
            } as any;

            const registryParticipant = new ChatParticipant(
                taskStore,
                boardConfigStore,
                extensionUri,
                () => true,
                undefined,
                undefined,
                mockRegistry,
            );
            registryParticipant.lastSelectedTaskId = task.id;

            vi.spyOn(workspace.fs, 'readFile').mockResolvedValue(new TextEncoder().encode('---\n---\n'));
            vi.spyOn(workspace.fs, 'writeFile').mockResolvedValue(undefined);

            const response = mockResponse();
            await registryParticipant.handleRequest(mockRequest('worktree', ''), {} as any, response, mockToken);

            expect(mockWorktreeService.isGitRepo).toHaveBeenCalled();
            expect(mockWorktreeService.create).toHaveBeenCalled();
        });
    });

    describe('/pack command', () => {
        it('should list configured packs', async () => {
            const config = boardConfigStore.get();
            config.packs = [
                { name: 'odoo', stack: 'Odoo Stack', skills: ['odoo-19'] },
                { name: 'web', stack: 'Web Stack' }
            ];
            config.activeStack = 'odoo';

            const response = mockResponse();
            await participant.handleRequest(mockRequest('pack', 'list'), {} as any, response, mockToken);

            expect(response.messages.some((m: string) => m.includes('### Configured Stack Packs'))).toBe(true);
            expect(response.messages.some((m: string) => m.includes('**odoo** *(active)*'))).toBe(true);
            expect(response.messages.some((m: string) => m.includes('**web**'))).toBe(true);
        });

        it('should change active stack pack and trigger sync', async () => {
            const config = boardConfigStore.get();
            config.packs = [
                { name: 'odoo', stack: 'Odoo Stack' },
                { name: 'web', stack: 'Web Stack' }
            ];
            config.activeStack = 'web';

            installMockFs({
                '/test-workspace/.agentkanban/board.yaml': 'profile: standard',
                '/test-workspace/AGENTS.md': '',
                '/test-extension/assets/prompts/README.md': 'Stack: <stack skill>',
                '/test-extension/assets/prompts/new-task-intake.md': 'Intake prompt',
                '/test-extension/assets/prompts/stage-backlog-to-planning.md': 'Planning prompt',
                '/test-extension/assets/prompts/stage-planning-to-review.md': 'Planning to review prompt',
                '/test-extension/assets/prompts/stage-review-to-in-progress.md': 'Review to in progress prompt',
                '/test-extension/assets/prompts/stage-review-to-done.md': 'Review to done prompt',
                '/test-extension/assets/prompts/stage-blocked-and-resume.md': 'Blocked prompt',
                '/test-extension/assets/prompts/production-readiness-audit.md': 'Audit prompt',
            });

            const response = mockResponse();
            await participant.handleRequest(mockRequest('pack', 'use odoo'), {} as any, response, mockToken);

            expect(boardConfigStore.get().activeStack).toBe('odoo');
            expect(response.messages.some((m: string) => m.includes('Active stack pack set to **odoo**'))).toBe(true);
        });
    });
});
