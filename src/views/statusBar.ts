import * as vscode from "vscode";
import { ConfigLoader } from "../config/configLoader";
import { TerminalManager } from "../terminals/terminalManager";

export function createStatusBar(
  configLoader: ConfigLoader,
  terminalManager: TerminalManager,
): vscode.Disposable {
  const item = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    50,
  );
  item.command = "brainSpawn.launch";
  item.text = "$(terminal-bash) Brain Spawn";

  function update() {
    const count = terminalManager.getActiveTerminalCount();
    const running = terminalManager.getRunningGroupNames();

    if (count > 0) {
      item.text = `$(terminal-bash) Brain Spawn`;
      item.tooltip = `Active: ${running.join(", ")} (${count} terminal${count === 1 ? "" : "s"})`;
      (item as any).badge = count > 0 ? count : undefined;
    } else {
      item.text = "$(terminal-bash) Brain Spawn";
      item.tooltip = "Click to launch a spawn group";
      (item as any).badge = undefined;
    }
  }

  update();
  item.show();

  const configSub = configLoader.onChange(() => update());
  const termSub = terminalManager.onDidChange(() => update());

  return new vscode.Disposable(() => {
    item.dispose();
    configSub.dispose();
    termSub.dispose();
  });
}
