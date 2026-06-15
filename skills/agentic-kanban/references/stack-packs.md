# Reference — stack packs (drop-in `<stack skill>` blocks)

Paste the matching block into any template's "Skills" / "Stack skill" slot. Each pack lists the skills to use and the stack-specific deliverables to cover during design + implementation.

## Odoo
- Skills: `odoo-<version>` (`odoo-17.0`/`odoo-18`/`odoo-19`), `odoo-performance-tuner`, `odoo-upgrade` (migrations), `odoo-owl` (frontend), `odoo-rpc-api` (external API).
- Design/implement coverage: `__manifest__.py` (deps, data, assets); models + fields + compute/constraints + `_sql_constraints`/`models.Constraint`; security (groups, `ir.model.access.csv`, record rules, multi-company); views (list/form/search/kanban, actions, menus); QWeb reports; cron/server actions; sequences; demo/seed (`noupdate`); i18n (PO); migration scripts (`pre/post/end`).
- Tests: `TransactionCase`, `HttpCase`, query-count assertions.
- Verify cmds: module install/upgrade on a clean DB; run module tests.

## Web frontend
- Skills: `shadcn` and/or `design-guide`, `design-taste-frontend`, `high-end-visual-design`, `astro`/framework skill.
- Coverage: component structure, design tokens, accessibility, responsive layout, state management, data fetching, error/empty/loading states.
- Verify cmds: `<lint>` · type-check · build · component/visual tests.

## API / backend (Python)
- Skills: `fastapi-expert`, `fastapi-templates`, `supabase`/`supabase-postgres-best-practices` (DB).
- Coverage: Pydantic v2 models, async routes, dependency injection, auth (JWT), DB layer (async SQLAlchemy), error handling, OpenAPI docs, rate limiting.
- Verify cmds: `<lint>` · `pytest` · build/container.

## Go services
- Skills: `golang-pro`.
- Coverage: concurrency (goroutines/channels), interfaces/generics, gRPC/REST, error handling, context propagation.
- Verify cmds: `go vet` · `go test ./...` · `go build`.

## Frappe / ERPNext
- Skills: `frappe-router` (entry), then `frappe-*` (doctype/api/frontend/testing as needed).
- Coverage: DocTypes, controllers, hooks, permissions, web forms/portal, print formats.

## Usage
1. Pick the pack matching the project Stack variable.
2. Replace `<stack skill>` in the template with that pack's skill list.
3. Fold the pack's "coverage" items into the Design & Plan stage; use its "verify cmds" in the verify gate.
````
