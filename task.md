# Tasks: native SDD MVP

Status: [x] done / [ ] pending

## Part A - Extension

- [x] Add `/spec` to the chat participant command list and implement `handleSpec()`.
- [x] Scaffold profile-aware spec templates under `.agentkanban/changes/<task-slug>/`.
- [x] Persist `change: .agentkanban/changes/<task-slug>` through task frontmatter.
- [x] Extend AGENTS.md task-aware context with linked spec artifacts.
- [x] Add focused tests for `/spec` scaffolding and AGENTS context.

## Part B - Skill

- [x] Add `references/sdd-workflow.md`.
- [x] Update the skill core rules for spec-driven tasks and `tasks.md` ownership.
- [x] Remove stale blocked-lane and `resumeLane` guidance.
- [x] Mirror the canonical skill and repo-local skill so `diff -r` is clean.

## Part C - Repo Deliverables

- [x] Add `PLAN.md`.
- [x] Refresh `task.md` for the SDD MVP.
- [x] Update `README.md`, `TECHNICAL.md`, `assets/INSTRUCTION.md`, and `CHANGELOG.md`.
- [ ] Manual VS Code workflow check for `/task` -> `/spec` in the running extension.

## Part D - Skill rename + alignment

- [x] Rename the skill `agentic-kanban-repo` -> `agentic-kanban` (dir, SKILL.md `name`, `agents/openai.yaml`).
- [x] Re-point the `.codex` / `.claude` / `.antigravity` symlinks to the new canonical skill.
- [x] Align skill content to the current model (single `review`, no `blocked` lane, blocked-as-label, no `resumeLane`/`reviewType`); rename `stage-planning-to-review.md` -> `stage-planning-to-in-progress.md`.
- [x] Re-sync canonical and repo-local skills so `diff -r` is identical.
- [x] Remove the locked orphan `.agents/skills/agentic-kanban-repo/references` folder once the watching process releases it (no `SKILL.md`, so not a live skill).

## Follow-ups (deferred)

- [x] `/spec` AGENTS sentinel: gate the `Spec Delta` pointer to Standard profile and substitute the real `<capability>` (currently always emitted with a literal placeholder).
- [x] Confirm whether the enhanced "Active Task" sentinel writing in the main workspace (every `/task`) is intended; update `README.md`/`TECHNICAL.md` if so.
