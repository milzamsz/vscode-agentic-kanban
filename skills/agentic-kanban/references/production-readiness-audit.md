# Template prompt - production-readiness audit

Standalone gate before moving a task or release to `done`. A board "done" claim is only useful when backed by evidence that the behavior runs. Produces a PASS/FAIL report in the task file.

````markdown
# PRODUCTION READINESS AUDIT - Agentic Kanban

## Target
- Task / release: `<name>`
- Capability spec: `.agentkanban/specs/<cap>/spec.md`
- Env exercised: `<local / staging / prod-like>`

## Audit (mark each PASS / FAIL / N/A with evidence - paste output)

### Correctness & "does it actually run"
- [ ] Checklist + spec acceptance criteria met
- [ ] Lint / type-check / test / build green, output pasted
- [ ] Route smoke / integration smoke green where applicable
- [ ] **Behavior proven to RUN**, not a DB row: the spec's Verification evidence (real workflow/job id, agent command executed on host, quota 429, S3 object, webhook state change). Quote it.
- [ ] No silent mock fallback left in the exercised path; failure mode fails closed

### Multi-tenant & security
- [ ] Every query scoped to its tenant or owner boundary; negative cross-boundary access tested where relevant
- [ ] Mutations write audit events when the product requires them; multi-statement mutations use transactions
- [ ] Secrets are reference-backed or environment-backed, masked, reveal audited, and never logged
- [ ] Agent commands typed, allowlisted, signed, TTL-bound, and idempotent where command dispatch exists
- [ ] Entitlement/quota enforced where the task creates billable or limited resources

### Reliability & ops
- [ ] Error handling + graceful failure; failed provisioning/command leaves no orphan or has cleanup/compensation
- [ ] Idempotent migration; verified on a clean DB when applicable
- [ ] Logging at useful levels, no secrets; health/metrics where applicable
- [ ] Backup/rollback path documented if the task touches data or deploy

### Performance
- [ ] No N+1 / unbatched hot paths; indexes present on lookup columns

### Docs
- [ ] README / architecture / spec updated to reflect what is now real vs still stubbed
- [ ] TECHNICAL.md / capability spec updated where behavior changed

## Output
Write a PASS/FAIL summary in the task file. ANY unresolved FAIL on Correctness / security /
reliability blocks `done` - list it, then fix or `block` with a reason. Mark untested checks `not-run`; never imply coverage you do not have. Evidence over assertion.
````
