Nah, ini maksud yang tepat: **satu prompt general untuk mengubah `PLAN.md` menjadi repository yang benar-benar terimplementasi**, sambil wajib mengikuti seluruh lifecycle `.agentkanban`, bukan berhenti setelah membuat backlog.

Untuk project besar, gunakan **Standard profile**: `backlog → planning → in-progress → review → done`. Pada profile ini, `/spec` membuat proposal, design, authoritative checklist, dan delta specification; implementasi dilakukan melalui worktree; dependency task wajib selesai sebelum task berikutnya diproses. ([GitHub][1])

## 1. Recommended: Human-Governed End-to-End

Versi ini paling aman untuk dokumentasi. Agent membuat backlog dan planning, lalu berhenti untuk approval sebelum mulai coding. Rupanya membiarkan AI mengubah seluruh repository tanpa checkpoint masih dianggap ide yang sedikit berani.

Implement this repository completely from `PLAN.md` using the Agentic Kanban workflow.

Treat these sources as authoritative, in this order:

1. `.agentkanban/INSTRUCTION.md`
2. User-authored repository instructions such as `AGENTS.md`, `CLAUDE.md`, or equivalent
3. `PLAN.md`
4. Existing specifications under `.agentkanban/specs/`
5. Existing source code, tests, configuration, migrations, and documentation

Use the Standard workflow profile:

`backlog → planning → in-progress → review → done`

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
* do not create vague tasks such as “Build backend” or “Implement frontend”;
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

For every non-trivial task, attach Standard-profile spec artifacts equivalent to:

* `proposal.md`;
* `design.md`;
* `tasks.md`;
* `specs/<capability>/spec.md`.

Artifact requirements:

### `proposal.md`

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

### `design.md`

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

### `tasks.md`

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

## 2. Continue After Planning Approval

Setelah planning batch disetujui, pakai prompt ini. Ia memproses task sesuai dependency, membuat worktree, mengimplementasikan checklist, melakukan review, lalu memindahkan task sampai `done`. Workflow resmi memang menjadikan `tasks.md` sebagai checklist authoritative dan mengharuskan worktree pada Standard profile sebelum implementasi. ([GitHub][1])

Continue implementing `PLAN.md` from the approved Agentic Kanban backlog and planning artifacts.

Follow `.agentkanban/INSTRUCTION.md` exactly.

You are authorized to process all ready tasks through:

`planning → in-progress → review → done`

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
* do not modify another task’s scope merely because it is convenient.

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
* prefer platform and framework standards over custom infrastructure;
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
* no unresolved blocker remains.

Then:

* archive the task change artifacts according to the workflow;
* merge accepted delta requirements into canonical specifications;
* record final implementation and verification evidence;
* merge the task branch through the repository’s normal Git flow;
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
3. PLAN.md coverage matrix:
   `requirement → task → specification → implementation → test`.
4. Commands and tests executed.
5. Migration and deployment status.
6. Security and operational risks.
7. Remaining follow-up work.
8. Final verdict:
   `READY FOR RELEASE` or `NOT READY`.

## 3. Fully Autonomous Version

Ini versi satu prompt untuk agent yang boleh merencanakan dan mengimplementasikan semuanya tanpa menunggu approval manual. Tetap melewati semua lane, hanya approval planning-nya diberikan secara eksplisit kepada agent.

Implement the entire repository from `PLAN.md` using the Agentic Kanban Standard workflow.

Follow `.agentkanban/INSTRUCTION.md` as the canonical workflow authority.

Use:

`backlog → planning → in-progress → review → done`

You are authorized to approve a task’s planning artifacts yourself only when:

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
6. PLAN.md coverage matrix:
   `requirement → task → specification → implementation → test`.
7. Full verification summary.
8. Migration and deployment notes.
9. Residual risks.
10. Final verdict:
    `READY FOR RELEASE` or `NOT READY`.

## Rekomendasi untuk docs Agentic Kanban

Masukkan dua template utama:

```text
Implement a PLAN.md — Human-Governed
Implement a PLAN.md — Autonomous
```

Urutan penggunaan versi human-governed:

```text
1. Initialize workspace with Standard profile
2. Place PLAN.md in the repository root
3. Run Prompt 1
4. Review and approve the planning batch
5. Run Prompt 2
6. Use @kanban /refresh if context drifts
```

`.agentkanban/INSTRUCTION.md` tetap menjadi sumber aturan workflow, task state tetap berada di Markdown, dependency memakai `dependsOn`, dan `/refresh` menyuntikkan ulang selected-task context ketika sesi agent mulai menyimpang ke alam metafisika. ([GitHub][1])

[1]: https://github.com/milzamsz/vscode-agentic-kanban "GitHub - milzamsz/vscode-agentic-kanban: A VS Code extension for organizing agentic development workflows using kanban boards, spec-driven development (SDD), and structured implementation tracking. · GitHub"
