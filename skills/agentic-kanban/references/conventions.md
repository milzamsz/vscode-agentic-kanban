# Conventions — shared run rules (canonical)

Cross-cutting rules every driver reuses. Mode-agnostic: applies to single-task work and lane sweeps.
This is the ONE home for the start ritual, verify gate, TDD loop, and Always/Never - drivers link here
instead of repeating them. Sweep mechanics + dependencies live in [batch-and-dependencies.md](batch-and-dependencies.md);
lane model + action vocabulary in [workflow.md](workflow.md).

## Start ritual (every session, in order)
1. Read `.agentkanban/INSTRUCTION.md` + `AGENTS.md` fresh (don't rely on memory).
2. Get task context: `@kanban /task <name>` (single task) or build the lane worklist (sweep - see
   [batch-and-dependencies.md](batch-and-dependencies.md)). In a worktree, `@kanban /refresh` re-injects context.
3. Open the task file + its checklist artifact. Use `todo_*.md` for regular tasks, or `.agentkanban/changes/<slug>/tasks.md` for spec-driven tasks. Re-read the latest `### user`/`### agent` entries and any `[comment: ...]`.
4. State in the task file: which file you are in and the current `lane`.

## Verify gate (run; paste real output; never assume)
- `<lint>` · `<test>` · `<build>` (e.g. `npm run lint` / `npm test` / `npm run build`, or stack equivalent) - all green.
- Run the `code-review` skill on the diff; fix findings or record the decision.
- Security: access/permissions, input validation, secrets, injection.
- Performance: no N+1 / unbatched hot paths / missing indexes / heavy loops.
- Edge cases + error handling covered by tests.
- **Evidence the behavior RUNS** (the spec's Verification proof - a real workflow/job id, an agent command, an HTTP response), not a status write.
- Docs updated (README / TECHNICAL / changelog) where behavior changed.
A check that wasn't run is marked not-run - never imply coverage you don't have. If something fails, fix the
root cause; do not work around it.

## TDD loop (implementation)
Per checklist item, smallest first: write a failing test -> make it pass -> refactor. Use the stack skill for
idioms (pass it the task title + the item). Keep each change scoped; match surrounding code style. Mark the
item done in the active checklist artifact and add a one-line progress note under `### agent`. Never invent values to satisfy a
test (no hardcoding to the test case, no guessing user intent) - implement the general solution.

## Always
- Respond IN the task file, not the chat window. Append; never rewrite past entries. End with `### user`.
- Honor inline `[comment: ...]` annotations before continuing.
- Explicit lane transitions only; never change a lane implicitly.
- Reference other tasks by **slug**. Record dependencies per [batch-and-dependencies.md](batch-and-dependencies.md).
- No em dashes in product copy (UI or docs); the AGENTS.md sentinel marker string is the only exception (matched verbatim).

## Never
- Claim done without evidence (green lint/test/build, Definition of Done checklist complete, review passed).
- Jump straight to implementation work while a task is still in `planning`, or `-> done` without implementation review.
- Edit content outside the `AGENTIC KANBAN` sentinels in AGENTS.md.
- Commit/VCS unless explicitly asked. Speculate about files you have not opened.

## Definitions (so steps are executable, not vague)
- **Small checklist item:** one test's worth / <= ~1 hour / a single independently verifiable change.
- **Real blocker:** something you CANNOT resolve with the tools and information available. If you can resolve
  it yourself, it is not a blocker - do it. (Genuine blockers: external dependency, a decision only the user
  can make, broken/unavailable env, upstream bug, or an unfinished task this one depends on.)
- **Production-like env:** same OS/runtime/config class as production - not your dev shell.
- **Over-engineered:** scope beyond the acceptance criteria, or an abstraction with a single caller.
- **Brainstorming input:** paste the task title + description + known constraints into the `brainstorming` skill.
