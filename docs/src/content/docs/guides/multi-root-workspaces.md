---
title: Multi-Root Workspaces
description: Learn how Agentic Kanban manages multiple project contexts, uninitialised folders, and profile isolation in VS Code multi-root workspaces.
---

Agentic Kanban supports VS Code multi-root workspaces, enabling you to work on multiple projects simultaneously. Instead of forcing a single shared board or workflow, the extension isolates all task files, configurations, and logs per workspace folder.

---

## Workspace Isolation

When you open a VS Code workspace containing multiple folders:

- **Independent State:** Each workspace folder maintains its own `.agentkanban/` directory, task list, and `board.yaml`.
- **Profile Isolation:** One project can run the **Standard** profile (with planning and review gates) while a neighboring project runs the **Lite** profile.
- **Uninitialised Safety:** The extension does not create `.agentkanban/` folders or log files in uninitialised folders automatically. They remain untouched until you explicitly initialise them.

---

## Using the Project Selector

When multiple folders are open, the Kanban board UI displays a **Project Selector** dropdown in the toolbar:

- Use the selector to switch between active projects.
- The webview dynamically reloads the lanes, tasks, and configurations of the active project.
- Uninitialised folders are visible in the dropdown with a `Not initialised` badge. Selecting an uninitialised folder displays the **Initialise** button to scaffold it.

---

## Command Routing

All VS Code Chat (`@kanban`) and palette commands automatically route to the **active project** selected in the board:

- **Task Creation:** `@kanban /new <title>` creates a task file under the active project's `.agentkanban/tasks/` folder.
- **Context Injection:** `@kanban /task <name>` opens the task file and updates `AGENTS.md` for the active project.
- **Worktrees:** Git worktrees are created and resolved relative to the active project folder.

---

## File Watchers & Lifecycle

The extension handles workspace folder changes dynamically:
- Scoped file watchers are created for each project's `tasks/`, `specs/`, `changes/`, and `board.yaml` files.
- If you add or remove folders from the VS Code workspace, the extension automatically spins up or disposes of the corresponding watchers and contexts cleanly.
