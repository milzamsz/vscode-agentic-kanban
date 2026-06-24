import type { Task, BoardConfig, Priority } from '../types';
import type { SettingsDiscoveredSkill, SettingsSkillStatusFilter } from './settingsSkills';
import { getSettingsSkillsViewModel, getPersistedSkillSelection } from './settingsSkills';

declare function acquireVsCodeApi(): {
    postMessage(message: unknown): void;
};

const vscode = acquireVsCodeApi();

// ── Types ────────────────────────────────────────────────────────────────────

interface BoardState {
    tasks: Task[];
    config: BoardConfig;
    isInitialised?: boolean;
    currentBranch?: string;
}

// ── State ────────────────────────────────────────────────────────────────────

let state: BoardState = { tasks: [], config: { profile: 'standard', profileVersion: 3, lanes: [] } };
let searchQuery = '';
let searchFilter: 'all' | 'title' | 'labels' | 'description' = 'all';
let draggedTaskId: string | null = null;
let draggedLaneId: string | null = null;
let isDragging = false;
let pendingState: BoardState | null = null;

// Search debounce timer
let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

// Modal state
let modalTaskId: string | null = null;
let modalLabels: string[] = [];
let modalDependsOn: string[] = [];
let modalMode: 'create' | 'edit' = 'edit';

interface ModalSnapshot {
    title: string;
    description: string;
    lane: string;
    priority: string;
    assignee: string;
    dueDate: string;
    labels: string[];
    dependsOn: string[];
}
let modalSnapshot: ModalSnapshot | null = null;

// ── Settings Modal state ───────────────────────────────────────────────
let settingsMode = false; // true when settings modal is open
let settingsDiscoveredSkills: SettingsDiscoveredSkill[] = [];
let settingsSkillFilter = '';
let settingsSkillStatusFilter: SettingsSkillStatusFilter = 'all';
let settingsSelectedSkills = new Set<string>();
let stackTemplates: import('../types').StackPack[] = [];

// ── Helpers ──────────────────────────────────────────────────────────────────

function esc(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function getInitials(name: string): string {
    return name
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? '')
        .join('');
}

function formatDate(isoDate: string): string {
    return isoDate;
}

function formatIsoToDate(iso: string): string {
    return iso.slice(0, 10);
}

const ICON_CLOCK = '<svg class="inline-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="6.25"/><path d="M8 4.5V8l2.5 1.5"/></svg>';
const ICON_ARCHIVE = '<svg class="inline-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4h12v2H2z"/><path d="M3 6v7a1 1 0 001 1h8a1 1 0 001-1V6"/><path d="M6.5 9h3"/></svg>';
const ICON_CALENDAR = '<svg class="inline-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="12" height="11" rx="1"/><path d="M5 1v3M11 1v3M2 7h12"/></svg>';
const ICON_BRANCH = '<svg class="inline-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="5" cy="4" r="2"/><circle cx="5" cy="12" r="2"/><circle cx="11" cy="6" r="2"/><path d="M5 6v4M9.2 5L7 7"/></svg>';
const ICON_BRANCH_ADD = '<svg class="inline-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="4" cy="4" r="2"/><circle cx="4" cy="12" r="2"/><path d="M4 6v4"/><path d="M10 7v4M8 9h4"/></svg>';
const ICON_COPY = '<svg class="inline-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="5.5" y="5.5" width="8" height="8" rx="1"/><path d="M3.5 10.5h-1a1 1 0 01-1-1v-6a1 1 0 011-1h6a1 1 0 011 1v1"/></svg>';
const ICON_CHECK = '<svg class="inline-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13.5 4.5l-7 7-3.5-3.5"/></svg>';

function isOverdue(isoDate: string): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(isoDate + 'T00:00:00') < today;
}

/** Display a lane slug in the UI: UPPERCASE, hyphens→spaces. */
function displayLane(slug: string): string {
    return slug.replace(/-/g, ' ').toUpperCase();
}

const PRIORITY_LABELS: Record<string, string> = {
    critical: 'Critical',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
    none: 'None',
};

// ── Message Handling ─────────────────────────────────────────────────────────

window.addEventListener('message', (event: MessageEvent) => {
    const msg = event.data as { type: string; state?: BoardState; skills?: Array<{ name: string; description?: string }>; templates?: import('../types').StackPack[] };
    if (msg.type === 'stateUpdate' && msg.state) {
        if (isDragging) {
            pendingState = msg.state;
        } else {
            state = msg.state;
            renderBoard();
        }
    }
    if (msg.type === 'openCreateModal') {
        openCreateModal();
    }
    if (msg.type === 'openSettings') {
        openSettingsModal();
    }
    if (msg.type === 'skillsList') {
        handleSkillsList(msg.skills ?? []);
    }
    if (msg.type === 'stackTemplatesList') {
        handleStackTemplatesList(msg.templates ?? []);
    }
});

// ── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    vscode.postMessage({ type: 'ready' });
});

// ── Rendering ────────────────────────────────────────────────────────────────

function renderBoard(): void {
    const app = document.getElementById('app');
    if (!app) {
        return;
    }

    // Show uninitialised prompt if workspace has not been set up
    if (state.isInitialised === false) {
        app.innerHTML = `
            <div class="uninit-panel">
                <div class="uninit-title">Agentic Kanban</div>
                <div class="uninit-desc">This workspace has not yet been initialised. Set up the Kanban board and agent instruction files to get started.</div>
                <button class="uninit-btn" id="btn-uninit-init">Initialise Agentic Kanban</button>
            </div>`;
        document.getElementById('btn-uninit-init')?.addEventListener('click', () => {
            vscode.postMessage({ type: 'initialise' });
        });
        return;
    }

    // Track in-progress modal state before clobbering the DOM
    const openModalId = modalTaskId;
    const savedLabels = [...modalLabels];
    const savedDependsOn = [...modalDependsOn];
    const savedMode = modalMode;
    const pendingLabelInput = (document.getElementById('modal-label-input') as HTMLInputElement | null)?.value ?? '';
    const pendingDepInput = (document.getElementById('modal-dep-input') as HTMLInputElement | null)?.value ?? '';
    const savedAssignee = (document.getElementById('modal-assignee') as HTMLInputElement | null)?.value ?? '';
    const savedPriority = (document.getElementById('modal-priority') as HTMLSelectElement | null)?.value ?? '';
    const savedDueDate = (document.getElementById('modal-duedate') as HTMLInputElement | null)?.value ?? '';
    const savedLane = (document.getElementById('modal-lane') as HTMLSelectElement | null)?.value ?? '';
    const savedTitleInput = (document.getElementById('modal-title-input') as HTMLInputElement | null)?.value ?? '';
    const savedDescription = (document.getElementById('modal-description') as HTMLTextAreaElement | null)?.value ?? '';

    app.innerHTML = buildBoardHtml();

    // Restore focus to search input after re-render (when search is active and no modal is open)
    if (searchQuery && !openModalId && modalMode !== 'create') {
        const si = document.getElementById('search-input') as HTMLInputElement | null;
        if (si) {
            si.focus();
            const len = si.value.length;
            si.setSelectionRange(len, len);
        }
    }

    // Re-open modal if it was open before the re-render
    if (openModalId || savedMode === 'create') {
        if (savedMode === 'create') {
            modalMode = 'create';
            modalLabels = savedLabels;
            modalDependsOn = savedDependsOn;
            document.getElementById('modal-backdrop')?.removeAttribute('hidden');
            configureModalMode();
            // Restore create-mode inputs
            const titleInput = document.getElementById('modal-title-input') as HTMLInputElement | null;
            if (titleInput) {
                titleInput.value = savedTitleInput;
            }
            const descEl = document.getElementById('modal-description') as HTMLTextAreaElement | null;
            if (descEl) {
                descEl.value = savedDescription;
            }
            const laneEl = document.getElementById('modal-lane') as HTMLSelectElement | null;
            if (laneEl && savedLane) {
                laneEl.value = savedLane;
            }
            const priorityEl = document.getElementById('modal-priority') as HTMLSelectElement | null;
            if (priorityEl && savedPriority) {
                priorityEl.value = savedPriority;
            }
            const assigneeEl = document.getElementById('modal-assignee') as HTMLInputElement | null;
            if (assigneeEl) {
                assigneeEl.value = savedAssignee;
            }
            const dueDateEl = document.getElementById('modal-duedate') as HTMLInputElement | null;
            if (dueDateEl) {
                dueDateEl.value = savedDueDate;
            }
            const labelInputEl = document.getElementById('modal-label-input') as HTMLInputElement | null;
            if (labelInputEl && pendingLabelInput) {
                labelInputEl.value = pendingLabelInput;
            }
            const depInputEl = document.getElementById('modal-dep-input') as HTMLInputElement | null;
            if (depInputEl && pendingDepInput) {
                depInputEl.value = pendingDepInput;
            }
            renderTags();
            renderDeps();
        } else if (openModalId) {
            const task = state.tasks.find((t) => t.id === openModalId);
            if (task) {
                modalTaskId = openModalId;
                modalLabels = savedLabels;
                modalDependsOn = savedDependsOn;
                modalMode = 'edit';
                document.getElementById('modal-backdrop')?.removeAttribute('hidden');
                configureModalMode();
                populateModal(task);
                // Restore any in-progress user input
                const assigneeEl = document.getElementById('modal-assignee') as HTMLInputElement | null;
                if (assigneeEl && savedAssignee) {
                    assigneeEl.value = savedAssignee;
                }
                const priorityEl = document.getElementById('modal-priority') as HTMLSelectElement | null;
                if (priorityEl && savedPriority) {
                    priorityEl.value = savedPriority;
                }
                const dueDateEl = document.getElementById('modal-duedate') as HTMLInputElement | null;
                if (dueDateEl && savedDueDate) {
                    dueDateEl.value = savedDueDate;
                }
                const laneEl = document.getElementById('modal-lane') as HTMLSelectElement | null;
                if (laneEl && savedLane) {
                    laneEl.value = savedLane;
                }
                const labelInputEl = document.getElementById('modal-label-input') as HTMLInputElement | null;
                if (labelInputEl && pendingLabelInput) {
                    labelInputEl.value = pendingLabelInput;
                }
                const depInputEl = document.getElementById('modal-dep-input') as HTMLInputElement | null;
                if (depInputEl && pendingDepInput) {
                    depInputEl.value = pendingDepInput;
                }
                renderTags();
                renderDeps();
            } else {
                modalTaskId = null;
                modalLabels = [];
                modalDependsOn = [];
            }
        }
    }
}

/** Filter a task against the current search query and filter mode. */
function taskMatchesSearch(task: Task): boolean {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    switch (searchFilter) {
        case 'title':
            return task.title.toLowerCase().includes(q);
        case 'labels':
            return (task.labels ?? []).some((l) => l.toLowerCase().includes(q));
        case 'description':
            return (task.description ?? '').toLowerCase().includes(q);
        case 'all':
        default:
            return (
                task.title.toLowerCase().includes(q) ||
                (task.description ?? '').toLowerCase().includes(q) ||
                (task.labels ?? []).some((l) => l.toLowerCase().includes(q))
            );
    }
}

