---
title: Quick Start
description: Walk through the standard developer-agent lifecycle end-to-end.
---

Get up and running with the **Standard** spec-driven development loop in a few minutes.

---

## 1. Initialise the Workspace

1. Open your project workspace folder in VS Code.
2. Click the **Agentic Kanban** icon in the Activity Bar to reveal the board.
3. If this is a new workspace, click **Initialise** and select the **Standard** profile.

This creates the `.agentkanban/` workspace folder where all board state, prompts, and memory are stored.

---

## 2. Create and Select a Task

In the VS Code Chat panel, send a command to `@kanban` to create your task:

```text
@kanban /new Add OAuth2 login
```

Once created, make it the active task in the context:

```text
@kanban /task Add OAuth2 login
```

This opens the task file (`.agentkanban/tasks/task_<date>_<id>_add-oauth2-login.md`) and updates the `AGENTS.md` file at the root of your workspace to reference it.

---

## 3. Scaffold Specifications

To attach spec-driven artifacts to the selected task, run:

```text
@kanban /spec auth
```

On the **Standard** profile, this scaffolds the following change directory structure:
```text
.agentkanban/
  specs/
    auth/spec.md
  changes/
    add-oauth2-login/
      proposal.md
      design.md
      tasks.md
```

- `proposal.md` - Explains the *why* and scope of the change.
- `design.md` - Outlines the implementation approach.
- `tasks.md` - The authoritative checklist of tasks the coding agent will work against.
- `specs/auth/spec.md` - The shared capability specification detailing scenarios and acceptance criteria.

---

## 4. Plan and Approve (`planning`)

1. Move the task card from `backlog` to `planning` on the board UI.
2. Open and refine `proposal.md` and `design.md`.
3. Add checklist items under `tasks.md`.
4. Once the plan is complete, get it approved by moving it from `planning` to `in-progress`. (This constitutes the plan-approval human gate).

---

## 5. Implement in a Git Worktree (`in-progress`)

With the task in `in-progress`, create an isolated worktree branch to execute the work:

```text
@kanban /worktree
```

The extension creates a clean worktree folder outside your main repository and opens it in a new window.
1. Implement your code against the approved specs.
2. Mark items as completed (`- [x]`) in `tasks.md`.
3. Verify changes locally.

---

## 6. Review and Complete (`review -> done`)

1. Move the task to `review`. If verification commands (`lintCommand`, `testCommand`, `buildCommand`) are defined in your `board.yaml`, the extension will automatically run them and ensure they pass.
2. Review the code. If changes are requested, move it back to `in-progress`.
3. If everything is verified, merge the worktree branch through your normal git flow.
4. Move the task to `done` on the board.
5. Archive the change folder to keep the repository clean:
   ```text
   @kanban /archive add-oauth2-login
   ```
