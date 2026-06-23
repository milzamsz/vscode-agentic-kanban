---
title: Build & Test
description: Guide to verification scripts, tests, linting, and compilation tooling.
---

Agentic Kanban uses esbuild for compilation, Tailwind CSS (PostCSS) for styling, and Vitest for testing. All contributions must pass the verification sequence before pull requests can be merged.

---

## 1. Verification Scripts

The following scripts are defined in `package.json`:

| Command | Script Run | Description |
| --- | --- | --- |
| **`npm run build`** | `node build.mjs` | Compiles the typescript files and styles into static files inside `dist/`. |
| **`npm run watch`** | `node build.mjs --watch` | Watches for code changes and compiles incrementally. |
| **`npm run lint`** | `tsc --noEmit` | Validates typescript types across all source files. |
| **`npm test`** | `vitest run` | Runs the test suite once. |
| **`npm run test:watch`** | `vitest` | Runs the test suite in watch mode. |
| **`npx @vscode/vsce package`** | `vsce package` | Packages the compiled code into an installable `.vsix` file. |

---

## 2. Release Verification Sequence

Before making commits or opening a pull request, run the following verification sequence in your shell:

```bash
# Type check/lint
npm run lint

# Run all unit tests
npm test

# Build production bundle
npm run build

# Package the extension to confirm no packaging issues
npx @vscode/vsce package
```

Ensure all 300+ unit tests remain fully green.

---

## 3. Styling Engine (Tailwind v4)
Styles are defined in `src/webview/board.css` and compiled to `dist/webview/board.css`. Do not wrap custom CSS classes in `@layer components` because Tailwind v4 tree-shaking will remove them if they are not statically found in JS files. Use standard top-level CSS classes instead.
