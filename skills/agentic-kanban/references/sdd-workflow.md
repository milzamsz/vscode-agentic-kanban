# Spec-driven development workflow

Agentic Kanban supports an opt-in spec workflow through `@kanban /spec [capability]`.

## Artifact layout

```text
.agentkanban/
  specs/<capability>/spec.md
  changes/<task-slug>/
    proposal.md
    design.md
    tasks.md
    specs/<capability>/spec.md
  changes/archive/<yyyymmdd>-<task-slug>/
```

The task links to the change through:

```yaml
change: .agentkanban/changes/<task-slug>
```

## Artifact rules

- `proposal.md` explains why the change exists and what is in scope.
- `design.md` is required for Standard profile tasks.
- `tasks.md` is the authoritative checklist for spec-driven tasks.
- `specs/<capability>/spec.md` uses OpenSpec-style delta sections:
  `## ADDED Requirements`, `## MODIFIED Requirements`, `## REMOVED Requirements`.
- Requirements use `### Requirement:` and at least one `#### Scenario:` with GIVEN / WHEN / THEN.

## Lane mapping

- Lite profile:
  `backlog -> in-progress -> done`
  Use `proposal.md` and `tasks.md`. Skip `design.md` and formal review gates.
- Standard profile:
  `backlog -> planning -> in-progress -> review -> done`
  Build the proposal, design, and delta spec in `planning`.
  Implement and check off `tasks.md` in `in-progress`.
  Verify code against spec and tasks in `review`.

Blockers still use `blocked` and `blocked-by:<slug>` labels. They are not a lane.

## Validation and completion

- Validate proposal, design, and delta spec before implementation review.
- When moving to `done`, archive the change and merge accepted deltas into `.agentkanban/specs/`.
- This MVP keeps validation, archive, and merge agent-driven rather than extension-enforced.
