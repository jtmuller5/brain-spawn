import * as vscode from "vscode";
import { GroupSource, TerminalDefinition } from "../../types";

export class GroupTreeItem extends vscode.TreeItem {
  constructor(
    public readonly groupName: string,
    public readonly terminalCount: number,
    public readonly isRunning: boolean,
    public readonly source?: GroupSource
  ) {
    super(groupName, vscode.TreeItemCollapsibleState.Expanded);
    const scopeLabel = source === "user" ? "User" : "Workspace";
    const termLabel = `${terminalCount} terminal${terminalCount === 1 ? "" : "s"}`;
    this.description = `${scopeLabel} · ${termLabel}`;
    this.iconPath = new vscode.ThemeIcon(
      isRunning ? "debug-start" : "symbol-folder"
    );
    this.contextValue = isRunning ? "spawnGroupRunning" : "spawnGroup";
  }
}

const COLOR_MAP: Record<string, string> = {
  black: "terminal.ansiBlack",
  red: "terminal.ansiRed",
  green: "terminal.ansiGreen",
  yellow: "terminal.ansiYellow",
  blue: "terminal.ansiBlue",
  magenta: "terminal.ansiMagenta",
  cyan: "terminal.ansiCyan",
  white: "terminal.ansiWhite",
};

export class TerminalTreeItem extends vscode.TreeItem {
  constructor(
    public readonly terminalDef: TerminalDefinition,
    public readonly groupName: string
  ) {
    super(terminalDef.name, vscode.TreeItemCollapsibleState.None);
    this.description = terminalDef.command ?? "";
    this.iconPath = new vscode.ThemeIcon(
      terminalDef.icon ?? "terminal",
      terminalDef.color
        ? new vscode.ThemeColor(COLOR_MAP[terminalDef.color] ?? "")
        : undefined
    );
    this.contextValue = "terminalDef";
  }
}
