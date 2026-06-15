# Template prompt — sweep `planning` → `in-progress` (all approved tasks)

Start implementation for EVERY ready task in `planning` whose plan has been explicitly approved.
Run rules: [conventions.md](conventions.md). Sweep + dependency mechanics: [batch-and-dependencies.md](batch-and-dependencies.md).

For spec-driven tasks, use the approved artifacts from [sdd-workflow.md](sdd-workflow.md) as the implementation contract and use change `tasks.md` as the checklist.

````markdown
# SWEEP PLANNING → IN-PROGRESS — Agentic Kanban stage driver

Read conventions.md and batch-and-dependencies.md first — they define the ritual, rules, worklist, guardrail,
discovery, loop-until-dry, and summary.

## Scope (fill first)
- Lane: `planning` — start all approved + ready tasks
- Stack skill: `<e.g. odoo-19 / fastapi-expert>`

## Per ready+approved task (parallel where independent) — action: `implement`
Only tasks with an explicit approval to start. Topo-sort so depended-on tasks start first; serialize dependent chains.
1. Confirm the plan and checklist are still current. If scope changed materially, return to `planning` and revise first.
2. `@kanban /task <name>`; set `lane: in-progress`.
3. Isolate: `@kanban /worktree` (branch `agentkanban/<slug>` + separate dir) when the profile or task risk requires it.
4. Confirm the toolchain is green before changes.
5. Start the TDD loop on the first checklist item, then continue via run-development-prompt.md.

Implement only the approved plan; if the work uncovers a real scope change, note it and return to `planning`.
Discovered work + summary per batch-and-dependencies.md.
````
