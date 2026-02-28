# Changelog

## 0.1.0

Initial release.

- Define spawn groups in `.vscode/brain-spawn.json` or VS Code user settings
- Launch, kill, and manage terminal groups from the command palette
- Activity bar sidebar with tree view for browsing groups and terminals
- Inline launch/kill buttons in the tree view
- Launch individual terminals from a group
- Visual configuration editor (webview)
- Status bar item showing active terminal count
- Custom icons and colors per terminal (codicons + ANSI colors)
- Variable substitution: `${workspaceFolder}`, `${workspaceFolderBasename}`, `${env:VAR_NAME}`
- Auto-reload on config file or settings changes
- Keyboard shortcut `Ctrl+Shift+T` / `Cmd+Shift+T` to launch
