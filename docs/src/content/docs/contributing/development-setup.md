---
title: Development Setup
description: Guide to setting up a local development environment for contributing to Agentic Kanban.
---

To modify or debug the Agentic Kanban extension locally, you need **Node.js 18 or newer**, **npm**, and **VS Code 1.95 or newer**.

---

## 1. Repository Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/milzamsz/vscode-agentic-kanban.git
   cd vscode-agentic-kanban
   ```
2. Install development dependencies:
   ```bash
   npm ci
   ```

---

## 2. Compile and Watch

Compile the typescript files in watch mode:

```bash
npm run watch
```

This compiles typescript into JavaScript under `dist/` and keeps compiling in the background as you make file changes.

---

## 3. Running and Debugging

1. Open the project folder in VS Code.
2. Open the **Run and Debug** view (`Ctrl+Shift+D` or `Cmd+Shift+D`).
3. Select the launch configuration **"Run Extension"** and press `F5`.
4. This launches a new VS Code instance - the **Extension Development Host** - running your local compiled build of Agentic Kanban.
5. In the host window, open any workspace and launch the board. You can set breakpoints directly in your code inside the main VS Code window to debug active events!

---

## 4. Diagnostics & Logs

- To log detailed diagnostics, enable `agentKanban.enableLogging` in settings.
- Diagnostic log files are saved to `.agentkanban/logs/`.
- Set the environment variable `AGENT_KANBAN_DEBUG=1` before starting the extension host to print debug statements to the debug console.
