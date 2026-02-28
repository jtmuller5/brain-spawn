# Brain Spawn — Product Requirements Document

## Overview

**Brain Spawn** is a VS Code extension that lets users define and launch groups of pre-configured terminals with a single command. Each terminal can have a custom name, icon, color, and startup command. Designed for developers who routinely spin up the same set of processes (dev server, API, database, tests, etc.) every time they open a project.

## Problem

Developers working on multi-service projects repeatedly perform the same manual steps each session: open 3-5 terminals, name them, and run the same commands. This is tedious, error-prone, and wastes time. VS Code's built-in tasks system can run commands but lacks the terminal-level customization (icons, colors, naming) and the simple UX of "spawn my whole workspace in one click."

## Target Users

- Developers working on full-stack or multi-service projects
- Teams that want to share standardized terminal setups via version control
- Anyone who opens the same set of terminals every coding session

## Core Concepts

### Spawn Group

A named collection of terminal definitions that are launched together. Examples: "Full Stack Dev", "Tests Only", "Docker Services".

### Terminal Definition

A single terminal configuration within a spawn group, specifying its name, command, icon, color, and optional working directory.

---

## Features

### 1. Spawn Groups via Command Palette

**Commands:**

- `Brain Spawn: Launch` — If only one group exists, launch it. If multiple, show a quick pick to choose.
- `Brain Spawn: Launch Group...` — Always show quick pick to select a group.
- `Brain Spawn: Kill Group...` — Kill all terminals belonging to a selected group.
- `Brain Spawn: Edit Configuration` — Open the Brain Spawn settings UI.

**Keyboard Shortcut (default):**

- `Ctrl+Shift+T` / `Cmd+Shift+T` — Bound to `Brain Spawn: Launch`

### 2. Terminal Definitions

Each terminal definition supports:

| Field     | Type    | Required | Description                                                                                                |
| --------- | ------- | -------- | ---------------------------------------------------------------------------------------------------------- |
| `name`    | string  | Yes      | Terminal tab title                                                                                         |
| `command` | string  | No       | Shell command to run on open                                                                               |
| `icon`    | string  | No       | Codicon name (e.g. `server`, `flame`, `database`). Defaults to `terminal`.                                 |
| `color`   | string  | No       | Terminal ansi color name (e.g. `green`, `blue`, `cyan`). Maps to `terminal.ansi{Color}`. Defaults to none. |
| `cwd`     | string  | No       | Working directory. Supports `${workspaceFolder}` variable. Defaults to workspace root.                     |
| `env`     | object  | No       | Additional environment variables as key-value pairs.                                                       |
| `focus`   | boolean | No       | If true, this terminal receives focus after the group launches. Only one per group. Defaults to false.     |

### 3. Configuration UI (Webview)

A webview-based settings page accessible via command palette or the activity bar icon.

**Layout:**

- Left sidebar: List of spawn groups with add/delete controls
- Main panel: Selected group's terminal list

**Group Management:**

- Add new group (name input)
- Rename group (inline edit)
- Delete group (with confirmation)
- Duplicate group
- Reorder groups (drag and drop)

**Terminal Management (within a group):**

- Add terminal definition
- Remove terminal definition (with confirmation)
- Reorder terminals (drag and drop)
- Per-terminal form fields:
  - Name (text input)
  - Command (text input, monospace)
  - Icon (dropdown/picker showing codicon previews)
  - Color (color swatches matching VS Code terminal ansi palette)
  - Working directory (text input with folder picker button)
  - Environment variables (key-value pair editor)
  - Focus toggle

**Live Preview:** Each terminal definition row shows a styled preview of what the tab will look like (icon + color + name).

### 4. Configuration Storage

Configuration is stored in `.vscode/brain-spawn.json` at the workspace root so it can be committed and shared with teammates.

**Schema:**

```jsonc
{
  "version": 1,
  "groups": [
    {
      "name": "Full Stack Dev",
      "terminals": [
        {
          "name": "Frontend",
          "command": "npm run dev",
          "icon": "browser",
          "color": "green",
          "cwd": "${workspaceFolder}/client",
        },
        {
          "name": "API Server",
          "command": "npm run server",
          "icon": "server",
          "color": "blue",
          "cwd": "${workspaceFolder}/server",
        },
        {
          "name": "Database",
          "command": "docker compose up db",
          "icon": "database",
          "color": "yellow",
        },
        {
          "name": "Tests",
          "command": "npm run test:watch",
          "icon": "beaker",
          "color": "magenta",
          "cwd": "${workspaceFolder}/server",
        },
      ],
    },
  ],
}
```

**Fallback:** If no `.vscode/brain-spawn.json` exists, the extension also reads from VS Code user/workspace settings under `brainSpawn.groups` to support per-user configs that aren't committed.

### 5. Status Bar Integration

- A status bar item shows the Brain Spawn icon (codicon: `terminal-bash` or custom)
- Click to launch (single group) or pick a group (multiple groups)
- Tooltip shows the active group name if terminals are running
- Badge count showing number of active Brain Spawn terminals

### 6. Activity Bar (Optional)

A Brain Spawn icon in the activity bar opens a tree view:

- Top level: Spawn groups
- Children: Terminal definitions with icon/color indicators
- Inline actions: Launch group, edit group, launch single terminal
- Context menu: Kill group, kill terminal

---

## Behavioral Details

### Launch Behavior

1. Terminals are created sequentially (in definition order)
2. Each terminal's `sendText` is called immediately after creation
3. The terminal marked with `focus: true` gets `show()` called last
4. If no terminal has `focus: true`, the last terminal in the list is focused
5. If a group's terminals are already running (tracked by name), prompt: "Group already running. Kill and relaunch?"

### Kill Behavior

1. `Kill Group` disposes all terminals whose names match the group's terminal definitions
2. Terminals are matched by name prefix to handle VS Code's automatic numbering of duplicate names

### Variable Substitution

Support standard VS Code variables in `command` and `cwd` fields:

- `${workspaceFolder}` — workspace root path
- `${workspaceFolderBasename}` — workspace folder name
- `${env:VARIABLE_NAME}` — environment variable value

---

## Non-Goals (v1)

- **Task integration** — Not replacing VS Code tasks; this is terminal-focused
- **Terminal output capture/logging** — Just spawning, not monitoring
- **Remote/SSH terminals** — Local terminals only for v1
- **Auto-launch on workspace open** — Considered for v2 (via a `"autoLaunch": true` flag on groups)
- **Conditional terminals** — No if/else logic for platform-specific commands in v1

## Future Considerations (v2+)

- Auto-launch groups when workspace opens
- Platform-specific command overrides (`commandWindows`, `commandMac`, `commandLinux`)
- Import/export groups as shareable JSON
- Terminal health monitoring (restart if process exits)
- Profiles (e.g., "dev" vs "staging" environment variable sets)
- Integration with VS Code tasks for pre-launch steps

---

## Technical Notes

### Extension Activation

- Activate on command (`onCommand:brainSpawn.*`)
- Activate on presence of `.vscode/brain-spawn.json` (`workspaceContains`)

### Dependencies

- No external dependencies required
- Uses only VS Code extension API (`vscode.window.createTerminal`, `vscode.commands`, webview API)

### Terminal Tracking

- Maintain an internal map of group name → terminal instances
- Listen to `vscode.window.onDidCloseTerminal` to clean up references
- Use `terminal.processId` to verify terminal is still alive before operations

### Webview Security

- Use `nonce`-based CSP for webview scripts
- Communicate between webview and extension via `postMessage`/`onDidReceiveMessage`
- Persist form state on webview hide/show using `retainContextWhenHidden` or state serialization
