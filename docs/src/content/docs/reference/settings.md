---
title: VS Code Settings
description: Reference guide for all VS Code configurations available in Agentic Kanban.
---

You can customize the behavior of the extension using the following settings in your VS Code `settings.json` file.

---

## Configuration Settings

| Setting Name | Type | Default | Scope | Description |
| --- | --- | --- | --- | --- |
| **`agentKanban.enableLogging`** | `boolean` | `false` | `window` | Enable rolling diagnostic logs under `.agentkanban/logs/`. Requires window reload to take effect. |
| **`agentKanban.customInstructionFile`** | `string` | `""` (empty) | `resource` | Path to an additional instruction file to append to context during `/task` loading. Resolved relative to workspace root. |
| **`agentKanban.defaultProfile`** | `string` | `"standard"` | `resource` | Profile used when initializing a new board. Authoritative profile must be updated directly in `board.yaml`. |
| **`agentKanban.enforcementMode`** | `string` | `"profile-default"` | `resource` | Default enforcement mode for newly initialized boards: `"profile-default"` (Lite uses warning-mode, Standard uses strict-mode), `"strict"`, or `"warn"`. |
| **`agentKanban.worktreeRequiredForImplementation`** | `string` | `"profile-default"` | `resource` | Default worktree policy for newly initialized boards: `"profile-default"` (Standard requires worktrees, Lite does not), `"true"`, or `"false"`. |
| **`agentKanban.worktreeRoot`** | `string` | `../{repo}-worktrees` | `resource` | Root folder where Git worktree checkouts are created. `{repo}` is replaced automatically with the repository name. |
| **`agentKanban.worktreeOpenBehavior`** | `string` | `"current"` | `resource` | Controls whether reopened task worktrees are launched in the `current` VS Code window or in a `new` window. |
| **`agentKanban.enforceWorktrees`** | `boolean` | `false` | `resource` | If set to `true`, requires that a worktree folder exists and is open before `/refresh` commands can run. |
