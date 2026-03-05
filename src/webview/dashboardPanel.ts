import * as vscode from "vscode";
import { ClaudeMonitor } from "../hooks/claudeMonitor";
import { TerminalManager } from "../terminals/terminalManager";

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
  }

  private sendState(): void {
    this.panel.webview.postMessage({
      type: "state",
      terminals: this.monitor.getStates(),
    });
  }

  private handleMessage(msg: {
    type: string;
    terminalId?: string;
    text?: string;
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
      case "launch":
        vscode.commands.executeCommand("brainSpawn.launch");
        break;
      case "newTerminal":
        vscode.commands.executeCommand("brainSpawn.newTerminal");
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
      await new Promise((resolve) => setTimeout(resolve, 100));
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
      <h1>Brain Spawn Dashboard</h1>
      <div class="header-actions">
        <button class="header-btn" id="launchBtn" title="Launch terminal group">
          <i class="codicon codicon-run-all"></i> Launch
        </button>
        <button class="header-btn" id="newTerminalBtn" title="New terminal">
          <i class="codicon codicon-terminal"></i> New Terminal
        </button>
      </div>
    </div>
    <div id="emptyState" class="empty-state">
      <p>No terminals are being monitored.</p>
      <p class="hint">Launch a terminal group to get started.</p>
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
