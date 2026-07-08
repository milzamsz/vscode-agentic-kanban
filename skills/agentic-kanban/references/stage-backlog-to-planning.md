# Template prompt - sweep `backlog` -> `planning` (all tasks)

Process EVERY ready task in `backlog`: clarify it and produce a concrete implementation plan, ending in
`planning`. Run rules: [conventions.md](conventions.md). Sweep + dependency mechanics: [batch-and-dependencies.md](batch-and-dependencies.md).

For spec-driven tasks, create and refine the change artifacts described in [sdd-workflow.md](sdd-workflow.md) during this stage.

````markdown
# SWEEP BACKLOG -> PLANNING - Agentic Kanban stage driver

Read conventions.md (ritual, Always/Never) and batch-and-dependencies.md (worklist, guardrail, discovery,
loop-until-dry, summary) first - they define everything not stated here.

## Scope (fill first)
- Lane: `backlog` - process all ready tasks in it
- Stack skill: `<e.g. odoo-19 / fastapi-expert>`

## Per ready task (parallel where independent) - action: `plan` (read/think only, no implementation)
1. **Discovery** (use the `brainstorming` skill): problem & outcome; actors; scope in/out; use-cases;
   acceptance criteria (testable); constraints (data/security/perf/compliance/deadline); affected code as `path:line`.
   Capture open questions + assumptions; if a blocking question can't be answered, ask the user - don't guess.
   If it waits on another task, set `dependsOn: [<slug>]` + a `blocked-by:<slug>` label -> treat as not-ready.
2. **Implementation plan** (stack skill): approach + key decisions (+ rejected alternatives); data model /
   interfaces / contracts; security model; how the behavior is proven to RUN; risks + mitigations;
   rollout/migration if relevant. Include production-readiness coverage for security, reliability, data,
   and docs so the final audit is not a surprise.
3. **Spec-driven when appropriate:** create `.agentkanban/changes/<slug>/{proposal,design,tasks}.md`, record the chosen approach in `design.md`, use `tasks.md` as the authoritative checklist, and add `change:` / `spec:` frontmatter to the task. Otherwise create ordered, small checklist items under `# Iteration 1` in `todo_*.md`.
4. **Transition:** set `lane: planning`. After the plan is approved, the autonomous `planning -> review` driver carries it through implementation - do not implement during this backlog->planning pass.

Record discovered work and end-of-pass summary per batch-and-dependencies.md.
````
