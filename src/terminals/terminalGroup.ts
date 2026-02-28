import * as vscode from "vscode";
import { SpawnGroup, TerminalDefinition } from "../types";
import { TerminalManager } from "./terminalManager";
import { substituteVariables } from "../config/variableSubstitution";

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

export async function launchGroup(
  group: SpawnGroup,
  terminalManager: TerminalManager
): Promise<void> {
  // Check if already running
  if (terminalManager.isGroupRunning(group.name)) {
    const choice = await vscode.window.showWarningMessage(
      `Group "${group.name}" is already running. Kill and relaunch?`,
      "Kill & Relaunch",
      "Cancel"
    );
    if (choice !== "Kill & Relaunch") {
      return;
    }
    terminalManager.killGroup(group.name);
  }

  let focusTerminal: vscode.Terminal | undefined;

  for (const def of group.terminals) {
    const terminal = createTerminal(def);
    terminalManager.track(group.name, terminal);

    if (def.command) {
      terminal.sendText(substituteVariables(def.command));
    }

    if (def.focus) {
      focusTerminal = terminal;
    }
  }

  // Focus: explicitly marked terminal, or last terminal
  const toFocus =
    focusTerminal ?? terminalManager.getGroupTerminals(group.name).at(-1);
  toFocus?.show();
}

export function launchSingleTerminal(
  def: TerminalDefinition,
  groupName: string,
  terminalManager: TerminalManager
): void {
  const terminal = createTerminal(def);
  terminalManager.track(groupName, terminal);

  if (def.command) {
    terminal.sendText(substituteVariables(def.command));
  }

  terminal.show();
}

function createTerminal(def: TerminalDefinition): vscode.Terminal {
  const options: vscode.TerminalOptions = {
    name: def.name,
    iconPath: new vscode.ThemeIcon(def.icon ?? "terminal"),
  };

  if (def.color) {
    const colorId = COLOR_MAP[def.color];
    if (colorId) {
      options.color = new vscode.ThemeColor(colorId);
    }
  }

  if (def.cwd) {
    options.cwd = substituteVariables(def.cwd);
  }

  if (def.env) {
    const resolvedEnv: Record<string, string> = {};
    for (const [key, value] of Object.entries(def.env)) {
      resolvedEnv[key] = substituteVariables(value);
    }
    options.env = resolvedEnv;
  }

  return vscode.window.createTerminal(options);
}
