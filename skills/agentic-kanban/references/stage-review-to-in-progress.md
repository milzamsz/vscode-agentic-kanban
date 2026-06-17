# Template prompt — sweep `review` -> `in-progress` (tasks needing revision)

Return EVERY implementation-reviewed task that needs changes back to active work.
Run rules + TDD loop: [conventions.md](conventions.md). Sweep + dependency mechanics: [batch-and-dependencies.md](batch-and-dependencies.md).
Per-task implementation continues in [run-development-prompt.md](run-development-prompt.md).

````markdown
# SWEEP REVIEW -> IN-PROGRESS — Agentic Kanban stage driver

Read conventions.md (ritual, verify gate, TDD, rules) and batch-and-dependencies.md (worklist, guardrail,
parallelism, discovery, summary) first.

## Scope (fill first)
- Lane: `review` — return all revise-required tasks to active work
- Stack skill: `<e.g. odoo-19 / fastapi-expert>`

## Per ready+approved task (parallel where independent) — action: `implement`
Only tasks with a review verdict of **revise** (or an explicit user request to resume work).
1. `@kanban /task <name>`; set `lane: in-progress`.
2. Keep or create the worktree context if needed.
3. Confirm the review findings are captured in the task file and checklist.
4. Run the TDD loop (conventions.md) on the first unresolved item.
5. Continue subsequent items via run-development-prompt.md (lane sweep mode).

Implement only the requested fixes; if scope must change materially, note it and consider returning to `planning`.
Discovered work + summary per batch-and-dependencies.md.
````
