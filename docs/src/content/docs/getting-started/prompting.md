---
title: Prompting
description: Copy-paste prompt templates to drive Agentic Kanban from a PLAN.md.
---

**Agentic Kanban** is a structured workflow for agent-driven development. These prompt templates teach a coding agent how to transform your `PLAN.md` into a fully implemented repository while respecting the Agentic Kanban lifecycle.

The authoritative source hierarchy understood by these prompts:

1. `.agentkanban/INSTRUCTION.md` -- canonical workflow rules
2. `AGENTS.md` / `CLAUDE.md` -- user-authored agent instructions
3. `PLAN.md` -- your product requirements
4. `.agentkanban/specs/` -- capability specifications
5. Existing source code, tests, configuration, and documentation

---

## Choosing a Profile and Governance Model

### Workflow Profile

| Profile | Lane Flow | Best For |
| --- | --- | --- |
| **Lite** | `backlog -> in-progress -> done` | Small changes, fast iterations, solo work |
| **Standard** | `backlog -> planning -> in-progress -> review -> done` | Larger projects, multi-agent, structured delivery |

### Governance Model

| Model | Checkpoint | Best For |
| --- | --- | --- |
| **Human-Governed** | Agent stops after planning for approval | When you want to review the plan before any code is written |
| **Autonomous** | Agent self-approves unambiguous plans | Small repositories, crystal-clear requirements, experienced users |

---

## Standard Profile -- Human-Governed

Use this prompt when you want the agent to create a full backlog and planning artifacts, then stop for your approval before any implementation begins.

Paste the entire block into your chat, then review the planning output before running the **Continue** prompt below.

```text
Implement this repository completely from `PLAN.md` using the Agentic Kanban workflow.

Treat these sources as authoritative, in this order:

1. `.agentkanban/INSTRUCTION.md`
2. User-authored repository instructions such as `AGENTS.md`, `CLAUDE.md`, or equivalent
3. `PLAN.md`
4. Existing specifications under `.agentkanban/specs/`
5. Existing source code, tests, configuration, migrations, and documentation

Use the Standard workflow profile:

`backlog -> planning -> in-progress -> review -> done`

## Core objective

Transform the requirements in `PLAN.md` into a complete, tested, documented, and release-ready repository without bypassing any Agentic Kanban workflow rule.

## Step 1: Inspect the repository

Before creating or changing anything:

* read the complete `PLAN.md`;
* inspect the existing repository structure and implementation;
* inspect all active and archived Agentic Kanban tasks;
* inspect existing canonical specifications and change artifacts;
* identify what is complete, partial, missing, obsolete, duplicated, or conflicting;
* preserve working behavior unless `PLAN.md` explicitly replaces it;
* record assumptions and unresolved decisions.

Do not implement production code during this step.

## Step 2: Build the implementation backlog

Convert `PLAN.md` into outcome-based Agentic Kanban tasks.

Task rules:

* create vertical, independently testable delivery slices;
* do not create one task per file;
* do not create vague tasks such as "Build backend" or "Implement frontend";
* preserve meaningful phases and milestones from `PLAN.md`;
* split tasks that are too large to plan, implement, and review safely;
* assign priority based on dependency order, risk, and user value;
* define explicit `dependsOn` relationships;
* treat `dependsOn` as authoritative;
* mirror task dependencies with `blocked-by:<task-slug>`;
* use `blocked` only for external blockers;
* identify tasks that may safely run in parallel;
* include measurable acceptance criteria;
* include testing, migration, security, accessibility, performance, observability, deployment, and documentation requirements where relevant.

Every task must contain enough context to remain understandable in a future agent session.

## Step 3: Create specification artifacts

For every non-trivial task, attach Standard-profile spec artifacts:

* `proposal.md`
* `design.md`
* `tasks.md`
* `specs/<capability>/spec.md`

### proposal.md

Define:

* problem;
* business or user value;
* scope;
* non-scope;
* constraints;
* dependencies;
* assumptions;
* risks;
* success criteria.

### design.md

Define:

* architecture;
* components and boundaries;
* interfaces and contracts;
* data flow;
* storage and migrations;
* security model;
* error and failure handling;
* local, preview, staging, and production behavior;
* backward compatibility;
* rollback strategy;
* testing approach;
* affected files or modules.

### Delta specification

Write testable requirements using:

* `### Requirement:`
* `#### Scenario:`
* GIVEN / WHEN / THEN statements.

### tasks.md

