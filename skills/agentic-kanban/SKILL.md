---
name: agentic-kanban
description: Use when developing, reviewing, packaging, rebranding, or validating the Agentic Kanban VS Code extension (the vscode-agentic-kanban repo). Covers the lane/checklist workflow model, spec-driven development via /spec, batch lane sweeps with a task-dependency guardrail, the AGENTS.md managed-sentinel rules, the Agent Kanban → Agentic Kanban branding rules, and the lint/test/build/VSIX release pipeline.
license: Elastic-2.0
metadata:
  author: milzam
  version: 1.2.0
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
- **`in-progress` is not a human gate.** The autonomous `planning -> review` driver runs implementation hands-off; the two human gates are plan approval (`planning`) and `review -> done`. Real blockers are labeled and parked, never forced.
- **WIP limit.** `wipLimits` in board.yaml caps tasks per lane (default Standard `in-progress: 1`); a move into a full lane is blocked (strict) or warned (warn). Work serially.
- **Worktrees are optional** unless `worktreePolicy.requiredForImplementation` is true. The default is optional.
- **Definition of Done (evidence gate):** behavior proven to run (test output / real run / workflow or job id), not a status write. Run the production-readiness audit before `done`. When `requireDoneChecklistForDone` is on (standard profile default), the task body must also contain a `## Definition of Done` section with all items checked; items tagged `(human)` require a human actor.
- **Chat commands:** `/new`, `/task`, `/refresh`, `/spec [capability]`, `/worktree`, `/archive [slug]`, `/prompts`. `/prompts` (re)writes the bundled stage-driver prompts into `.agentkanban/prompts/` (also auto-scaffolded on init, missing-only).
- **Identifiers stay stable.** Command IDs (`agentKanban.*`), config keys (`agentKanban.*`), the chat participant id, the `.agentkanban/` directory, and the `agentkanban/` git branch prefix are kept for compatibility. Do NOT rename them as part of branding work unless a migration is explicitly planned.
- **Branding target is `Agentic Kanban`.** User-visible copy says "Agentic Kanban". The runtime log file is `agentic-kanban.log`. See [references/branding-and-packaging.md](references/branding-and-packaging.md).
- **Managed sentinels:** new output uses `<!-- BEGIN AGENTIC KANBAN — DO NOT EDIT THIS SECTION -->` … `<!-- END AGENTIC KANBAN -->`. Code must still *read and replace* the legacy `AGENT KANBAN` markers (upgrade in place) but must only ever *write* the new ones.
- **Respond in the task file**, not the chat window, when operating inside the workflow itself. Use explicit lane transitions; never change a lane implicitly.
- **Stage prompts are lane sweeps.** They process ALL ready tasks in a lane in one pass (parallel where independent), not one at a time — built for agentic AI development. See [references/batch-and-dependencies.md](references/batch-and-dependencies.md).
- **Task dependencies via `dependsOn` frontmatter** (authoritative; preserved across saves by the `extras` round-trip in `TaskStore`) **+ a `blocked-by:<slug>` label** for board visibility. Reference tasks by slug. A task is *ready* only when every dependency is in `done` (the guardrail). See [references/batch-and-dependencies.md](references/batch-and-dependencies.md).
- **Discovered tasks → `backlog`.** New work found mid-sweep is created in `backlog` with a `discovered` label + back-reference; it never derails the current pass.
- **No em dashes in product copy** (UI or docs), except the existing sentinel marker string which uses `—` and must be matched verbatim.

## Spec-driven tasks

- Spec-driven tasks own `.agentkanban/changes/<slug>/` (proposal/design/tasks) and reference a shared capability spec.
- Frontmatter stores `change: .agentkanban/changes/<slug>` + `spec: .agentkanban/specs/<capability>/spec.md`.
- The capability spec (`specs/<capability>/spec.md`: behavior + acceptance criteria + verification) lives once and is referenced, not duplicated per change. `tasks.md` is the authoritative checklist.
- `@kanban /archive [slug]` moves a finished change to `changes/archive/`; the capability spec stays.
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
- **Default (autonomous):** carry approved `planning` tasks through `in-progress` to `review` in one hands-off pass; serial (WIP=1); blockers labeled + parked -> [references/stage-planning-to-review.md](references/stage-planning-to-review.md). Runs the `planning->in-progress->review` steps inline (no separate prompts for those middle transitions).
- New idea/bug → well-formed task → [references/new-task-intake.md](references/new-task-intake.md).
- Sweep `backlog -> planning` (discovery + plan + checklist) -> [references/stage-backlog-to-planning.md](references/stage-backlog-to-planning.md).
- Revise: send a review-rejected task back to implementation → [references/stage-review-to-in-progress.md](references/stage-review-to-in-progress.md).
- `review -> done` (human gate: production-readiness + release & handover) -> [references/stage-review-to-done.md](references/stage-review-to-done.md).
- Block a task / sweep `blocked` to resume cleared tasks → [references/stage-blocked-and-resume.md](references/stage-blocked-and-resume.md).

These drivers are bundled by the extension as `assets/prompts/*` and scaffolded to a workspace's `.agentkanban/prompts/` on init (refresh with `@kanban /prompts`).

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
