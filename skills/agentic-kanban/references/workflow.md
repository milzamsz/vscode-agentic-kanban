# Workflow model

The extension structures AI-assisted delivery around **fixed workflow profiles**. The conversation between agent and user happens **in task files** (`.agentkanban/tasks/task_*.md`), not the chat window. The chat window is for summaries and lightweight coordination only.

## Lane models

### Lite profile
```
backlog -> in-progress -> done
```
- `backlog`: rough items needing lightweight clarification.
- `in-progress`: implementation happens here.
- `done`: completed work.

### Standard profile
```
backlog -> planning -> in-progress -> review -> done
```
- `backlog`: broad, not ready for detailed execution.
- `planning`: refine scope, write the implementation plan, identify risks, update the checklist.
- `in-progress`: implement the approved plan (with a worktree when configured). Moving into `in-progress` is the explicit approval step for the plan.
- `review`: implementation review. Return to `in-progress` for revisions, or move to `done` when approved.
- `blocked` is a label, not a lane. Use it for external blockers while keeping the task in its active lane.

## Lane rules

- The lane is stored in task-file frontmatter (`lane:`). Managed by the user and extension. **Never change a lane implicitly** — use explicit transitions only.
- Do not implement changes unless the task is in `in-progress`, or the user explicitly asks for a combined transition-plus-implement in the same turn.
- Standard profile: `planning -> in-progress` is the explicit plan approval step; never reach `done` without implementation review.
- When adding `blocked` or `blocked-by:<slug>` labels, preserve the blocker context in the task file and clear the labels when work can continue.
- To override the workflow, record the reason in the task file.
- Do not add or commit to version control unless explicitly instructed.

## Checklist artifact (`TODO`)

- `TODO` is a **checklist artifact, not a lane**. It lives in the sibling `todo_*.md` file as `- [ ]` / `- [x]` items grouped under `# Iteration <n>`.
- Spec-driven tasks use `.agentkanban/changes/<slug>/tasks.md` as the authoritative checklist.
- Create or update it during planning or implementation when work needs explicit steps.
- Add new items to the bottom of the current iteration. Mark items complete during or immediately after implementation.

## Spec-driven tasks

- `@kanban /spec [capability]` scaffolds `.agentkanban/changes/<task-slug>/`.
- The task stores `change: .agentkanban/changes/<task-slug>` in frontmatter.
- Standard profile uses `proposal.md`, `design.md`, `tasks.md`, and `specs/<capability>/spec.md`.
- Lite profile uses `proposal.md` and `tasks.md`.
- Full format and completion rules live in [sdd-workflow.md](sdd-workflow.md).

## Action vocabulary

| Action | Meaning |
| --- | --- |
| `plan` | Clarify requirements, refine scope, write/update the implementation plan |
| `checklist` | Create/update the TODO checklist artifact |
| `implement` | Carry out approved implementation work |
| `review` | Perform or prepare an implementation review |
| `block` | Record blockers and add `blocked` or `blocked-by:<slug>` labels |
| `unblock` | Resolve blockers and remove blocker labels |

## Task dependencies & batch sweeps

Dependencies are recorded as `dependsOn: [<slug>]` frontmatter (authoritative, preserved across saves) plus a
`blocked-by:<slug>` label for board visibility. For agentic AI development the stage drivers process **all
ready tasks in a lane** in one pass (parallel where independent), gated by the dependency guardrail. Full
convention, guardrail, cycle detection, discovery, and loop-until-dry mechanics: [batch-and-dependencies.md](batch-and-dependencies.md).

## Context injection (how the agent stays on track)

Three layers, described in TECHNICAL.md and README.md:
1. **AGENTS.md managed sentinel** — re-injected on every agent turn; the most reliable. In worktree workspaces it names the exact task file.
2. **Per-thread `response.reference()`** — `/task` and `/refresh` attach INSTRUCTION.md + task file URIs.
3. **`/refresh` command** — on-demand re-sync when the agent drifts.

## Worktree flow

- `@kanban /worktree` creates branch `agentkanban/<task-slug>` (prefix unchanged for compatibility), writes a task-specific AGENTS.md sentinel into the worktree, and `--skip-worktree`s AGENTS.md so worktree edits don't pollute commits.
- In a worktree workspace, `/task` and `/refresh` auto-detect the linked task; re-selection is usually unnecessary.
