# Brain Spawn - VS Code Extension

A VS Code extension that lets you define and launch groups of pre-configured terminals with a single command. It includes a webview dashboard for monitoring terminal state, and integrates with Claude Code via hooks to track Claude session activity (busy/idle/waiting status, chat history, event logs).

Key components:
- **TerminalManager** - Manages terminal lifecycle and groups
- **ClaudeMonitor** - Tracks Claude Code session state via a local HTTP hook server
- **DashboardPanel** - Webview UI showing terminal cards with live status, chat history, and event logs
- **HookServer** - HTTP server receiving Claude Code hook events (PreToolUse, PostToolUse, Stop, etc.)
- **HookConfigWriter** - Writes/removes hook config in `.claude/settings.local.json`

## Development

- Run `npm run watch` before starting development. This auto-rebuilds TypeScript on changes via esbuild.
- Files in `media/webview/` (CSS, fonts, JS) are served directly to the webview and don't need a build step.
- Files in `src/` (TypeScript) must be built before changes appear in the Extension Development Host.
- To test, press F5 to launch the Extension Development Host, then reload it after rebuilds.

## Project Structure

- `src/` - TypeScript source (bundled by esbuild)
- `media/webview/` - Static assets served directly to the webview (CSS, JS, fonts)
- `media/webview/codicon.css` and `codicon.ttf` - Copied from `@vscode/codicons` package. If icons are missing, re-copy from `node_modules/@vscode/codicons/dist/`.