Create an ordered, authoritative implementation checklist.

Each checklist item must be:

* concrete;
* independently verifiable;
* ordered by dependency;
* checked only after implementation and verification.

## Step 4: Planning approval checkpoint

Move ready backlog tasks into `planning` and complete their artifacts.

Do not move any task from `planning` to `in-progress` until:

* the proposal is complete;
* the design is internally consistent;
* acceptance scenarios are testable;
* the checklist is complete;
* dependencies are correctly modeled;
* risks and migration impacts are documented.

After planning the first ready implementation batch, stop and return:

1. Repository gap analysis.
2. Complete task backlog.
3. Dependency graph.
4. Tasks that can run in parallel.
5. Planned first execution batch.
6. Decisions requiring human approval.
7. Risks and external blockers.
8. A clear request for planning approval.

Do not implement production code before approval.
```

### Continue After Planning Approval

After you have reviewed and approved the planning output, continue with this prompt to execute the approved plan:

```text
Continue implementing `PLAN.md` from the approved Agentic Kanban backlog and planning artifacts.

Follow `.agentkanban/INSTRUCTION.md` exactly.

You are authorized to process all ready tasks through:

`planning -> in-progress -> review -> done`

Do not bypass lanes, dependency guardrails, worktree requirements, review, or completion rules.

## Readiness rules

A task may enter implementation only when:

* all tasks listed in `dependsOn` are in `done`;
* no unresolved external blocker exists;
* its proposal, design, delta specification, and `tasks.md` are complete;
* planning has been approved;
* the implementation scope is internally consistent.

If a prerequisite is missing, do not implement the task. Correct its dependencies or mark the blocker.

## Execution strategy

* process tasks in dependency order;
* process independent tasks in parallel only when their files, migrations, infrastructure, and specifications do not conflict;
* process dependent chains sequentially;
* keep every task isolated in its own task record, artifacts, branch, worktree, commits, and verification evidence;
* do not merge unrelated tasks;
* do not modify another task's scope merely because it is convenient.

## For every ready task

### 1. Select and refresh context

Read:

* `.agentkanban/INSTRUCTION.md`;
* the selected task;
* its dependencies;
* proposal;
* design;
* delta specification;
* `tasks.md`;
* relevant canonical specifications;
* repository instructions;
* relevant existing implementation.

Confirm the approved design is still valid.

### 2. Create or open the required worktree

For Standard-profile implementation:

* use the task-specific Agentic Kanban worktree;
* work only in that isolated branch;
* do not implement a Standard task directly on the main workspace unless the canonical workflow explicitly allows it.

### 3. Implement

* implement only the approved task scope;
* follow `tasks.md` in dependency order;
* reuse existing repository patterns before creating abstractions;
- prefer platform and framework standards over custom infrastructure;
* preserve backward compatibility unless explicitly excluded;
* never hardcode credentials, secrets, production IDs, URLs, or environment-specific values;
* update schemas, types, migrations, environment examples, tests, and documentation where required;
* provide secure failure behavior and actionable errors;
* include accessibility, i18n, performance, security, and observability requirements where applicable;
* run focused verification after each meaningful checklist group;
* check an item only after it is implemented and verified;
* record important decisions and evidence in the task conversation.

If implementation reveals an invalid design:

* stop;
* document the conflict;
* return the task to `planning`;
* update the design and specification;
* do not silently redesign while coding.

If blocked externally:

* add the `blocked` label;
* record evidence and required human action;
* continue with other ready tasks.

### 4. Review

Move the task to `review` only after its implementation checklist is complete.

Review against:

1. Task description.
2. Acceptance criteria.
3. Proposal.
4. Design.
5. Delta specification.
6. Every `tasks.md` item.
7. Canonical repository specifications.
8. `PLAN.md`.
9. Repository conventions.

The review must:

* inspect the complete diff;
* detect scope drift;
* detect unnecessary abstractions;
* verify security and authorization boundaries;
* verify validation and failure behavior;
* verify migrations and rollback implications;
* verify accessibility and i18n where applicable;
* verify documentation and environment examples;
* check for leaked secrets, debug code, placeholders, and temporary configuration;
* run formatting;
* run linting;
* run type checks;
* run unit tests;
* run integration tests;
* run relevant E2E tests;
* run the production build.

Fix straightforward defects inside the approved scope and rerun affected verification.

For design-level defects, return the task to `planning` or `in-progress`. Do not approve it.

### 5. Complete

Move a task to `done` only when:

