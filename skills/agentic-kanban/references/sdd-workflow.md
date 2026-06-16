# Spec-driven development workflow

Agentic Kanban supports an opt-in spec workflow through `@kanban /spec [capability]`.

## Artifact layout

```text
.agentkanban/
  specs/<capability>/spec.md        # capability contract — one per capability, shared across tasks
  changes/<task-slug>/
    proposal.md                     # why + outcome + scope
    design.md                       # approach (Standard profile)
    tasks.md                        # authoritative checklist for this task
  changes/archive/<task-slug>/      # archived change folders (via @kanban /archive)
```

The capability spec lives **once** under `.agentkanban/specs/<capability>/spec.md` and is
referenced — not duplicated — by each task. A task links to both:

```yaml
change: .agentkanban/changes/<task-slug>
spec: .agentkanban/specs/<capability>/spec.md
```

## Artifact rules

- `spec.md` is the authoritative behavior contract: `## Behavior`, `## Acceptance criteria`
  (testable checkboxes), `## Verification`, `## Related tasks`. It is a living document, not a
  per-change delta — multiple tasks may reference and extend the same capability spec.
- `proposal.md` states the problem, the outcome, and scope (in/out).
- `design.md` (Standard profile) records the verified key facts, approach, decisions, risks, and open
  questions — grounded in real code. Authored in `planning`.
- `tasks.md` is the authoritative checklist for the task (replaces the sibling `todo_*.md`). Group
  with `## Phase N` or `# Iteration N`.

## Lane mapping

- Lite profile: `backlog -> in-progress -> done`. Use `proposal.md` + `tasks.md`; skip `design.md`
  and formal review gates.
- Standard profile: `backlog -> planning -> in-progress -> review -> done`. Write/refine the
  capability spec, proposal, and design in `planning`; implement and check off `tasks.md` in
  `in-progress`; verify code against the spec's acceptance criteria in `review`.

Blockers use `blocked` and `blocked-by:<slug>` labels — they are not a lane.

## Validation and completion

- The board surfaces spec-driven tasks: the checklist button opens `<change>/tasks.md`, the card
  shows a `SPEC` indicator + `done/total` progress, and a `⚠` badge when a declared `change` folder
  or `spec` file is missing.
- A task is `done` only when its behavior is proven to run (test output / a real run / a workflow or
  job id) and the spec's acceptance criteria are met — not when a record was written.
- On `done`, archive the change with `@kanban /archive [slug]` (moves `changes/<slug>` to
  `changes/archive/<slug>`). The capability spec stays in `specs/` as the living contract.
- Validation and the decision to archive remain agent-driven; the extension provides the `/archive`
  helper and the board surfacing but does not auto-enforce the lifecycle.
