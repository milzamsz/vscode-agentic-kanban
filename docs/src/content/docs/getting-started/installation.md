---
title: Installation
description: Requirements and steps to install Agentic Kanban.
---

Agentic Kanban requires **VS Code 1.95 or newer** (with the chat participant engine standard).

---

## 1. GitHub Release VSIX (Recommended)

Download the latest `agentic-kanban-<version>.vsix` package from [GitHub Releases](https://github.com/milzamsz/vscode-agentic-kanban/releases), then install it from your terminal:

```bash
code --install-extension agentic-kanban-1.6.4.vsix
```

Alternatively, inside VS Code:
1. Open the Extensions View (`Ctrl+Shift+X` or `Cmd+Shift+X`).
2. Click the `...` menu in the top-right corner.
3. Select **Install from VSIX...**.
4. Choose the downloaded `.vsix` file.

---

## 2. Build From Source

If you want to build the extension from source:

1. Clone the repository:
   ```bash
   git clone https://github.com/milzamsz/vscode-agentic-kanban.git
   cd vscode-agentic-kanban
   ```
2. Install dependencies:
   ```bash
   npm ci
   ```
3. Compile the code:
   ```bash
   npm run build
   ```
4. Package the VSIX:
   ```bash
   npx @vscode/vsce package
   ```
5. Install the generated VSIX file:
   ```bash
   code --install-extension agentic-kanban-1.6.4.vsix
   ```
