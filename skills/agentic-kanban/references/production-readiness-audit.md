# Template prompt — production-readiness audit

Standalone gate to run before moving a task (or a release) to `done`. Deeper than the inline checklist in the stage drivers. Produces a pass/fail report in the task file.

````markdown
# PRODUCTION READINESS AUDIT — Agentic Kanban

## Target
- Task / release: `<name>`
- Deploy target: `<docker / cloud / on-prem>`

## Audit (mark each PASS / FAIL / N/A with evidence)

### Correctness & tests
- [ ] All checklist items done; acceptance criteria met
- [ ] Unit + integration + e2e tests green; output pasted
- [ ] Lint / type-check / build green
- [ ] `code-review` run; findings resolved

### Security
- [ ] Access control / permissions enforced and tested
- [ ] Input validation + output encoding; no injection vectors
- [ ] Secrets via env/secret store, never hardcoded or logged
- [ ] Dependencies free of known criticals

### Reliability & ops
- [ ] Error handling + graceful failures
- [ ] Logging at useful levels; no secrets in logs
- [ ] Monitoring / health checks where applicable
- [ ] Backup + rollback plan documented
- [ ] Idempotent migrations; verified on a clean DB and on a copy of prod-like data

### Performance
- [ ] No N+1 / unbatched hot paths; indexes present
- [ ] Acceptable under expected load (smoke/load test if relevant)

### Config & deploy
- [ ] Env config externalized + documented
- [ ] Reproducible build artifact; version bumped
- [ ] Smoke test in a production-like environment
- [ ] Feature flags / safe rollout where risky

### Docs
- [ ] README + TECHNICAL + changelog updated
- [ ] Operational notes (deploy, rollback, troubleshooting)

## Output
Write a PASS/FAIL summary in the task file. ANY unresolved FAIL on Correctness/Security/Reliability
blocks `done` — list it, and either fix or `block` with a clear reason. State explicitly what was N/A.

## Always
Evidence over assertion. If a check wasn't run, mark it not-run — never imply coverage you don't have.
````
