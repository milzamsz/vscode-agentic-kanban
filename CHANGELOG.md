# Changelog

All notable changes to Agentic Kanban will be documented here.

## [1.6.2] - 2026-06-23

- **Parameterized lane sweeps**: `@kanban /sweep [lane]` now supports `--label=`, `--priority=`, and `--pack=`/`--stack=` filtering flags
- **First-class Stack Packs**: dynamic stack pack configurations (`packs.yaml`) for Odoo, Web, Python API, Go, and Frappe automatically seeded on initialize
- **Always-on Project Skills**: Union of project and active pack skills dynamically synced directly into the `AGENTS.md` managed sentinel
- **Dynamic Prompt Interpolation**: prompts under `.agentkanban/prompts/` are now automatically populated with stack-specific coverage requirements and verify commands
- **New `/pack` Command**: command routing for listing packs (`/pack list`) and setting the active pack (`/pack use <name>`)

## [1.6.1] - 2026-06-22

- **Dependabot baseline** (`.github/dependabot.yml`): weekly grouped npm + GitHub Actions updates
- **Profile-aware prompt scaffolding**: Lite workspace no longer receives Standard-only stage prompts; `getWorkflowPrompt()`, `buildAgentsMdSection()`, `scaffoldPrompts()` are now profile-aware
- **Resilient board search input**: debounced live search, Enter immediate commit, focus retention across re-renders
- **Workflow doctor diagnostics**: new `@kanban /doctor` command reporting lane drift, stale blockers, dependency cycles, stale worktrees, spec drift, and orphaned deps
- **Structured evidence completion gates**: `TaskEvidence` frontmatter with validator; `review → done` now requires evidence with `ran: true, passed: true`
- **Task lifecycle fields**: `parent`, `superseeds`, `superseededBy`, `blockerResolved` in frontmatter
- **README**: dependency management section added

## [1.6.0] - 2026-06-17

- Add a visual dependency graph dialog to the Kanban board, rendering task connections and supporting details navigation.
- Implement configurable transition policies (`requireChecklistForInProgress`, `requireSpecForInProgress`, etc.) in `board.yaml`.
- Integrate automatic verification check execution (test, lint, and build commands) when moving tasks from `in-progress` to `review` on the board.
- Introduce the `@kanban /sweep [lane]` chat command to automatically run verification policies against all ready tasks in a lane, advancing passing tasks and marking failing ones as blocked.
- Enhance board search/filter keyboard shortcuts (Cmd/Ctrl+K to focus, Escape to clear queries).

## [1.5.0] - 2026-06-17

- Bundle stage-driver prompts: written to `.agentkanban/prompts/` on init (missing files only, so edits survive) and refreshable with `@kanban /prompts`. Includes an autonomous `planning → review` driver plus intake, planning, review, revise, blocked, and production-readiness prompts.
- Add a WIP limit (`wipLimits` in board.yaml; default `in-progress: 1` for the Standard profile). Moving a task into a full lane is blocked (strict) or warned (warn), with the usual human-override path.
- Update the bundled `INSTRUCTION.md`: `in-progress` is not a separate human gate — an approved task can run hands-off to `review`; the human gates are plan approval and `review → done`. Removed a duplicate execution rule.

## [1.4.0] - 2026-06-16

- Surface spec-driven checklists on the board: the checklist button now opens `<change>/tasks.md` when a task has a `change`, falling back to `todo_<id>.md` otherwise.
- Show a `SPEC` indicator, a `done/total` checklist-progress badge, and a `⚠` badge (missing `change` folder / `spec` file, or a lane outside the active profile) on task cards.
- Treat `change`, `spec`, and `dependsOn` as first-class frontmatter keys (typed, ordered) instead of opaque extras; existing files keep round-tripping.
- Realign `@kanban /spec` to the capability-spec model: it writes one shared `.agentkanban/specs/<capability>/spec.md`, links the task via both `change` and `spec` frontmatter, and no longer scaffolds a nested `changes/<slug>/specs/` delta.
- Refresh the bundled spec templates (proposal / design / spec / tasks) to the behavior-and-acceptance shape; spec is a living contract, not an OpenSpec delta.
- Add `@kanban /archive [slug]` to move a completed change folder to `changes/archive/`, leaving the shared capability spec in place.
- Fold tasks with a lane outside the active profile into the last lane instead of dropping the card.

## [1.3.2] - 2026-06-16

- Prepend a documented reference comment header to serialized `board.yaml` configuration files, detailing profile settings, enforcement rules, and reviewer roles.

## [1.3.1] - 2026-06-16

- Wire `enforcement` and `reviewPolicy` configurations to make them functional in board lane transitions.
- Add strict vs. warning-based transition validation, returning structured transition blocker reasons.
- Support capture of human override reasons via input boxes, logging them as comments in task files.
- Inject live `enforcement` and priority-aware `reviewPolicy` context into managed `AGENTS.md` instructions.
- Add setting option for default board enforcement mode (`agentKanban.enforcementMode`).

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
