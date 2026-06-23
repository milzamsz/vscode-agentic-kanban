---
title: Release Workflow
description: Reference guide for maintainers cutting new releases and packaging the extension.
---

Agentic Kanban uses GitHub Actions to automate extension packaging and release publishing.

---

## 1. Maintainer Release Flow

To release a new version patch:

1. **Increment Version:** Update the `version` field in `package.json` (e.g. from `1.6.3` to `1.6.4`).
2. **Update Changelog:** Add a new release section with detailed notes at the top of `CHANGELOG.md`.
3. **Commit Changes:** Stage and commit your changes:
   ```bash
   git add package.json CHANGELOG.md
   git commit -m "Release v1.6.4: ..."
   ```
4. **Create Tag:** Create a release tag matching the version:
   ```bash
   git tag v1.6.4
   ```
5. **Push Branch and Tag:** Push the commit and the tag to GitHub:
   ```bash
   git push origin main
   git push origin v1.6.4
   ```
6. **Automation:** The push triggers `.github/workflows/release.yml`. This workflow:
   - Installs dependencies.
   - Runs linting, testing, and building.
   - Packages the VSIX.
   - Creates a GitHub Release and uploads the `.vsix` package as an asset.

---

## 2. Branding Guidelines

When contributing to this fork, ensure the **Agentic Kanban** name is preserved:
- Use **Agentic Kanban** in UI copy, titles, and user-facing documentation.
- The extension icon lives at `images/icon.png`.
- Custom prompts and directories should continue using the `.agentkanban/` path namespace.
