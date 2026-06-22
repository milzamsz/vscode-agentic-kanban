---
title: VS Code Commands
description: Reference guide for Command Palette commands provided by Agentic Kanban.
---

You can run the following commands from the VS Code **Command Palette** (`Ctrl+Shift+P` or `Cmd+Shift+P`):

---

## Command Reference

### `Agentic Kanban: Open Board`
- **Identifier:** `agentic-kanban.openBoard`
- **Behavior:** Focuses and opens the Agentic Kanban board webview in the active editor group.

### `Agentic Kanban: New Task`
- **Identifier:** `agentic-kanban.newTask`
- **Behavior:** Prompts you to enter a task title in the input box, creates a new task file in the backlog, and opens it.

### `Agentic Kanban: Reset Memory`
- **Identifier:** `agentic-kanban.resetMemory`
- **Behavior:** Clears the contents of `.agentkanban/memory.md` to reset the persistent context shared between agent turns.

### `Agentic Kanban: Initialise Workspace`
- **Identifier:** `agentic-kanban.initialise`
- **Behavior:** Scaffolds the `.agentkanban/` folder structure, prompts for profile selection (Lite or Standard), and writes config and instructions.

### `Agentic Kanban: Apply Settings to Board Config`
- **Identifier:** `agentic-kanban.applySettingsToBoardConfig`
- **Behavior:** Overwrites `board.yaml` parameters (`enforcement`, `worktreePolicy`, etc.) using current VS Code settings. Prompts with a warning if the transition profile leaves tasks in invalid lanes.
