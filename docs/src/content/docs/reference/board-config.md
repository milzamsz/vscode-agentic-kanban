---
title: Board Config (board.yaml)
description: Reference guide for the board.yaml configuration schema.
---

The committed `.agentkanban/board.yaml` file is the shared project source of truth for workflow profiles, lanes, and policies.

---

## Configuration Schema

Here is a typical `board.yaml` file populated for the Standard profile:

```yaml
profile: standard
lanes:
  - backlog
  - planning
  - in-progress
  - review
  - done
enforcement:
  mode: strict
  overrides:
    allowed: true
    actors:
      - human
    requireReason: true
reviewPolicy:
  low:
    planning: self-agent
    implementation: self-agent
  medium:
    planning: self-agent
    implementation: self-agent
  high:
    planning: self-agent
    implementation: human
  critical:
    planning: independent-agent
    implementation: independent-agent+human
worktreePolicy:
  requiredForImplementation: true
wipLimits:
  in-progress: 1
```

---

## Field Descriptions

### `profile`
- **Type:** `string` (values: `"lite"` or `"standard"`)
- **Description:** Sets the active workflow pattern.

### `lanes`
- **Type:** `string[]`
- **Description:** Ordered list of column slugs visible on the board.

### `enforcement`
- **`mode`:** `"strict"` (transition failures block) or `"warn"` (transition failures warn only).
- **`overrides`:**
  - `allowed`: `boolean`. Permit bypassing rules.
  - `actors`: `("human" | "agent")[]`. Which actors can override.
  - `requireReason`: `boolean`. Require a typed reason on override.

### `reviewPolicy`
Defines who must perform review stages for each priority level (`low`, `medium`, `high`, `critical`):
- **`planning`** and **`implementation`**:
  - `self-agent` - Active coding agent performs review.
  - `independent-agent` - Separate agent must review.
  - `independent-agent+human` - Separate agent plus developer must review.

### `worktreePolicy`
- **`requiredForImplementation`**: `boolean`. Require worktree isolation in the `in-progress` lane.

### `wipLimits`
- **Type:** `Record<string, number>`
- **Description:** Sets work-in-progress limits per lane.
