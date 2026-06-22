---
title: What is Agentic Kanban?
description: An introduction to the core concepts and design of Agentic Kanban.
---

**Agentic Kanban** is a VS Code extension built for agentic, spec-driven development (SDD). It pairs a visual board for humans with the `@kanban` chat participant, Git worktrees, and a reusable agent skill so that developers and coding agents share a single, unified workflow.

Rather than hiding task states in an opaque database, all board states, checklists, blockers, and agent-developer conversations are stored as durable, version-control-friendly Markdown files.

---

## Core Principles

### 1. Markdown as Source of Truth
Every card on the board corresponds to a Markdown file under `.agentkanban/tasks/`. The board UI reads these files to render columns, and any changes made on the board modify the frontmatter of these files. This ensures your workflow is completely auditable and integrates naturally with Git.

### 2. Fixed Lane Delivery
A task always sits in a known lane, depending on the active **Workflow Profile**:
- **Lite Profile:** `backlog -> in-progress -> done`
- **Standard Profile:** `backlog -> planning -> in-progress -> review -> done`

Explicit lane transitions keep the workflow structured and predictable, which is essential during long agent sessions.

### 3. Human-in-the-Loop SDD
The extension enforces strict or warning-based policies at critical gates:
- **Plan Approval:** When moving a task from `planning` to `in-progress` (Standard profile).
- **Completion Gate:** When moving from `review` to `done`.

By defining capability specifications under `.agentkanban/specs/` and task checklists, the agent can implement approved plans autonomously while keeping developers in control at key checkpoints.

### 4. Dependency-Aware Lane Sweeps
Tasks can declare dependencies on other tasks (using `dependsOn`). The Agentic Kanban skill respects these relations during lane sweeps - allowing independent tasks to be processed in parallel while keeping dependent chains strictly ordered.
