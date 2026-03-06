import * as vscode from "vscode";
import { ClaudeMonitor } from "../hooks/claudeMonitor";
import { TerminalManager } from "../terminals/terminalManager";
import { forkTerminal } from "../terminals/terminalGroup";

export class DashboardPanel {
  private static currentPanel: DashboardPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly monitor: ClaudeMonitor;
  private readonly terminalManager: TerminalManager;
  private disposables: vscode.Disposable[] = [];

  static createOrShow(
    context: vscode.ExtensionContext,
    monitor: ClaudeMonitor,
    terminalManager: TerminalManager
  ): void {
    if (DashboardPanel.currentPanel) {
      DashboardPanel.currentPanel.panel.reveal();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "brainSpawnDashboard",
      "Brain Spawn: Dashboard",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, "media"),
        ],
      }
    );

    DashboardPanel.currentPanel = new DashboardPanel(
      panel,
      context,
      monitor,
      terminalManager
    );
  }

  private constructor(
    panel: vscode.WebviewPanel,
    context: vscode.ExtensionContext,
    monitor: ClaudeMonitor,
    terminalManager: TerminalManager
  ) {
    this.panel = panel;
    this.monitor = monitor;
    this.terminalManager = terminalManager;

    this.panel.webview.html = this.getHtml(context);

    this.panel.webview.onDidReceiveMessage(
      (msg) => this.handleMessage(msg),
      undefined,
      this.disposables
    );

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    const monitorSub = this.monitor.onDidChange(() => this.sendState());
    this.disposables.push(monitorSub);

    const termSub = vscode.window.onDidChangeActiveTerminal((t) =>
      this.sendActiveTerminalId(t)
    );
    this.disposables.push(termSub);
  }

  private sendState(): void {
    this.panel.webview.postMessage({
      type: "state",
      terminals: this.monitor.getStates(),
    });
    this.sendActiveTerminalId(vscode.window.activeTerminal);
  }

  private sendActiveTerminalId(
    terminal: vscode.Terminal | undefined
  ): void {
    let activeId: string | null = null;
    if (terminal) {
      const env = (terminal.creationOptions as vscode.TerminalOptions).env;
      if (env?.["BRAIN_SPAWN_TERMINAL_ID"]) {
        activeId = env["BRAIN_SPAWN_TERMINAL_ID"];
      }
    }
    this.panel.webview.postMessage({
      type: "activeTerminal",
      terminalId: activeId,
    });
  }

  private handleMessage(msg: {
    type: string;
    terminalId?: string;
    text?: string;
    description?: string;
    name?: string;
  }): void {
    switch (msg.type) {
      case "ready":
        this.sendState();
        break;
      case "focusTerminal":
        if (msg.terminalId) {
          this.focusTerminal(msg.terminalId);
        }
        break;
      case "sendText":
        if (msg.terminalId && msg.text) {
          this.sendTextToTerminal(msg.terminalId, msg.text);
        }
        break;
      case "closeTerminal":
        if (msg.terminalId) {
          this.closeTerminal(msg.terminalId);
        }
        break;
      case "setDescription":
        if (msg.terminalId && msg.description !== undefined) {
          this.monitor.setDescription(msg.terminalId, msg.description);
        }
        break;
      case "setName":
        if (msg.terminalId && msg.name) {
          this.monitor.setName(msg.terminalId, msg.name);
        }
        break;
      case "launch":
        vscode.commands.executeCommand("brainSpawn.launch");
        break;
      case "newTerminal":
        vscode.commands.executeCommand("brainSpawn.newTerminal");
        break;
      case "newPlanTerminal":
        vscode.commands.executeCommand("brainSpawn.newPlanTerminal");
        break;
      case "newPlainTerminal": {
        if (this.terminalManager.getRemainingCapacity() === 0) {
          vscode.window.showWarningMessage("Terminal limit reached (max 10). Close some terminals first.");
          break;
        }
        const term = vscode.window.createTerminal();
        this.terminalManager.track("Plain", term);
        term.show();
        break;
      }
      case "forkTerminal":
        if (msg.terminalId) {
          const state = this.monitor
            .getStates()
            .find((s) => s.terminalId === msg.terminalId);
          if (state?.sessionId) {
            forkTerminal(this.terminalManager, state.sessionId, state.terminalName);
          }
        }
        break;
      case "requestLogs":
        if (msg.terminalId) {
          const events = this.monitor.getEventLog(msg.terminalId);
          const state = this.monitor
            .getStates()
            .find((s) => s.terminalId === msg.terminalId);
          this.panel.webview.postMessage({
            type: "eventLogs",
            terminalId: msg.terminalId,
            terminalName: state?.terminalName ?? "Unknown",
            events,
          });
        }
        break;
    }
  }

  private focusTerminal(terminalId: string): void {
    const terminal = this.findTerminal(terminalId);
    if (terminal) {
      terminal.show();
    }
  }

  private async sendTextToTerminal(
    terminalId: string,
    text: string
  ): Promise<void> {
    const terminal = this.findTerminal(terminalId);
    if (terminal) {
      terminal.show(false);
      await vscode.commands.executeCommand(
        "workbench.action.terminal.sendSequence",
        { text }
      );
      const delay = text === "/clear" ? 500 : 100;
      await new Promise((resolve) => setTimeout(resolve, delay));
      await vscode.commands.executeCommand(
        "workbench.action.terminal.sendSequence",
        { text: "\r" }
      );
    }
  }

  private closeTerminal(terminalId: string): void {
    const terminal = this.findTerminal(terminalId);
    if (terminal) {
      terminal.dispose();
    }
    this.monitor.unregisterTerminal(terminalId);
    this.sendState();
  }

  private findTerminal(terminalId: string): vscode.Terminal | undefined {
    for (const groupName of this.terminalManager.getRunningGroupNames()) {
      for (const terminal of this.terminalManager.getGroupTerminals(
        groupName
      )) {
        const env = (terminal.creationOptions as vscode.TerminalOptions).env;
        if (env && env["BRAIN_SPAWN_TERMINAL_ID"] === terminalId) {
          return terminal;
        }
      }
    }
    return undefined;
  }

  private dispose(): void {
    DashboardPanel.currentPanel = undefined;
    this.panel.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
  }

  private getHtml(context: vscode.ExtensionContext): string {
    const webview = this.panel.webview;
    const nonce = getNonce();

    const codiconCssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        context.extensionUri,
        "media",
        "webview",
        "codicon.css"
      )
    );
    const stylesUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        context.extensionUri,
        "media",
        "webview",
        "dashboard.css"
      )
    );
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        context.extensionUri,
        "media",
        "webview",
        "dashboard.js"
      )
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource};">
  <link href="${codiconCssUri}" rel="stylesheet">
  <link href="${stylesUri}" rel="stylesheet">
  <title>Brain Spawn Dashboard</title>
