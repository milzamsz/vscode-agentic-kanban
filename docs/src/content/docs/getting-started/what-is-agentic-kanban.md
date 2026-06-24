---
title: What is Agentic Kanban?
description: An introduction to the core concepts and design of Agentic Kanban.
---

**Agentic Kanban** is a VS Code extension that gives you and a coding agent a shared Kanban board. Tasks live as Markdown files your team can read, edit, and review in Git — no opaque database, no context drift between sessions.

Pick a profile that fits your work style:
- **Lite** — `backlog → in-progress → done`. Fast path for bug fixes and small changes.
- **Standard** — `backlog → planning → in-progress → review → done`. Full spec-driven delivery with plan approval and implementation review.

---

## What you actually get

**A visual board** — cards you can drag between lanes, with priority, labels, and dependency indicators visible at a glance.

**`@kanban` chat commands** — create tasks, attach specs, create worktrees, run diagnostics, and drive lane sweeps from the VS Code Chat panel.

**Spec artifacts per task** — `/spec auth` scaffolds `proposal.md`, `design.md`, `tasks.md`, and a shared capability spec under `.agentkanban/changes/`. The agent works from these files, not from stale chat memory.

**Loop-until-dry automation** — `/loop` repeatedly advances ready tasks through lanes until the lane is dry. Dependency-aware: task B stays parked until task A reaches `done`.

**Persistent context** — a managed section in `AGENTS.md` and `.agentkanban/INSTRUCTION.md` keep the workflow rules and active task visible to any agent on every turn.

---

## Core Principles

### 1. Markdown as Source of Truth

Every card on the board is a Markdown file under `.agentkanban/tasks/`. Example:

```markdown
---
title: Add OAuth2 login
lane: planning
priority: high
labels:
  - backend
dependsOn:
  - establish-auth-storage
change: .agentkanban/changes/add-oauth2-login
---

## Conversation

### user
Plan the OAuth2 implementation.

### agent
Starting with auth boundary mapping...
```

The board reads these files to render columns. Any card move on the board modifies the `lane:` in frontmatter. This makes your workflow fully auditable and Git-trackable.

### 2. Fixed Lane Delivery

A task always sits in a known lane. Lanes are fixed per profile — agents cannot invent new lane names or skip steps:

- **Lite:** `backlog → in-progress → done`
- **Standard:** `backlog → planning → in-progress → review → done`

This keeps the workflow coherent across long agent sessions where chat context has long since rolled off.

### 3. Two Human Gates, No More

The extension enforces exactly two human checkpoints in Standard profile:

- **Plan Approval:** moving a task from `planning` to `in-progress` is your sign-off that the plan is ready.
- **Completion Gate:** moving from `review` to `done` is your sign-off that the implementation is accepted.

Everything in between (implementing, verifying, checking off `tasks.md`) the agent handles autonomously. `/loop` is specifically designed to refuse crossing either gate — it will park tasks that would need a human decision rather than skipping ahead.

### 4. Dependency-Aware Lane Loop

Tasks declare dependencies in frontmatter:

```yaml
dependsOn:
  - establish-auth-storage
labels:
  - blocked-by:establish-auth-storage
```

When you run `@kanban /loop`, it checks each task's `dependsOn` list. A task is only ready when every dependency is in `done`. Independent tasks can be processed in parallel; dependent chains stay strictly ordered. The loop runs multiple passes until nothing more can advance.
