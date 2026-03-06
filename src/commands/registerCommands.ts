import * as vscode from "vscode";
import { TerminalManager } from "../terminals/terminalManager";
import { ClaudeMonitor } from "../hooks/claudeMonitor";
import { DashboardPanel } from "../webview/dashboardPanel";
import { launchNewTerminal, launchOneTerminal, launchPlanTerminal } from "../terminals/terminalGroup";

export function registerCommands(
  context: vscode.ExtensionContext,
  terminalManager: TerminalManager,
  claudeMonitor?: ClaudeMonitor
): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand("brainSpawn.launch", () => {
      launchNewTerminal(terminalManager);
    }),
    vscode.commands.registerCommand("brainSpawn.newTerminal", () => {
      launchOneTerminal(terminalManager);
    }),
    vscode.commands.registerCommand("brainSpawn.newPlanTerminal", () => {
      launchPlanTerminal(terminalManager);
    }),
    vscode.commands.registerCommand("brainSpawn.openDashboard", () => {
      if (claudeMonitor) {
        DashboardPanel.createOrShow(context, claudeMonitor, terminalManager);
      }
    }),
  ];
}
