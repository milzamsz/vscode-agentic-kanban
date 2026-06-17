# Agentic Kanban - Instruction

You are working with the **Agentic Kanban** extension.

IMPORTANT: Follow these workspace structure, file format, and workflow rules strictly.

Agentic Kanban structures AI-assisted delivery around fixed workflow profiles. Conversation between you (the agent) and the user happens in task files. Use the chat window only for summaries and lightweight coordination. Planning decisions, reviews, and implementation notes belong in the task file so the workflow remains auditable.

IMPORTANT: Always respond in the task file, not the chat window. Stay in the assigned task file until a new one is given.

## Task Directory Structure

```text
.agentkanban/
  .gitignore          # Auto-generated - ignores logs/
  board.yaml          # Workflow profile, lanes, and policy config
  specs/
    <capability>/spec.md   # capability contract — one per capability, shared across tasks
  changes/
    <task-slug>/
      proposal.md
      design.md
      tasks.md
    archive/<task-slug>/   # archived change folders (via @kanban /archive)
  memory.md           # Persistent memory across tasks (reset via command)
  INSTRUCTION.md      # This file - managed by the extension
  tasks/
    task_<id>_<slug>.md    # Task files (lane stored in frontmatter)
    todo_<id>_<slug>.md    # Checklist artifact for the task
    archive/               # Archived tasks (hidden from board)
  logs/               # Diagnostic logs (gitignored)
```

## Task File Format

IMPORTANT: The task lane is managed by the user and extension via frontmatter. Do not change the lane implicitly. Use explicit transitions.

Each task is a markdown file with YAML frontmatter. Conversation flows under `### user` and `### agent` headings. The user may add inline comments `[comment: <text>]` on your responses. Check for these before continuing.

```markdown
---
title: <Task Title>
lane: <lane-slug>
created: <ISO 8601>
updated: <ISO 8601>
description: <Brief description>
labels: [blocked, blocked-by:<slug>]    # optional blocker labels
---

## Conversation

### user

<message>

### agent

<response> [comment: <inline comment by the user>]

### user
```

Rules:

- Append new entries at the end. Never modify or delete existing conversation entries.
- Start each message with `### user` or `### agent` on its own line, with a blank line between messages.
- After your response, add `### user` on a new line for the user's next entry.
- Honor inline `[comment: <text>]` annotations from the user.
- Re-read this `INSTRUCTION.md` at the start of every action.
- Confirm which task file you are working in at the start of each response. If none is in context, ask the user to select one with `@kanban /task`.
- If no task file reference is found, ask the user to run `@kanban /task` or `@kanban /refresh`.

## Checklist Artifact

Track execution details with `- [ ]` / `- [x]` checkboxes in the corresponding `todo_*.md` file. This is a checklist artifact, not a workflow lane.

```markdown
# Iteration <number>

- [ ] Uncompleted item
- [x] Completed item
```

Rules:

- Create or update the checklist during planning or implementation when work needs explicit steps.
- Add new checklist items to the bottom of the current iteration.
- Mark completed items during or immediately after implementation.
- For spec-driven tasks linked through `change: .agentkanban/changes/<task-slug>`, use the change `tasks.md` as the authoritative checklist instead of the sibling `todo_*.md`.

## Spec-Driven Development

Some tasks opt into spec-driven development. They carry two frontmatter keys: a `change` pointing at
`.agentkanban/changes/<task-slug>` (the per-task proposal/design/tasks) and a `spec` pointing at the
shared capability contract `.agentkanban/specs/<capability>/spec.md`.

For those tasks:

- Read the capability `spec.md` (behavior + acceptance criteria) and `proposal.md` before planning or implementation.
- In the Standard profile, also read `design.md`.
- Treat the change `tasks.md` as the authoritative checklist (not the sibling `todo_*.md`).
- The capability spec lives once under `.agentkanban/specs/` and is referenced, not duplicated per change.
- Preserve the task-to-change and task-to-spec links in frontmatter.
- A task is `done` only when its behavior is proven to run and the spec's acceptance criteria are met.
- When the task reaches `done`, archive the change with `@kanban /archive [slug]`; the capability spec stays in `specs/`. Archiving and validation remain agent-driven.

## Memory

`.agentkanban/memory.md` persists across tasks. Read it at the start of each task. Update it with project conventions, key decisions, and useful context.

## Technical Document

Maintain `TECHNICAL.md` at workspace root with implementation details for agents and humans. Update the relevant section when behavior or workflow rules change.

## Workflow Profiles

### Lite profile

Lane flow:

`backlog -> in-progress -> done`

Guidance:

- `backlog` is for rough work items that still need lightweight clarification.
- `in-progress` is where implementation happens.
- `done` is for completed work.

### Standard profile

Lane flow:

`backlog -> planning -> in-progress -> review -> done`

Guidance:

- `backlog`: the task is still broad and not ready for detailed execution.
- `planning`: refine scope, write the implementation plan, identify risks, and update the checklist artifact as needed. This is where the plan is **approved**. To transition a task from `planning` to `in-progress`, it must have a checklist with at least one item, and if it is spec-driven, it must also have a valid spec file and change folder.
- `in-progress`: implement the approved plan. Entering `in-progress` is **not** a separate human gate — an agent may carry an approved task from `planning` straight through implementation to `review` in one pass (the autonomous `planning -> review` flow). When running this flow, the task must be moved to `in-progress` before starting work, so the board reflects the current progress state. Worktrees are optional unless the board policy requires them.
- `review`: implementation review. Return to `in-progress` for revisions, or move to `done` when approved.
- The two human gates are **plan approval** (in `planning`) and **`review -> done`**. Everything between can run hands-off.
- Real blockers → keep the task in its lane and add the `blocked` label (external dependency/decision) or `blocked-by:<slug>` (task dependency); record what clears it. Never force past a real blocker.
- One active implementation task at a time (WIP) unless the board allows otherwise.

## Action Vocabulary

The user may instruct you with these action words:

| Action | Meaning |
| --- | --- |
| `plan` | Clarify requirements, refine scope, and write or update the implementation plan |
| `checklist` | Create or update the TODO checklist artifact |
| `implement` | Carry out the approved implementation work |
| `review` | Perform or prepare an implementation review |
| `block` | Record blockers on the task and add `blocked` or `blocked-by:<slug>` labels |
| `unblock` | Remove blocker labels once the task can continue |

Treat `TODO` as the checklist artifact only. Do not treat `todo` as a workflow lane.

## Execution Rules

- Do not implement changes unless the task is in `in-progress`. When running the autonomous `planning -> review` flow on an approved task, you must move the task to `in-progress` before starting work.
- Do not move a Standard-profile task to `done` without implementation review.
- Preserve blocker context in the task file when adding or clearing blocker labels.
- If the user wants to override the workflow, note the reason in the task file.
- Do not add or commit to version control unless specifically instructed.

## Worktree Guidance

In a worktree workspace, `AGENTS.md` permanently contains the task reference, so `/task` and `/refresh` are usually unnecessary.

When the profile or policy requires worktrees for implementation:

- ensure the task has worktree metadata before implementation starts
- keep implementation activity inside the worktree
- preserve the task file and checklist file as the workflow record

## Board Policy

The active board policy is injected through `AGENTS.md`.

- `enforcement.mode: strict` means transition failures block unless a human override is used.
- `enforcement.mode: warn` means transition failures are surfaced as warnings and the move can continue.
- `reviewPolicy` tells the agent who should review planning and implementation work for each task priority.
- `self-agent` means the active coding agent can perform that review.
- `independent-agent` means a different agent should review that stage.
- `independent-agent+human` means a different agent review plus human review is required.
