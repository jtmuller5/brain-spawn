import * as vscode from "vscode";
import { ConfigLoader } from "../config/configLoader";
import { TerminalManager } from "../terminals/terminalManager";
import { launchGroup } from "../terminals/terminalGroup";

export function createLaunchCommand(
  configLoader: ConfigLoader,
  terminalManager: TerminalManager
): () => Promise<void> {
  return async () => {
    const config = configLoader.getConfig();

    if (config.groups.length === 0) {
      const action = await vscode.window.showInformationMessage(
        "No spawn groups configured.",
        "Edit Configuration"
      );
      if (action === "Edit Configuration") {
        vscode.commands.executeCommand("brainSpawn.editConfiguration");
      }
      return;
    }

    if (config.groups.length === 1) {
      await launchGroup(config.groups[0], terminalManager);
      return;
    }

    // Multiple groups — show quick pick
    const picked = await vscode.window.showQuickPick(
      config.groups.map((g) => ({
        label: g.name,
        description: `${g.source === "user" ? "User" : "Workspace"} · ${g.terminals.length} terminal${g.terminals.length === 1 ? "" : "s"}`,
        group: g,
      })),
      { placeHolder: "Select a spawn group to launch" }
    );

    if (picked) {
      await launchGroup(picked.group, terminalManager);
    }
  };
}
