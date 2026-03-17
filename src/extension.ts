import * as vscode from "vscode";
import * as http from "http";
import { TerminalManager } from "./terminals/terminalManager";
import { registerCommands } from "./commands/registerCommands";
import { DashboardPanel } from "./webview/dashboardPanel";
import { ClaudeMonitor } from "./hooks/claudeMonitor";
import { HookServer } from "./hooks/hookServer";
import { writeHookConfig, removeHookConfig, findExistingHookPort } from "./hooks/hookConfigWriter";
import { setClaudeMonitor } from "./terminals/terminalGroup";
import { TerminalTreeProvider } from "./views/terminalTreeProvider";

let hookServer: HookServer | undefined;
let activeHookPort: number | undefined;

function isHookServerAlive(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.request(
      { host: "127.0.0.1", port, path: "/health", method: "GET", timeout: 1000 },
      (res) => {
        let body = "";
        res.on("data", (chunk: Buffer) => { body += chunk.toString(); });
        res.on("end", () => {
          try {
            const data = JSON.parse(body);
            resolve(data.name === "brain-spawn");
          } catch {
            resolve(false);
          }
        });
      }
    );
    req.on("error", () => resolve(false));
    req.on("timeout", () => { req.destroy(); resolve(false); });
    req.end();
  });
}

export async function activate(
  context: vscode.ExtensionContext
): Promise<void> {
  const config = vscode.workspace.getConfiguration("brainSpawn");
  const terminalManager = new TerminalManager();
  const claudeMonitor = new ClaudeMonitor();
  setClaudeMonitor(claudeMonitor);

  let ownsHookServer = false;

  if (config.get<boolean>("autoStart", true)) {
    // Check if another Brain Spawn window already has a hook server running
    const existingPort = await findExistingHookPort();
    const existingAlive = existingPort ? await isHookServerAlive(existingPort) : false;

    if (existingAlive) {
      // Reuse existing server — just ensure hook configs point to it
      activeHookPort = existingPort!;
      await writeHookConfig(activeHookPort);
    } else {
      // Start our own hook server
      hookServer = new HookServer(claudeMonitor);
      try {
        await hookServer.start();
        activeHookPort = hookServer.port;
        await writeHookConfig(activeHookPort);
        ownsHookServer = true;
      } catch (err) {
        vscode.window.showWarningMessage(
          `Brain Spawn: Failed to start hook server: ${err}`
        );
      }
    }


    // Terminal close cleanup
    context.subscriptions.push(terminalManager.startListening());
  }

  // Commands (always registered so the user can manually trigger)
  context.subscriptions.push(
    ...registerCommands(context, terminalManager, claudeMonitor, () => activeHookPort)
  );

  // Sidebar tree view
  const treeProvider = new TerminalTreeProvider(terminalManager, claudeMonitor);
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("brainSpawnTerminals", treeProvider),
    vscode.commands.registerCommand("brainSpawn.sidebar.focusTerminal", (terminalId: string) => {
      // Open the dashboard and let it focus the terminal
      if (claudeMonitor) {
        DashboardPanel.createOrShow(context, claudeMonitor, terminalManager);
      }
    }),
    vscode.commands.registerCommand("brainSpawn.sidebar.showTerminal", (item: { terminalId?: string }) => {
      if (!item?.terminalId) { return; }
      // Find the vscode.Terminal and reveal it
      for (const groupName of terminalManager.getRunningGroupNames()) {
        for (const terminal of terminalManager.getGroupTerminals(groupName)) {
          const opts = terminal.creationOptions as vscode.TerminalOptions;
          if (opts.env?.["BRAIN_SPAWN_TERMINAL_ID"] === item.terminalId) {
            terminal.show();
            return;
          }
        }
      }
    })
  );

  // Auto-open dashboard (independent of autoStart/hook server)
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
