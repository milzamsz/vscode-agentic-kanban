---
title: Storage Layout
description: File directory tree and storage mapping details of the .agentkanban folder.
---

Agentic Kanban stores all task state and metadata locally under the `.agentkanban/` directory at the root of your workspace.

---

## Directory Tree

Here is the full workspace layout created during initialization:

```text
.agentkanban/
  .gitignore          # Ignores logs/ from version control
  board.yaml          # Committed project board configuration
  memory.md           # Persistent text memory shared across tasks
  INSTRUCTION.md      # Active instruction set compiled for agents
  specs/
    <capability>/
      spec.md         # Living specification files
  changes/
    <task-slug>/
      proposal.md     # Proposal document
      design.md       # Design document
      tasks.md        # Authoritative checklist
    archive/          # Archived change folders
  tasks/
    task_<date>_<id>_<slug>.md   # Active task files
    todo_<date>_<id>_<slug>.md   # Task checklists (Lite / non-spec)
    archive/                     # Archived task files
  logs/               # Diagnostics and error logs (gitignored)
```

---

## File Details

### `.gitignore`
Pre-populated to ignore `logs/` from git commits while keeping tasks, configs, and specs tracked.

### `board.yaml`
Committed configuration defining the profile, reviewer roles, WIP limits, and verification commands.

### `memory.md`
A plain text file that agents read and update. Used to keep track of persistent conventions, project structures, and design decisions across different task executions.

### `INSTRUCTION.md`
Copied from templates on initialization. Contains the core rules, execution behaviors, and lanes instruction set parsed by chat participants and agents.
