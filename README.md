# Brain Spawn

Spawn a swarm of Claude terminals with a single command.

[VS Code Extension](https://marketplace.visualstudio.com/manage/publishers/codeontherocks/extensions/brain-spawn/hub)

![Brain Spawn Demo](media/demo.gif)

## Features

- **Instant Swarm** — Launch 5 Claude terminals at once, each with a random name, icon, and color.
- **Add More** — Spawn additional terminals one at a time.
- **Dashboard** — Monitor all your Claude terminals and their status from a built-in webview.
- **Custom Command** — Override the default `claude` command via a single VS Code setting.

## Getting Started

1. Install the extension.
2. Press `Cmd+Shift+T` (`Ctrl+Shift+T` on Windows/Linux) or run **Brain Spawn: Launch** from the command palette.
3. Five Claude terminals appear, ready to go.

## Commands

| Command | Shortcut | Description |
|---|---|---|
| `Brain Spawn: Launch` | `Cmd+Shift+T` | Spawn 5 Claude terminals |
| `Brain Spawn: New Terminal` | — | Spawn 1 additional terminal |
| `Brain Spawn: Dashboard` | — | Open the terminal status dashboard |

## Settings

| Setting | Default | Description |
|---|---|---|
| `brainSpawn.command` | `"claude"` | Command to run in each spawned terminal |

To use a different command, add this to your VS Code settings:

```json
{
  "brainSpawn.command": "claude --model sonnet"
}
```

## License

[MIT](LICENSE)
