---
name: agentic-kanban
description: Use when developing, reviewing, packaging, rebranding, or validating the Agentic Kanban VS Code extension (the vscode-agentic-kanban repo). Covers the lane/checklist workflow model, spec-driven development via /spec, batch lane sweeps with a task-dependency guardrail, the AGENTS.md managed-sentinel rules, the Agent Kanban → Agentic Kanban branding rules, and the lint/test/build/VSIX release pipeline.
license: Elastic-2.0
metadata:
  author: milzam
  version: 1.0.0
---

# Agentic Kanban

Work guide for the **Agentic Kanban** VS Code extension — a profile-driven Kanban board that drives AI-assisted development through persistent markdown task files. The extension was renamed from **Agent Kanban**; branding consistency and a clean VSIX are recurring concerns.

Repo root (this machine): `C:\Workspace\tools\vscode-agentic-kanban`.

## Read first, always

Before changing anything, read these in order — they are the source of truth:

1. `README.md` — product overview, workflows, chat commands.
2. `AGENTS.md` — your role + the managed sentinel block.
3. `TECHNICAL.md` — architecture, service responsibilities, sentinel internals.
4. `.agentkanban/INSTRUCTION.md` — the live workflow rules the extension injects.

Never speculate about code you have not opened. Investigate before answering.

## Core rules

- **`TODO` is a checklist artifact, not a lane.** It lives in `todo_*.md` files as `- [ ]` / `- [x]` items. Spec-driven tasks use `.agentkanban/changes/<slug>/tasks.md` instead. See [references/workflow.md](references/workflow.md).
- **Lanes are fixed per profile.** Lite: `backlog -> in-progress -> done`. Standard: `backlog -> planning -> in-progress -> review -> done`. General blockers stay on the card as a `blocked` label; task dependencies use `blocked-by:<slug>`.
- **Identifiers stay stable.** Command IDs (`agentKanban.*`), config keys (`agentKanban.*`), the chat participant id, the `.agentkanban/` directory, and the `agentkanban/` git branch prefix are kept for compatibility. Do NOT rename them as part of branding work unless a migration is explicitly planned.
- **Branding target is `Agentic Kanban`.** User-visible copy says "Agentic Kanban". The runtime log file is `agentic-kanban.log`. See [references/branding-and-packaging.md](references/branding-and-packaging.md).
- **Managed sentinels:** new output uses `<!-- BEGIN AGENTIC KANBAN — DO NOT EDIT THIS SECTION -->` … `<!-- END AGENTIC KANBAN -->`. Code must still *read and replace* the legacy `AGENT KANBAN` markers (upgrade in place) but must only ever *write* the new ones.
- **Respond in the task file**, not the chat window, when operating inside the workflow itself. Use explicit lane transitions; never change a lane implicitly.
- **Stage prompts are lane sweeps.** They process ALL ready tasks in a lane in one pass (parallel where independent), not one at a time — built for agentic AI development. See [references/batch-and-dependencies.md](references/batch-and-dependencies.md).
- **Task dependencies via `dependsOn` frontmatter** (authoritative; preserved across saves by the `extras` round-trip in `TaskStore`) **+ a `blocked-by:<slug>` label** for board visibility. Reference tasks by slug. A task is *ready* only when every dependency is in `done` (the guardrail). See [references/batch-and-dependencies.md](references/batch-and-dependencies.md).
- **Discovered tasks → `backlog`.** New work found mid-sweep is created in `backlog` with a `discovered` label + back-reference; it never derails the current pass.
- **No em dashes in product copy** (UI or docs), except the existing sentinel marker string which uses `—` and must be matched verbatim.

## Spec-driven tasks

- Spec-driven tasks own `.agentkanban/changes/<slug>/`.
- The task frontmatter stores `change: .agentkanban/changes/<slug>`.
- `tasks.md` is the authoritative checklist for spec-driven tasks.
- Accepted deltas merge into `.agentkanban/specs/` when the task reaches `done`.
- See [references/sdd-workflow.md](references/sdd-workflow.md).

## Workflow model

- Lane model, checklist semantics, review rules, blocked/resume, context injection, worktree flow → [references/workflow.md](references/workflow.md).
- Batch lane sweep, task dependencies (guardrail), mid-work discovery, parallel-where-independent, loop-until-dry → [references/batch-and-dependencies.md](references/batch-and-dependencies.md).
- Cross-cutting run rules (start ritual, verify gate, TDD loop, Always/Never, key definitions) → [references/conventions.md](references/conventions.md).

## Template prompts

Paste-ready prompt templates that drive work on the board. Fill the variables, then paste.

**Orchestration**
- Whole project, zero → production (stack-agnostic scaffold) → [references/lifecycle-prompt.md](references/lifecycle-prompt.md).
- Run an active task or a whole lane this session (single-task or lane-sweep execution driver) → [references/run-development-prompt.md](references/run-development-prompt.md).

**Stage drivers (lane sweeps — process all ready tasks in the lane)**
- New idea/bug → well-formed task → [references/new-task-intake.md](references/new-task-intake.md).
- Sweep `backlog → planning` (all tasks: discovery + plan + checklist) → [references/stage-backlog-to-planning.md](references/stage-backlog-to-planning.md).
- Sweep `planning → in-progress` (all approved tasks: kick off implementation) → [references/stage-planning-to-in-progress.md](references/stage-planning-to-in-progress.md).
- Sweep `review → in-progress` (all revise-required tasks: resume implementation) → [references/stage-review-to-in-progress.md](references/stage-review-to-in-progress.md).
- Sweep `in-progress → review` (all done tasks: implementation review gate) → [references/stage-in-progress-to-review.md](references/stage-in-progress-to-review.md).
- Sweep `review → done` (all approved tasks: release & handover) → [references/stage-review-to-done.md](references/stage-review-to-done.md).
- Block a task / sweep `blocked` to resume cleared tasks → [references/stage-blocked-and-resume.md](references/stage-blocked-and-resume.md).

**Utilities**
- Bug-fix fast path (Lite profile) → [references/bugfix-fast-path.md](references/bugfix-fast-path.md).
- Worktree operations (create/open/merge/remove) → [references/worktree-ops.md](references/worktree-ops.md).
- Production-readiness audit (gate before `done`) → [references/production-readiness-audit.md](references/production-readiness-audit.md).
- Stack packs (drop-in `<stack skill>` blocks: Odoo, web, API, Go, Frappe) → [references/stack-packs.md](references/stack-packs.md).

## Branding, release & packaging

When the request mentions release, rename, branding, artifact drift, or packaging: make the edits per the
branding rules, run the release pipeline (`npm run lint` → `npm test` → `npm run build` → `npx @vscode/vsce
package`), then inspect the packaged VSIX for stray legacy branding. Full rename rules, the release pipeline,
the search-validation regex, and the VSIX verification checklist are in [references/branding-and-packaging.md](references/branding-and-packaging.md).

## Verification before any "done" claim

- Lint, tests, build, and (for release/branding work) `vsce package` all pass.
- `rg "Agent Kanban|AGENT KANBAN|agent-kanban\.log"` over `src/` and root docs returns only intentional legacy-compat hits.
- The VSIX file list and bundled markdown show only `Agentic Kanban`.
- State plainly what passed and what was skipped. If a step failed, show the output.
