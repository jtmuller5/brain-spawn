# Manual Setup

## To test the extension
1. Open this folder in VS Code
2. Press F5 to launch the Extension Development Host
3. In the new window, the test `.vscode/brain-spawn.json` is already present

## To test specific features
- **Ctrl+Shift+T / Cmd+Shift+T** — launches the "Full Stack Dev" group (auto-picks since there's only one)
- **Command Palette > Brain Spawn: Launch Group...** — always shows quick pick
- **Command Palette > Brain Spawn: Kill Group...** — kills running groups
- **Command Palette > Brain Spawn: Edit Configuration** — opens the webview config editor
- **Activity bar** — Brain Spawn icon shows tree view of groups + terminals with inline play/stop actions
- **Status bar** — Brain Spawn item in bottom bar, click to launch

## To publish
1. `npm install -g @vscode/vsce`
2. Update `publisher` in package.json to your VS Code Marketplace publisher ID
3. `vsce package` to create a `.vsix`
4. `vsce publish` to publish