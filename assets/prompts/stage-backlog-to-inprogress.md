# Prompt - sweep `backlog` -> `in-progress`

Clarify, lightly plan, and START EVERY ready task in `backlog`, ending in `in-progress`. Lite
profile: no planning lane. Approve the lightweight plan inline, then move the task and begin the
implementation pass.

---

```markdown
# SWEEP BACKLOG -> IN-PROGRESS

Read first (in repo): `AGENTS.md`, `.agentkanban/INSTRUCTION.md`, `.agentkanban/memory.md`. For
each spec-linked task, read the referenced `.agentkanban/specs/<capability>/spec.md` and
`.agentkanban/changes/<slug>/proposal.md` before deciding readiness.

## Scope
- Lane: `backlog` - process all ready tasks.
- Ready means: every `dependsOn` task is already in `done`, and the task is not labeled `blocked`.
- Respect `wipLimits.in-progress` from `board.yaml`.

## Per ready task
1. Discovery only: clarify the problem, expected runnable outcome, constraints, affected code, and
   verification path. Ground claims in actual files and code refs.
2. Write a lightweight implementation note in the task or spec artifacts. Capture key decisions,
   risks, and exact checks that will prove the behavior runs.
3. If the task is spec-driven, make sure the change folder and checklist exist and the frontmatter
   still points at the right `change:` and `spec:` files.
4. Move the task to `in-progress` only when the scope is clear enough to start without guessing.
5. If a real blocker remains, do not force it. Add or keep `blocked` / `blocked-by:<slug>`, state
   the exact unblock action, and continue with the next ready task.

## Lite start rule
Start the task when all are true:
- the requirement is unambiguous enough to implement;
- no missing product decision remains;
- no destructive approval is needed;
- no unresolved security choice is being guessed at;
- the repo patterns are clear enough to follow.

If any condition is false, leave the task out of `in-progress`, record the blocker, and keep going.

## Exit condition
- Every task you advanced is now in `in-progress`.
- Every task you skipped has the exact reason recorded.
- Do not move anything to `done` here. The `in-progress -> done` sweep handles review and evidence.
```
