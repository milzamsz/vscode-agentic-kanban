---
title: Context Injection
description: How Agentic Kanban manages context, instructions, and task state to prevent LLM drift.
---

Coding agents require constant access to task requirements, board policies, and active project rules. Agentic Kanban uses **Context Injection** to ensure instructions are fed directly to your agent on every turn.

---

## 1. The `AGENTS.md` Managed Section

A file named `AGENTS.md` resides at the root of your workspace. It features a managed sentinel section that the extension reads and updates automatically:

```markdown
<!-- BEGIN AGENTIC KANBAN — DO NOT EDIT THIS SECTION -->
## Agentic Kanban

**Active Task:** Implement OAuth2 login
**Task File:** `.agentkanban/tasks/task_20260623_implement_oauth2_login.md`
**Checklist File:** `.agentkanban/tasks/todo_20260623_implement_oauth2_login.md`

Enforcement mode: `strict`
Priority high: planning review by independent-agent, implementation review by human
<!-- END AGENTIC KANBAN -->
```

### Rules
- **Do not edit this section manually.** The extension regenerates it on every state change or turn refresh.
- Place any custom developer guidelines, workspace notes, or project-specific rules *outside* of these sentinel comments. They will survive re-renders intact.

---

## 2. Dynamic Instruction Sync

Inside `.agentkanban/INSTRUCTION.md` (copied from `assets/INSTRUCTION.md`), the extension stores the canonical rules of your board.
VS Code automatically references this file during chat participant interactions.
When a worktree is created, task-specific details and spec requirements are compiled directly into the worktree's `AGENTS.md` file, making it immediately available to the agent checked out in that workspace.

---

## 3. Correcting Drift (`/refresh`)

Over long conversation histories, LLM context windows can drift, leading the agent to lose track of the active task or checklist state.

If your agent drifts or forgets its active task:
1. Send a command to `@kanban`:
   ```text
   @kanban /refresh
   ```
2. This forces the extension to reload and re-inject the active task file, checklist state, capability specs, and core instructions, resetting the agent's context.
