# Template prompt — sweep `in-progress` → `review` (all done tasks)

Run the implementation-review gate for EVERY `in-progress` task whose work is complete, moving each to
`review`. Run rules + verify gate: [conventions.md](conventions.md).
Sweep mechanics: [batch-and-dependencies.md](batch-and-dependencies.md).

For spec-driven tasks, verify the implementation against the linked proposal, design, delta spec, and change `tasks.md` from [sdd-workflow.md](sdd-workflow.md).

````markdown
# SWEEP IN-PROGRESS → REVIEW (implementation) — Agentic Kanban stage driver

Read conventions.md (ritual, verify gate, rules) and batch-and-dependencies.md (worklist, discovery,
loop-until-dry, summary) first.

## Scope (fill first)
- Lane: `in-progress` — gate all tasks whose checklist is complete

## Per qualifying task (parallel where independent)
A task qualifies when its checklist is done (or remaining items are justified deferrals). Tasks still mid-work
stay; not-ready tasks follow the guardrail.
1. Run the full **verify gate** from conventions.md (lint/test/build + code-review + security + performance +
   edge cases + docs). Paste real output.
2. Action `review`: set `lane: review`. Write verdict +
   evidence (command output, review notes) in the task file. Recommend (user confirms):
   - **Approve** → `done`.
   - **Revise** → back to `in-progress`; list exact fixes.

Never claim pass without evidence; never push `→ done` yourself. Discovered work + summary per batch-and-dependencies.md.
````
