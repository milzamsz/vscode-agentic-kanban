# Template prompt - full lifecycle development via Agentic Kanban

Reusable, stack-agnostic prompt template for driving a project from zero to production-ready on the Agentic Kanban board (Standard profile). Fill the variables, paste into the agent.

````markdown
# TEMPLATE PROMPT - Full Lifecycle Development via Agentic Kanban

## Variables (fill first)
- Project/app: `<name>`
- Goal: `<1-2 sentence business outcome>`
- Stack: `<framework/language, e.g. Odoo 19 / FastAPI / Next.js>`
- Profile: `<Standard | Lite>`
- Deploy target: `<docker / cloud / on-prem>`
- Constraints: `<deadline, compliance, multi-tenant, etc.>`

## Role
Senior engineer. Build `<name>` from zero to production-ready, driven by the **Agentic Kanban** extension.
Work happens inside the task file (`.agentkanban/tasks/task_*.md`), not the chat window.
Chat window: summaries + `@kanban` commands only.

## Read first (always)
`README.md` -> `AGENTS.md` -> `TECHNICAL.md` -> `.agentkanban/INSTRUCTION.md`.
Never speculate about code you have not opened.

## Skills
- `agentic-kanban` - lane/checklist/sentinel/review rules.
- `brainstorming` - before any coding (explore intent + design).
- `<stack skill>` - e.g. `odoo-19`, `fastapi-expert`, `shadcn`. Pick per stack.
- `code-review` - gate before every transition to `done`.
- `<optional>` - performance/upgrade/testing skills as needed.

## Workflow rules (Standard profile)
Lanes: `backlog -> planning -> in-progress -> review -> done`.
Blockers stay on the task as `blocked` or `blocked-by:<slug>` labels.
Lane model + action vocab: [workflow.md](workflow.md). Run rules (transitions, gates, Always/Never): [conventions.md](conventions.md).

## Lifecycle - break into board tasks

> For a real project, create one task per deliverable (not a single mega-task) and run each phase below as a
> lane sweep: process all ready tasks in that lane in one pass, parallel where independent, respecting
> task dependencies, capturing discovered work into `backlog`. See [batch-and-dependencies.md](batch-and-dependencies.md)
> and the matching `stage-*.md` driver for each transition.

### 0. Bootstrap
```
@kanban /new <name>: full lifecycle
@kanban /task <name>
```
Pick the profile. Record all Variables in the task file + `.agentkanban/memory.md`.

### 1. Discovery (`backlog -> planning`) - action: `plan`
`brainstorming`: actors, use-cases, acceptance criteria, scope in/out, risks.
Output in task file: scope + deliverable list.

### 2. Design & Plan (`planning`) - action: `plan` + `checklist`
Architecture, data model, API/interface contracts, security model, test strategy, dependencies.
`checklist`: break the plan into ordered work items.
Move to `in-progress` only when the plan is explicitly approved.

### 3. Implement (`in-progress`) - action: `implement`
```
@kanban /worktree
```
TDD (`red -> green -> refactor`) per the stack skill. Per item:
scaffold -> core logic -> security/validation -> UI/views -> integration -> seed/i18n -> migration (if any).
Update `checklist` as each item lands.

### 4. Quality Gate (`in-progress -> review`) - action: `review`
Run the full verify gate from [conventions.md](conventions.md) (`lint`, `test`, `build` + code-review + security + performance + edge cases + docs).
Then implementation review. OK -> `done`; else -> back to `in-progress`.

### 5. Production Readiness (before final `done`)
Run the [production-readiness-audit.md](production-readiness-audit.md) gate. Any unresolved fail on
correctness, security, or reliability blocks `done`.

### 6. Release & Handover (`done`)
Summarize results in the task file. If asked: commit, tag, package, deploy. Archive the task; clean up the worktree.

## Blocked
On hitting a blocker: action `block` -> record the blocker and add `blocked` or `blocked-by:<slug>` labels, then wait.
Action `unblock` -> clear the labels and continue.

## Done rule
Claim done only with evidence: tests/build/review green, checklist complete, production checklist done.
If any step failed or was skipped, state it explicitly and show the output.
````

## Lite-profile variant
For small tasks, collapse to Lite (`backlog -> in-progress -> done`): merge Discovery + Design into a short `backlog` note, skip the dual reviews, keep the Quality Gate and Production Readiness checks before `done`.

## Notes
- Swap the `<stack skill>` line for the matching installed skill.
- Worktree flow (step 3) is optional for small changes; use it for larger or riskier work so the main workspace stays clean.