* every acceptance criterion is satisfied;
* every checklist item is complete;
* review is approved;
* all required verification passes;
* documentation is updated;
- no unresolved blocker remains.

Then:

* archive the task change artifacts according to the workflow;
* merge accepted delta requirements into canonical specifications;
* record final implementation and verification evidence;
* merge the task branch through the repository's normal Git flow;
* remove the worktree only after the branch is safely integrated.

## Batch behavior

After completing a task:

* recalculate which tasks are ready;
* continue with the next dependency-ready task;
* do not stop the entire run because one task is externally blocked;
* run repository-wide verification after each logical batch;
* update backlog dependencies when new technical prerequisites are discovered.

## Completion condition

Continue until:

* all implementable `PLAN.md` tasks are in `done`; or
* remaining tasks are blocked by documented external actions.

At the end, perform a release-readiness audit and return:

1. Completed tasks.
2. Blocked tasks and required actions.
3. PLAN.md coverage matrix: `requirement -> task -> specification -> implementation -> test`.
4. Commands and tests executed.
5. Migration and deployment status.
6. Security and operational risks.
7. Remaining follow-up work.
8. Final verdict: `READY FOR RELEASE` or `NOT READY`.
```

---

## Standard Profile -- Autonomous

Use this prompt when the agent may plan and implement without waiting for manual approval at the planning gate. The agent still passes through all lanes -- it self-approves only when the requirement is unambiguous, no destructive migration is involved, and no product decision is missing.

```text
Implement the entire repository from `PLAN.md` using the Agentic Kanban Standard workflow.

Follow `.agentkanban/INSTRUCTION.md` as the canonical workflow authority.

Use:

`backlog -> planning -> in-progress -> review -> done`

You are authorized to approve a task's planning artifacts yourself only when:

* the requirement is unambiguous;
* no product decision is missing;
* no destructive migration requires human approval;
* no security-sensitive assumption is unresolved;
* the design is consistent with `PLAN.md` and the existing repository.

If any of those conditions is false, mark the task blocked, document the decision required, and continue with other ready tasks.

## Required process

1. Inspect `PLAN.md`, repository instructions, existing implementation, active tasks, archived tasks, specifications, tests, migrations, and documentation.
2. Produce a gap analysis.
3. Convert every implementable requirement into outcome-based Agentic Kanban tasks.
4. Define explicit `dependsOn` relationships and blocker labels.
5. Attach Standard spec artifacts to every non-trivial task.
6. Complete proposal, design, delta specification, and authoritative `tasks.md`.
7. Approve planning only when the authorization conditions above are satisfied.
8. Create a task-specific worktree before Standard-profile implementation.
9. Implement strictly from approved artifacts.
10. Check off `tasks.md` only after verification.
11. Move each completed implementation to review.
12. Perform strict review against the task, artifacts, canonical specifications, and `PLAN.md`.
13. Fix in-scope defects and rerun verification.
14. Return design defects to planning instead of hiding them.
15. Move a task to done only after all acceptance criteria and verification pass.
16. Archive accepted change artifacts.
17. Merge accepted delta requirements into canonical specifications.
18. Recalculate ready tasks and continue in dependency order.
19. Run independent, non-conflicting tasks in parallel when safe.
20. Perform a final release-readiness audit.

## Non-negotiable rules

* Do not skip lanes.
* Do not ignore `dependsOn`.
* Do not implement blocked tasks.
* Do not combine unrelated tasks.
* Do not create one task per file.
* Do not mark unverified work complete.
* Do not weaken tests to obtain a passing build.
* Do not hardcode secrets or production configuration.
* Do not silently change approved architecture.
* Do not leave accepted delta specifications unmerged.
* Do not claim release readiness while required tasks remain incomplete.
* Preserve user-authored repository instructions outside managed Agentic Kanban sections.

## Verification

For each task, run all applicable:

* formatting;
* linting;
* static analysis;
* type checks;
* unit tests;
* integration tests;
* E2E tests;
* migration checks;
* security checks;
* accessibility checks;
* production build.

## Final output

Return:

1. Repository gap analysis.
2. Created tasks and dependency graph.
3. Tasks completed.
4. Tasks blocked and exact human action required.
5. Key architecture decisions.
6. PLAN.md coverage matrix: `requirement -> task -> specification -> implementation -> test`.
7. Full verification summary.
8. Migration and deployment notes.
9. Residual risks.
10. Final verdict: `READY FOR RELEASE` or `NOT READY`.
```

---

## Lite Profile -- Human-Governed

Use this prompt for smaller projects where the Lite profile is active. The agent creates a backlog and lightweight planning, then stops for your approval.

```text
Implement this repository from `PLAN.md` using the Agentic Kanban Lite workflow.

