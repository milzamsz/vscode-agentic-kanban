# Template prompt — worktree operations

Use to manage a task's isolated git worktree: create, open, merge back, remove. Requires a git repo.

````markdown
# WORKTREE OPS — Agentic Kanban

## Target
- Task: `<task name or slug>`

## Create (start isolated work)
```
@kanban /task <task name>
@kanban /worktree
```
Creates branch `agentkanban/<task-slug>`, auto-commits the task file, writes a task-specific
AGENTS.md sentinel into the worktree, `--skip-worktree`s it, and opens the worktree in VS Code.
In the worktree, `/task` and `/refresh` auto-detect the linked task — no re-selection needed.

## Open an existing worktree
```
@kanban /worktree open
```

## Merge back (when work is approved)
In the worktree: ensure everything is committed.
In your main workspace, via the normal git workflow:
```
git checkout <main-branch>
git merge agentkanban/<task-slug>
```
Resolve conflicts as usual. Run lint/test/build on the merge result.

## Remove (after merge or abandon)
```
@kanban /worktree remove
```
Removes the worktree dir and deletes the branch. Moving a task to Done/Archive also prompts cleanup.

## Notes
- Config: `agentKanban.worktreeRoot` (default `../{repo}-worktrees`), `agentKanban.worktreeOpenBehavior` (`current`/`new`).
- The branch prefix `agentkanban/` is fixed for compatibility — do not rename.
- If worktree metadata is stale (dir gone), `@kanban /worktree` cleans up and recreates.

## When to use
Larger or riskier changes that should not touch the main working tree, or when you want to keep
working in the main workspace while the agent operates in the worktree. Skip it for trivial edits.
````
