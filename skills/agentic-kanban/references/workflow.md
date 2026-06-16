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
- `planning`: refine scope, write the implementation plan, identify risks, update the checklist. The plan is **approved** here.
- `in-progress`: implement the approved plan. Entering `in-progress` is **not** a separate human gate — an agent may carry an approved task straight from `planning` through implementation to `review` in one pass (the autonomous `planning → review` driver). Worktrees optional unless board policy requires them.
- `review`: implementation review. Return to `in-progress` for revisions, or move to `done` when approved.
- The two human gates are **plan approval** (`planning`) and **`review → done`**; everything between can run hands-off.
- `blocked` is a label, not a lane. Real blockers → `blocked` / `blocked-by:<slug>`, keep the task in its lane, never force past them.

## Lane rules

- The lane is stored in task-file frontmatter (`lane:`). Managed by the user and extension. **Never change a lane implicitly** — use explicit transitions only.
- Do not implement changes unless the task is in `in-progress`, or you are running the autonomous `planning → review` flow on an approved task (a combined transition-plus-implement in one pass).
- Standard profile: the plan is approved in `planning`; `in-progress` is automatic; never reach `done` without implementation review.
- **WIP limit:** `wipLimits` in board.yaml caps tasks per lane (default Standard `in-progress: 1`). A move into a full lane is blocked (strict) or warned (warn). Work serially: finish or park before the next.
- When adding `blocked` or `blocked-by:<slug>` labels, preserve the blocker context in the task file and clear the labels when work can continue.
- To override the workflow, record the reason in the task file.
- Do not add or commit to version control unless explicitly instructed.

## Checklist artifact (`TODO`)

- `TODO` is a **checklist artifact, not a lane**. It lives in the sibling `todo_*.md` file as `- [ ]` / `- [x]` items grouped under `# Iteration <n>`.
- Spec-driven tasks use `.agentkanban/changes/<slug>/tasks.md` as the authoritative checklist.
- Create or update it during planning or implementation when work needs explicit steps.
- Add new items to the bottom of the current iteration. Mark items complete during or immediately after implementation.

## Spec-driven tasks

- `@kanban /spec [capability]` scaffolds `.agentkanban/changes/<task-slug>/` (proposal/design/tasks) and ensures a shared capability spec at `.agentkanban/specs/<capability>/spec.md`.
- The task stores `change: .agentkanban/changes/<task-slug>` and `spec: .agentkanban/specs/<capability>/spec.md` in frontmatter. The capability spec lives once and is referenced, not duplicated per change.
- Standard profile uses `proposal.md`, `design.md`, `tasks.md`; Lite uses `proposal.md` + `tasks.md`.
- `@kanban /archive [slug]` moves a finished change to `changes/archive/`; the capability spec stays.
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
