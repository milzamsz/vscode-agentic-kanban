# Batch lane sweep, dependencies & mid-work discovery (canonical)

Shared mechanics for the stage drivers. The stage prompts operate on **all ready tasks in a lane** (a sweep),
not one task at a time — built for agentic AI development. This is the ONE home for the sweep model, the
dependency convention, the guardrail, discovery, and the stop condition. Cross-cutting run rules
(ritual, verify gate, TDD, Always/Never) live in [conventions.md](conventions.md).

## Dependency convention
Record on the **dependent** task:
- **Authoritative:** `dependsOn: [<slug>, ...]` in task frontmatter. Preserved across saves by the
  extension's frontmatter round-trip (the `extras` mechanism). Reference tasks by **slug**.
- **Board visibility / safety mirror:** a `blocked-by:<slug>` label per blocker (rendered distinctly on the
  card). Labels always persist, so they also cover older extension builds. Keep label and `dependsOn` in sync.
- **Optional rationale:** a `## Dependencies` body block (`Depends-on: <slug> — <why>`; `Parent: <epic-slug>`).

## Lane sweep model
1. Build the worklist: read `.agentkanban/tasks/*.md` (exclude `archive/`), keep those with `lane: <target>`.
2. Order: `priority` (critical → high → medium → low → none) → `sortOrder` (ascending) → `created` (oldest first).
3. Apply the dependency guardrail (below) → split into **ready** vs **not-ready**.
4. Process the ready set (parallel where independent), transition each, record per-task outcome.
5. Repeat until dry (below). Emit a batch summary.

## Dependency guardrail
- A task is **ready** only if EVERY dependency is in lane `done`. Read deps from `dependsOn` (authoritative);
  if absent, fall back to `blocked-by:<slug>` labels.
- Not-ready in a sweep: skip this pass, write one line in the task file ("waiting on `<slug>` (lane: `<x>`)").
  Leave it in its current lane and keep the matching `blocked-by:<slug>` label. Use the plain `blocked` label
  only for external blockers that are not represented by another task.
- **Topological order:** within the ready set, process upstream (depended-on) tasks before downstream ones.
- **Cycle detection:** if slugs form a loop (A→B→A, or longer), do NOT loop. On each task in the cycle, add a
  `dep-cycle` label and a body line `DEP CYCLE: <slug-a> -> <slug-b> -> <slug-a>`, then stop and surface it to
  the user as a blocker to resolve.
- **Self / dangling refs:** ignore a dependency pointing at itself or at a missing/archived slug; note it.

## Parallel where independent
- Group ready tasks that share no dependency edge → run concurrently.
- Isolate each parallel task in its own worktree (`@kanban /worktree`) so file edits never collide.
- Serialize dependent chains in topological order (downstream waits for upstream to reach `done`).
- Optional WIP cap: limit simultaneous `in-progress` tasks if the environment is constrained.
- **Idempotent:** a task is "already advanced" this pass when its `lane` no longer equals the sweep's source
  lane — skip it. Re-running the same sweep is safe and reprocesses nothing.

## Mid-work discovery (new tasks found while working)
1. `@kanban /new <concise imperative title>` → lands in `backlog`.
2. Add label `discovered`; in the body add `## Dependencies` → `Discovered-from: <originating-slug>`.
3. If it must finish before the current task, add `dependsOn: [<new-slug>]` (+ a `blocked-by:` label) on the
   dependent task (now not-ready).
4. Continue the current pass. **Do not pull discovered tasks into the current sweep** — triage them later via
   [stage-backlog-to-planning.md](stage-backlog-to-planning.md). This keeps passes bounded.

## Loop-until-dry stop condition
After a pass, run another ONLY if at least one task advanced. Stop when no remaining task can advance (all
not-ready due to deps, or needing user input). Never spin re-trying the same blocked set. Report what remains.

## Gates are never skipped
A sweep advances each task to the **next** lane only. In Standard, never go `in-progress → done` directly:
the `review` lane (implementation review) must run first. `planning → in-progress` is the explicit
plan-approval step; do not skip it either.

## Batch summary report
At pass end, write a table (chat + the originating notes):

| Task (slug) | Lane before → after | Outcome |
|---|---|---|
| `<slug>` | `<from>` → `<to>` | advanced |
| `<slug>` | `<x>` (unchanged) | skipped — waiting on `<slug>` |
| `<slug>` | `<x>` (unchanged) | blocked label set — `<reason>` |
| `<slug>` | — | created (discovered) |

State totals: advanced / skipped / blocked / created, and whether another pass is warranted.
