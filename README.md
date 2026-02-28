# Brain Spawn

Define and launch groups of pre-configured terminals with a single command.

## Features

- **Spawn Groups** — Define named groups of terminals, each with its own command, icon, color, working directory, and environment variables.
- **One-Click Launch** — Launch an entire group of terminals from the command palette, status bar, or the sidebar tree view.
- **Kill Groups** — Tear down all terminals in a group at once.
- **Launch Individual Terminals** — Start a single terminal from a group without launching the rest.
- **Activity Bar View** — Browse and manage your spawn groups from a dedicated sidebar panel.
- **Visual Configuration Editor** — Edit your spawn groups through a built-in webview UI.
- **Workspace + User Scopes** — Define groups per-project in `.vscode/brain-spawn.json` or globally in your VS Code user settings. Both are merged automatically.
- **Variable Substitution** — Use `${workspaceFolder}`, `${workspaceFolderBasename}`, and `${env:VAR_NAME}` in commands, paths, and environment values.

## Getting Started

1. Open the command palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and run **Brain Spawn: Edit Configuration** to open the visual editor, or create `.vscode/brain-spawn.json` manually:

```json
{
  "version": 1,
  "groups": [
    {
      "name": "Dev Server",
      "terminals": [
        {
          "name": "Frontend",
          "command": "npm run dev",
          "icon": "globe",
          "color": "cyan"
        },
        {
          "name": "Backend",
          "command": "npm run serve",
          "icon": "server",
          "color": "green"
        }
      ]
    }
  ]
}
```

2. Press `Ctrl+Shift+T` (`Cmd+Shift+T` on Mac) or run **Brain Spawn: Launch** to start your terminals.

## Commands

| Command | Description |
|---|---|
| `Brain Spawn: Launch` | Launch a spawn group (auto-selects if only one exists) |
| `Brain Spawn: Launch Group...` | Pick a spawn group to launch |
| `Brain Spawn: Kill Group...` | Pick a running group to terminate |
| `Brain Spawn: Edit Configuration` | Open the visual configuration editor |

## Terminal Options

Each terminal in a group supports:

| Property | Type | Description |
|---|---|---|
| `name` | `string` | **Required.** Terminal tab name |
| `command` | `string` | Command to run on launch |
| `icon` | `string` | [Codicon](https://microsoft.github.io/vscode-codicons/dist/codicon.html) name (default: `terminal`) |
| `color` | `string` | Tab color: `black`, `red`, `green`, `yellow`, `blue`, `magenta`, `cyan`, `white` |
| `cwd` | `string` | Working directory |
| `env` | `object` | Environment variables |
| `focus` | `boolean` | Focus this terminal after launch |

## User-Level Groups

To define groups that follow you across all workspaces, add them to your VS Code settings:

```json
{
  "brainSpawn.groups": [
    {
      "name": "Scratch",
      "terminals": [
        { "name": "Node REPL", "command": "node" }
      ]
    }
  ]
}
```

User groups appear alongside workspace groups in the sidebar and command palette.

## Variable Substitution

Commands, `cwd`, and `env` values support these variables:

| Variable | Value |
|---|---|
| `${workspaceFolder}` | Absolute path to the workspace root |
| `${workspaceFolderBasename}` | Name of the workspace folder |
| `${env:VAR_NAME}` | Value of environment variable `VAR_NAME` |

## Keybinding

| Shortcut | Command |
|---|---|
| `Ctrl+Shift+T` / `Cmd+Shift+T` | Brain Spawn: Launch |

## License

[MIT](LICENSE)
