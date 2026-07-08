# Template prompt - `review` -> `done` (human gate)

Finalize every task whose implementation review passed. This is a human gate: production-readiness pass,
Definition of Done checklist, honest-state docs, release if asked, handover, cleanup. Run rules:
[conventions.md](conventions.md). Sweep mechanics: [batch-and-dependencies.md](batch-and-dependencies.md).

For spec-driven tasks, archive the change and merge accepted deltas into `.agentkanban/specs/` as described in [sdd-workflow.md](sdd-workflow.md).

````markdown
# REVIEW -> DONE

Read AGENTS.md (Definition of Done), .agentkanban/INSTRUCTION.md, conventions.md, and batch-and-dependencies.md first.

## Scope (fill first)
- Lane: `review` - finalize tasks with an **approved** verdict. Never skip review. Per board reviewPolicy, high/critical need independent sign-off recorded in the task.

## Per approved task
1. **Production-readiness gate (required):** run the gate in [production-readiness-audit.md](production-readiness-audit.md) and paste the PASS/FAIL report into the task. Any unresolved FAIL on correctness, security, or reliability blocks `done` - fix it, or `block` with a reason. Mark untested checks `not-run`.
2. **Evidence gate:** confirm required `@kanban /evidence` entries are present and passing. Standard tasks require lint, test, and build evidence; spec-driven tasks also require behavior evidence proving acceptance criteria.
3. **Definition of Done checklist (if board policy requires it):** confirm a `## Definition of Done` section exists in the task body with all items checked. Items tagged `(human)` require a human actor.
4. **Update honest-state docs:** update README, architecture, spec notes, status banners, or TECHNICAL.md where the change made behavior real or changed workflow expectations.
5. **Spec-driven:** confirm the capability `spec.md` reflects the shipped behavior. Archive the change folder with `@kanban /archive <slug>`; the capability spec stays.
6. **Release & handover (only what the user asks):** commit/tag/package/deploy only when instructed; if on the default branch, branch first. Summarize what shipped, how verified, and follow-ups.
7. **Finalize:** set `lane: done`. Moving to `done` unblocks downstream tasks whose `dependsOn` now clear - flag them for the next pass.

State plainly what shipped, verified, skipped. Discovered work + summary per batch-and-dependencies.md.
````
