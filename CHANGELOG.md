# Changelog

All notable changes to Agentic Kanban will be documented here.

## [1.3.0] - 2026-06-16

- Expose board profile and worktree configuration options in VS Code settings.
- Seed new `board.yaml` files from user settings.
- Add "Apply Settings to Board Config" command to update existing boards with a modal confirmation safeguard for potential lane conflicts.
- Wire `agentKanban.enforceWorktrees` setting into the `/refresh` workflow as a soft gate.
- Centralize workspace settings resolution and add helper test suites.

## [1.2.0] - 2026-06-15

- Add opt-in spec-driven development with `@kanban /spec`.
- Scaffold OpenSpec-compatible change artifacts under `.agentkanban/changes/<task-slug>/`.
- Persist task-to-change links through frontmatter as `change: .agentkanban/changes/<task-slug>`.
- Extend AGENTS.md task context so linked spec artifacts are re-read across turns.
- Add bundled spec templates and documentation for the MVP workflow.
- Publish a comprehensive source-available project README and align repository and release metadata.

## [1.0.0] - 2026-06-15

- Fork release for Agentic Kanban under independent versioning.
- Standard workflow no longer uses a dedicated `blocked` lane. Blockers stay visible on the task card through `blocked` and `blocked-by:<slug>` labels.
- Legacy `lane: blocked` tasks automatically migrate back to `resumeLane` or `backlog` when reopened.
- Task frontmatter keeps unknown metadata such as `dependsOn` across saves, and blocked dependency labels render with warning styling on the board.

## [2.0.0] - 2026-03-12

- Major change to support Git worktree based workflows, leveraging VS Code support for Git worktrees
- `/plan`, `/todo`, `/implement` `@kanban` participant commands are gone in favour of `/refresh` for non worktree based workflow
- Automatic commit of tasks when creating Git worktrees (for availability in new worktree)
- Documentation updated

## [1.0.5] - 2026-03-11

- Bump esbuild version on dependabot alert

## [1.0.4] - 2026-03-11

- Fix side bar / board focus behaviour

## [1.0.3] - 2026-03-10

- Bugfix: Agent should not initialise workspace automatically - requires user action.

## [1.0.2] - 2026-03-10

- Bugfix: Fix task editor close on mouse event bug.

## [1.0.1] - 2026-03-10

- Chore: Bump releases.

## [1.0.0] - 2026-03-09

- Feature: Directory based task / lane synchronisation to prevent a large singe `tasks` directory
- Feature: Layered agent instruction approach

## [0.3.0] - 2026-03-09

- Feature: Major UI overhaul - board moved to editor tab from side bar

## [0.2.1] - 2026-03-07

### Added

- Chore: Name bump
- Feature: Release polish

## [0.1.2] - 2026-03-07

### Added

- Chore: Extension `.gitignore` under `.agentkanban`
- Feature: Re-ordering swimlanes with deletion rules

## [0.1.1] - 2026-03-07

### Added

- Feature: Initial release.
