# Prompt — new task intake

Turn a raw idea / feature request / bug into a well-formed task in `backlog`.

---

```markdown
# NEW TASK INTAKE

## Input (paste the raw request)
`<idea / feature request / bug report, as-is>`

## Steps
1. `@kanban /new "<concise imperative title>"` (e.g. "Add OAuth2 login", not "auth").
2. Fill the task file:
   - **Description** — 1-3 sentences: the outcome, not the solution.
   - **Context** — where it came from, affected area, code refs as `path:line`.
   - **Bug?** repro steps, expected vs actual, environment.
   - **Scope hints** — obvious in/out, known constraints.
   - **Open questions** — anything needing user input before planning.
3. Frontmatter: `priority` (critical/high/medium/low), `labels`, `dependsOn:[<slug>]` if it waits on
   another task (+ a `blocked-by:<slug>` label for board visibility).
4. **Spec-driven?** If it touches a capability, run `@kanban /spec <capability>` to scaffold
   `changes/<slug>/{proposal,design,tasks}.md` + link the capability `spec`.
5. Leave it in `backlog`. Do NOT plan or implement yet.

## Discovered mid-work
Spotted while doing another task → create it here with label `discovered` +
`Discovered-from: <slug>`, leave in `backlog`, continue current work. Don't pull it in.

## Next
[stage-backlog-to-planning.md](stage-backlog-to-planning.md).
```
