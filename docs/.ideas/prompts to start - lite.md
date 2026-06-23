Untuk **Lite profile**, workflow resminya adalah:

```text
backlog → in-progress → done
```

Lite ditujukan untuk perubahan kecil dan jalur cepat. Planning tetap dilakukan, tetapi tidak memiliki lane khusus; tidak ada `review` lane; dan worktree bersifat opsional. Jika memakai `/spec`, Lite membuat `proposal.md` dan `tasks.md`, sementara delta specification bersifat opsional. `tasks.md` tetap menjadi checklist authoritative selama implementasi. ([GitHub][1])

Untuk mengimplementasikan `PLAN.md` besar menggunakan Lite, prompt harus memaksa agent **memecah plan menjadi task kecil, vertikal, dan cepat diverifikasi**. Kalau tidak, “Lite” cuma menjadi nama lucu untuk pekerjaan tiga minggu yang dijejalkan ke satu kartu.

## 1. Lite Profile — Human-Governed

Prompt pertama membuat backlog dan lightweight planning, lalu berhenti sebelum coding.

Implement this repository from `PLAN.md` using the Agentic Kanban Lite workflow.

Treat these sources as authoritative, in this order:

1. `.agentkanban/INSTRUCTION.md`
2. User-authored repository instructions such as `AGENTS.md`, `CLAUDE.md`, or equivalent
3. `PLAN.md`
4. Existing canonical specifications under `.agentkanban/specs/`
5. Existing source code, tests, configuration, migrations, and documentation

Use the Lite workflow profile:

`backlog → in-progress → done`

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
* vague tasks such as “Build backend” or “Complete frontend”;
* tasks that combine unrelated capabilities;
* tasks with unresolved destructive migrations or security decisions;
* oversized tasks merely to reduce the number of cards.

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

### `proposal.md`

Document:

* why the change is needed;
* intended outcome;
* scope;
* non-scope;
* dependencies;
* constraints;
* risks;
* acceptance criteria.

### `tasks.md`

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

## 2. Lite Profile — Continue Implementation

Setelah backlog disetujui, prompt ini menjalankan task dari `backlog` ke `in-progress`, melakukan implementasi dan verifikasi, lalu langsung ke `done`.

Walaupun Lite tidak memiliki `review` lane, implementasi tetap harus diperiksa sebelum `done`. Ketiadaan lane bukan izin untuk melepas kode ke alam liar tanpa pengawasan. Worktree boleh digunakan untuk perubahan berisiko, paralel, atau yang menyentuh area konflik. ([GitHub][1])

Continue implementing `PLAN.md` from the approved Agentic Kanban Lite backlog.

Follow `.agentkanban/INSTRUCTION.md` exactly.

Use the Lite workflow:

`backlog → in-progress → done`

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
* keep each task’s changes, checklist, evidence, and conversation separate;
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
* the task may conflict with other active work;
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
* merge the branch through the repository’s normal Git flow;
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
3. PLAN.md coverage matrix:
   `requirement → task → implementation → verification`.
4. Tests and commands executed.
5. Migration and deployment status.
6. Security and operational risks.
7. Remaining follow-up tasks.
8. Final verdict:
   `READY FOR RELEASE` or `NOT READY`.

## 3. Lite Profile — Fully Autonomous

Versi ini cocok untuk repository kecil atau `PLAN.md` yang sangat jelas. Agent boleh membuat backlog, memberi lightweight approval, dan mengimplementasikan seluruh task tanpa checkpoint manual.

Implement the entire repository from `PLAN.md` using the Agentic Kanban Lite workflow.

Follow `.agentkanban/INSTRUCTION.md` as the canonical workflow authority.

Use:

`backlog → in-progress → done`

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

You may approve a task’s lightweight plan when:

* the requirement is unambiguous;
* the task is small and isolated;
* no destructive migration requires approval;
* no unresolved security decision exists;
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
6. PLAN.md coverage matrix:
   `requirement → task → implementation → verification`.
7. Verification summary.
8. Migration and deployment notes.
9. Residual risks.
10. Final verdict:
    `READY FOR RELEASE` or `NOT READY`.

## Rekomendasi untuk dokumentasi

Gunakan dua template utama:

```text
Implement a PLAN.md — Lite Human-Governed
Implement a PLAN.md — Lite Autonomous
```

Urutan human-governed:

```text
1. Initialize workspace with Lite profile
2. Place PLAN.md in the repository root
3. Run the Lite Human-Governed planning prompt
4. Review and approve the generated backlog
5. Run the Lite Continue Implementation prompt
6. Use @kanban /refresh when context drifts
```

Perintah `/task`, `/refresh`, `/spec`, dan worktree tetap tersedia di Lite. Perbedaannya, worktree opsional dan task bergerak langsung dari `in-progress` ke `done` setelah implementasi serta verification gate selesai. ([GitHub][1])

[1]: https://github.com/milzamsz/vscode-agentic-kanban "GitHub - milzamsz/vscode-agentic-kanban: A VS Code extension for organizing agentic development workflows using kanban boards, spec-driven development (SDD), and structured implementation tracking. · GitHub"
