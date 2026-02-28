import * as vscode from "vscode";
import { ConfigLoader } from "../config/configLoader";
import { handleWebviewMessage } from "./webviewMessageHandler";

export class ConfigPanel {
  private static currentPanel: ConfigPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly configLoader: ConfigLoader;
  private disposables: vscode.Disposable[] = [];

  static createOrShow(
    context: vscode.ExtensionContext,
    configLoader: ConfigLoader
  ): void {
    if (ConfigPanel.currentPanel) {
      ConfigPanel.currentPanel.panel.reveal();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      "brainSpawnConfig",
      "Brain Spawn: Configuration",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, "media"),
        ],
      }
    );

    ConfigPanel.currentPanel = new ConfigPanel(panel, context, configLoader);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    context: vscode.ExtensionContext,
    configLoader: ConfigLoader
  ) {
    this.panel = panel;
    this.configLoader = configLoader;

    this.panel.webview.html = this.getHtml(context);

    this.panel.webview.onDidReceiveMessage(
      (msg) => handleWebviewMessage(msg, this.panel.webview, this.configLoader),
      undefined,
      this.disposables
    );

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    // Send config when webview is ready
    const configSub = this.configLoader.onChange((event) => {
      this.panel.webview.postMessage({
        type: "config",
        config: event.config,
      });
    });
    this.disposables.push(configSub);
  }

  private dispose(): void {
    ConfigPanel.currentPanel = undefined;
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
      vscode.Uri.joinPath(context.extensionUri, "media", "webview", "codicon.css")
    );
    const stylesUri = webview.asWebviewUri(
      vscode.Uri.joinPath(context.extensionUri, "media", "webview", "styles.css")
    );
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(context.extensionUri, "media", "webview", "main.js")
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource};">
  <link href="${codiconCssUri}" rel="stylesheet">
  <link href="${stylesUri}" rel="stylesheet">
  <title>Brain Spawn Configuration</title>
</head>
<body>
  <div class="container">
    <div class="sidebar">
      <div class="sidebar-header">
        <h2>Spawn Groups</h2>
        <div class="add-group-wrapper">
          <button id="addGroupBtn" class="icon-btn" title="Add Workspace Group">+</button>
          <button id="addGroupDropdownBtn" class="icon-btn add-group-dropdown-btn" title="More options">\u25BE</button>
        </div>
      </div>
      <ul id="groupList" class="group-list"></ul>
    </div>
    <div class="resize-handle" id="resizeHandle"></div>
    <div class="main-panel">
      <div id="emptyState" class="empty-state">
        <p>Select a group or create a new one to get started.</p>
      </div>
      <div id="groupEditor" class="group-editor" style="display: none;">
        <div class="group-header">
          <input id="groupNameInput" type="text" class="group-name-input" placeholder="Group Name">
          <div class="group-actions">
            <button id="duplicateGroupBtn" class="text-btn" title="Duplicate Group">Duplicate</button>
            <button id="deleteGroupBtn" class="text-btn danger" title="Delete Group">Delete</button>
          </div>
        </div>
        <div class="terminals-header">
          <h3>Terminals</h3>
          <button id="addTerminalBtn" class="icon-btn" title="Add Terminal">+</button>
        </div>
        <div id="terminalsList" class="terminals-list"></div>
      </div>
    </div>
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
