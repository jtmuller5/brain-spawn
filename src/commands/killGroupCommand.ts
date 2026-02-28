import * as vscode from "vscode";
import { ConfigLoader } from "../config/configLoader";
import { TerminalManager } from "../terminals/terminalManager";

export function createKillGroupCommand(
  configLoader: ConfigLoader,
  terminalManager: TerminalManager
): () => Promise<void> {
  return async () => {
    const running = terminalManager.getRunningGroupNames();

    if (running.length === 0) {
      vscode.window.showInformationMessage(
        "No Brain Spawn terminal groups are running."
      );
      return;
    }

    const picked = await vscode.window.showQuickPick(
      running.map((name) => ({
        label: name,
        description: `${terminalManager.getGroupTerminals(name).length} terminal(s)`,
      })),
      { placeHolder: "Select a group to kill" }
    );

    if (picked) {
      terminalManager.killGroup(picked.label);
    }
  };
}
