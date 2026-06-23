---
title: Lanes & Tasks
description: Learn about the kanban board lanes, task markdown structures, checklists, and blockers.
---

Task files and checklists are stored as plain Markdown text files in `.agentkanban/tasks/`. The board UI reads these files to render the columns and cards.

---

## 1. Task File Format

Every task file contains a YAML frontmatter section and a conversation body:

```markdown
---
title: Implement OAuth2 login
lane: planning
created: 2026-06-23T04:00:00.000Z
updated: 2026-06-23T04:30:00.000Z
description: Add OAuth2 login flow to the client application
priority: high
assignee: Developer
labels:
  - security
  - auth
dependsOn:
  - setup-database-schema
---

## Conversation

### user

Plan the OAuth2 implementation.

### agent

I confirm that I have read `README.md`.
I will start by reviewing the client-side configuration parameters...
```

### Conversation Markers
- **`### user`** - Marks the beginning of a user turn, containing instructions or feedback.
- **`### agent`** - Marks the beginning of an agent turn, containing explanation of work, plans, or completed steps.
- **`[comment: <text>]`** - Inline user annotations placed on agent text. The agent checks for these comments on every turn.

---

## 2. Checklist Files (`todo_*.md`)

For tasks that are not spec-driven, a checklist file is created as a sibling to the task file:
- **Filename:** `todo_<date>_<id>_<slug>.md`
- **Format:**
  ```markdown
  ---
  task: task_20260623_docs_starlight_documentation_site
  ---

  # Iteration 1

  - [ ] Uncompleted item
  - [x] Completed item
  ```

During planning and implementation, you and the agent use the checklist to break down execution steps and check off progress.
*(Note: Spec-driven tasks ignore the `todo_*.md` file and use the change-level `tasks.md` as their checklist).*

---

## 3. Blockers and Dependencies

Blockers do not move a task out of its active lane. Instead, they are represented using labels and frontmatter:

- **`dependsOn` (Frontmatter Array):** Authoritative list of task slugs or IDs this task depends on.
- **`blocked-by:<slug>` (Label):** Syntactic mirror of `dependsOn` that triggers visual blocker styles on the board.
- **`blocked` (Label):** Used for external blockers that are not represented by a task card (e.g. waiting for API keys, user decision, etc.).

### Synchronization
The board webview and task store synchronize the `dependsOn` frontmatter array and `blocked-by:<slug>` labels bidirectionally. Adding a dependency in the modal adds the label; removing the label removes the dependency.

### Guardrails
The agent skill includes a dependency ready-gate: a task is not ready to sweep/implement until all tasks in its `dependsOn` list are in the `done` lane.