function buildBoardHtml(): string {
    const { lanes } = state.config;
    const laneSet = new Set(lanes);
    // Tasks whose lane is not part of the active profile fold into the last lane
    // (typically `done`) so a stray/legacy lane value never drops the card.
    const laneFor = (t: Task): string => (laneSet.has(t.lane) ? t.lane : lanes[lanes.length - 1] ?? t.lane);
    const filteredTasks = state.tasks.filter(taskMatchesSearch);
    const isSearchActive = searchQuery.length > 0;
    const totalTasks = state.tasks.length;
    const foundCount = filteredTasks.length;
    const ICON_SEARCH = '<svg class="search-icon-svg" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="7.5" r="5"/><path d="M11.5 11.5L16 16"/></svg>';
    const filterModes: Array<{ key: typeof searchFilter; label: string }> = [
        { key: 'all', label: 'All' },
        { key: 'title', label: 'Title' },
        { key: 'labels', label: 'Labels' },
        { key: 'description', label: 'Desc' },
    ];
    return `
        <div class="toolbar">
            <button id="btn-new-task" class="btn-primary">+ New Task</button>
            <button id="btn-dep-graph" class="btn-secondary">Dependencies</button>
            <div class="search-area">
                <div class="search-input-row">
                    ${ICON_SEARCH}
                    <input type="text" class="search-input" id="search-input"
                           placeholder="Search tasks or labels..."
                           value="${esc(searchQuery)}"
                           autocomplete="off" spellcheck="false">
                    <button class="search-clear-btn" id="search-clear-btn"${isSearchActive ? '' : ' hidden'}
                            title="Clear search">&times;</button>
                </div>
                <div class="search-filters" id="search-filters">
                    ${filterModes.map((m) => `
                        <button class="filter-btn${searchFilter === m.key ? ' active' : ''}"
                                data-search-filter="${m.key}">${m.label}</button>
                    `).join('')}
                </div>
            </div>
            <span class="toolbar-profile">${esc((state.config.profile ?? 'standard').toUpperCase())} PROFILE</span>
        </div>
        ${isSearchActive ? `
        <div class="search-results-bar" id="search-results-bar">
            <span>Found ${foundCount} task${foundCount !== 1 ? 's' : ''}${foundCount < totalTasks ? ' of ' + totalTasks : ''}</span>
            <button class="btn-link" id="search-clear-btn2">Clear search</button>
        </div>` : ''}
        <div class="board" id="board">
            ${lanes.map((lane) => buildLaneHtml(lane, filteredTasks.filter((t) => laneFor(t) === lane))).join('')}
        </div>
        ${buildModalHtml()}
        ${buildDiscardConfirmHtml()}
        ${buildConfirmDialogHtml()}
        ${buildDepGraphModalHtml()}
        ${buildSettingsModalHtml()}
    `;
}

function buildLaneHtml(lane: string, tasks: Task[]): string {
    return `
        <div class="lane" data-lane-id="${esc(lane)}">
            <div class="lane-header">
                <span class="lane-title">${esc(displayLane(lane))}</span>
                <span class="lane-count">${tasks.length}</span>
            </div>
            <div class="lane-cards" data-lane-id="${esc(lane)}">
                ${tasks.map(buildCardHtml).join('')}
            </div>
        </div>
    `;
}

function buildCardHtml(task: Task): string {
    const p = task.priority && task.priority !== 'none' ? task.priority : null;
    const priorityBadge = p
        ? `<span class="priority-badge priority-${esc(p)}">${esc(PRIORITY_LABELS[p] ?? p)}</span>`
        : '<span class="priority-badge priority-none">No Priority</span>';
    const hasMeta =
        task.assignee || task.dueDate || (task.labels && task.labels.length > 0);
    const specBadge = task.change
        ? `<span class="spec-badge" title="Spec-driven task — checklist in ${esc(task.change)}/tasks.md">SPEC</span>`
        : '';
    const progressBadge = task.checklist
        ? `<span class="progress-badge" title="Checklist progress">${task.checklist.done}/${task.checklist.total}</span>`
        : '';
    const doneChecklistBadge = task.doneChecklist && task.doneChecklist.total > 0
        ? `<span class="progress-badge dod-badge" title="Definition of Done progress: ${task.doneChecklist.agentDone}/${task.doneChecklist.agentTotal} agent + ${task.doneChecklist.humanDone}/${task.doneChecklist.humanTotal} human">DoD ${task.doneChecklist.done}/${task.doneChecklist.total}</span>`
        : '';
    const warnBits: string[] = [];
    if (task.specMissing) { warnBits.push('spec file missing'); }
    if (task.changeMissing) { warnBits.push('change folder missing'); }
    if (task.laneInvalid) { warnBits.push(`lane "${task.lane}" not in profile`); }
    const warnBadge = warnBits.length > 0
        ? `<span class="warn-badge" title="${esc(warnBits.join('; '))}">⚠</span>`
        : '';
    return `
        <div class="card" draggable="true" data-task-id="${esc(task.id)}">
            <div class="card-header">
                ${priorityBadge}
                ${specBadge}
                ${progressBadge}
                ${doneChecklistBadge}
                ${warnBadge}
                <button class="icon-btn card-delete" data-delete-task-id="${esc(task.id)}" title="Delete task">&times;</button>
            </div>
            <div class="card-title">${esc(task.title)}</div>
            ${hasMeta
            ? `<div class="card-meta">
                <div class="card-meta-row">
                    ${task.assignee ? `<span class="assignee-badge" title="${esc(task.assignee)}">${esc(getInitials(task.assignee))}</span>` : ''}
                    ${task.dueDate ? `<span class="due-chip${isOverdue(task.dueDate) ? ' due-overdue' : ''}">${ICON_CLOCK} ${esc(formatDate(task.dueDate))}</span>` : ''}
                </div>
                ${(task.labels?.length ?? 0) > 0
                ? `<div class="card-labels">
                    ${(task.labels ?? []).map((l) => {
                        const blockedBy = l.startsWith('blocked-by:');
                        const blocked = l === 'blocked';
                        const className = blockedBy || blocked ? ' label-blocked' : '';
                        const title = blockedBy
                            ? ' title="Blocked by another task"'
                            : blocked
                                ? ' title="Blocked pending an external dependency or decision"'
                                : '';
                        return `<span class="label-pill${className}"${title}>${esc(l)}</span>`;
                    }).join('')}
                </div>`
                : ''
            }
            </div>`
            : ''
        }
            <div class="card-footer">
                <div class="card-date">${formatIsoToDate(task.updated)}</div>
                <div class="card-footer-actions">
                    ${task.worktree
            ? `<button class="icon-btn card-worktree-open" data-worktree-open-task-id="${esc(task.id)}" title="Branch: ${esc(task.worktree.branch)} (Click to open worktree)">${ICON_BRANCH}</button>`
            : `<button class="icon-btn card-worktree-create" data-worktree-create-task-id="${esc(task.id)}" title="Create worktree">${ICON_BRANCH_ADD}</button>`
        }
                    <button class="icon-btn card-archive" data-archive-task-id="${esc(task.id)}" title="Archive task">${ICON_ARCHIVE}</button>
                </div>
            </div>
        </div>
    `;
}

