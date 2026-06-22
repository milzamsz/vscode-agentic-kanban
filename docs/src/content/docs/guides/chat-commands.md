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

### `/sweep`
Runs verification checks and processes tasks in a lane.
- **Usage:** `@kanban /sweep [lane] [options]`
- **Options:**
  - `--label=<name>` - Sweep only tasks carrying the specified label.
  - `--priority=<level>` - Sweep only tasks of a specific priority level.
  - `--pack=<name>` or `--stack=<name>` - Sweep tasks matching a specific technology pack.
- **Example:** `@kanban /sweep in-progress --priority=high`
- **Behavior:** Scans the target lane, validates dependencies, runs test/lint/build commands, and advances passing tasks while marking failing ones as blocked.

### `/doctor`
Runs a diagnostic sweep on the board state.
- **Usage:** `@kanban /doctor`
- **Behavior:** Scans your workspace and reports any workflow issues, such as lane drift, dependency cycles, stale blocker labels, broken worktrees, or orphaned spec files.