</head>
<body>
  <div class="dashboard">
    <div class="dashboard-header">
      <div class="header-left">
        <h1>Brain Spawn</h1>
        <div id="statusSummary" class="status-summary"></div>
      </div>
      <div class="header-actions">
        <button class="header-btn" id="launchBtn" title="Launch terminal group">
          <i class="codicon codicon-run-all"></i> Swarm
        </button>
        <button class="header-btn" id="newTerminalBtn" title="New brain">
          <i class="codicon codicon-add"></i> Brain
        </button>
        <button class="header-btn" id="newPlanTerminalBtn" title="New plan terminal">
          <i class="codicon codicon-map"></i> Plan
        </button>
        <button class="header-btn" id="newPlainTerminalBtn" title="New terminal">
          <i class="codicon codicon-terminal"></i> Terminal
        </button>
      </div>
    </div>
    <div id="emptyState" class="empty-state">
      <p>No terminals are being monitored.</p>
      <p class="hint">Launch a terminal group to get started.</p>
      <div class="empty-actions">
        <button class="header-btn" id="emptyLaunchBtn" title="Launch terminal group">
          <i class="codicon codicon-run-all"></i> Swarm
        </button>
        <button class="header-btn" id="emptyNewTerminalBtn" title="New brain">
          <i class="codicon codicon-add"></i> Brain
        </button>
        <button class="header-btn" id="emptyNewPlanTerminalBtn" title="New plan terminal">
          <i class="codicon codicon-map"></i> Plan
        </button>
        <button class="header-btn" id="emptyNewPlainTerminalBtn" title="New terminal">
          <i class="codicon codicon-terminal"></i> Terminal
        </button>
      </div>
    </div>
    <div id="terminalList" class="terminal-list"></div>
  </div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = "";
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}
