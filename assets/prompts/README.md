# Kanban prompts

Paste-ready stage drivers for AI-assisted development on this board. Stack-agnostic — fill the
`<stack skill>` / `<lint>` / `<test>` / `<build>` placeholders for your project.

Shared rules live in the repo: `AGENTS.md` (the managed Agentic Kanban block + your custom rules),
`.agentkanban/INSTRUCTION.md` (workflow, lanes, action vocabulary, SDD), and per capability
`.agentkanban/specs/<capability>/spec.md`.

## Flow

`in-progress` is **automatic** — not a human gate. Humans touch only at **plan approval**
(`planning`) and **`review → done`**. The default driver carries an approved plan straight to `review`.

```
intake → backlog ──▶ planning ══[planning→review: AUTO]══▶ review ──▶ done
                    [GATE:human]   │  in-progress (auto)             [GATE:human]
                                   └─ blocker? → label + park ───────▶ (resume later)
```

**Default (autonomous):**

| Prompt | When |
|---|---|
| [stage-planning-to-review.md](stage-planning-to-review.md) | one launch → carry approved planning tasks through `in-progress` to `review`, hands-off; serial (WIP=1); blockers labeled + parked |

**Entry + gates + recovery:**

| Prompt | When |
|---|---|
| [new-task-intake.md](new-task-intake.md) | raw idea/bug → well-formed task in `backlog` |
| [stage-backlog-to-planning.md](stage-backlog-to-planning.md) | clarify + plan ready backlog tasks (spec-driven) |
| [stage-review-to-done.md](stage-review-to-done.md) | finalize approved tasks (human gate; runs the audit) |
| [stage-review-to-in-progress.md](stage-review-to-in-progress.md) | revise: send a rejected task back to implementation |
| [stage-blocked-and-resume.md](stage-blocked-and-resume.md) | block one / resume cleared |
| [production-readiness-audit.md](production-readiness-audit.md) | gate run by review→done (evidence the behavior RUNS) |

> The middle steps (`planning→in-progress`, `in-progress→review`) are not separate prompts — the
> autonomous driver does them inline.

These files are bundled by the extension and (re)written by `@kanban /prompts`. Edit freely — your
copies are preserved on init; `/prompts` overwrites to the latest bundled versions.
