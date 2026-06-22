---
title: Spec-Driven Development
description: Guide to spec-driven development (SDD) processes, folder layouts, templates, and lifecycle.
---

Spec-driven development (SDD) turns task files into tracked, auditable specifications. By separating intent (proposal), design, checklist, and capability specifications, Agentic Kanban ensures coding agents act on explicit developer intent.

---

## 1. Initializing SDD

To opt an active task into SDD, run:

```text
@kanban /spec [capability]
```

This adds two links to the task's frontmatter:
```yaml
change: .agentkanban/changes/task-slug
spec: .agentkanban/specs/capability/spec.md
```

And scaffolds a dedicated directory structure under `.agentkanban/`:

```text
.agentkanban/
  specs/
    <capability>/
      spec.md             # Shared capability spec (living contract)
  changes/
    <task-slug>/
      proposal.md         # Explains "why" and "scope"
      design.md           # Implementation approach
      tasks.md            # The authoritative checklist
```

---

## 2. Artifact Lifecycles

### Planning Phase (`planning` lane)
During planning, you or the agent write and refine:
- **`proposal.md`:** Document the requirements, user stories, out-of-scope boundaries, and business goals.
- **`design.md`:** Map files to modify, database changes, API routes, and structural diagrams.
- **`specs/<capability>/spec.md`:** Write behavioral criteria (e.g. Gherkin-style `Given/When/Then` scenarios).
- **`tasks.md`:** Create the checklist of implementation tasks.

### Implementation Phase (`in-progress` lane)
When the plan is approved, the agent implements the code.
- The agent reads `proposal.md` and `design.md` as its implementation guide.
- The agent uses `tasks.md` as the **authoritative checklist** (instead of the sibling `todo_*.md` file). It marks items completed (`- [x]`) as changes are checked in.

### Review and Merging (`review` and `done` lanes)
- Code is verified against the capability `spec.md` scenarios.
- Once completed, the change folder is archived to keep the workspace clean:
  ```text
  @kanban /archive <task-slug>
  ```
  This moves the folder to `.agentkanban/changes/archive/`. The shared capability specification in `.agentkanban/specs/` remains in place, acting as a permanent, living description of your codebase's features.
