# Template prompt — autonomous `planning` -> `review` (default driver)

One launch carries every **approved** planning task through implementation to `review`, hands-off.
`in-progress` is automatic - no human touch between plan approval and the review gate. Real blockers
are labeled and parked. Serial: one task at a time (WIP = 1). This is the default for agentic runs; it
runs the `planning -> in-progress -> review` steps inline (there are no separate prompts for the middle
transitions). Run rules: [conventions.md](conventions.md). Sweep + dependency mechanics:
[batch-and-dependencies.md](batch-and-dependencies.md). For spec-driven tasks the approved
proposal/design + capability spec are the contract; the change `tasks.md` is the checklist
([sdd-workflow.md](sdd-workflow.md)).

````markdown
# AUTONOMOUS PLANNING -> REVIEW — Agentic Kanban stage driver

Read conventions.md (start ritual, verify gate, TDD, Always/Never) and batch-and-dependencies.md
(worklist, guardrail, discovery, summary) first. For each task read its capability spec (`spec:`) +
change `design.md`/`tasks.md` before coding.

## Scope (fill first)
- Lane: `planning` — process approved + ready tasks only.
- Approved = a human go is recorded in the task (or you name the tasks when launching). No approval and
  not named -> skip.
- Ready = every `dependsOn` slug is `done` (the guardrail). Else it stays.
- WIP = 1, serial: fully finish or park one task before the next. Topo-sort by `dependsOn`.
- Stack skill: `<stack skill>`.

## Per approved+ready task (serial) — planning to review
1. **Enter implementation (automatic):** Set `lane: in-progress` before starting work, so the board reflects the current progress state. Confirm toolchain green. (Automatic - launching the driver is the authority.)
2. Re-read the capability spec + `changes/<slug>/{design,tasks}.md`. If the design materially diverges
   from current code, set `lane: planning`, add `blocked` label, park, note why (no silent scope creep), and move to the next task.
3. **Plan-review gate (high/critical):** if no independent planning-review verdict is recorded, spawn
   an independent reviewer to vet the plan. `revise` -> write findings, set `lane: planning`, add `blocked` label, park, next.
   `approve` -> continue. (low/medium: self-review.)
4. Implement via the TDD loop down `tasks.md`; honor the repo guardrails (AGENTS.md).
5. Run the **verify gate** (conventions.md) + capture **evidence the behavior RUNS** (the spec's
   Verification proof), not a status write.
6. Real blocker -> `blocked` / `blocked-by:<slug>`, record what clears it, park, next task.
7. Success -> `lane: review` with verdict + pasted evidence. **STOP** — `review -> done` is the human
   gate. Never push a task to `done` yourself.

End-of-run summary per task: `advanced-to-review` / `parked-blocked` / `revise-parked` / `skipped`.
Discovered work -> `backlog` (per batch-and-dependencies.md). Revise re-entry: [stage-review-to-in-progress.md](stage-review-to-in-progress.md).
Blockers: [stage-blocked-and-resume.md](stage-blocked-and-resume.md). Finalize (human): [stage-review-to-done.md](stage-review-to-done.md).
````
