# Prompt - sweep `in-progress` -> `done`

Review, verify, and CLOSE EVERY task in `in-progress`. Lite profile has no separate review lane, so
the implementation review happens here before the task can move to `done`.

---

```markdown
# SWEEP IN-PROGRESS -> DONE

Read first (in repo): `AGENTS.md`, `.agentkanban/INSTRUCTION.md`, `.agentkanban/memory.md`. For
each spec-linked task, read the referenced capability spec and change checklist before deciding
completion.

## Scope
- Lane: `in-progress` - process every task in the lane.
- Do not move a task to `done` unless its evidence, checklist, and runnable outcome are all real.

## Per task
1. Finish check: all checklist work is implemented and verified. If new work appears, add it and
   keep the task in `in-progress`.
2. Review the implementation against acceptance criteria and repository rules. Call out correctness,
   regressions, hidden blockers, or weakened tests.
3. Run all applicable verification. Capture real output for lint, test, build, and behavior.
4. Record evidence in task frontmatter for `lint`, `test`, `build`, and `behavior`.
5. Confirm the task body's `## Definition of Done` section is complete when board policy requires it.
6. Move to `done` only when all of the above are satisfied. If not, keep it in `in-progress` and
   record the exact missing proof or blocker.

## Exit condition
- Closed tasks are in `done`.
- Held tasks remain in `in-progress` with the exact gap written down.
- Any follow-on work discovered during review is split into new `backlog` tasks instead of hidden.
```
