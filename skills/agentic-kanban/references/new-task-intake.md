# Template prompt — new task intake

Use to turn a raw idea, feature request, or bug report into a well-formed task on the board (lands in the first lane, ready to be worked).

````markdown
# NEW TASK INTAKE — Agentic Kanban

## Input (paste the raw request)
`<idea / feature request / bug report, as-is>`

## Steps
1. If the workspace isn't initialised, `@kanban /new <title>` auto-initialises (implies consent).
2. Create the task:
   ```
   @kanban /new <concise imperative title>
   ```
3. Open it and fill the task file:
   - **Description** — 1-3 sentences: the outcome, not the solution.
   - **Context** — where it came from, affected area, links.
   - **For a bug:** steps to reproduce, expected vs actual, environment.
   - **Initial scope hints** — obvious in/out, known constraints.
   - **Open questions** — anything needing user input before planning.
4. Set useful frontmatter (optional): `priority` (critical/high/medium/low), `labels`, `dueDate`.
5. Leave it in the first lane (`backlog` for Standard, `backlog` for Lite). Do NOT plan or implement yet.

## Dependencies & discovered tasks
- If the new task must wait on another task, set `dependsOn: [<slug>]` frontmatter (authoritative) + a
  `blocked-by:<slug>` label for board visibility. Convention detail: [batch-and-dependencies.md](batch-and-dependencies.md).
- **Discovered mid-work:** when you spot new work while sweeping/implementing another task, create it here with
  label `discovered` + back-ref `Discovered-from: <originating-slug>`, leave it in `backlog`, and continue the
  current work — do not pull it into the current pass.

## Good title rules
Imperative, specific, scannable: "Add OAuth2 login", "Fix duplicate invoice on retry" — not "auth" or "bug".

## Checklist
- [ ] Title is imperative + specific
- [ ] Description states the outcome
- [ ] Bug reports include repro + expected/actual
- [ ] Open questions captured
- [ ] Frontmatter set where useful; task left in `backlog`

## Next
Move it forward with [stage-backlog-to-planning.md](stage-backlog-to-planning.md).
````
