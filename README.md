# Brain Spawn

Spawn a swarm of Claude terminals with a single command.

[VS Code Extension](https://marketplace.visualstudio.com/manage/publishers/codeontherocks/extensions/brain-spawn/hub)

![Brain Spawn Demo](media/demo.gif)

## Features

- **Instant Swarm** — Launch a batch of Claude terminals at once, each with a random name, icon, and color (max 10).
- **Add More** — Spawn additional terminals one at a time.
- **Plan Mode** — Spawn a terminal in `--permission-mode plan` for read-only exploration.
- **Worktree Mode** — Spawn a terminal with `--worktree` so Claude works on its own git branch.
- **Fork Session** — Fork a running Claude session into a new terminal from the dashboard.
- **Live Dashboard** — Monitor all terminals with real-time busy/idle/waiting status, chat history, edited files, and event logs via Claude Code hooks.
- **Custom Command** — Override the default `claude` command via a single VS Code setting.

## Getting Started

1. Install the extension.
2. Press `Cmd+Shift+T` (`Ctrl+Shift+T` on Windows/Linux) or run **Brain Spawn: Launch** from the command palette.
3. A batch of Claude terminals appear, ready to go.
4. Run **Brain Spawn: Dashboard** to open the live monitoring dashboard.

## Commands

| Command | Shortcut | Description |
|---|---|---|
| `Brain Spawn: Launch` | `Cmd+Shift+T` | Spawn a batch of Claude terminals |
| `Brain Spawn: New Terminal` | — | Spawn 1 additional terminal |
| `Brain Spawn: New Plan Terminal` | — | Spawn a terminal in plan mode (read-only) |
| `Brain Spawn: New Worktree Terminal` | — | Spawn a terminal with `--worktree` |
| `Brain Spawn: Dashboard` | — | Open the live terminal monitoring dashboard |

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
