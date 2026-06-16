# Capability spec: {{CAPABILITY}}

> Authoritative behavior contract for the {{CAPABILITY}} capability. Tasks reference this file via
> their `spec:` frontmatter key; keep it the single source of truth (do not duplicate per change).
> Status <date>: <one line — what is real vs stubbed today>.

## Behavior

Describe what the system must do for this capability — the observable behavior, the actors, and the
main flow. Reference authoritative decisions (ADRs, product plan) rather than restating them.

## Acceptance criteria

- [ ] A concrete, testable statement of correct behavior.
- [ ] Another. Each should be verifiable by a test or an observable run.

## Verification

How to prove the behavior actually runs (a real run, a test, a workflow/job id, an HTTP response) —
not a DB row or a status write alone.

## Related tasks

- `<task-slug>` — what part it delivers.
