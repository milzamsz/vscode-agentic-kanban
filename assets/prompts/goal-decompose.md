# Goal Decompose Driver

**Goal:** {{goalTitle}}
**Slug:** `{{goalSlug}}`
**Artifact:** `.agentkanban/goals/{{goalSlug}}/goal.md`

---

## Your task

Read the goal artifact at `.agentkanban/goals/{{goalSlug}}/goal.md`, then break the objective into a set of well-formed child tasks that together satisfy all acceptance criteria.

**Profile:** `{{profile}}`
**Lane flow:** `{{lanes}}`

{{advance}}

---

## Decomposition rules

1. Run `@kanban /new <title>` for each child task. After creation, open the task file and add `parent: {{goalSlug}}` to its frontmatter.
2. Where tasks must be done in order, add `dependsOn: [<slug>]` to the later task and a matching `blocked-by:<slug>` label.
3. Keep each task small (one independently verifiable unit of work).
4. In Standard profile: for tasks that change a shared capability, run `@kanban /spec <capability>` to scaffold the spec-driven change artifacts (proposal/design/tasks). This wires the task to a capability spec and change folder.
5. In Lite profile: keep tasks lightweight. Each task needs only a brief description and a `tasks.md` checklist. No design.md or review gate required.
6. When the `dependsOn` graph is set, run `@kanban /loop` to drive tasks forward automatically. `/loop` is profile-aware and will not cross human gates.

**Human gates preserved:**
- Standard: plan approval (task in `planning`) requires human sign-off before implementation starts.
- Standard: `review -> done` requires human approval of the implementation.
- Lite: no human gates; `/loop` drives tasks straight to `done`.

---

## Decomposition output (write into goal.md)

After creating the tasks, update the `## Decomposition` section of `.agentkanban/goals/{{goalSlug}}/goal.md` with the task list:

```
## Decomposition

- `<slug-1>`: <title> (no dependencies)
- `<slug-2>`: <title> (dependsOn: slug-1)
- `<slug-3>`: <title> (no dependencies)
```

---

## Verification commands

{{verifyCmds}}

---

## Skills active

{{skills}}
