import * as vscode from "vscode";
import { ConfigLoader } from "../../config/configLoader";
import { TerminalManager } from "../../terminals/terminalManager";
import { GroupTreeItem, TerminalTreeItem } from "./spawnTreeItems";

export class SpawnTreeProvider
  implements vscode.TreeDataProvider<GroupTreeItem | TerminalTreeItem>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<
    GroupTreeItem | TerminalTreeItem | undefined | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(
    private configLoader: ConfigLoader,
    private terminalManager: TerminalManager
  ) {
    terminalManager.onDidChange(() => this.refresh());
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(
    element: GroupTreeItem | TerminalTreeItem
  ): vscode.TreeItem {
    return element;
  }

  getChildren(
    element?: GroupTreeItem | TerminalTreeItem
  ): (GroupTreeItem | TerminalTreeItem)[] {
    if (!element) {
      // Root: show groups
      const config = this.configLoader.getConfig();
      return config.groups.map(
        (g) =>
          new GroupTreeItem(
            g.name,
            g.terminals.length,
            this.terminalManager.isGroupRunning(g.name),
            g.source
          )
      );
    }

    if (element instanceof GroupTreeItem) {
      // Group: show terminals
      const config = this.configLoader.getConfig();
      const group = config.groups.find(
        (g) => g.name === element.groupName && g.source === element.source
      );
      if (!group) {
        return [];
      }
      return group.terminals.map(
        (t) => new TerminalTreeItem(t, element.groupName)
      );
    }

    return [];
  }
}