Treat these sources as authoritative, in this order:

1. `.agentkanban/INSTRUCTION.md`
2. User-authored repository instructions such as `AGENTS.md`, `CLAUDE.md`, or equivalent
3. `PLAN.md`
4. Existing canonical specifications under `.agentkanban/specs/`
5. Existing source code, tests, configuration, migrations, and documentation

Use the Lite workflow profile:

`backlog -> in-progress -> done`

## Objective

Transform `PLAN.md` into a complete repository through small, dependency-aware, independently verifiable tasks without bypassing Agentic Kanban rules.

## Step 1: Inspect the repository

Before creating or modifying tasks:

* read the complete `PLAN.md`;
* inspect the current repository structure;
* inspect active and archived Agentic Kanban tasks;
* inspect existing specifications and change artifacts;
* inspect source code, tests, configuration, migrations, and documentation;
* identify requirements that are complete, partial, missing, obsolete, duplicated, or conflicting;
* preserve existing working behavior unless `PLAN.md` explicitly replaces it;
* record assumptions and unresolved decisions.

Do not implement production code during this step.

## Step 2: Convert PLAN.md into Lite-sized tasks

Create outcome-based Agentic Kanban tasks.

Every task must be:

* small enough to plan, implement, verify, and complete in one focused execution cycle;
* a vertical, independently testable delivery slice;
* understandable without relying on chat history;
* limited to one coherent outcome;
* safe to complete without a separate planning or review lane.

Do not create:

* one task per file;
* vague tasks such as "Build backend" or "Complete frontend";
* tasks that combine unrelated capabilities;
* tasks with unresolved destructive migrations or security decisions;
- oversized tasks merely to reduce the number of cards.

When a requirement is too complex for Lite:

* split it into smaller prerequisite and delivery tasks;
* create explicit `dependsOn` relationships;
* document any remaining architectural decision;
* do not hide complexity inside one task.

## Step 3: Model dependencies and blockers

For every task:

* define explicit `dependsOn` entries;
* treat `dependsOn` as authoritative;
* mirror dependencies using `blocked-by:<task-slug>`;
* use `blocked` only for external blockers;
* assign priority based on dependency order, risk, and user value;
* identify tasks that can safely run in parallel.

A task is ready only when every task in `dependsOn` is in `done`.

## Step 4: Add lightweight planning

Every task must contain:

* clear outcome;
* problem or user value;
* scope;
* non-scope;
* assumptions;
* acceptance criteria;
* expected files or modules;
* required tests;
* verification commands;
* security, migration, accessibility, deployment, and documentation impacts where relevant.

For non-trivial tasks, attach Lite spec artifacts using `/spec`.

Lite artifacts must include:

### proposal.md

Document:

* why the change is needed;
* intended outcome;
* scope;
* non-scope;
* dependencies;
* constraints;
* risks;
* acceptance criteria.

### tasks.md

Create an ordered authoritative checklist.

Each checklist item must be:

* concrete;
* independently verifiable;
* ordered by dependency;
* checked only after implementation and verification.

Create an optional delta specification only when the task introduces or changes externally observable behavior, interfaces, data contracts, or important business rules.

## Step 5: Human checkpoint

After creating and refining the backlog, stop before implementing production code.

Return:

1. Repository gap analysis.
2. Complete Lite-sized task backlog.
3. Dependency graph.
4. Tasks that can safely run in parallel.
5. Recommended first execution batch.
6. Tasks that may be too risky or complex for Lite.
7. Decisions requiring human approval.
8. External blockers.
9. A clear readiness verdict.

Do not move tasks to `in-progress` before human approval.
```

### Continue Implementation (Lite)

After you have reviewed and approved the Lite backlog, continue with this prompt:

```text
Continue implementing `PLAN.md` from the approved Agentic Kanban Lite backlog.

Follow `.agentkanban/INSTRUCTION.md` exactly.

Use the Lite workflow:

`backlog -> in-progress -> done`

Do not invent additional lanes or bypass dependency rules.

## Readiness rules

A task may move from `backlog` to `in-progress` only when:

