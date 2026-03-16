# ARCHITECTURE.md

## Runtime Model

Brain Spawn runs as a VS Code extension in the **Extension Host** process. It manages terminal instances, runs an HTTP server for hook events, and renders a webview dashboard — all within VS Code's extension lifecycle.

## Directory Structure

```
src/
├── extension.ts              # Activation/deactivation, wires up all components
├── fileSets.ts               # File set CRUD (persisted to .brain-spawn/file-sets.json)
├── commands/
│   └── registerCommands.ts   # VS Code command registrations
├── hooks/
│   ├── hookServer.ts         # Local HTTP server receiving Claude Code hook events
│   ├── hookConfigWriter.ts   # Writes/removes hook config in .claude/settings.local.json
│   └── claudeMonitor.ts      # State machine tracking per-terminal Claude session state
├── terminals/
│   ├── terminalManager.ts    # Terminal group lifecycle (track, kill, capacity)
│   └── terminalGroup.ts      # Terminal creation with random names/icons/colors
├── views/
│   └── terminalTreeProvider.ts  # Sidebar tree view data provider
└── webview/
    └── dashboardPanel.ts     # Webview panel: HTML generation, message handling, tab tracking

media/webview/
├── dashboard.css             # Dashboard styles (served directly, no build step)
├── dashboard.js              # Dashboard client-side logic (vanilla JS)
├── codicon.css               # Copied from @vscode/codicons at build time
└── codicon.ttf               # Copied from @vscode/codicons at build time
```

## Communication Patterns

### Hook Event Flow (Claude Code → Extension)

```
Claude Code session
  → HTTP POST /hooks (with X-Terminal-Id header)
    → HookServer.handleHook()
      → ClaudeMonitor.handleHookEvent()
        → Updates per-terminal state (status, chat history, edited files)
        → Fires onDidChange callbacks
          → DashboardPanel.sendState() → webview postMessage
          → TerminalTreeProvider.refresh()
```

Hook events: `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `Notification`, `Stop`, `SessionEnd`

Events that only support `type: "command"` hooks (not HTTP): `SessionStart`, `SessionEnd`, `Notification`. These use a `curl` command wrapper to POST to the same HTTP endpoint.

### Webview ↔ Extension

The dashboard communicates with the extension via VS Code's `postMessage` API:

- **Extension → Webview**: `panel.webview.postMessage({ type, ... })` — state updates, event logs, usage results
- **Webview → Extension**: `vscode.postMessage({ type, ... })` → `handleMessage()` in `DashboardPanel`

### Terminal Identification

Each Brain Spawn terminal gets a UUID stored in its environment as `BRAIN_SPAWN_TERMINAL_ID`. This ID is:
- Set when the terminal is created (`terminalGroup.ts`)
- Passed in the `X-Terminal-Id` HTTP header by Claude Code hooks
- Used to correlate hook events with dashboard cards

External Claude sessions (not spawned by Brain Spawn) are auto-adopted when hook events arrive with an unknown terminal ID.

## Key Data Models

### ClaudeTerminalState (claudeMonitor.ts)
Per-terminal state: `terminalId`, `status` (idle/busy/waiting), `chatHistory`, `editedFiles`, `sessionId`, metadata (name, group, icon, color).

### HookEvent (claudeMonitor.ts)
Incoming hook payload: `hook_event_name`, `prompt`, `last_assistant_message`, `tool_name`, `tool_input`, `session_id`.

### FileSet (fileSets.ts)
Named collection of workspace-relative file paths, persisted to `.brain-spawn/file-sets.json`.

## Settings & Storage

- **Hook config**: Written to `.claude/settings.local.json` per workspace folder. Entries are tagged with a `_marker: "brain-spawn-hook"` for safe merge/removal.
- **File sets**: Stored in `.brain-spawn/file-sets.json` in the workspace root.
- **Extension settings** (in `package.json` contributes.configuration):
  - `brainSpawn.command` — legacy single command
  - `brainSpawn.commands` — array of named commands
  - `brainSpawn.autoStart` — auto-start hook server and monitoring
  - `brainSpawn.openDashboardOnStart` — auto-open dashboard

## Multi-Window Behavior

When multiple VS Code windows have Brain Spawn active, only one hook server runs. On activation, the extension checks for an existing hook server via `findExistingHookPort()` + a `/health` probe. If alive, it reuses that port; otherwise it starts its own. A file system watcher on `.claude/settings.local.json` auto-reinstalls hooks if they go missing.
