# Prompt — production-readiness audit

Standalone gate before moving a task or release to `done`. A board "done" is worthless without
evidence the behavior RUNS. Produces a PASS/FAIL report in the task file.

---

```markdown
# PRODUCTION READINESS AUDIT

## Target
- Task / release: `<name>`
- Capability spec: `.agentkanban/specs/<capability>/spec.md`
- Env exercised: `<local / staging / prod-like>`

## Audit (mark each PASS / FAIL / N/A with evidence — paste output)

### Correctness & "does it actually run"
- [ ] Checklist + spec acceptance criteria met
- [ ] `<lint>` · `<test>` · `<build>` green (output pasted)
- [ ] **Behavior proven to RUN**, not a status write: the spec's Verification evidence. Quote it.

### Security
- [ ] Access control / permissions enforced and tested
- [ ] Input validation; no injection vectors
- [ ] Secrets via env/secret store, never hardcoded or logged

### Reliability & ops
- [ ] Error handling + graceful failure; no orphaned state on partial failure
- [ ] Idempotent migrations (if any), verified on a clean DB
- [ ] Logging at useful levels, no secrets; health/monitoring where applicable
- [ ] Backup / rollback path documented if the change touches data or deploy

### Performance
- [ ] No N+1 / unbatched hot paths; indexes present where needed

### Docs
- [ ] README / architecture / spec updated where behavior changed

## Output
Write a PASS/FAIL summary in the task file. ANY unresolved FAIL on correctness / security /
reliability blocks `done` — list it, then fix or `block` with a reason. Mark untested checks
`not-run`; never imply coverage you don't have. Evidence over assertion.
```
