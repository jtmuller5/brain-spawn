import * as vscode from "vscode";
import { TerminalManager } from "../terminals/terminalManager";
import { ClaudeMonitor, ClaudeTerminalState } from "../hooks/claudeMonitor";

type TreeItem = GroupItem | TerminalItem;

class GroupItem extends vscode.TreeItem {
  constructor(
    public readonly groupName: string,
    terminalCount: number
  ) {
    super(groupName, vscode.TreeItemCollapsibleState.Expanded);
    this.description = `${terminalCount}`;
    this.contextValue = "group";
    this.iconPath = new vscode.ThemeIcon("terminal-bash");
  }
}

const STATUS_ICONS: Record<string, { icon: string; color?: string }> = {
  busy: { icon: "sync~spin", color: "charts.yellow" },
  waiting: { icon: "bell", color: "charts.orange" },
  idle: { icon: "circle-filled", color: "charts.green" },
};

class TerminalItem extends vscode.TreeItem {
  constructor(
    public readonly terminalId: string,
    state: ClaudeTerminalState
  ) {
    super(state.terminalName, vscode.TreeItemCollapsibleState.None);

    const statusInfo = STATUS_ICONS[state.status] ?? STATUS_ICONS.idle;
    this.iconPath = new vscode.ThemeIcon(
      state.icon ?? statusInfo.icon,
      statusInfo.color ? new vscode.ThemeColor(statusInfo.color) : undefined
    );
    this.description = state.status;
    if (state.lastMessage) {
      const preview =
        state.lastMessage.length > 60
          ? state.lastMessage.slice(0, 60) + "..."
          : state.lastMessage;
      this.tooltip = `${state.terminalName} (${state.status})\n${preview}`;
    } else {
      this.tooltip = `${state.terminalName} (${state.status})`;
    }
    this.contextValue = "terminal";
    this.command = {
      command: "brainSpawn.sidebar.showTerminal",
      title: "Show Terminal",
      arguments: [{ terminalId }],
    };
  }
}

export class TerminalTreeProvider
  implements vscode.TreeDataProvider<TreeItem>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<
    TreeItem | undefined | null
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private disposables: vscode.Disposable[] = [];

  constructor(
    private terminalManager: TerminalManager,
    private claudeMonitor: ClaudeMonitor
  ) {
    this.disposables.push(
      terminalManager.onDidChange(() => this.refresh()),
      claudeMonitor.onDidChange(() => this.refresh())
    );
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: TreeItem): TreeItem[] {
    if (!element) {
      return this.getRootItems();
    }
    if (element instanceof GroupItem) {
      return this.getTerminalItems(element.groupName);
    }
    return [];
  }

  private getRootItems(): TreeItem[] {
    const states = this.claudeMonitor.getStates();
    if (states.length === 0) {
      return [];
    }

    // Group states by groupName
    const groups = new Map<string, ClaudeTerminalState[]>();
    for (const state of states) {
      const list = groups.get(state.groupName) ?? [];
      list.push(state);
      groups.set(state.groupName, list);
    }

    // If only one group, show terminals flat (no group wrapper)
    if (groups.size === 1) {
      const [, groupStates] = [...groups.entries()][0];
      return groupStates.map((s) => new TerminalItem(s.terminalId, s));
    }

    return [...groups.entries()].map(
      ([name, groupStates]) => new GroupItem(name, groupStates.length)
    );
  }

  private getTerminalItems(groupName: string): TreeItem[] {
    const states = this.claudeMonitor
      .getStates()
      .filter((s) => s.groupName === groupName);
    return states.map((s) => new TerminalItem(s.terminalId, s));
  }

  dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
    this._onDidChangeTreeData.dispose();
  }
}