function buildModalHtml(): string {
    const laneOptions = state.config.lanes
        .map((l) => `<option value="${esc(l)}">${esc(displayLane(l))}</option>`)
        .join('');
    return `
        <div class="modal-backdrop" id="modal-backdrop" hidden>
            <div class="modal" id="modal" role="dialog" aria-modal="true">
                <div class="modal-header">
                    <h3 class="modal-title" id="modal-task-title"></h3>
                    <input class="form-control modal-title-input" id="modal-title-input" type="text" placeholder="Task title" hidden>
                    <button class="icon-btn" id="modal-close" title="Close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-row" id="modal-branch-info-row" hidden>
                        <label class="form-label">Branch</label>
                        <div class="modal-branch-container" id="modal-branch-container">
                        </div>
                    </div>
                    <div class="form-row" id="modal-description-row" hidden>
                        <label class="form-label" for="modal-description">Description</label>
                        <textarea class="form-control" id="modal-description" rows="3" placeholder="Describe the task…"></textarea>
                    </div>
                    <div class="form-row">
                        <label class="form-label" for="modal-lane">Lane</label>
                        <select class="form-control" id="modal-lane">
                            ${laneOptions}
                        </select>
                    </div>
                    <div class="form-row">
                        <label class="form-label" for="modal-priority">Priority</label>
                        <select class="form-control" id="modal-priority">
                            <option value="none">None</option>
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="critical">Critical</option>
                        </select>
                    </div>
                    <div class="form-row">
                        <label class="form-label">Labels</label>
                        <div class="tag-field">
                            <div class="tags-row" id="tags-row"></div>
                            <div class="tag-add-row">
                                <div class="autocomplete-wrapper" id="label-ac-wrapper">
                                    <input class="form-control tag-add-input" id="modal-label-input" type="text"
                                           placeholder="Add label…" autocomplete="off">
                                    <div class="autocomplete-dropdown" id="label-ac-dropdown" hidden></div>
                                </div>
                                <button class="btn-secondary btn-sm" id="btn-add-label-tag" type="button">Add</button>
                            </div>
                        </div>
                    </div>
                    <div class="form-row">
                        <label class="form-label">Dependencies</label>
                        <div class="tag-field">
                            <div class="tags-row" id="dep-tags-row"></div>
                            <div class="tag-add-row">
                                <div class="autocomplete-wrapper" id="dep-ac-wrapper">
                                    <input class="form-control tag-add-input" id="modal-dep-input" type="text"
                                           placeholder="Add dependency…" autocomplete="off">
                                    <div class="autocomplete-dropdown" id="dep-ac-dropdown" hidden></div>
                                </div>
                                <button class="btn-secondary btn-sm" id="btn-add-dep-tag" type="button">Add</button>
                            </div>
                        </div>
                    </div>
                    <div class="form-row">
                        <label class="form-label" for="modal-assignee">Assignee</label>
                        <div class="autocomplete-wrapper" id="assignee-ac-wrapper">
                            <input class="form-control" id="modal-assignee" type="text"
                                   placeholder="Unassigned" autocomplete="off">
                            <div class="autocomplete-dropdown" id="assignee-ac-dropdown" hidden></div>
                        </div>
                    </div>
                    <div class="form-row">
                        <label class="form-label">Due Date</label>
                        <div class="datepicker-wrapper" id="datepicker-wrapper">
                            <div class="datepicker-input-row">
                                <input class="form-control" id="modal-duedate" type="text" placeholder="YYYY-MM-DD">
                                <button class="icon-btn datepicker-toggle" id="datepicker-toggle" type="button" title="Pick date">${ICON_CALENDAR}</button>
                                <button class="icon-btn datepicker-clear" id="datepicker-clear" type="button" title="Clear date">&times;</button>
                            </div>
                            <div class="datepicker-help" id="datepicker-help" hidden></div>
                        </div>
                    </div>
                </div>
                <div class="datepicker-overlay" id="datepicker-overlay" hidden>
                    <div class="datepicker-overlay-backdrop" id="datepicker-overlay-backdrop"></div>
                    <div class="datepicker-popup" id="datepicker-popup"></div>
                </div>
                <div class="modal-footer">
                    <div class="modal-footer-left" id="modal-footer-left">
                        <button class="btn-primary" id="btn-open-task">Task File</button>
                        <button class="btn-secondary" id="btn-open-todo">Checklist File</button>
                        <button class="btn-secondary" id="btn-send-to-chat" hidden>Send to Chat</button>
                    </div>
                    <div class="modal-actions">
                        <button class="btn-secondary" id="modal-cancel">Cancel</button>
                        <button class="btn-primary" id="modal-save">Save</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// ── Event Listeners ───────────────────────────────────────────────────────────

function setupEventListeners(): void {
    document.addEventListener('click', handleClick);
    document.addEventListener('dblclick', handleDblClick);
    document.addEventListener('dragstart', handleDragStart as EventListener);
    document.addEventListener('dragend', handleDragEnd as EventListener);
    document.addEventListener('dragover', handleDragOver as EventListener);
    document.addEventListener('dragleave', handleDragLeave as EventListener);
    document.addEventListener('drop', handleDrop as EventListener);
    document.addEventListener('keydown', handleKeydown as EventListener);
    document.addEventListener('focusout', (e: FocusEvent) => {
        if ((e.target as HTMLElement)?.id === 'modal-duedate') {
            validateDateInput();
        }
    });
    document.addEventListener('input', (e: Event) => {
        if ((e.target as HTMLElement)?.id === 'modal-duedate') {
            clearDateError();
        }
        if ((e.target as HTMLElement)?.id === 'search-input') {
            handleSearchInput(e.target as HTMLInputElement);
        }
        if ((e.target as HTMLElement)?.id === 'settings-skill-filter') {
            settingsSkillFilter = (e.target as HTMLInputElement).value;
            renderSkillsCheckboxes();
        }
    });
    document.addEventListener('change', (e: Event) => {
        if ((e.target as HTMLElement)?.classList.contains('skill-checkbox')) {
            const checkbox = e.target as HTMLInputElement;
            if (checkbox.checked) {
                settingsSelectedSkills.add(checkbox.value);
            } else {
                settingsSelectedSkills.delete(checkbox.value);
            }
            renderSkillsCheckboxes();
        }
    });
}

function handleSearchInput(input: HTMLInputElement): void {
    searchQuery = input.value;
    if (searchQuery === '') {
        searchFilter = 'all';
        renderBoard();
    } else {
        if (searchDebounceTimer) { clearTimeout(searchDebounceTimer); }
        searchDebounceTimer = setTimeout(() => {
            renderBoard();
            // Restore focus to search input after render
            const si = document.getElementById('search-input') as HTMLInputElement | null;
            if (si) {
                si.focus();
                const len = si.value.length;
                si.setSelectionRange(len, len);
            }
        }, 150);
    }
}

function handleClick(e: MouseEvent): void {
    const t = e.target as Element;

    if ((t as HTMLElement).id === 'btn-new-task') {
        openCreateModal();
        return;
    }
    if ((t as HTMLElement).id === 'btn-dep-graph') {
        openDepGraph();
        return;
    }
    if ((t as HTMLElement).id === 'dep-graph-close' || (t as HTMLElement).id === 'dep-graph-backdrop') {
        closeDepGraph();
        return;
    }
    // Settings modal handlers
    if ((t as HTMLElement).id === 'settings-save') {
        saveSettingsModal();
        return;
    }
    if ((t as HTMLElement).id === 'settings-cancel' || (t as HTMLElement).id === 'settings-close') {
        closeSettingsModal();
        return;
    }
    if ((t as HTMLElement).id === 'settings-backdrop' && e.target === document.getElementById('settings-backdrop')) {
        closeSettingsModal();
        return;
    }
    if ((t as HTMLElement).matches('[data-settings-skill-filter]')) {
        settingsSkillStatusFilter = ((t as HTMLElement).getAttribute('data-settings-skill-filter') as SettingsSkillStatusFilter) || 'all';
        renderSkillsCheckboxes();
        return;
    }
    // Settings tab switching
    if ((t as HTMLElement).closest('.settings-tab')) {
        const tab = (t as HTMLElement).closest('.settings-tab') as HTMLElement;
        const tabName = tab.dataset.tab;
        document.querySelectorAll('.settings-tab').forEach(el => el.classList.remove('active'));
        tab.classList.add('active');
        document.querySelectorAll('.settings-panel').forEach(el => el.setAttribute('hidden', ''));
        const targetId = tabName === 'skill-packs' ? 'settings-skill-packs' : 'settings-board-config';
        document.getElementById(targetId)?.removeAttribute('hidden');
        if (tabName === 'skill-packs') {
            renderSkillsCheckboxes();
            vscode.postMessage({ type: 'requestStackTemplates' });
        }
        return;
    }
    if ((t as HTMLElement).id === 'modal-close') {
        tryCloseModal();
        return;
    }
    if ((t as HTMLElement).id === 'modal-cancel') {
        closeModal();
        return;
    }
    if ((t as HTMLElement).id === 'modal-discard-keep') {
        hideDiscardConfirm();
        return;
    }
    if ((t as HTMLElement).id === 'modal-discard-confirm') {
        hideDiscardConfirm();
        closeModal();
        return;
    }
    if ((t as HTMLElement).id === 'modal-save') {
        saveModal();
        return;
    }
    if ((t as HTMLElement).id === 'btn-open-task') {
        if (modalTaskId) {
            vscode.postMessage({ type: 'openTask', taskId: modalTaskId });
            closeModal();
        }
        return;
    }
    if ((t as HTMLElement).id === 'btn-open-todo') {
        if (modalTaskId) {
            vscode.postMessage({ type: 'openTodo', taskId: modalTaskId });
            closeModal();
        }
        return;
    }
    if ((t as HTMLElement).id === 'btn-send-to-chat') {
        if (modalTaskId) {
            vscode.postMessage({ type: 'sendToChat', taskId: modalTaskId });
            closeModal();
        }
        return;
    }
    // ── Branch and Worktree handlers ──
    if ((t as HTMLElement).id === 'modal-btn-copy-branch' || (t as HTMLElement).closest('#modal-btn-copy-branch')) {
        const copyBranchBtn = document.getElementById('modal-btn-copy-branch');
        const branchText = document.getElementById('modal-branch-info')?.textContent;
        if (copyBranchBtn && branchText) {
            navigator.clipboard.writeText(branchText);
            const originalTitle = copyBranchBtn.getAttribute('title');
            copyBranchBtn.setAttribute('title', 'Copied!');
            copyBranchBtn.innerHTML = ICON_CHECK;
            setTimeout(() => {
                copyBranchBtn.setAttribute('title', originalTitle || 'Copy branch name');
                copyBranchBtn.innerHTML = ICON_COPY;
            }, 1000);
        }
        return;
    }
    if ((t as HTMLElement).id === 'modal-btn-open-worktree' || (t as HTMLElement).closest('#modal-btn-open-worktree')) {
        if (modalTaskId) {
            vscode.postMessage({ type: 'openWorktree', taskId: modalTaskId });
            closeModal();
        }
        return;
    }
    if ((t as HTMLElement).id === 'modal-btn-create-worktree' || (t as HTMLElement).closest('#modal-btn-create-worktree')) {
        if (modalTaskId) {
            vscode.postMessage({ type: 'createWorktree', taskId: modalTaskId });
            closeModal();
        }
        return;
    }
    if ((t as HTMLElement).id === 'modal-btn-link-branch' || (t as HTMLElement).closest('#modal-btn-link-branch')) {
        if (modalTaskId) {
            vscode.postMessage({ type: 'linkBranch', taskId: modalTaskId });
            closeModal();
        }
        return;
    }

    // ── Search handlers ──
    if ((t as HTMLElement).id === 'search-clear-btn' || (t as HTMLElement).id === 'search-clear-btn2') {
        searchQuery = '';
        searchFilter = 'all';
        renderBoard();
        const si = document.getElementById('search-input') as HTMLInputElement | null;
        if (si) { si.focus(); }
        return;
    }
    const filterBtn = t.closest('[data-search-filter]') as HTMLElement | null;
    if (filterBtn) {
        searchFilter = filterBtn.dataset.searchFilter as typeof searchFilter;
        renderBoard();
        // Keep focus on the search input
        const si = document.getElementById('search-input') as HTMLInputElement | null;
        if (si) { si.focus(); }
        return;
    }
    // ── End search handlers ──

    if ((t as HTMLElement).id === 'btn-add-label-tag') {
        addLabelTag();
        return;
    }
    if ((t as HTMLElement).id === 'btn-add-dep-tag') {
        addDepTag();
        return;
    }
    if (t.closest('#datepicker-toggle')) {
        toggleDatepicker();
        return;
    }
    if (t.closest('#datepicker-clear')) {
        clearDatepicker();
        return;
    }
    if ((t as HTMLElement).id === 'datepicker-overlay-backdrop') {
        document.getElementById('datepicker-overlay')?.setAttribute('hidden', '');
        return;
    }
    // Datepicker navigation & day selection
    if (t.closest('#dp-prev')) {
        dpNavigate(-1);
        return;
    }
    if (t.closest('#dp-next')) {
        dpNavigate(1);
        return;
    }
    const dayBtn = t.closest('[data-dp-day]') as HTMLElement | null;
    if (dayBtn) {
        dpSelectDay(dayBtn.dataset.dpDay!);
        return;
    }
    if ((t as HTMLElement).id === 'confirm-cancel') {
        hideArchiveConfirm();
        return;
    }
    if ((t as HTMLElement).id === 'confirm-archive') {
        confirmArchive();
        return;
    }
    if ((t as HTMLElement).id === 'confirm-backdrop') {
        hideArchiveConfirm();
        return;
    }

    const archiveBtn = t.closest('[data-archive-task-id]') as HTMLElement | null;
    if (archiveBtn) {
        e.stopPropagation();
        showArchiveConfirm(archiveBtn.dataset.archiveTaskId!);
        return;
    }

    const worktreeCreateBtn = t.closest('[data-worktree-create-task-id]') as HTMLElement | null;
    if (worktreeCreateBtn) {
        e.stopPropagation();
        vscode.postMessage({ type: 'createWorktree', taskId: worktreeCreateBtn.dataset.worktreeCreateTaskId });
        return;
    }

    const worktreeOpenBtn = t.closest('[data-worktree-open-task-id]') as HTMLElement | null;
    if (worktreeOpenBtn) {
        e.stopPropagation();
        vscode.postMessage({ type: 'openWorktree', taskId: worktreeOpenBtn.dataset.worktreeOpenTaskId });
        return;
    }

    const deleteBtn = t.closest('[data-delete-task-id]') as HTMLElement | null;
    if (deleteBtn) {
        e.stopPropagation();
        vscode.postMessage({ type: 'deleteTask', taskId: deleteBtn.dataset.deleteTaskId });
        return;
    }

    const tagRemoveBtn = t.closest('[data-remove-tag]') as HTMLElement | null;
    if (tagRemoveBtn) {
        removeTag(tagRemoveBtn.getAttribute('data-remove-tag')!);
        return;
    }

    const depRemoveBtn = t.closest('[data-remove-dep]') as HTMLElement | null;
    if (depRemoveBtn) {
        removeDep(depRemoveBtn.getAttribute('data-remove-dep')!);
        return;
    }

    const card = t.closest('.card[data-task-id]') as HTMLElement | null;
    if (card && !t.closest('[data-delete-task-id]') && !t.closest('[data-archive-task-id]') && !t.closest('[data-worktree-create-task-id]') && !t.closest('[data-worktree-open-task-id]')) {
        openModal(card.dataset.taskId!);
        return;
    }
}

function handleDblClick(_e: MouseEvent): void {}

function handleKeydown(e: KeyboardEvent): void {
    // Ctrl/Cmd+K to focus search input
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const si = document.getElementById('search-input') as HTMLInputElement | null;
        if (si) { si.focus(); si.select(); }
        return;
    }
    if (e.key === 'Escape') {
        const depBackdrop = document.getElementById('dep-graph-backdrop');
        if (depBackdrop && !depBackdrop.hasAttribute('hidden')) {
            closeDepGraph();
            return;
        }
        const overlay = document.getElementById('datepicker-overlay');
        if (overlay && !overlay.hasAttribute('hidden')) {
            overlay.setAttribute('hidden', '');
            return;
        }
        if (confirmTaskId) {
            hideArchiveConfirm();
            return;
        }
        // Escape clears search if active and modal is closed
        if (searchQuery) {
            const modalBackdrop = document.getElementById('modal-backdrop');
            if (modalBackdrop && !modalBackdrop.hasAttribute('hidden')) {
                closeModal();
            } else {
                searchQuery = '';
                searchFilter = 'all';
                renderBoard();
            }
            return;
        }
        closeModal();
        return;
    }
    if (e.key === 'Enter' && (e.target as Element).id === 'search-input') {
        e.preventDefault();
        // Immediately apply search without debounce
        if (searchDebounceTimer) { clearTimeout(searchDebounceTimer); searchDebounceTimer = null; }
        searchQuery = (e.target as HTMLInputElement).value;
        if (searchQuery === '') { searchFilter = 'all'; }
        renderBoard();
        // Restore focus to search input
        const si = document.getElementById('search-input') as HTMLInputElement | null;
        if (si) {
            si.focus();
            const len = si.value.length;
            si.setSelectionRange(len, len);
        }
        return;
    }
    if (e.key === 'Enter' && (e.target as Element).id === 'modal-label-input') {
        e.preventDefault();
        addLabelTag();
        return;
    }
    if (e.key === 'Enter' && (e.target as Element).id === 'modal-dep-input') {
        e.preventDefault();
        addDepTag();
        return;
    }
    if (e.key === 'Enter' && (e.target as Element).id === 'modal-duedate') {
        e.preventDefault();
        if (validateDateInput()) {
            document.getElementById('datepicker-overlay')?.setAttribute('hidden', '');
        }
        return;
    }
}

// ── Drag and Drop ─────────────────────────────────────────────────────────────

function handleDragStart(e: DragEvent): void {
    const t = e.target as Element;

    const card = t.closest('.card[data-task-id]') as HTMLElement | null;
    if (card) {
        draggedTaskId = card.dataset.taskId!;
        card.classList.add('card-dragging');
        e.dataTransfer!.effectAllowed = 'move';
        isDragging = true;
    }
}

function handleDragEnd(e: DragEvent): void {
    document.querySelectorAll('.lane').forEach((el) => el.classList.remove('lane-dragging', 'lane-drag-over'));
    document.querySelectorAll('.lane-cards').forEach((el) => el.classList.remove('cards-drag-over'));
    document.querySelectorAll('.card-drop-indicator').forEach((el) => el.remove());
    (e.target as Element).closest('.card')?.classList.remove('card-dragging');
    draggedTaskId = null;
    draggedLaneId = null;
    isDragging = false;
    if (pendingState) {
        state = pendingState;
        pendingState = null;
        renderBoard();
    }
}

function handleDragOver(e: DragEvent): void {
    e.preventDefault();
    const t = e.target as Element;

    if (!draggedTaskId) {
        return;
    }

    const laneCards = t.closest('.lane-cards') as HTMLElement | null;
    if (!laneCards) {
        return;
    }
    laneCards.classList.add('cards-drag-over');

    // Remove all existing drop indicators
    document.querySelectorAll('.card-drop-indicator').forEach((el) => el.remove());

    // Find which card we're hovering over
    const cards = Array.from(laneCards.querySelectorAll('.card[data-task-id]')) as HTMLElement[];
    const hoveredCard = t.closest('.card[data-task-id]') as HTMLElement | null;

    if (hoveredCard && hoveredCard.dataset.taskId !== draggedTaskId) {
        const rect = hoveredCard.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const indicator = document.createElement('div');
        indicator.className = 'card-drop-indicator';
        if (e.clientY < midY) {
            hoveredCard.parentNode!.insertBefore(indicator, hoveredCard);
        } else {
            hoveredCard.parentNode!.insertBefore(indicator, hoveredCard.nextSibling);
        }
    } else if (!hoveredCard && cards.length === 0) {
        // Empty lane — show indicator
        const indicator = document.createElement('div');
        indicator.className = 'card-drop-indicator';
        laneCards.appendChild(indicator);
    }
}

function handleDragLeave(e: DragEvent): void {
    const t = e.target as Element;
    const related = e.relatedTarget as Element | null;

    const cards = t.closest('.lane-cards');
    if (cards && !cards.contains(related)) {
        cards.classList.remove('cards-drag-over');
        // Remove indicators when leaving lane
        cards.querySelectorAll('.card-drop-indicator').forEach((el) => el.remove());
    }
}

function getTaskSortOrder(taskId: string): number {
    const task = state.tasks.find((t) => t.id === taskId);
    if (!task) {
        return 0;
    }
    return task.sortOrder ?? Date.parse(task.created);
}

function handleDrop(e: DragEvent): void {
    e.preventDefault();
    const t = e.target as Element;

    // Clean up indicators
    document.querySelectorAll('.card-drop-indicator').forEach((el) => el.remove());

    const laneCards = t.closest('.lane-cards') as HTMLElement | null;
    if (!laneCards || !draggedTaskId) {
        document.querySelectorAll('.lane-cards').forEach((el) => el.classList.remove('cards-drag-over'));
        return;
    }

    const targetLaneId = laneCards.dataset.laneId!;
    const cards = Array.from(laneCards.querySelectorAll('.card[data-task-id]')) as HTMLElement[];
    const cardIds = cards.map((c) => c.dataset.taskId!).filter((id) => id !== draggedTaskId);

    // Determine drop position based on cursor
    const hoveredCard = t.closest('.card[data-task-id]') as HTMLElement | null;
    let insertIndex = cardIds.length; // default: end

    if (hoveredCard && hoveredCard.dataset.taskId !== draggedTaskId) {
        const hoveredId = hoveredCard.dataset.taskId!;
        const idx = cardIds.indexOf(hoveredId);
        if (idx !== -1) {
            const rect = hoveredCard.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            insertIndex = e.clientY < midY ? idx : idx + 1;
        }
    }

    // Calculate sortOrder: midpoint between neighbours
    let newSortOrder: number;
    if (cardIds.length === 0) {
        // Empty lane or only card
        newSortOrder = 1;
    } else if (insertIndex === 0) {
        // Before first card
        newSortOrder = getTaskSortOrder(cardIds[0]) - 1;
    } else if (insertIndex >= cardIds.length) {
        // After last card
        newSortOrder = getTaskSortOrder(cardIds[cardIds.length - 1]) + 1;
    } else {
        // Between two cards
        const above = getTaskSortOrder(cardIds[insertIndex - 1]);
        const below = getTaskSortOrder(cardIds[insertIndex]);
        newSortOrder = (above + below) / 2;
    }

    vscode.postMessage({
        type: 'moveTask',
        taskId: draggedTaskId,
        lane: targetLaneId,
        sortOrder: newSortOrder,
    });

    document.querySelectorAll('.lane-cards').forEach((el) => el.classList.remove('cards-drag-over'));
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function openModal(taskId: string): void {
    const task = state.tasks.find((t) => t.id === taskId);
    if (!task) {
        return;
    }
    modalMode = 'edit';
    modalTaskId = taskId;
    modalLabels = [...(task.labels ?? [])];
    modalDependsOn = [...(task.dependsOn ?? [])];
    document.getElementById('modal-backdrop')?.removeAttribute('hidden');
    configureModalMode();
    populateModal(task);
    captureModalSnapshot();
}

function openCreateModal(): void {
    modalMode = 'create';
    modalTaskId = null;
    modalLabels = [];
    modalDependsOn = [];
    document.getElementById('modal-backdrop')?.removeAttribute('hidden');
    configureModalMode();

    // Defaults for create mode
    const titleInput = document.getElementById('modal-title-input') as HTMLInputElement | null;
    if (titleInput) {
        titleInput.value = '';
    }
    const descEl = document.getElementById('modal-description') as HTMLTextAreaElement | null;
    if (descEl) {
        descEl.value = '';
    }

    const laneEl = document.getElementById('modal-lane') as HTMLSelectElement | null;
    if (laneEl) {
        laneEl.value = state.config.lanes[0] ?? '';
    }
    const priorityEl = document.getElementById('modal-priority') as HTMLSelectElement | null;
    if (priorityEl) {
        priorityEl.value = 'none';
    }
    const assigneeEl = document.getElementById('modal-assignee') as HTMLInputElement | null;
    if (assigneeEl) {
        assigneeEl.value = '';
    }
    const dueDateEl = document.getElementById('modal-duedate') as HTMLInputElement | null;
    if (dueDateEl) {
        dueDateEl.value = '';
    }

    initAutocomplete('modal-assignee', 'assignee-ac-dropdown', () => state.config.users ?? [], 'select');
    initAutocomplete('modal-label-input', 'label-ac-dropdown', () => state.config.labels ?? [], 'add-tag');
    initAutocomplete('modal-dep-input', 'dep-ac-dropdown', () => {
        return state.tasks.map((t) => t.title);
    }, 'add-dep');

    renderTags();
    renderDeps();
    captureModalSnapshot();
    titleInput?.focus();
}

// ── Settings Modal Functions ──────────────────────────────────────────

function openSettingsModal(): void {
    settingsMode = true;
    settingsSelectedSkills = new Set(state.config.skills || []);
    const backdrop = document.getElementById('settings-backdrop');
    if (backdrop) {
        backdrop.removeAttribute('hidden');
    }
    vscode.postMessage({ type: 'requestSkills' });
    vscode.postMessage({ type: 'requestStackTemplates' });

    const filterInput = document.getElementById('settings-skill-filter');
    if (filterInput) {
        (filterInput as HTMLInputElement).value = settingsSkillFilter;
    }
    
    // Initial render
    renderSkillsCheckboxes();

    // Wire Active Stack dropdown for Create New
    const stackSelect = document.getElementById('settings-active-stack') as HTMLSelectElement | null;
    if (stackSelect) {
        stackSelect.addEventListener('change', (e) => {
            const val = (e.target as HTMLSelectElement).value;
            if (val === '__create_new__') {
                const form = document.getElementById('template-create-form');
                form?.removeAttribute('hidden');
                // Reset dropdown to previous value to avoid saving __create_new__
                stackSelect.value = state.config.activeStack ?? '';
            }
        });
    }
    const saveTplBtn = document.getElementById('template-create-save');
    if (saveTplBtn) {
        saveTplBtn.addEventListener('click', handleCreateTemplateSave);
    }
    const cancelTplBtn = document.getElementById('template-create-cancel');
    if (cancelTplBtn) {
        cancelTplBtn.addEventListener('click', () => {
            document.getElementById('template-create-form')?.setAttribute('hidden', '');
        });
    }
}

function handleCreateTemplateSave(): void {
    const nameInput = document.getElementById('template-name') as HTMLInputElement | null;
    const stackInput = document.getElementById('template-stack') as HTMLInputElement | null;
    const skillsInput = document.getElementById('template-skills') as HTMLTextAreaElement | null;
    const coverageInput = document.getElementById('template-coverage') as HTMLTextAreaElement | null;
    const verifyCmdsInput = document.getElementById('template-verify') as HTMLTextAreaElement | null;

    const name = nameInput?.value.trim() ?? '';
    if (!name) {
        nameInput?.focus();
        return;
    }

    const splitLines = (v: string) => v.split('\n').map(s => s.trim()).filter(Boolean);
    const template = {
        name,
        stack: stackInput?.value.trim() || undefined,
        skills: splitLines(skillsInput?.value ?? ''),
        coverage: splitLines(coverageInput?.value ?? ''),
        verifyCmds: splitLines(verifyCmdsInput?.value ?? ''),
    };

    vscode.postMessage({ type: 'saveStackTemplate', template });
    document.getElementById('template-create-form')?.setAttribute('hidden', '');

    // Clear form
    if (nameInput) { nameInput.value = ''; }
    if (stackInput) { stackInput.value = ''; }
    if (skillsInput) { skillsInput.value = ''; }
    if (coverageInput) { coverageInput.value = ''; }
    if (verifyCmdsInput) { verifyCmdsInput.value = ''; }
}

function handleSkillsList(skills: SettingsDiscoveredSkill[]): void {
    settingsDiscoveredSkills = skills;
    // Re-render the skills checkbox list if the Skill Packs panel is visible
    const panel = document.getElementById('settings-skill-packs');
    if (panel && !panel.hasAttribute('hidden')) {
        renderSkillsCheckboxes();
    }
}

function renderSkillsCheckboxes(): void {
    const container = document.getElementById('settings-skills-list');
    if (!container) {
        return;
    }
    const config = state.config;
    const summary = document.getElementById('settings-skills-summary');
    const warning = document.getElementById('settings-skills-warning');
    const skillsVM = getSettingsSkillsViewModel(
        settingsDiscoveredSkills,
        settingsSelectedSkills,
        config.skills || [],
        settingsSkillFilter,
        settingsSkillStatusFilter
    );

    if (summary) {
        summary.innerHTML = `
            <button type="button" class="settings-summary-chip${settingsSkillStatusFilter === 'all' ? ' active' : ''}" data-settings-skill-filter="all">Installed ${skillsVM.installedCount}</button>
            <button type="button" class="settings-summary-chip${settingsSkillStatusFilter === 'active' ? ' active' : ''}" data-settings-skill-filter="active">Active ${skillsVM.activeInstalledCount}</button>
            <button type="button" class="settings-summary-chip${settingsSkillStatusFilter === 'inactive' ? ' active' : ''}" data-settings-skill-filter="inactive">Inactive ${Math.max(0, skillsVM.installedCount - skillsVM.activeInstalledCount)}</button>
        `;
    }

    if (warning) {
        if (skillsVM.configuredMissing.length > 0) {
            warning.innerHTML = `
                <strong>Configured but not discovered:</strong>
                ${skillsVM.configuredMissing.map((skill) => `<code>${esc(skill)}</code>`).join(', ')}.
                Saving this form on this machine will remove them from <code>board.yaml</code>.
            `;
            warning.removeAttribute('hidden');
        } else {
            warning.setAttribute('hidden', '');
            warning.innerHTML = '';
        }
    }
    
    if (skillsVM.filtered.length === 0) {
        container.innerHTML = `<div class="settings-skills-empty">${skillsVM.emptyMessage || 'No skills match your search.'}</div>`;
        return;
    }

    container.innerHTML = skillsVM.filtered.map(skill => {
        const checked = settingsSelectedSkills.has(skill.name) ? 'checked' : '';
        const descHtml = skill.description ? `<div class="skill-desc">${esc(skill.description)}</div>` : '';
        const sourceHtml = skill.sourceLabel ? `<span class="skill-source-badge">${esc(skill.sourceLabel)}</span>` : '';
        return `
            <label class="skill-checkbox-label">
                <input type="checkbox" class="skill-checkbox" value="${esc(skill.name)}" ${checked}>
                <div class="skill-info">
                    <div class="skill-heading">
                        <span class="skill-name">${esc(skill.name)}</span>
                        ${sourceHtml}
                    </div>
                    ${descHtml}
                </div>
            </label>
        `;
    }).join('');
}

function handleStackTemplatesList(templates: import('../types').StackPack[]): void {
    stackTemplates = templates;
    const panel = document.getElementById('settings-skill-packs');
    if (panel && !panel.hasAttribute('hidden')) {
        renderActiveStackDropdown();
    }
}

function renderActiveStackDropdown(): void {
    const select = document.getElementById('settings-active-stack') as HTMLSelectElement | null;
    if (!select) { return; }
    const config = state.config;
    const localPacks = config.packs ?? [];
    const localNames = new Set(localPacks.map(p => p.name));
    const globalOnly = stackTemplates.filter(t => !localNames.has(t.name));
    const allOptions = [
        ...localPacks.map(p => {
            const label = typeof p.stack === 'string' ? p.stack : p.name;
            return `<option value="${esc(p.name)}" ${config.activeStack === p.name ? 'selected' : ''}>${esc(label)}</option>`;
        }),
        ...globalOnly.map(t => {
            const label = typeof t.stack === 'string' ? t.stack : t.name;
            return `<option value="${esc(t.name)}" ${config.activeStack === t.name ? 'selected' : ''}>[Global] ${esc(label)}</option>`;
        }),
        `<option value="__create_new__">+ Create New Template...</option>`,
    ];
    select.innerHTML = allOptions.join('');
}

function closeSettingsModal(): void {
    settingsMode = false;
    settingsSkillFilter = '';
    settingsSkillStatusFilter = 'all';
    settingsSelectedSkills = new Set<string>();
    const backdrop = document.getElementById('settings-backdrop');
    if (backdrop) {
        backdrop.setAttribute('hidden', '');
    }
}

function saveSettingsModal(): void {
    const config = state.config;

    const enforcementMode = (document.getElementById('settings-enforcement-mode') as HTMLSelectElement)?.value || 'warn';
    const allowed = (document.getElementById('settings-allowed') as HTMLSelectElement)?.value || 'true';
    const actors = (document.getElementById('settings-actors') as HTMLSelectElement)?.value || 'agent';
    const requireReason = (document.getElementById('settings-require-reason') as HTMLSelectElement)?.value || 'true';

    const worktreeRequired = (document.getElementById('settings-worktree-required') as HTMLSelectElement)?.value || 'true';
    const wipLimit = parseInt((document.getElementById('settings-wip-limit') as HTMLInputElement)?.value || '1', 10);

    const transitionChecklist = (document.getElementById('settings-transition-checklist') as HTMLSelectElement)?.value || '1';
    const transitionSpec = (document.getElementById('settings-transition-spec') as HTMLSelectElement)?.value || '1';
    const transitionDescription = (document.getElementById('settings-transition-description') as HTMLSelectElement)?.value || '1';
    const transitionWorktree = (document.getElementById('settings-transition-worktree') as HTMLSelectElement)?.value || '1';
    const transitionDoneChecklist = (document.getElementById('settings-transition-done-checklist') as HTMLSelectElement)?.value || '1';

    const verificationTest = (document.getElementById('settings-verification-test') as HTMLInputElement)?.value || '';
    const verificationLint = (document.getElementById('settings-verification-lint') as HTMLInputElement)?.value || '';
    const verificationBuild = (document.getElementById('settings-verification-build') as HTMLInputElement)?.value || '';

    // Review policy matrix
    const reviewPolicy: Record<string, { planning: string; implementation: string }> = { ...(config.reviewPolicy || {}) };
    document.querySelectorAll('.settings-review-planning').forEach(el => {
        const select = el as HTMLSelectElement;
        const level = select.dataset.level as string;
        if (level) {
            if (!reviewPolicy[level]) reviewPolicy[level] = { planning: 'self-agent', implementation: 'self-agent' };
            reviewPolicy[level].planning = select.value;
        }
    });
    document.querySelectorAll('.settings-review-implementation').forEach(el => {
        const select = el as HTMLSelectElement;
        const level = select.dataset.level as string;
        if (level) {
            if (!reviewPolicy[level]) reviewPolicy[level] = { planning: 'self-agent', implementation: 'self-agent' };
            reviewPolicy[level].implementation = select.value;
        }
    });

    const activeStack = (document.getElementById('settings-active-stack') as HTMLSelectElement)?.value || '';
    // Gather checked skills from checkbox list
    const skills = getPersistedSkillSelection(settingsDiscoveredSkills, settingsSelectedSkills);

    const update: Record<string, unknown> = {
        enforcement: {
            mode: enforcementMode,
            overrides: {
                allowed: allowed === 'true',
                actors: actors ? actors.split(',').map((a: string) => a.trim()) : ['agent'],
                requireReason: requireReason === 'true',
            },
        },
        worktreePolicy: {
            requiredForImplementation: worktreeRequired === 'true',
        },
        wipLimits: { 'in-progress': wipLimit },
        reviewPolicy,
        policies: {
            transition: {
                requireChecklistForInProgress: transitionChecklist === '1',
                requireSpecForInProgress: transitionSpec === '1',
                requireDescriptionForReview: transitionDescription === '1',
                requireWorktreeForInProgress: transitionWorktree === '1',
                requireDoneChecklistForDone: transitionDoneChecklist === '1',
            },
            verification: {
                testCommand: verificationTest,
                lintCommand: verificationLint,
                buildCommand: verificationBuild,
            },
        },
        skills,
    };

    vscode.postMessage({ type: 'saveBoardConfig', ...update });

    if (activeStack && activeStack !== '__create_new__' && activeStack !== config.activeStack) {
        vscode.postMessage({ type: 'setActiveStack', name: activeStack });
    }

    closeSettingsModal();
}

function configureModalMode(): void {
    const titleH3 = document.getElementById('modal-task-title');
    const titleInput = document.getElementById('modal-title-input');
    const descRow = document.getElementById('modal-description-row');
    const footerLeft = document.getElementById('modal-footer-left');
    const saveBtn = document.getElementById('modal-save');

    if (modalMode === 'create') {
        titleH3?.setAttribute('hidden', '');
        titleInput?.removeAttribute('hidden');
        descRow?.removeAttribute('hidden');
        document.getElementById('modal-branch-info-row')?.setAttribute('hidden', '');
        if (footerLeft) {
            footerLeft.style.visibility = 'hidden';
        }
        if (saveBtn) {
            saveBtn.textContent = 'Create';
        }
    } else {
        titleH3?.removeAttribute('hidden');
        titleInput?.setAttribute('hidden', '');
        descRow?.setAttribute('hidden', '');
        if (footerLeft) {
            footerLeft.style.visibility = 'visible';
        }
        if (saveBtn) {
            saveBtn.textContent = 'Save';
        }
    }
}

function populateModal(task: Task): void {
    const titleEl = document.getElementById('modal-task-title');
    if (titleEl) {
        titleEl.textContent = task.title;
    }

    const branchInfoRow = document.getElementById('modal-branch-info-row');
    const branchContainer = document.getElementById('modal-branch-container');
    if (branchInfoRow && branchContainer) {
        if (task.worktree?.branch) {
            branchContainer.innerHTML = `
                <span class="modal-branch-badge" id="modal-branch-info">${esc(task.worktree.branch)}</span>
                <button class="icon-btn" id="modal-btn-copy-branch" title="Copy branch name" type="button">${ICON_COPY}</button>
                <button class="btn-secondary btn-sm" id="modal-btn-open-worktree" type="button">Open Worktree</button>
            `;
            branchInfoRow.removeAttribute('hidden');
        } else {
            branchContainer.innerHTML = `
                <span class="modal-branch-empty">No active branch/worktree</span>
                <div class="modal-branch-actions">
                    <button class="btn-secondary btn-sm" id="modal-btn-create-worktree" type="button">Create Worktree</button>
                    <button class="btn-secondary btn-sm" id="modal-btn-link-branch" type="button">Link Branch</button>
                </div>
            `;
            branchInfoRow.removeAttribute('hidden');
        }
    }

    const laneEl = document.getElementById('modal-lane') as HTMLSelectElement | null;
    if (laneEl) {
        laneEl.value = task.lane;
    }

    const priorityEl = document.getElementById('modal-priority') as HTMLSelectElement | null;
    if (priorityEl) {
        priorityEl.value = task.priority ?? 'none';
    }

    const assigneeEl = document.getElementById('modal-assignee') as HTMLInputElement | null;
    if (assigneeEl) {
        assigneeEl.value = task.assignee ?? '';
    }

    const dueDateEl = document.getElementById('modal-duedate') as HTMLInputElement | null;
    if (dueDateEl) {
        dueDateEl.value = task.dueDate ?? '';
    }

    initAutocomplete('modal-assignee', 'assignee-ac-dropdown', () => state.config.users ?? [], 'select');
    initAutocomplete('modal-label-input', 'label-ac-dropdown', () => state.config.labels ?? [], 'add-tag');
    initAutocomplete('modal-dep-input', 'dep-ac-dropdown', () => {
        return state.tasks
            .filter((t) => t.id !== task.id && t.slug !== task.slug)
            .map((t) => t.title);
    }, 'add-dep');

    renderTags();
    renderDeps();
}

function closeModal(): void {
    document.getElementById('modal-backdrop')?.setAttribute('hidden', '');
    hideDiscardConfirm();
    modalTaskId = null;
    modalLabels = [];
    modalDependsOn = [];
    modalMode = 'edit';
    modalSnapshot = null;
}

function captureModalSnapshot(): void {
    modalSnapshot = {
        title: (document.getElementById('modal-title-input') as HTMLInputElement | null)?.value ?? '',
        description: (document.getElementById('modal-description') as HTMLTextAreaElement | null)?.value ?? '',
        lane: (document.getElementById('modal-lane') as HTMLSelectElement | null)?.value ?? '',
        priority: (document.getElementById('modal-priority') as HTMLSelectElement | null)?.value ?? '',
        assignee: (document.getElementById('modal-assignee') as HTMLInputElement | null)?.value ?? '',
        dueDate: (document.getElementById('modal-duedate') as HTMLInputElement | null)?.value ?? '',
        labels: [...modalLabels],
        dependsOn: [...modalDependsOn],
    };
}

function isModalDirty(): boolean {
    if (!modalSnapshot) {
        return false;
    }
    const lane = (document.getElementById('modal-lane') as HTMLSelectElement | null)?.value ?? '';
    const priority = (document.getElementById('modal-priority') as HTMLSelectElement | null)?.value ?? '';
    const assignee = (document.getElementById('modal-assignee') as HTMLInputElement | null)?.value ?? '';
    const dueDate = (document.getElementById('modal-duedate') as HTMLInputElement | null)?.value ?? '';
    const title = (document.getElementById('modal-title-input') as HTMLInputElement | null)?.value ?? '';
    const description = (document.getElementById('modal-description') as HTMLTextAreaElement | null)?.value ?? '';
    return (
        title !== modalSnapshot.title ||
        description !== modalSnapshot.description ||
        lane !== modalSnapshot.lane ||
        priority !== modalSnapshot.priority ||
        assignee !== modalSnapshot.assignee ||
        dueDate !== modalSnapshot.dueDate ||
        JSON.stringify([...modalLabels].sort()) !== JSON.stringify([...modalSnapshot.labels].sort()) ||
        JSON.stringify([...modalDependsOn].sort()) !== JSON.stringify([...modalSnapshot.dependsOn].sort())
    );
}

function tryCloseModal(): void {
    if (isModalDirty()) {
        showDiscardConfirm();
    } else {
        closeModal();
    }
}

function showDiscardConfirm(): void {
    document.getElementById('modal-discard-backdrop')?.removeAttribute('hidden');
}

function hideDiscardConfirm(): void {
    document.getElementById('modal-discard-backdrop')?.setAttribute('hidden', '');
}

function saveModal(): void {
    const priority = (document.getElementById('modal-priority') as HTMLSelectElement).value as Priority;
    const assigneeRaw = ((document.getElementById('modal-assignee') as HTMLInputElement).value ?? '').trim();
    const dueDateRaw = ((document.getElementById('modal-duedate') as HTMLInputElement).value ?? '').trim();
    if (dueDateRaw && !isValidDate(dueDateRaw)) {
        showDateError('Please enter a valid date in YYYY-MM-DD format');
        return;
    }
    clearDateError();
    const dueDate = dueDateRaw || undefined;
    const assignee = assigneeRaw || undefined;
    const labels = modalLabels.length > 0 ? [...modalLabels] : undefined;
    const dependsOn = modalDependsOn.length > 0 ? [...modalDependsOn] : undefined;
    const lane = (document.getElementById('modal-lane') as HTMLSelectElement).value;

    if (modalMode === 'create') {
        const titleRaw = ((document.getElementById('modal-title-input') as HTMLInputElement).value ?? '').trim();
        if (!titleRaw) {
            (document.getElementById('modal-title-input') as HTMLInputElement)?.focus();
            return;
        }
        const description = ((document.getElementById('modal-description') as HTMLTextAreaElement).value ?? '').trim();

        vscode.postMessage({
            type: 'createTask',
            title: titleRaw,
            description,
            lane,
            priority: priority === 'none' ? undefined : priority,
            assignee,
            labels,
            dependsOn,
            dueDate,
        });
    } else {
        if (!modalTaskId) {
            return;
        }

        vscode.postMessage({
            type: 'updateTaskMeta',
            taskId: modalTaskId,
            lane,
            priority: priority === 'none' ? undefined : priority,
            assignee,
            labels,
            dependsOn,
            dueDate,
        });
    }

    // Register new user/labels with the config registry
    if (assignee && !(state.config.users ?? []).includes(assignee)) {
        vscode.postMessage({ type: 'addUser', name: assignee });
    }
    for (const label of modalLabels) {
        if (!(state.config.labels ?? []).includes(label)) {
            vscode.postMessage({ type: 'addLabel', name: label });
        }
    }

    closeModal();
}

function addLabelTag(): void {
    const input = document.getElementById('modal-label-input') as HTMLInputElement | null;
    if (!input) {
        return;
    }
    const value = sanitiseLabel(input.value);
    if (value && !modalLabels.includes(value)) {
        modalLabels.push(value);
        if (value.startsWith('blocked-by:')) {
            const dep = value.substring('blocked-by:'.length).trim();
            if (dep && !modalDependsOn.includes(dep)) {
                modalDependsOn.push(dep);
                renderDeps();
            }
        }
        renderTags();
    }
    input.value = '';
    input.focus();
}

/** Sanitise a label: lowercase, alphanumeric and hyphens only. */
function sanitiseLabel(raw: string): string {
    return raw.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
}

function removeTag(label: string): void {
    modalLabels = modalLabels.filter((l) => l !== label);
    if (label.startsWith('blocked-by:')) {
        const dep = label.substring('blocked-by:'.length).trim();
        modalDependsOn = modalDependsOn.filter((d) => d !== dep);
        renderDeps();
    }
    renderTags();
}

function renderTags(): void {
    const row = document.getElementById('tags-row');
    if (!row) {
        return;
    }
    row.innerHTML = modalLabels
        .map(
            (l) =>
                `<span class="tag-chip">${esc(l)}<button class="tag-remove" data-remove-tag="${esc(l)}" type="button">&times;</button></span>`,
        )
        .join('');
}

function addDepTag(): void {
    const input = document.getElementById('modal-dep-input') as HTMLInputElement | null;
    if (!input) {
        return;
    }
    const val = input.value.trim();
    if (val) {
        // Try to find a task whose title, slug or ID matches (case-insensitive)
        const found = state.tasks.find((t) =>
            t.title.toLowerCase() === val.toLowerCase() ||
            t.slug?.toLowerCase() === val.toLowerCase() ||
            t.id.toLowerCase() === val.toLowerCase()
        );
        if (found) {
            const depKey = found.slug || found.id;
            if (depKey && !modalDependsOn.includes(depKey)) {
                modalDependsOn.push(depKey);
                const lbl = `blocked-by:${depKey}`;
                if (!modalLabels.includes(lbl)) {
                    modalLabels.push(lbl);
                    renderTags();
                }
                renderDeps();
            }
        } else {
            // Otherwise try sanitising and adding
            const sanitised = sanitiseLabel(val);
            if (sanitised && !modalDependsOn.includes(sanitised)) {
                modalDependsOn.push(sanitised);
                const lbl = `blocked-by:${sanitised}`;
                if (!modalLabels.includes(lbl)) {
                    modalLabels.push(lbl);
                    renderTags();
                }
                renderDeps();
            }
        }
    }
    input.value = '';
    input.focus();
}

function removeDep(dep: string): void {
    modalDependsOn = modalDependsOn.filter((d) => d !== dep);
    modalLabels = modalLabels.filter((l) => l !== `blocked-by:${dep}`);
    renderTags();
    renderDeps();
}

function renderDeps(): void {
    const row = document.getElementById('dep-tags-row');
    if (!row) {
        return;
    }
    row.innerHTML = modalDependsOn
        .map((d) => {
            const depTask = state.tasks.find((t) => t.slug === d || t.id === d);
            const displayName = depTask ? depTask.title : d;
            return `<span class="tag-chip">${esc(displayName)}<button class="tag-remove" data-remove-dep="${esc(d)}" type="button">&times;</button></span>`;
        })
        .join('');
}

// ── Discard Confirm Dialog ───────────────────────────────────────────────────

function buildDiscardConfirmHtml(): string {
    return `
        <div class="confirm-backdrop" id="modal-discard-backdrop" hidden>
            <div class="confirm-dialog">
                <p class="confirm-message">You have unsaved changes. Discard them?</p>
                <div class="confirm-actions">
                    <button class="btn-secondary" id="modal-discard-keep">Keep editing</button>
                    <button class="btn-primary" id="modal-discard-confirm">Discard</button>
                </div>
            </div>
        </div>
    `;
}

// ── Confirm Dialog ────────────────────────────────────────────────────────────

let confirmTaskId: string | null = null;

function buildConfirmDialogHtml(): string {
    return `
        <div class="confirm-backdrop" id="confirm-backdrop" hidden>
            <div class="confirm-dialog">
                <p class="confirm-message">Archive this task? It will be hidden from all lanes.</p>
                <div class="confirm-actions">
                    <button class="btn-secondary" id="confirm-cancel">Cancel</button>
                    <button class="btn-primary confirm-archive-btn" id="confirm-archive">Archive</button>
                </div>
            </div>
        </div>
    `;
}

function showArchiveConfirm(taskId: string): void {
    confirmTaskId = taskId;
    document.getElementById('confirm-backdrop')?.removeAttribute('hidden');
}

function hideArchiveConfirm(): void {
    confirmTaskId = null;
    document.getElementById('confirm-backdrop')?.setAttribute('hidden', '');
}

function confirmArchive(): void {
    if (confirmTaskId) {
        vscode.postMessage({ type: 'archiveTask', taskId: confirmTaskId });
    }
    hideArchiveConfirm();
}

// ── Autocomplete ──────────────────────────────────────────────────────────────

type AutocompleteMode = 'select' | 'add-tag' | 'add-dep';
const acCleanups: Array<() => void> = [];

function initAutocomplete(
    inputId: string,
    dropdownId: string,
    getItems: () => string[],
    mode: AutocompleteMode,
): void {
    const input = document.getElementById(inputId) as HTMLInputElement | null;
    const dropdown = document.getElementById(dropdownId) as HTMLElement | null;
    if (!input || !dropdown) {
        return;
    }

    let acIndex = -1;

    function showDropdown(filter: string): void {
        const items = getItems().filter((item) =>
            item.toLowerCase().includes(filter.toLowerCase()),
        );
        if (items.length === 0 || (items.length === 1 && items[0].toLowerCase() === filter.toLowerCase())) {
            dropdown!.setAttribute('hidden', '');
            return;
        }
        acIndex = -1;
        dropdown!.innerHTML = items
            .map(
                (item, i) =>
                    `<div class="autocomplete-option" data-ac-index="${i}" data-ac-value="${esc(item)}">${esc(item)}</div>`,
            )
            .join('');
        dropdown!.removeAttribute('hidden');
    }

    function hideDropdown(): void {
        dropdown!.setAttribute('hidden', '');
        acIndex = -1;
    }

    function selectItem(value: string): void {
        if (mode === 'select') {
            input!.value = value;
            hideDropdown();
        } else if (mode === 'add-tag') {
            input!.value = '';
            hideDropdown();
            const sanitised = sanitiseLabel(value);
            if (sanitised && !modalLabels.includes(sanitised)) {
                modalLabels.push(sanitised);
                renderTags();
            }
        } else if (mode === 'add-dep') {
            input!.value = '';
            hideDropdown();
            const depTask = state.tasks.find((t) => t.title === value);
            if (depTask) {
                const depKey = depTask.slug || depTask.id;
                if (depKey && !modalDependsOn.includes(depKey)) {
                    modalDependsOn.push(depKey);
                    const lbl = `blocked-by:${depKey}`;
                    if (!modalLabels.includes(lbl)) {
                        modalLabels.push(lbl);
                        renderTags();
                    }
                    renderDeps();
                }
            }
        }
    }

    function handleInput(): void {
        showDropdown(input!.value);
    }

    function handleFocus(): void {
        if (input!.value || getItems().length > 0) {
            showDropdown(input!.value);
        }
    }

    function handleKeydown(e: KeyboardEvent): void {
        if (dropdown!.hasAttribute('hidden')) {
            return;
        }
        const options = dropdown!.querySelectorAll('.autocomplete-option');
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            acIndex = Math.min(acIndex + 1, options.length - 1);
            updateActiveOption(options);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            acIndex = Math.max(acIndex - 1, 0);
            updateActiveOption(options);
        } else if (e.key === 'Enter' && acIndex >= 0) {
            e.preventDefault();
            e.stopPropagation();
            const opt = options[acIndex] as HTMLElement | undefined;
            if (opt) {
                selectItem(opt.dataset.acValue!);
            }
        } else if (e.key === 'Escape') {
            hideDropdown();
        }
    }

    function updateActiveOption(options: NodeListOf<Element>): void {
        options.forEach((el, i) => {
            el.classList.toggle('autocomplete-option-active', i === acIndex);
        });
    }

    function handleDropdownClick(e: MouseEvent): void {
        const opt = (e.target as Element).closest('.autocomplete-option') as HTMLElement | null;
        if (opt) {
            selectItem(opt.dataset.acValue!);
        }
    }

    function handleBlur(): void {
        // Delay to allow click on dropdown option
        setTimeout(() => hideDropdown(), 150);
    }

    input.addEventListener('input', handleInput);
    input.addEventListener('focus', handleFocus);
    input.addEventListener('blur', handleBlur);
    input.addEventListener('keydown', handleKeydown);
    dropdown.addEventListener('mousedown', handleDropdownClick);

    acCleanups.push(() => {
        input.removeEventListener('input', handleInput);
        input.removeEventListener('focus', handleFocus);
        input.removeEventListener('blur', handleBlur);
        input.removeEventListener('keydown', handleKeydown);
        dropdown.removeEventListener('mousedown', handleDropdownClick);
    });
}

// ── Datepicker ────────────────────────────────────────────────────────────────

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Check format AND that the date is real (e.g. rejects 2025-02-30). */
function isValidDate(v: string): boolean {
    if (!DATE_RE.test(v)) { return false; }
    const [y, m, d] = v.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

function showDateError(msg: string): void {
    const input = document.getElementById('modal-duedate');
    const help = document.getElementById('datepicker-help');
    input?.classList.add('datepicker-error');
    if (help) { help.textContent = msg; help.removeAttribute('hidden'); }
}

function clearDateError(): void {
    const input = document.getElementById('modal-duedate');
    const help = document.getElementById('datepicker-help');
    input?.classList.remove('datepicker-error');
    if (help) { help.textContent = ''; help.setAttribute('hidden', ''); }
}

function validateDateInput(): boolean {
    const input = document.getElementById('modal-duedate') as HTMLInputElement | null;
    if (!input) { return true; }
    const v = input.value.trim();
    if (!v) { clearDateError(); return true; }
    if (!isValidDate(v)) {
        showDateError('Please enter a valid date in YYYY-MM-DD format');
        return false;
    }
    clearDateError();
    return true;
}

let dpViewYear = new Date().getFullYear();
let dpViewMonth = new Date().getMonth(); // 0-based

function toggleDatepicker(): void {
    const overlay = document.getElementById('datepicker-overlay');
    if (!overlay) {
        return;
    }
    if (overlay.hasAttribute('hidden')) {
        // Initialise view to current value or today
        const input = document.getElementById('modal-duedate') as HTMLInputElement | null;
        if (input?.value && isValidDate(input.value)) {
            const d = new Date(input.value + 'T00:00:00');
            dpViewYear = d.getFullYear();
            dpViewMonth = d.getMonth();
        } else {
            const now = new Date();
            dpViewYear = now.getFullYear();
            dpViewMonth = now.getMonth();
        }
        renderCalendar();
        overlay.removeAttribute('hidden');
    } else {
        overlay.setAttribute('hidden', '');
    }
}

function clearDatepicker(): void {
    const input = document.getElementById('modal-duedate') as HTMLInputElement | null;
    if (input) {
        input.value = '';
    }
    clearDateError();
    document.getElementById('datepicker-overlay')?.setAttribute('hidden', '');
}

function dpNavigate(delta: number): void {
    dpViewMonth += delta;
    if (dpViewMonth < 0) {
        dpViewMonth = 11;
        dpViewYear--;
    } else if (dpViewMonth > 11) {
        dpViewMonth = 0;
        dpViewYear++;
    }
    renderCalendar();
}

function dpSelectDay(dateStr: string): void {
    const input = document.getElementById('modal-duedate') as HTMLInputElement | null;
    if (input) {
        input.value = dateStr;
    }
    clearDateError();
    document.getElementById('datepicker-overlay')?.setAttribute('hidden', '');
}

function renderCalendar(): void {
    const popup = document.getElementById('datepicker-popup');
    if (!popup) {
        return;
    }
    const input = document.getElementById('modal-duedate') as HTMLInputElement | null;
    const selectedDate = input?.value ?? '';

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];

    const firstDay = new Date(dpViewYear, dpViewMonth, 1);
    const startDow = firstDay.getDay(); // 0=Sun
    const daysInMonth = new Date(dpViewYear, dpViewMonth + 1, 0).getDate();

    let cells = '';
    // Empty cells before first day
    for (let i = 0; i < startDow; i++) {
        cells += '<div class="dp-cell dp-empty"></div>';
    }
    for (let d = 1; d <= daysInMonth; d++) {
        const ds = `${dpViewYear}-${String(dpViewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const isSelected = ds === selectedDate;
        const isToday = ds === todayStr;
        let cls = 'dp-cell dp-day';
        if (isSelected) {
            cls += ' dp-selected';
        }
        if (isToday) {
            cls += ' dp-today';
        }
        cells += `<div class="${cls}" data-dp-day="${ds}">${d}</div>`;
    }

    popup.innerHTML = `
        <div class="dp-header">
            <button class="icon-btn dp-nav" id="dp-prev" type="button">&lsaquo;</button>
            <span class="dp-month-label">${monthNames[dpViewMonth]} ${dpViewYear}</span>
            <button class="icon-btn dp-nav" id="dp-next" type="button">&rsaquo;</button>
        </div>
        <div class="dp-weekdays">
            <div>Su</div><div>Mo</div><div>Tu</div><div>We</div><div>Th</div><div>Fr</div><div>Sa</div>
        </div>
        <div class="dp-grid">${cells}</div>
    `;
}

function openDepGraph(): void {
    document.getElementById('dep-graph-backdrop')?.removeAttribute('hidden');
    renderDepGraph();
}

function closeDepGraph(): void {
    document.getElementById('dep-graph-backdrop')?.setAttribute('hidden', '');
}

function renderDepGraph(): void {
    const container = document.getElementById('dep-graph-svg-container');
    if (!container) {
        return;
    }

    const depthMap: Record<string, number> = {};
    function getTaskDepth(taskId: string, visited: Set<string> = new Set()): number {
        const task = state.tasks.find((t) => t.id === taskId || t.slug === taskId);
        if (!task) {
            return 0;
        }

        const canonicalId = task.id;
        if (visited.has(canonicalId)) {
            return 0;
        }
        if (canonicalId in depthMap) {
            return depthMap[canonicalId];
        }

        visited.add(canonicalId);

        if (!task.dependsOn || task.dependsOn.length === 0) {
            depthMap[canonicalId] = 0;
            return 0;
        }

        let maxDepDepth = -1;
        for (const depId of task.dependsOn) {
            const d = getTaskDepth(depId, new Set(visited));
            if (d > maxDepDepth) {
                maxDepDepth = d;
            }
        }
        const depth = maxDepDepth + 1;
        depthMap[canonicalId] = depth;
        return depth;
    }

    for (const task of state.tasks) {
        getTaskDepth(task.id);
    }

    const columns: Record<number, Task[]> = {};
    for (const task of state.tasks) {
        const depth = depthMap[task.id] ?? 0;
        if (!columns[depth]) {
            columns[depth] = [];
        }
        columns[depth].push(task);
    }

    const columnIds = Object.keys(columns)
        .map(Number)
        .sort((a, b) => a - b);

    if (columnIds.length === 0) {
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--vscode-descriptionForeground);">No tasks to display in the dependency graph.</div>';
        return;
    }

    const columnWidth = 260;
    const rowHeight = 100;
    const cardWidth = 200;
    const cardHeight = 70;
    const padding = 50;

    const maxTasks = Math.max(...Object.values(columns).map((col) => col.length));
    const totalHeight = Math.max(400, maxTasks * rowHeight + padding * 2);
    const totalWidth = columnIds.length * columnWidth + padding * 2;

    const positions: Record<string, { x: number; y: number }> = {};
    for (const depth of columnIds) {
        const colTasks = columns[depth];
        const N = colTasks.length;
        const startOffset = (totalHeight - N * rowHeight) / 2;
        const colIdx = columnIds.indexOf(depth);

        colTasks.forEach((task, i) => {
            const x = padding + colIdx * columnWidth;
            const y = startOffset + i * rowHeight + (rowHeight - cardHeight) / 2;
            positions[task.id] = { x, y };
        });
    }

    let svgContent = `
        <svg width="${totalWidth}" height="${totalHeight}" style="display: block; overflow: visible;">
            <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1.5 L 6 5 L 0 8.5 z" fill="var(--vscode-editorLink-activeForeground, #3b82f6)" />
                </marker>
            </defs>
    `;

    for (const task of state.tasks) {
        if (!task.dependsOn) {
            continue;
        }
        const posT = positions[task.id];
        if (!posT) {
            continue;
        }

        for (const depId of task.dependsOn) {
            const depTask = state.tasks.find((t) => t.slug === depId || t.id === depId);
            if (!depTask) {
                continue;
            }
            const posD = positions[depTask.id];
            if (!posD) {
                continue;
            }

            const x1 = posD.x + cardWidth;
            const y1 = posD.y + cardHeight / 2;
            const x2 = posT.x;
            const y2 = posT.y + cardHeight / 2;

            const controlOffset = Math.abs(x2 - x1) / 2;
            const path = `M ${x1} ${y1} C ${x1 + controlOffset} ${y1}, ${x2 - controlOffset} ${y2}, ${x2} ${y2}`;

            svgContent += `
                <path class="dep-graph-edge" d="${path}" stroke="var(--vscode-editorLink-activeForeground, #3b82f6)" stroke-width="2" fill="none" opacity="0.6" marker-end="url(#arrow)" />
            `;
        }
    }

    const { lanes } = state.config;
    const laneSet = new Set(lanes);

    for (const task of state.tasks) {
        const pos = positions[task.id];
        if (!pos) {
            continue;
        }

        const taskLane = laneSet.has(task.lane) ? task.lane : (lanes[lanes.length - 1] ?? task.lane);
        const escTitle = esc(task.title);
        const escLane = esc(displayLane(taskLane));
        const priorityBadge = task.priority && task.priority !== 'none'
            ? `<span class="dep-graph-priority-badge ${esc(task.priority)}">${esc(task.priority)}</span>`
            : '';

        svgContent += `
            <foreignObject x="${pos.x}" y="${pos.y}" width="${cardWidth}" height="${cardHeight}">
                <div class="dep-graph-card ${esc(taskLane)}" data-dep-task-id="${esc(task.id)}">
                    <div class="dep-graph-card-title" title="${escTitle}">${escTitle}</div>
                    <div class="dep-graph-card-meta">
                        <span class="dep-graph-lane-badge">${escLane}</span>
                        ${priorityBadge}
                    </div>
                </div>
            </foreignObject>
        `;
    }

    svgContent += `</svg>`;
    container.innerHTML = svgContent;

    const cards = container.querySelectorAll('.dep-graph-card');
    cards.forEach((card) => {
        card.addEventListener('click', (e) => {
            const taskId = (e.currentTarget as HTMLElement).dataset.depTaskId;
            if (taskId) {
                closeDepGraph();
                openModal(taskId);
            }
        });
    });
}