* every task listed in `dependsOn` is in `done`;
* no unresolved external blocker exists;
* its scope and acceptance criteria are clear;
* required lightweight planning is complete;
* `proposal.md` and `tasks.md` are complete when the task uses `/spec`;
* no unresolved destructive migration, security decision, or architectural conflict remains.

If the task is too broad or risky for a safe Lite execution:

* do not implement it as-is;
* split it into smaller tasks;
* correct dependencies;
* return the oversized task to `backlog`.

## Execution order

* process tasks in dependency order;
* process independent tasks in parallel only when their files, migrations, infrastructure, and runtime resources do not conflict;
* process dependent chains sequentially;
* keep each task's changes, checklist, evidence, and conversation separate;
* do not combine unrelated tasks.

## For each ready task

### 1. Refresh context

Read:

* `.agentkanban/INSTRUCTION.md`;
* the selected task;
* its `dependsOn` tasks;
* linked `proposal.md`;
* linked `tasks.md`;
* optional delta specification;
* canonical specifications;
* repository instructions;
* relevant existing source code and tests.

Confirm that the task remains suitable for Lite.

### 2. Decide whether to use a worktree

Use the main workspace for small, isolated changes.

Use a task worktree when:

* the task is risky;
* the task may run in parallel;
* the task touches migrations or shared infrastructure;
* the task modifies many files;
- the task may conflict with other active work;
* isolation materially improves safety.

Record the decision in the task conversation.

### 3. Implement

Move the task to `in-progress`.

Then:

* implement only the selected task scope;
* follow `tasks.md` in order when present;
* reuse existing repository patterns;
* prefer framework and platform standards before custom abstractions;
* preserve backward compatibility unless explicitly excluded;
* never hardcode secrets, credentials, account IDs, production URLs, or environment-specific values;
* update types, schemas, migrations, configuration examples, tests, and documentation where required;
* provide secure failure behavior and actionable errors;
* account for accessibility, i18n, performance, observability, and deployment requirements where relevant;
* run focused verification after each meaningful implementation step;
* check off a checklist item only after it is implemented and verified;
* record significant decisions and evidence in the task conversation.

If the approved lightweight plan is invalid:

* stop implementation;
* move the task back to `backlog`;
* update its proposal, checklist, dependencies, and acceptance criteria;
* do not silently redesign during implementation.

If externally blocked:

* add the `blocked` label;
* record evidence and exact human action required;
* continue with other ready tasks.

### 4. Verify before completion

Lite has no separate review lane, so verification is a mandatory completion gate inside `in-progress`.

Before moving to `done`:

* inspect the complete diff;
* check for scope drift;
* check for unnecessary abstractions;
* verify every acceptance criterion;
* verify every completed checklist item;
* review input validation and failure behavior;
* review authorization and security boundaries when relevant;
* review migrations and rollback implications;
* review accessibility and i18n where relevant;
* check environment configuration;
* check documentation;
* check for leaked secrets, debug code, placeholders, and temporary configuration;
* run formatting;
* run linting;
* run static analysis or type checks;
* run relevant unit tests;
* run relevant integration tests;
* run relevant E2E tests;
* run the production build.

Fix in-scope defects and rerun affected checks.

If verification exposes a design-level problem:

* keep the task out of `done`;
* return it to `backlog`;
* update its planning artifacts;
* create prerequisite tasks when needed.

### 5. Complete

Move the task to `done` only when:

* all acceptance criteria pass;
* all checklist items are complete;
* required tests and build pass;
* documentation is updated;
* no unresolved blocker remains;
* the final diff contains only intended changes.

Then:

* archive task change artifacts according to the workflow;
* merge accepted optional delta requirements into canonical specifications;
* record final implementation and verification evidence;
* merge the branch through the repository's normal Git flow;
* remove the worktree only after successful integration.

## Batch behavior

After each completed task:

* recalculate ready tasks;
* continue with the next ready task;
* skip externally blocked tasks without stopping the entire batch;
* run repository-wide verification after each logical batch;
* update dependencies when newly discovered prerequisites are valid.

## Completion condition

Continue until:

* all implementable `PLAN.md` tasks are in `done`; or
* all remaining tasks are blocked by documented external actions.

At the end, return:

1. Completed tasks.
2. Blocked tasks and exact required actions.
3. PLAN.md coverage matrix: `requirement -> task -> implementation -> verification`.
4. Tests and commands executed.
5. Migration and deployment status.
6. Security and operational risks.
7. Remaining follow-up tasks.
8. Final verdict: `READY FOR RELEASE` or `NOT READY`.
```

---

## Lite Profile -- Autonomous

Use this for small repositories or very clear `PLAN.md` files. The agent creates the backlog, self-approves lightweight planning, and implements everything without manual checkpoints.

```text
Implement the entire repository from `PLAN.md` using the Agentic Kanban Lite workflow.

