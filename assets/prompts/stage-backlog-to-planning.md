# Prompt — sweep `backlog` → `planning`

Clarify + plan every ready task in `backlog`, ending in `planning`. Spec-driven where a capability
spec applies.

---

```markdown
# SWEEP BACKLOG → PLANNING

Read first: AGENTS.md, .agentkanban/INSTRUCTION.md, .agentkanban/memory.md. For each task touching a
capability, read its `.agentkanban/specs/<capability>/spec.md` — it is the acceptance contract.

## Scope (fill first)
- Lane: `backlog` — process ready tasks only (ready = every `dependsOn` slug is `done`).
- Stack skill: `<stack skill>`.

## Per ready task — action: `plan` (read/think only, NO implementation)
1. **Discovery** (brainstorming skill): problem & outcome; actors; scope in/out; testable acceptance
   criteria; constraints (security, perf, data); affected code as `path:line`. Unanswerable blocking
   question → ask the user. Waits on another task → `dependsOn` + `blocked-by:<slug>` → not ready.
2. **Implementation plan** (stack skill): approach + key decisions (+ rejected alternatives); data
   model / interfaces / contracts; security model; **how the behavior is proven to RUN** (the verify
   path); risks + mitigations.
3. **Spec-driven:** create/refine `.agentkanban/changes/<slug>/{proposal,design,tasks}.md`; design.md
   records the chosen approach grounded in real `path:line`; tasks.md is the authoritative checklist.
   Add `change:`/`spec:` frontmatter.
4. **Transition:** set `lane: planning`. Per board reviewPolicy, high/critical plans get an
   independent review before implementation.

Ground every claim against code. Record discovered work. Do not implement.
```
