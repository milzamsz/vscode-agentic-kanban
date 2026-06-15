# Native SDD MVP For Agentic Kanban

## Summary

Agentic Kanban now supports opt-in spec-driven development through `@kanban /spec`. The MVP keeps the extension focused on scaffolding and context persistence while leaving validation, archive, and spec merge steps to the agent workflow.

## Implemented Changes

- Added `@kanban /spec [capability]` to the chat participant.
- Scaffolds `.agentkanban/changes/<task-slug>/` and stores `change: .agentkanban/changes/<task-slug>` in task frontmatter.
- Standard profile scaffolds `proposal.md`, `design.md`, `tasks.md`, and `specs/<capability>/spec.md`.
- Lite profile scaffolds `proposal.md` and `tasks.md`.
- Preserves existing change files on rerun.
- Extends AGENTS.md task-aware context with spec change, proposal, tasks, and delta spec pointers.
- Documents the workflow in `README.md`, `TECHNICAL.md`, `assets/INSTRUCTION.md`, and the Agentic Kanban skill.

## Public Interfaces

- New chat command: `/spec`
- New bundled assets: `assets/spec-templates/*.md`
- New artifact layout under `.agentkanban/changes/`
- Preserved task frontmatter key: `change`

## Verification

- `npm run lint`
- `npm test`
- `npm run build`
- `npx @vscode/vsce package`
- VSIX branding grep after extraction

## Assumptions

- Validation, archive, and merge remain agent-driven for this MVP.
- `tasks.md` is authoritative for spec-driven tasks.
- Existing task frontmatter round-trip through `Task.extras` is the right compatibility layer for `change`.