function buildDepGraphModalHtml(): string {
    return `
        <div class="modal-backdrop" id="dep-graph-backdrop" hidden>
            <div class="modal dep-graph-modal" id="dep-graph-modal" role="dialog" aria-modal="true">
                <div class="modal-header">
                    <h3 class="modal-title">Dependency Graph</h3>
                    <button class="icon-btn" id="dep-graph-close" title="Close">&times;</button>
                </div>
                <div class="modal-body dep-graph-body" style="overflow: auto; max-height: 70vh;">
                    <div id="dep-graph-svg-container" style="position: relative; width: 100%; min-height: 400px;">
                        <!-- SVG graph will be rendered here dynamically -->
                    </div>
                </div>
            </div>
        </div>
    `;
}

// ── Settings Modal ───────────────────────────────────────────────────────────

function buildSettingsModalHtml(): string {
    const config = state.config;
    const reviewPolicyLevels = ['low', 'medium', 'high', 'critical'];

    const enforcementMatrix = reviewPolicyLevels
        .map(level => {
            const row = config.reviewPolicy?.[level as keyof typeof config.reviewPolicy];
            return {
                level,
                planning: row?.planning || 'self-agent',
                implementation: row?.implementation || 'self-agent',
            };
        })
        .map(row => {
            return `
                <tr>
                    <td class="policy-level-cell">${row.level.toUpperCase()}</td>
                    <td>
                        <select class="form-control settings-review-planning" data-level="${row.level}" data-field="planning">
                            <option value="self-agent" ${row.planning === 'self-agent' ? 'selected' : ''}>Self-Agent</option>
                            <option value="independent-agent" ${row.planning === 'independent-agent' ? 'selected' : ''}>Independent-Agent</option>
                            <option value="independent-agent+human" ${row.planning === 'independent-agent+human' ? 'selected' : ''}>Independent-Agent+Human</option>
                        </select>
                    </td>
                    <td>
                        <select class="form-control settings-review-implementation" data-level="${row.level}" data-field="implementation">
                            <option value="self-agent" ${row.implementation === 'self-agent' ? 'selected' : ''}>Self-Agent</option>
                            <option value="independent-agent" ${row.implementation === 'independent-agent' ? 'selected' : ''}>Independent-Agent</option>
                            <option value="independent-agent+human" ${row.implementation === 'independent-agent+human' ? 'selected' : ''}>Independent-Agent+Human</option>
                        </select>
                    </td>
                </tr>
            `;
        })
        .join('');

    const transition = config.policies?.transition || {};
    const verification = config.policies?.verification || {};

    const localPackNames = new Set((config.packs || []).map(p => p.name));
    const globalOnlyTemplates = stackTemplates.filter(t => !localPackNames.has(t.name));
    const packOptions = [
        ...(config.packs || []).map(pack => {
            const stackName = typeof pack.stack === 'string' ? pack.stack : pack.name;
            return `<option value="${esc(pack.name)}" ${config.activeStack === pack.name ? 'selected' : ''}>${esc(stackName)}</option>`;
        }),
        ...globalOnlyTemplates.map(t => {
            const stackName = typeof t.stack === 'string' ? t.stack : t.name;
            return `<option value="${esc(t.name)}" ${config.activeStack === t.name ? 'selected' : ''}>[Global] ${esc(stackName)}</option>`;
        }),
        `<option value="__create_new__">+ Create New Template...</option>`,
    ].join('');

    const packCards = (config.packs || []).map(pack => {
        const stackName = typeof pack.stack === 'string' ? pack.stack : pack.name;
        const skillsList = (pack.skills || []).map(s => `<span class="skill-badge">${s}</span>`).join('');
        const coverageList = (pack.coverage || []).map(c => `<span class="coverage-badge">${c}</span>`).join('');
        const verifyList = (pack.verifyCmds || []).map(c => `<span class="verify-cmd-badge">${c}</span>`).join('');
        return `
            <div class="skill-card">
                <div class="skill-card-title">${stackName}</div>
                <div class="skill-card-body">
                    <div class="skill-list">${skillsList}</div>
                    <div class="skill-coverage">${coverageList}</div>
                    <div class="skill-verify">${verifyList}</div>
                </div>
            </div>
        `;
    }).join('');

    return `
        <div class="modal-backdrop" id="settings-backdrop" hidden>
            <div class="modal settings-modal" id="settings-modal" role="dialog" aria-modal="true">
                <div class="modal-header">
                    <h3 class="modal-title">Settings</h3>
                    <button class="icon-btn" id="settings-close" title="Close">&times;</button>
                </div>
                <div class="modal-body settings-body">
                    <div class="settings-tabs">
                        <button class="settings-tab active" data-tab="board-config">Board Config</button>
                        <button class="settings-tab" data-tab="skill-packs">Skill Packs</button>
                    </div>

                    <div class="settings-panel active" id="settings-board-config">
                        <div class="section">
                            <h4 class="section-label">Enforcement</h4>
                            <div class="form-row">
                                <label class="form-label">Mode</label>
                                <select class="form-control" id="settings-enforcement-mode">
                                    <option value="warn" ${config.enforcement?.mode === 'warn' ? 'selected' : ''}>Warn</option>
                                    <option value="strict" ${config.enforcement?.mode === 'strict' ? 'selected' : ''}>Strict</option>
                                </select>
                            </div>
                            <div class="form-row">
                                <label class="form-label">Overrides</label>
                                <div class="settings-nested">
                                    <div class="form-row">
                                        <label class="form-label">Allowed</label>
                                        <select class="form-control" id="settings-allowed">
                                            <option value="true" ${config.enforcement?.overrides?.allowed !== false ? 'selected' : ''}>Yes</option>
                                            <option value="false" ${config.enforcement?.overrides?.allowed === false ? 'selected' : ''}>No</option>
                                        </select>
                                    </div>
                                    <div class="form-row">
                                        <label class="form-label">Actors</label>
                                        <select class="form-control" id="settings-actors">
                                            <option value="agent" ${config.enforcement?.overrides?.actors?.includes('agent') ? 'selected' : ''}>Agent</option>
                                            <option value="human" ${config.enforcement?.overrides?.actors?.includes('human') ? 'selected' : ''}>Human</option>
                                            <option value="human,agent" ${config.enforcement?.overrides?.actors?.join(',') === 'human,agent' ? 'selected' : ''}>Human, Agent</option>
                                        </select>
                                    </div>
                                    <div class="form-row">
                                        <label class="form-label">Require Reason</label>
                                        <select class="form-control" id="settings-require-reason">
                                            <option value="true" ${config.enforcement?.overrides?.requireReason !== false ? 'selected' : ''}>Yes</option>
                                            <option value="false" ${config.enforcement?.overrides?.requireReason === false ? 'selected' : ''}>No</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="section">
                            <h4 class="section-label">Worktree Policy</h4>
                            <div class="form-row">
                                <label class="form-label">Require Worktree for Implementation</label>
                                <select class="form-control" id="settings-worktree-required">
                                    <option value="true" ${config.worktreePolicy?.requiredForImplementation === true ? 'selected' : ''}>Yes</option>
                                    <option value="false" ${config.worktreePolicy?.requiredForImplementation === false ? 'selected' : ''}>No</option>
                                </select>
                            </div>
                        </div>

                        <div class="section">
                            <h4 class="section-label">WIP Limits</h4>
                            <div class="form-row">
                                <label class="form-label">Max tasks in in-progress</label>
                                <input class="form-control" type="number" id="settings-wip-limit" min="0" value="${config.wipLimits?.['in-progress'] ?? 1}">
                            </div>
                        </div>

                        <div class="section">
                            <h4 class="section-label">Transition Policies</h4>
                            <div class="settings-transition-grid">
                                <div class="transition-row">
                                    <span class="transition-label">Checklist Required for In-Progress</span>
                                    <select class="form-control" id="settings-transition-checklist">
                                        <option value="1" ${transition.requireChecklistForInProgress !== false ? 'selected' : ''}>Yes</option>
                                        <option value="0" ${transition.requireChecklistForInProgress === false ? 'selected' : ''}>No</option>
                                    </select>
                                </div>
                                <div class="transition-row">
                                    <span class="transition-label">Spec Required for In-Progress</span>
                                    <select class="form-control" id="settings-transition-spec">
                                        <option value="1" ${transition.requireSpecForInProgress !== false ? 'selected' : ''}>Yes</option>
                                        <option value="0" ${transition.requireSpecForInProgress === false ? 'selected' : ''}>No</option>
                                    </select>
                                </div>
                                <div class="transition-row">
                                    <span class="transition-label">Description Required for Review</span>
                                    <select class="form-control" id="settings-transition-description">
                                        <option value="1" ${transition.requireDescriptionForReview !== false ? 'selected' : ''}>Yes</option>
                                        <option value="0" ${transition.requireDescriptionForReview === false ? 'selected' : ''}>No</option>
                                    </select>
                                </div>
                                <div class="transition-row">
                                    <span class="transition-label">Worktree Required for In-Progress</span>
                                    <select class="form-control" id="settings-transition-worktree">
                                        <option value="1" ${transition.requireWorktreeForInProgress === true ? 'selected' : ''}>Yes</option>
                                        <option value="0" ${transition.requireWorktreeForInProgress !== true ? 'selected' : ''}>No</option>
                                    </select>
                                </div>
                                <div class="transition-row">
                                    <span class="transition-label">Done Checklist Required for Done</span>
                                    <select class="form-control" id="settings-transition-done-checklist">
                                        <option value="1" ${transition.requireDoneChecklistForDone !== false ? 'selected' : ''}>Yes</option>
                                        <option value="0" ${transition.requireDoneChecklistForDone === false ? 'selected' : ''}>No</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div class="section">
                            <h4 class="section-label">Review Policy Matrix</h4>
                            <div class="settings-table-container">
                                <table class="settings-table">
                                    <thead>
                                        <tr>
                                            <th>Level</th>
                                            <th>Planning</th>
                                            <th>Implementation</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${enforcementMatrix}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div class="section">
                            <h4 class="section-label">Verification Commands</h4>
                            <div class="form-row">
                                <label class="form-label" for="settings-verification-test">Test</label>
                                <input class="form-control" type="text" id="settings-verification-test" placeholder="npm test" value="${esc((verification as any).testCommand || '')}">
                            </div>
                            <div class="form-row">
                                <label class="form-label" for="settings-verification-lint">Lint</label>
                                <input class="form-control" type="text" id="settings-verification-lint" placeholder="npx tsc --noEmit" value="${esc((verification as any).lintCommand || '')}">
                            </div>
                            <div class="form-row">
                                <label class="form-label" for="settings-verification-build">Build</label>
                                <input class="form-control" type="text" id="settings-verification-build" placeholder="npm run build" value="${esc((verification as any).buildCommand || '')}">
                            </div>
                        </div>
                    </div>

                    <div class="settings-panel" id="settings-skill-packs" hidden>
                        <div class="section">
                            <h4 class="section-label">Active Stack</h4>
                            <div class="form-row">
                                <select class="form-control" id="settings-active-stack">
                                    ${packOptions}
                                </select>
                            </div>
                            <div class="template-create-form" id="template-create-form" hidden>
                                <div class="template-create-title">New Global Template</div>
                                <div class="form-row">
                                    <label class="form-label" for="template-name">Name</label>
                                    <input class="form-control" type="text" id="template-name" placeholder="e.g. my-stack">
                                </div>
                                <div class="form-row">
                                    <label class="form-label" for="template-stack">Stack Label</label>
                                    <input class="form-control" type="text" id="template-stack" placeholder="e.g. My Stack">
                                </div>
                                <div class="form-row">
                                    <label class="form-label" for="template-skills">Skills (one per line)</label>
                                    <textarea class="form-control" id="template-skills" rows="3" placeholder="skill-name&#10;another-skill"></textarea>
                                </div>
                                <div class="form-row">
                                    <label class="form-label" for="template-coverage">Coverage Lines (one per line)</label>
                                    <textarea class="form-control" id="template-coverage" rows="2" placeholder="src/&#10;tests/"></textarea>
                                </div>
                                <div class="form-row">
                                    <label class="form-label" for="template-verify">Verify Commands (one per line)</label>
                                    <textarea class="form-control" id="template-verify" rows="2" placeholder="npm test&#10;npm run lint"></textarea>
                                </div>
                                <div class="template-create-actions">
                                    <button class="btn-primary btn-sm" id="template-create-save">Save</button>
                                    <button class="btn-secondary btn-sm" id="template-create-cancel">Cancel</button>
                                </div>
                            </div>
                        </div>

                        <div class="section">
                            <h4 class="section-label">Project Skills</h4>
                            <div class="form-row">
                                <label class="form-label">Installed Skills</label>
                                <div class="settings-helper-text">Checked skills are active for this project and loaded into the managed agent context.</div>
                                <div class="settings-skills-summary" id="settings-skills-summary">
                                    <button type="button" class="settings-summary-chip active" data-settings-skill-filter="all">Installed 0</button>
                                    <button type="button" class="settings-summary-chip" data-settings-skill-filter="active">Active 0</button>
                                    <button type="button" class="settings-summary-chip" data-settings-skill-filter="inactive">Inactive 0</button>
                                </div>
                                <div class="settings-skills-warning" id="settings-skills-warning" hidden></div>
                                <input type="text" class="form-control" id="settings-skill-filter" placeholder="Filter skills..." />
                                <div class="settings-skills-list" id="settings-skills-list">
                                    ${(config.skills || []).length > 0
                                        ? `<div class="settings-skills-loading">Loading discovered skills...</div>`
                                        : `<div class="settings-skills-empty">No skills configured. Discovering...</div>`
                                    }
                                </div>
                            </div>
                        </div>

                        <div class="section">
                            <h4 class="section-label">Stack Packs</h4>
                            <div class="settings-packs-list">
                                ${packCards}
                            </div>
                        </div>

                        <div class="section">
                            <h4 class="section-label">How to add more</h4>
                            <div class="settings-help-note">
                                <p><strong>Project Skills</strong> come from skill folders discovered on this machine, including <code>~/.agents/skills/</code>, <code>~/.codex/skills/</code>, <code>workspace/skills/</code>, and <code>workspace/.claude/skills/</code>.</p>
                                <p><strong>Stack Packs</strong> come from this workspace's <code>.agentkanban/packs.yaml</code>, the active settings in <code>.agentkanban/board.yaml</code>, and any global templates saved from this modal.</p>
                                <p>After adding a skill folder or pack, reopen Settings to refresh the installed list.</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <div class="modal-actions">
                        <button class="btn-primary" id="settings-save">Save</button>
                        <button class="btn-secondary" id="settings-cancel">Cancel</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}
