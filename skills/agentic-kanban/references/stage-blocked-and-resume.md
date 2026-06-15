# Template prompt - add or clear blocker labels

Two uses: **block** a single task that hits a real blocker, and **sweep** active tasks with blocker labels to
resume every task whose blocker cleared. Run rules: [conventions.md](conventions.md). Dependency guardrail + cycle
detection: [batch-and-dependencies.md](batch-and-dependencies.md).

Spec-driven tasks keep the same blocker model: use labels, keep the task in its working lane, and leave the linked change artifacts in place. See [sdd-workflow.md](sdd-workflow.md).

````markdown
# BLOCK / UNBLOCK - Agentic Kanban stage driver

Read conventions.md first. "Real blocker" means something you cannot resolve with available
tools or information. Otherwise, resolve it directly instead of parking the task.

## Action: `block` (single task)
1. `@kanban /task <name>`; read current state.
2. In the task file under `### agent`, record the blocker precisely: what, why, what clears it, who or what must act, and what you tried.
3. If it waits on another task, set `dependsOn: [<slug>]` plus a `blocked-by:<slug>` label.
4. If it is an external blocker, add the plain `blocked` label.
5. Surface the blocker to the user and wait.

## Sweep: resume all unblocked tasks
1. Worklist: all tasks carrying `blocked` or `blocked-by:<slug>` labels.
2. For each, check if cleared:
   - Dependency blocker: every dep (`dependsOn`, else `blocked-by:` labels) is now in `done`.
   - Other blocker: the recorded condition is resolved. Confirm it; do not assume.
3. Cleared -> unblock: note how it cleared; remove the satisfied blocker labels. Continue its work via the matching stage driver.
4. Still blocked: leave the labels in place with a one-line status. Watch for dependency cycles and surface them to the user.

Emit a summary (`resumed` / `still blocked`, with reasons).
````
