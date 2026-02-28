import * as vscode from "vscode";
import { ConfigLoader } from "../config/configLoader";
import { TerminalManager } from "../terminals/terminalManager";
import { SpawnTreeProvider } from "../views/treeView/spawnTreeProvider";
import { GroupTreeItem, TerminalTreeItem } from "../views/treeView/spawnTreeItems";
import { createLaunchCommand } from "./launchCommand";
import { createLaunchGroupCommand } from "./launchGroupCommand";
import { createKillGroupCommand } from "./killGroupCommand";
import { createEditConfigCommand } from "./editConfigCommand";
import { launchGroup, launchSingleTerminal } from "../terminals/terminalGroup";

export function registerCommands(
  context: vscode.ExtensionContext,
  configLoader: ConfigLoader,
  terminalManager: TerminalManager,
  treeProvider: SpawnTreeProvider
): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand(
      "brainSpawn.launch",
      createLaunchCommand(configLoader, terminalManager)
    ),
    vscode.commands.registerCommand(
      "brainSpawn.launchGroup",
      createLaunchGroupCommand(configLoader, terminalManager)
    ),
    vscode.commands.registerCommand(
      "brainSpawn.killGroup",
      createKillGroupCommand(configLoader, terminalManager)
    ),
    vscode.commands.registerCommand(
      "brainSpawn.editConfiguration",
      createEditConfigCommand(context, configLoader)
    ),
    vscode.commands.registerCommand(
      "brainSpawn.launchGroupInline",
      async (item: GroupTreeItem) => {
        const group = configLoader
          .getConfig()
          .groups.find((g) => g.name === item.groupName && g.source === item.source);
        if (group) {
          await launchGroup(group, terminalManager);
          treeProvider.refresh();
        }
      }
    ),
    vscode.commands.registerCommand(
      "brainSpawn.killGroupInline",
      (item: GroupTreeItem) => {
        terminalManager.killGroup(item.groupName);
        treeProvider.refresh();
      }
    ),
    vscode.commands.registerCommand(
      "brainSpawn.launchTerminal",
      (item: TerminalTreeItem) => {
        launchSingleTerminal(item.terminalDef, item.groupName, terminalManager);
        treeProvider.refresh();
      }
    ),
  ];
}