Follow `.agentkanban/INSTRUCTION.md` as the canonical workflow authority.

Use:

`backlog -> in-progress -> done`

## Core responsibility

Convert every implementable requirement in `PLAN.md` into small Lite-sized tasks, execute them in dependency order, verify each task inside `in-progress`, and move it to `done` only when fully validated.

## Required process

1. Inspect `PLAN.md`, repository instructions, existing implementation, active and archived tasks, specifications, tests, migrations, and documentation.
2. Produce a repository gap analysis.
3. Convert missing requirements into small, outcome-based tasks.
4. Define explicit `dependsOn` relationships and blocker labels.
5. Add scope, non-scope, acceptance criteria, tests, verification commands, and relevant operational considerations to every task.
6. Attach Lite `/spec` artifacts to non-trivial tasks:

   * `proposal.md`;
   * authoritative `tasks.md`;
   * optional delta specification when observable behavior or contracts change.
7. Keep every task small enough to complete safely without a separate planning or review lane.
8. Move only dependency-ready tasks into `in-progress`.
9. Use a worktree when risk, parallel execution, migrations, or file conflicts justify isolation.
10. Implement strictly within the selected task scope.
11. Check off checklist items only after implementation and verification.
12. Perform mandatory review and verification inside `in-progress`.
13. Move the task to `done` only after all acceptance criteria and checks pass.
14. Archive completed change artifacts.
15. Merge accepted optional deltas into canonical specifications.
16. Recalculate ready tasks and continue.
17. Perform a final release-readiness audit.

## Autonomous planning rule

You may approve a task's lightweight plan when:

* the requirement is unambiguous;
* the task is small and isolated;
* no destructive migration requires approval;
- no unresolved security decision exists;
* no product decision is missing;
* the implementation matches established repository patterns.

If any condition is false:

* do not guess;
* mark the task blocked or split it;
* document the exact decision required;
* continue with other ready work.

## Non-negotiable rules

* Do not add planning or review lanes.
* Do not ignore `dependsOn`.
* Do not implement blocked tasks.
* Do not create oversized Lite tasks.
* Do not create one task per file.
* Do not combine unrelated outcomes.
* Do not mark unverified work complete.
* Do not weaken valid tests.
* Do not hardcode secrets or production configuration.
* Do not silently redesign during implementation.
* Do not claim release readiness while required work remains incomplete.
* Preserve user-authored instructions outside managed Agentic Kanban sections.

## Mandatory verification per task

Run all applicable:

* formatting;
* linting;
* static analysis;
* type checks;
* unit tests;
* integration tests;
* E2E tests;
* migration checks;
* security checks;
* accessibility checks;
* production build.

## Final output

Return:

1. Repository gap analysis.
2. Created task backlog.
3. Dependency graph.
4. Completed tasks.
5. Blocked tasks and exact human action required.
6. PLAN.md coverage matrix: `requirement -> task -> implementation -> verification`.
7. Verification summary.
8. Migration and deployment notes.
9. Residual risks.
10. Final verdict: `READY FOR RELEASE` or `NOT READY`.
```

---

## Recommended Sequence

### Standard Profile -- Human-Governed

```text
1. Initialize workspace with Standard profile
2. Place PLAN.md in the repository root
3. Run the Standard Human-Governed prompt
4. Review and approve the planning batch
5. Run the Continue After Planning Approval prompt
6. Use @kanban /refresh if context drifts
```

### Standard Profile -- Autonomous

```text
1. Initialize workspace with Standard profile
2. Place PLAN.md in the repository root
3. Run the Standard Autonomous prompt
4. Use @kanban /refresh if context drifts
```

### Lite Profile -- Human-Governed

```text
1. Initialize workspace with Lite profile
2. Place PLAN.md in the repository root
3. Run the Lite Human-Governed planning prompt
4. Review and approve the generated backlog
5. Run the Lite Continue Implementation prompt
6. Use @kanban /refresh when context drifts
```

### Lite Profile -- Autonomous

```text
1. Initialize workspace with Lite profile
2. Place PLAN.md in the repository root
3. Run the Lite Autonomous prompt
4. Use @kanban /refresh if context drifts
```
