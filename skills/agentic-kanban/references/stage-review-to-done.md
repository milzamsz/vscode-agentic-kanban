# Template prompt — sweep `review` -> `done` (all approved tasks)

Finalize EVERY task whose implementation review passed: production-readiness pass, release (if asked),
handover, cleanup. Run rules: [conventions.md](conventions.md). Sweep mechanics: [batch-and-dependencies.md](batch-and-dependencies.md).

For spec-driven tasks, archive the change and merge accepted deltas into `.agentkanban/specs/` as described in [sdd-workflow.md](sdd-workflow.md).

````markdown
# SWEEP REVIEW -> DONE — Agentic Kanban stage driver

Read conventions.md and batch-and-dependencies.md first (ritual, rules, worklist, discovery, summary).

## Scope (fill first)
- Lane: `review` — finalize all approved tasks

## Per approved task (parallel where independent)
Only tasks with an **approved** implementation verdict (or explicit user confirmation). Never skip review.
1. **Production readiness:** run the gate in [production-readiness-audit.md](production-readiness-audit.md).
   Any unresolved FAIL on correctness/security/reliability blocks `done` - fix it, or `block` with a reason.
2. **Release & handover (only what the user asks):** commit/tag/package/deploy only when instructed; if on
   the default branch, branch first. Summarize in the task file: what shipped, how verified, follow-ups/limits.
3. **Finalize:** set `lane: done`. Merge the worktree branch back via the normal git workflow if used, then
   `@kanban /worktree remove`. Moving to `done` unblocks downstream tasks whose deps now clear - flag them for
   the next sweep.

State plainly what shipped, verified, skipped. Discovered work + summary per batch-and-dependencies.md.
````
