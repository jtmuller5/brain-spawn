# PROJECT.md

## Brain Spawn

A VS Code extension that lets you define and launch groups of pre-configured terminals with a single command. It includes a webview dashboard for monitoring terminal state, and integrates with Claude Code via hooks to track Claude session activity (busy/idle/waiting status, chat history, event logs).

## Tech Stack

- **Runtime**: VS Code Extension API (vscode ^1.85.0)
- **Language**: TypeScript 5.3+ (strict mode)
- **Bundler**: esbuild (custom `esbuild.js` config)
- **Target**: Node 18, CommonJS
- **UI**: VS Code Webview API with vanilla JS/CSS (no framework)
- **Icons**: @vscode/codicons

## Development Commands

| Command | Description |
|---------|-------------|
| `npm run build` | Production build (minified, copies codicon assets) |
| `npm run watch` | Dev build with file watching (no minification) |
| `npm run package` | Package as `.vsix` for distribution (`vsce package`) |

## Testing

Press F5 in VS Code to launch the Extension Development Host. Reload the host window after rebuilds to pick up changes.

## Prerequisites

- Node.js 18+
- npm
- VS Code ^1.85.0
- `vsce` CLI (for packaging): `npm install -g @vscode/vsce`
