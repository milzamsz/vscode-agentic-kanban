# Prompt — `review` → `in-progress` (revise)

Send a review-rejected task back to active work to apply the requested fixes.

---

```markdown
# REVISE: REVIEW → IN-PROGRESS

Read AGENTS.md + the task's review verdict + spec + change `tasks.md` first. Stack: `<stack skill>`.

## Scope
- Lane: `review` — tasks with verdict **revise** (or an explicit user request to resume).

## Per revise task — action: `implement`
1. `@kanban /task <name>`; set `lane: in-progress`.
2. Confirm the review findings are captured as concrete checklist items in `tasks.md`.
3. TDD loop on the first unresolved finding: failing test → pass → refactor. Never hardcode to the
   test — implement the general solution.
4. Re-run the verify gate (`<lint>` · `<test>` · `<build>` + smoke) before re-review.
5. Mark items done with a one-line note under `### agent`.

Apply ONLY the requested fixes. If a fix forces a material scope change, note it and return to
`planning`. Then continue to `review` (or relaunch the autonomous driver).
```
