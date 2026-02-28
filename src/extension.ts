import * as vscode from "vscode";
import { ConfigLoader } from "./config/configLoader";
import { TerminalManager } from "./terminals/terminalManager";
import { registerCommands } from "./commands/registerCommands";
import { createStatusBar } from "./views/statusBar";
import { SpawnTreeProvider } from "./views/treeView/spawnTreeProvider";

export async function activate(
  context: vscode.ExtensionContext
): Promise<void> {
  const configLoader = new ConfigLoader();
  await configLoader.load();

  const terminalManager = new TerminalManager();
  const treeProvider = new SpawnTreeProvider(configLoader, terminalManager);

  // File watcher + settings listener
  context.subscriptions.push(...configLoader.startWatching());

  // Terminal close cleanup
  context.subscriptions.push(terminalManager.startListening());

  // Commands
  context.subscriptions.push(
    ...registerCommands(context, configLoader, terminalManager, treeProvider)
  );

  // Status bar
  context.subscriptions.push(
    createStatusBar(configLoader, terminalManager)
  );

  // Tree view
  const treeView = vscode.window.createTreeView("brainSpawnGroups", {
    treeDataProvider: treeProvider,
  });
  context.subscriptions.push(treeView);

  // Refresh tree on config changes
  context.subscriptions.push(
    configLoader.onChange(() => treeProvider.refresh())
  );
}

export function deactivate(): void {}
