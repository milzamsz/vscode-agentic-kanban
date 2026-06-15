# Template prompt — run the development (execution driver)

Drives the actual work on already-created tasks — one focused task or a whole lane in one sweep. Scaffold:
[lifecycle-prompt.md](lifecycle-prompt.md). Run rules (ritual, verify gate, TDD, Always/Never): [conventions.md](conventions.md).
Lane→action map + lane model: [workflow.md](workflow.md). Sweep + dependency mechanics: [batch-and-dependencies.md](batch-and-dependencies.md).

````markdown
# RUN DEVELOPMENT — Agentic Kanban execution driver

Read conventions.md, workflow.md, and batch-and-dependencies.md first — they define the ritual, verify gate,
TDD loop, rules, the lane→action mapping, and (for sweeps) the worklist/guardrail/discovery/summary.

## Mode (pick one)
- **Single task** — fill Task below; do the start ritual; pick the action for the task's lane (workflow.md).
- **Lane sweep (batch)** — set `Lane: <X>`; build the worklist + apply the dependency guardrail
  (batch-and-dependencies.md); run the matching `stage-*.md` driver, which loops the per-task flow below,
  parallel where independent.

## Target (fill first)
- Task: `<task name or slug>`  — or —  Lane: `<lane>` (sweep)
- Intent this session: `<e.g. "implement the approved plan" / "fix review comments">`

## Per-task flow
1. Start ritual (conventions.md): read INSTRUCTION/AGENTS, select/refresh the task, state file + lane.
2. Confirm the Intent matches the lane's action (workflow.md). If not (e.g. asked to implement while in
   `planning`), STOP and ask for an explicit transition first.
3. Do the action:
   - `plan` / `checklist` — see stage-backlog-to-planning.md.
   - `implement` — run the TDD loop (conventions.md); isolate in a worktree for risky/large work.
   - `review` — run the verify gate (conventions.md) for implementation review.
   - `block` / `unblock` — see stage-blocked-and-resume.md.
4. If new work surfaces, capture it as a discovered task (batch-and-dependencies.md) — don't derail the current task.

Always/Never and dependency recording: conventions.md + batch-and-dependencies.md.
````

## Quick one-liners (for an in-flight task)
- Continue work: `@kanban /refresh` then "implement the next checklist item; run the verify gate; report output."
- Hand to review: "implementation review: run the verify gate + code-review, write findings in the task file, recommend the transition."
- Unstick: "block: record the blocker, add `blocked` or `blocked-by:<slug>` labels, then stop."
- Sweep a lane: "run the <lane> stage driver over all ready tasks, parallel where independent."
