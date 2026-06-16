# Prompt — autonomous `planning` → `review` (default driver)

One launch carries every **approved** planning task through implementation to `review`, hands-off.
`in-progress` is automatic — no human touch between plan approval and the review gate. Real blockers
are labeled and parked. Serial: one task at a time (WIP = 1).

Human gates: **plan approval** (in `planning`, before you launch) and **`review → done`** (after).

---

```markdown
# AUTONOMOUS PLANNING → REVIEW

Read AGENTS.md, .agentkanban/memory.md, and per task its capability spec + change `design.md`/`tasks.md`
before touching code. Stack: `<stack skill>`.

## Scope (fill first)
- Lane: `planning` — process approved + ready tasks only.
- Approved = a human go is recorded in the task (or you name the tasks when launching). No approval
  and not named → skip.
- Ready = every `dependsOn` slug is `done`. Else it stays (guardrail).
- WIP = 1, serial: fully finish or park one task before the next. Topo-sort by `dependsOn`.

## Per approved+ready task (serial) — planning to review
1. **Re-read** the capability spec (`spec:`) + `changes/<slug>/{design,tasks}.md`. If the design
   materially diverges from current code, stop in `planning` and note why (no silent scope creep).
2. **Plan-review gate (high/critical).** If no independent planning-review verdict is recorded,
   spawn an independent reviewer to vet the plan. `revise` → write findings, `blocked` label, park,
   next task. `approve` → continue. (low/medium: self-review is enough.)
3. **Enter implementation (automatic).** Set `lane: in-progress`. Launching this driver is the
   authority — no separate human approval. Confirm the toolchain is green first.
4. **Implement** TDD down `changes/<slug>/tasks.md`: failing test → pass → refactor; check items off
   with a one-line `### agent` note. Honor the repo's guardrails (AGENTS.md).
5. **Verify gate (paste real output):** `<lint>` · `<test>` · `<build>` + any project smoke checks,
   plus **evidence the behavior RUNS** (the spec's Verification proof), not a status write.
6. **Blocker** (real: dependency task not `done`, env unavailable, upstream bug, decision only the
   user can make) → add `blocked` / `blocked-by:<slug>`, record what clears it, park, next task. If
   you can resolve it yourself, do — it's not a blocker.
7. **Success → review.** Set `lane: review`, write the review verdict + pasted evidence. **STOP** —
   `review → done` is the human gate. Never push a task to `done` yourself.

## End-of-run summary
Per task: `advanced-to-review` / `parked-blocked:<reason>` / `revise-parked:<reason>` / `skipped:<reason>`.
Discovered work → a new `backlog` task (label `discovered`); never pull into the current pass.

## Notes
- Runs `planning → in-progress → review` inline — no separate prompts for the middle transitions.
- Blockers: [stage-blocked-and-resume.md](stage-blocked-and-resume.md). Revise: [stage-review-to-in-progress.md](stage-review-to-in-progress.md).
- `review → done` is run separately by a human via [stage-review-to-done.md](stage-review-to-done.md).
```
