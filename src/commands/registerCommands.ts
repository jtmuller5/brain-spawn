import * as vscode from "vscode";
import { TerminalManager } from "../terminals/terminalManager";
import { ClaudeMonitor } from "../hooks/claudeMonitor";
import { DashboardPanel } from "../webview/dashboardPanel";
import { launchNewTerminal, launchOneTerminal, launchPlanTerminal, launchWorktreeTerminal } from "../terminals/terminalGroup";

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
    vscode.commands.registerCommand("brainSpawn.newWorktreeTerminal", () => {
      launchWorktreeTerminal(terminalManager);
    }),
    vscode.commands.registerCommand("brainSpawn.openDashboard", () => {
      if (claudeMonitor) {
        DashboardPanel.createOrShow(context, claudeMonitor, terminalManager);
      }
    }),
    vscode.commands.registerCommand("brainSpawn.closeUntracked", () => {
      const allTerminals = vscode.window.terminals;
      const untracked = allTerminals.filter(t => !terminalManager.isTracked(t));
      if (untracked.length > 0) {
        claudeMonitor?.suppressUnknownTerminals();
        for (const t of untracked) {
          t.dispose();
        }
        vscode.window.showInformationMessage(`Closed ${untracked.length} untracked terminal(s).`);
      } else {
        vscode.window.showInformationMessage("No untracked terminals to close.");
      }
    }),
  ];
}
