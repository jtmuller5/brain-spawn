import * as vscode from "vscode";
import * as crypto from "crypto";
import { TerminalManager } from "./terminalManager";
import { ClaudeMonitor } from "../hooks/claudeMonitor";

interface TerminalDefinition {
  name: string;
  icon?: string;
  color?: string;
  command?: string;
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

const RANDOM_ICONS = [
  "rocket", "zap", "flame", "bug", "beaker", "heart", "star-full",
  "lightbulb", "megaphone", "compass", "telescope", "squirrel",
  "smiley", "coffee", "globe", "jersey", "law", "ruby",
];

const RANDOM_COLORS = Object.keys(COLOR_MAP);

const RANDOM_NAMES = [
  "Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot",
  "Ghost", "Horizon", "Ion", "Jazz", "Kilo", "Luna",
  "Meteor", "Nova", "Orbit", "Pulse", "Quantum", "Raven",
  "Spark", "Titan", "Ultra", "Vortex", "Warp", "Xenon",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickUnique<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function getCommand(): string {
  return vscode.workspace.getConfiguration("brainSpawn").get<string>("command", "claude");
}

let claudeMonitor: ClaudeMonitor | undefined;

export function setClaudeMonitor(monitor: ClaudeMonitor): void {
  claudeMonitor = monitor;
}

const GROUP_NAME = "Brain Spawn";

export function launchNewTerminal(terminalManager: TerminalManager): void {
  const command = getCommand();
  const names = pickUnique(RANDOM_NAMES, 5);

  for (let i = 0; i < 5; i++) {
    const def: TerminalDefinition = {
      name: names[i],
      icon: pick(RANDOM_ICONS),
      color: pick(RANDOM_COLORS),
      command,
    };
    const terminal = createTerminal(def);
    terminalManager.track(GROUP_NAME, terminal);
    terminal.sendText(command);
  }
}

export function launchOneTerminal(terminalManager: TerminalManager): void {
  const command = getCommand();
  const def: TerminalDefinition = {
    name: pick(RANDOM_NAMES),
    icon: pick(RANDOM_ICONS),
    color: pick(RANDOM_COLORS),
    command,
  };
  const terminal = createTerminal(def);
  terminalManager.track(GROUP_NAME, terminal);
  terminal.sendText(command);
  terminal.show();
}

function createTerminal(def: TerminalDefinition): vscode.Terminal {
  const terminalId = crypto.randomUUID();

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

  const env: Record<string, string> = {
    BRAIN_SPAWN_TERMINAL_ID: terminalId,
  };
  options.env = env;

  if (claudeMonitor) {
    claudeMonitor.registerTerminal(terminalId, def.name, GROUP_NAME, def.icon, def.color);
  }

  return vscode.window.createTerminal(options);
}
