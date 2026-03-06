import * as vscode from "vscode";
import { TerminalManager } from "./terminals/terminalManager";
import { registerCommands } from "./commands/registerCommands";
import { DashboardPanel } from "./webview/dashboardPanel";
import { ClaudeMonitor } from "./hooks/claudeMonitor";
import { HookServer } from "./hooks/hookServer";
import { writeHookConfig, removeHookConfig } from "./hooks/hookConfigWriter";
import { setClaudeMonitor } from "./terminals/terminalGroup";

let hookServer: HookServer | undefined;

export async function activate(
  context: vscode.ExtensionContext
): Promise<void> {
  const terminalManager = new TerminalManager();

  // Close all pre-existing terminals (VS Code restores them async after activation)
  for (const terminal of vscode.window.terminals) {
    terminal.dispose();
  }
  // Only dispose stale restored terminals briefly after activation
  const staleTerminalListener = vscode.window.onDidOpenTerminal((terminal) => {
    if (!terminalManager.isTracked(terminal)) {
      terminal.dispose();
    }
  });
  setTimeout(() => staleTerminalListener.dispose(), 3000);

  // Claude monitoring
  const claudeMonitor = new ClaudeMonitor();
  setClaudeMonitor(claudeMonitor);

  hookServer = new HookServer(claudeMonitor);
  try {
    await hookServer.start();
    await writeHookConfig(hookServer.port);
  } catch (err) {
    vscode.window.showWarningMessage(
      `Brain Spawn: Failed to start hook server: ${err}`
    );
  }

  // Terminal close cleanup
  context.subscriptions.push(terminalManager.startListening());

  // Commands
  context.subscriptions.push(
    ...registerCommands(context, terminalManager, claudeMonitor)
  );

  // Auto-open dashboard
  const config = vscode.workspace.getConfiguration("brainSpawn");
  if (config.get<boolean>("openDashboardOnStart")) {
    DashboardPanel.createOrShow(context, claudeMonitor, terminalManager);
  }

}

export async function deactivate(): Promise<void> {
  if (hookServer) {
    hookServer.dispose();
    hookServer = undefined;
  }
  try {
    await removeHookConfig();
  } catch {
    // Best-effort cleanup
  }
}
