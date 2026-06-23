---
title: Git Worktrees
description: Isolate task implementation and context using Git worktrees.
---

In the **Standard** workflow profile, implementing code directly in your main workspace can contaminate your working branch, especially when driving parallel agent tasks. Agentic Kanban resolves this by using **Git Worktrees**.

---

## 1. How It Works

A Git worktree allows you to check out multiple branches of the same repository in separate directory paths simultaneously.

When you run `@kanban /worktree` for a task:
1. The extension commits any pending task metadata changes on your current branch.
2. It creates a task-specific branch (named `agentkanban/<task-slug>`).
3. It checks out the new branch in a dedicated worktree directory (usually sibling to your repository under `../{repo}-worktrees/`).
4. It writes task-aware context directly into the worktree's `AGENTS.md`.
5. It opens the worktree folder in a new VS Code window.

This isolates all code modifications, dependency installs, and agent conversations to a separate directory, keeping your main workspace clean.

---

## 2. Worktree Commands

### Create a Worktree
Select a task, then run:
```text
@kanban /worktree
```
This checks out a new branch and directory path, and launches a new editor window.

### Reopen an Existing Worktree
If you closed the worktree window and want to return to it, run:
```text
@kanban /worktree open
```

### Remove a Worktree
When work is completed, merged, and the task has reached `done`, clean up the workspace by running:
```text
@kanban /worktree remove
```
This safely deletes the worktree folder and prunes the git branch.

---

## 3. Configuration

You can customize worktree behavior in your VS Code settings:
- **`agentKanban.worktreeRoot`:** The path where worktrees are created (defaults to `../{repo}-worktrees`).
- **`agentKanban.worktreeOpenBehavior`:** Control whether the worktree opens in the `current` window or a `new` window.
- **`agentKanban.enforceWorktrees`:** Require a task worktree to exist before running `/refresh`.
