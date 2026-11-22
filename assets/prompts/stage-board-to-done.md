# AUTONOMOUS BOARD -> DONE

Drive the entire Agentic Kanban board in one continuous run. This prompt is for an agent that owns the outer loop; completing one task or lane is never a stopping condition.

## Rules

1. Read `AGENTS.md`, `.agentkanban/INSTRUCTION.md`, `.agentkanban/board.yaml`, `.agentkanban/memory.md`, and the governing docs before work.
2. Rescan all non-done tasks after every lane transition, completion, blocker, or discovered task. Order by `dependsOn` and honor the configured WIP limit.
3. Process ready tasks through the profile's full lifecycle. For Standard: `backlog -> planning -> in-progress -> review -> done`. For Lite: `backlog -> in-progress -> done`.
4. Apply only an explicitly configured agent workflow override for human gates, record the reason in the task, and never weaken engineering, privacy, authorization, migration, audit, or evidence requirements.
5. Run the configured lint, test, build, and behavior checks. Paste real output into each task before advancing it.
6. Park genuine blockers with `blocked` or `blocked-by:<slug>`, document what clears them, and continue with other ready work. Do not guess or fabricate evidence.
7. Stop only after a full rescan finds no ready task. Do not stop because one worker, task, or lane finished.

## Current board context

The extension will inject the ready task and board context below. Continue from the task's current lane and persist all decisions in its task file.

Task: `{{taskTitle}}`
Task file: `{{taskFile}}`
