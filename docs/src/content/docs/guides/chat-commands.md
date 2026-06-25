---
title: Chat Commands
description: Reference guide for all @kanban subcommands in the VS Code Chat panel.
---

You can control the Kanban board and drive agent behaviors using commands to `@kanban` inside the VS Code Chat panel.

---

## Command Reference

### `/new`
Creates a new task card on the board.
- **Usage:** `@kanban /new <title>`
- **Example:** `@kanban /new Add oauth2 endpoints`
- **Behavior:** Creates a task file in `.agentkanban/tasks/` in the first lane of the active profile (e.g. `backlog`).

### `/task`
Selects and opens an active task in your editor, setting it as the context.
- **Usage:** `@kanban /task <query>`
- **Example:** `@kanban /task oauth2`
- **Behavior:** Resolves the task by fuzzy title matching, opens the task Markdown file, and updates the active task reference in `AGENTS.md`.

### `/refresh`
Re-injects instructions and active task context.
- **Usage:** `@kanban /refresh [context]`
- **Behavior:** Syncs the current task details, active project skills, and workflow instructions. Used if the chat window context has drifted during long conversations.

### `/spec`
Scaffolds spec-driven development (SDD) files.
- **Usage:** `@kanban /spec [capability]`
- **Example:** `@kanban /spec authentication`
- **Behavior:** Links the active task to a change directory `.agentkanban/changes/<slug>/` and creates a proposal, design document, tasks checklist, and capability contract.

### `/worktree`
Manages Git worktrees for isolated task execution.
- **Usage:**
  - `@kanban /worktree` - Creates a clean worktree and checkout branch for the active task.
  - `@kanban /worktree open` - Opens the active task's existing worktree in a new VS Code window.
  - `@kanban /worktree remove` - Cleans up and deletes the worktree folder and git branch.

### `/archive`
Archives a completed change directory.
- **Usage:** `@kanban /archive [slug]`
- **Behavior:** Moves the task's change folder from `.agentkanban/changes/` to `.agentkanban/changes/archive/` (runs after the task reaches `done`).

### `/prompts`
Forces a re-scaffolding of agent prompts.
- **Usage:** `@kanban /prompts`
- **Behavior:** Overwrites all prompts under `.agentkanban/prompts/` with the latest template versions.

### `/goal`
Manages high-level objectives that group related tasks.
- **Usage:**
  - `@kanban /goal new <objective>` - Creates a new goal and links it to the board.
  - `@kanban /goal` - Lists all active goals with their progress summary.
  - `@kanban /goal show <slug>` - Shows the detail view for a specific goal by slug.

### `/loop`
Emits the stage-driver prompt for a lane into chat. Click the **"Send prompt to chat"** button in the response to inject it directly into the chat input — no copy-paste needed.
- **Usage:** `@kanban /loop [lane] [options]`
- **Options:**
  - `--label=<name>` - Scope the ready-task list to tasks with the specified label.
  - `--priority=<level>` - Scope the ready-task list to tasks of a specific priority.
- **Example:** `@kanban /loop planning --priority=high`
- **Behavior:** Resolves the stage-driver prompt for the chosen lane (workspace copy in `.agentkanban/prompts/` first, bundled fallback), interpolates it with board config vars, shows the list of ready tasks in that lane (non-blocked, dependency-satisfied), and renders a **"Send prompt to chat"** button. Clicking the button opens the chat input pre-filled with the prompt — press Enter to run. Clipboard copy is also provided as a fallback. No lanes are moved by this command.
- **Default lane:** `backlog` (first lane of the active profile) when no lane arg is given.
- **Lane-to-prompt mapping (Standard):** `backlog` -> `stage-backlog-to-planning`, `planning`/`in-progress` -> `stage-planning-to-review`, `review` -> `stage-review-to-done`, `done` -> no driver.
- **Lane-to-prompt mapping (Lite):** `backlog`/`in-progress` -> `work-on-task`, `done` -> no driver.
- **Gate enforcement:** gates are still enforced when the agent performs the actual board move (UI/`moveTask` -> `TransitionService`). `/loop` does not gate-check or block tasks itself.

### `/work`
Resolves a task and copies the work prompt to clipboard.
- **Usage:** `@kanban /work [task]`
- **Example:** `@kanban /work oauth2`
- **Behavior:** Fuzzy-matches the task, interpolates the work-on-task stage prompt with the task's context, and copies the result to clipboard. Paste into any agent session to start working immediately.

### `/evidence`
Views or records evidence for a task (required before `review → done`).
- **Usage:**
  - `@kanban /evidence [task]` — show current evidence status
  - `@kanban /evidence <task> <check> <pass|fail> ["<notes>"]` — record a result
- **Example:** `@kanban /evidence oauth2 lint pass`
- **Behavior:** Tracks `lint`, `test`, `build`, and `behavior` evidence entries on the task. The production-readiness gate requires all checks to pass before moving to `done`.

### `/pack`
Manages stack packs (drop-in language/framework context blocks).
- **Usage:**
  - `@kanban /pack list` — list available packs
  - `@kanban /pack use <name>` — activate a pack and regenerate prompts
- **Example:** `@kanban /pack use typescript-web`

### `/doctor`
Runs a diagnostic sweep on the board state.
- **Usage:** `@kanban /doctor`
- **Behavior:** Scans your workspace and reports any workflow issues, such as lane drift, dependency cycles, stale blocker labels, broken worktrees, or orphaned spec files.
