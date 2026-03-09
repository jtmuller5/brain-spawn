import * as vscode from "vscode";
import * as cp from "child_process";
import * as path from "path";
import * as fs from "fs";
import { ClaudeMonitor } from "../hooks/claudeMonitor";
import { TerminalManager } from "../terminals/terminalManager";
import { forkTerminal, getCommands, launchOneTerminalWithCommand } from "../terminals/terminalGroup";

export class DashboardPanel {
  private static currentPanel: DashboardPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly monitor: ClaudeMonitor;
  private readonly terminalManager: TerminalManager;
  private disposables: vscode.Disposable[] = [];
  private externalTerminals = new Map<string, vscode.Terminal>();

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

    const externalSub = this.monitor.onExternalTerminalDetected((terminalId) =>
      this.adoptExternalTerminal(terminalId)
    );
    this.disposables.push(externalSub);

    const closeSub = vscode.window.onDidCloseTerminal((closed) => {
      for (const [id, terminal] of this.externalTerminals) {
        if (terminal === closed) {
          this.externalTerminals.delete(id);
          this.monitor.unregisterTerminal(id);
          break;
        }
      }
    });
    this.disposables.push(closeSub);

  }

  private isClaudeCommand(): boolean {
    const cmd = vscode.workspace
      .getConfiguration("brainSpawn")
      .get<string>("command", "claude")
      .split(/\s/)[0];
    return cmd === "claude" || cmd.endsWith("/claude");
  }

  private sendState(): void {
    this.panel.webview.postMessage({
      type: "state",
      terminals: this.monitor.getStates(),
      isClaudeCommand: this.isClaudeCommand(),
      commands: getCommands(),
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
      } else {
        // Check external terminals
        for (const [id, t] of this.externalTerminals) {
          if (t === terminal) {
            activeId = id;
            break;
          }
        }
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
    filePath?: string;
    command?: string;
    orderedIds?: string[];
  }): void {
    switch (msg.type) {
      case "ready":
        this.sendState();
        if (this.monitor.getStates().length === 0) {
          vscode.commands.executeCommand("brainSpawn.launch");
        }
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
          this.renameTerminal(msg.terminalId, msg.name);
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
      case "newWorktreeTerminal":
        vscode.commands.executeCommand("brainSpawn.newWorktreeTerminal");
        break;
      case "newTerminalWithCommand":
        if (msg.command) {
          launchOneTerminalWithCommand(this.terminalManager, msg.command);
        }
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
      case "exportConversation":
        if (msg.terminalId) {
          this.exportConversation(msg.terminalId);
        }
        break;
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
      case "reorderTerminals":
        if (msg.orderedIds) {
          this.monitor.reorderTerminals(msg.orderedIds);
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
            editedFiles: state?.editedFiles ?? [],
            events,
          });
        }
        break;
      case "fetchUsage":
        this.fetchUsage();
        break;
      case "openFile":
        if (msg.filePath) {
          const uri = vscode.Uri.file(msg.filePath);
          vscode.window.showTextDocument(uri, { preview: true });
        }
        break;
      case "saveLikeness":
        if (msg.terminalId) {
          this.saveLikeness(msg.terminalId);
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

  private async exportConversation(terminalId: string): Promise<void> {
    const terminal = this.findTerminal(terminalId);
    if (terminal) {
      terminal.show(false);
      // Send /export command
      await vscode.commands.executeCommand(
        "workbench.action.terminal.sendSequence",
        { text: "/export" }
      );
      await new Promise((resolve) => setTimeout(resolve, 100));
      await vscode.commands.executeCommand(
        "workbench.action.terminal.sendSequence",
        { text: "\r" }
      );
      // Wait for the export menu to appear, then select option 1
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await vscode.commands.executeCommand(
        "workbench.action.terminal.sendSequence",
        { text: "1" }
      );
      await new Promise((resolve) => setTimeout(resolve, 100));
      await vscode.commands.executeCommand(
        "workbench.action.terminal.sendSequence",
        { text: "\r" }
      );
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
    this.externalTerminals.delete(terminalId);
    this.monitor.unregisterTerminal(terminalId);
    this.sendState();
  }

  private async saveLikeness(terminalId: string): Promise<void> {
    const state = this.monitor
      .getStates()
      .find((s) => s.terminalId === terminalId);
    if (!state || state.editedFiles.length === 0) {
      this.panel.webview.postMessage({
        type: "saveLikenessResult",
        terminalId,
        error: "No touched files to save.",
      });
      return;
    }

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceFolder) {
      vscode.window.showErrorMessage("No workspace folder open.");
      this.panel.webview.postMessage({
        type: "saveLikenessResult",
        terminalId,
        error: "No workspace folder.",
      });
      return;
    }

    // Build context for Claude
    const chatText = state.chatHistory
      .map((m) => `${m.role}: ${m.text}`)
      .join("\n");
    const fileList = state.editedFiles.join("\n");

    const prompt = `You are generating metadata for a coding session snapshot called a "likeness". Given the chat history and list of touched files below, produce a JSON object with exactly two fields:
- "name": a short, descriptive kebab-case name for this work (e.g. "add-user-auth", "fix-sidebar-layout"). Max 50 chars.
- "description": a one-sentence summary of what was accomplished. Max 200 chars.

Chat history:
${chatText}

Touched files:
${fileList}

Respond with ONLY the JSON object, no markdown fences or extra text.`;

    try {
      const result = await new Promise<string>((resolve, reject) => {
        const proc = cp.spawn("claude", ["-p", prompt], {
          cwd: workspaceFolder,
          env: { ...process.env },
          stdio: ["ignore", "pipe", "pipe"],
        });

        let stdout = "";
        let stderr = "";
        proc.stdout.on("data", (data: Buffer) => {
          stdout += data.toString();
        });
        proc.stderr.on("data", (data: Buffer) => {
          stderr += data.toString();
        });
        proc.on("close", (code) => {
          if (code === 0) {
            resolve(stdout.trim());
          } else {
            reject(new Error(stderr || `claude exited with code ${code}`));
          }
        });
        proc.on("error", reject);
      });

      // Parse the JSON response
      // Strip markdown fences if present
      let jsonStr = result;
      const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fenceMatch) {
        jsonStr = fenceMatch[1].trim();
      }

      let generated: { name: string; description?: string };
      try {
        generated = JSON.parse(jsonStr);
      } catch {
        // Fallback: use terminal name
        generated = {
          name: state.terminalName.toLowerCase().replace(/\s+/g, "-"),
          description: result.slice(0, 200),
        };
      }

      // Let user confirm/edit the name
      const name = await vscode.window.showInputBox({
        prompt: "Likeness name",
        value: generated.name,
        validateInput: (v) =>
          v.trim().length === 0 ? "Name is required" : undefined,
      });

      if (!name) {
        // User cancelled
        this.panel.webview.postMessage({
          type: "saveLikenessResult",
          terminalId,
          error: "Cancelled.",
        });
        return;
      }

      // Let user confirm/edit the description
      const description = await vscode.window.showInputBox({
        prompt: "Likeness description (optional)",
        value: generated.description || "",
      });

      // Build the likeness object
      const likeness = {
        name,
        description: description || undefined,
        files: state.editedFiles,
        createdAt: new Date().toISOString(),
      };

      // Save to .brain-spawn/ folder
      const brainSpawnDir = path.join(workspaceFolder, ".brain-spawn");
      if (!fs.existsSync(brainSpawnDir)) {
        fs.mkdirSync(brainSpawnDir, { recursive: true });
      }

      const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
      const filePath = path.join(brainSpawnDir, `${slug}.json`);

      fs.writeFileSync(filePath, JSON.stringify(likeness, null, 2) + "\n");

      vscode.window.showInformationMessage(`Likeness saved: ${slug}.json`);
      this.panel.webview.postMessage({
        type: "saveLikenessResult",
        terminalId,
        error: null,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Unknown error";
      vscode.window.showErrorMessage(`Failed to save likeness: ${message}`);
      this.panel.webview.postMessage({
        type: "saveLikenessResult",
        terminalId,
        error: message,
      });
    }
  }

  private async renameTerminal(
    terminalId: string,
    name: string
  ): Promise<void> {
    const terminal = this.findTerminal(terminalId);
    if (!terminal) {
      return;
    }
    const previousActive = vscode.window.activeTerminal;
    terminal.show(true);
    await vscode.commands.executeCommand(
      "workbench.action.terminal.rename",
      { name }
    );
    if (previousActive && previousActive !== terminal) {
      previousActive.show(true);
    }
  }

  private fetchUsage(): void {
    const cmd = vscode.workspace
      .getConfiguration("brainSpawn")
      .get<string>("command", "claude")
      .split(/\s/)[0];

    // Use the clipboard approach: pick a tracked terminal,
    // send /usage, wait, select all, copy, read clipboard
    const states = this.monitor.getStates();
    // Prefer an idle terminal with a sessionId, then any idle, then any tracked
    const target =
      states.find((s) => s.status === "idle" && s.sessionId) ||
      states.find((s) => s.status === "idle") ||
      states[0];
    if (!target) {
      console.log("[BrainSpawn] fetchUsage: no tracked terminals found");
      return;
    }
    // Verify the terminal still exists in VS Code
    const terminal = this.findTerminal(target.terminalId);
    if (!terminal) {
      console.log("[BrainSpawn] fetchUsage: terminal not found in VS Code for", target.terminalId);
      return;
    }
    console.log("[BrainSpawn] fetchUsage: using terminal", target.terminalName, target.terminalId);
    this.captureTerminalUsage(target.terminalId);
  }

  private async captureTerminalUsage(terminalId: string): Promise<void> {
    const terminal = this.findTerminal(terminalId);
    if (!terminal) {
      return;
    }

    console.log("[BrainSpawn] captureTerminalUsage: starting for", terminalId);

    // Save current clipboard
    const previousClipboard = await vscode.env.clipboard.readText();

    // Remember which terminal was active so we can restore focus
    const previousTerminal = vscode.window.activeTerminal;

    // Send /usage command directly to the terminal (works without focus)
    terminal.sendText("/usage");

    // Wait for output to render
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Show terminal so selectAll/copy commands target it
    terminal.show(false);
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Select all and copy
    await vscode.commands.executeCommand("workbench.action.terminal.selectAll");
    await vscode.commands.executeCommand("workbench.action.terminal.copySelection");
    await vscode.commands.executeCommand("workbench.action.terminal.clearSelection");

    // Read clipboard
    const content = await vscode.env.clipboard.readText();
    console.log("[BrainSpawn] captureTerminalUsage content length:", content.length);
    console.log("[BrainSpawn] captureTerminalUsage content:", content.substring(0, 500));

    // Dismiss the usage dialog by sending Escape
    terminal.sendText("\x1b", false);

    // Restore clipboard
    await vscode.env.clipboard.writeText(previousClipboard);

    // Restore previous terminal focus
    if (previousTerminal && previousTerminal !== terminal) {
      previousTerminal.show(false);
    }

    // Send to webview
    this.panel.webview.postMessage({
      type: "usageResult",
      content,
      error: false,
    });
  }

  private adoptExternalTerminal(terminalId: string): void {
    // Find an untracked terminal to associate with this external Claude session
    for (const terminal of vscode.window.terminals) {
      if (this.terminalManager.isTracked(terminal)) {
        continue;
      }
      if (this.externalTerminals.has(terminalId)) {
        break;
      }
      // Check it's not already adopted under a different ID
      let alreadyAdopted = false;
      for (const t of this.externalTerminals.values()) {
        if (t === terminal) {
          alreadyAdopted = true;
          break;
        }
      }
      if (alreadyAdopted) {
        continue;
      }
      this.externalTerminals.set(terminalId, terminal);
      this.monitor.setName(terminalId, terminal.name);
      break;
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
    return this.externalTerminals.get(terminalId);
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
        <button class="header-btn icon-only" id="launchBtn" title="Swarm">
          <i class="codicon codicon-run-all"></i>
        </button>
        <button class="header-btn icon-only" id="newTerminalBtn" title="New brain">
          <i class="codicon codicon-add"></i>
        </button>
        <button class="header-btn icon-only" id="newWorktreeTerminalBtn" title="New worktree brain">
          <i class="codicon codicon-git-branch"></i>
        </button>
        <button class="header-btn icon-only" id="newPlanTerminalBtn" title="New plan terminal">
          <i class="codicon codicon-map"></i>
        </button>
        <button class="header-btn icon-only" id="newPlainTerminalBtn" title="New terminal">
          <i class="codicon codicon-terminal"></i>
        </button>
      </div>
    </div>
    <div id="emptyState" class="empty-state">
      <p>No terminals are being monitored.</p>
      <p class="hint">Launch a terminal group to get started.</p>
      <div class="empty-actions">
        <button class="header-btn icon-only" id="emptyLaunchBtn" title="Swarm">
          <i class="codicon codicon-run-all"></i>
        </button>
        <button class="header-btn icon-only" id="emptyNewTerminalBtn" title="New brain">
          <i class="codicon codicon-add"></i>
        </button>
        <button class="header-btn icon-only" id="emptyNewWorktreeTerminalBtn" title="New worktree brain">
          <i class="codicon codicon-git-branch"></i>
        </button>
        <button class="header-btn icon-only" id="emptyNewPlanTerminalBtn" title="New plan terminal">
          <i class="codicon codicon-map"></i>
        </button>
        <button class="header-btn icon-only" id="emptyNewPlainTerminalBtn" title="New terminal">
          <i class="codicon codicon-terminal"></i>
        </button>
      </div>
    </div>
    <div id="terminalList" class="terminal-list"></div>
  </div>
  <div class="usage-bar" id="usageBar">
    <button class="usage-bar-btn" id="usageBtn" title="Refresh usage">
      <i class="codicon codicon-dashboard"></i>
    </button>
    <div class="usage-bar-track">
      <div class="usage-bar-fill" id="usageBarFill"></div>
    </div>
    <span class="usage-bar-label" id="usageBarLabel"></span>
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
