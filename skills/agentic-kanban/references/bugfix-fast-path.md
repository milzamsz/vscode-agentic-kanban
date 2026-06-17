# Template prompt — bug-fix fast path (Lite profile)

For small, well-understood bugs where full Standard ceremony is overkill. Lanes collapse to
`backlog -> in-progress -> done`. Run rules (TDD, verify gate, Always/Never): [conventions.md](conventions.md).

````markdown
# BUGFIX FAST PATH — Agentic Kanban (Lite)

Read conventions.md first (TDD loop, verify gate, rules). This file only adds the Lite-specific bits.

## Target (fill first)
- Bug: `<one-line symptom>`
- Repro: `<steps / failing input>`
- Stack skill: `<e.g. odoo-19 / fastapi-expert>`

## Steps
1. `@kanban /new Fix: <symptom>` (Lite). Record symptom + repro + expected/actual in the task file.
2. `@kanban /task Fix: <symptom>`; move to `in-progress`.
3. **Reproduce first.** Confirm the bug locally. If you can't reproduce, gather more info (or `block`).
4. **Diagnose root cause** — trace from first principles; don't patch symptoms. Quote exact error text.
5. Run the **TDD loop** (conventions.md): failing test that captures the bug -> fix -> refactor.
6. Run the **verify gate** (conventions.md); check for nearby regressions. Note root cause + fix; move to `done`.

## Escalate to Standard if
Root cause is broad, touches many files, needs a design decision, or has migration/security impact ->
recreate as a Standard task and run the full flow.
````
