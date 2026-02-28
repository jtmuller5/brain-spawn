import * as vscode from "vscode";

export type GroupSource = "user" | "workspace";

export interface TerminalDefinition {
  name: string;
  command?: string;
  icon?: string;
  color?: string;
  cwd?: string;
  env?: Record<string, string>;
  focus?: boolean;
}

export interface SpawnGroup {
  name: string;
  terminals: TerminalDefinition[];
  source?: GroupSource;
}

export interface BrainSpawnConfig {
  version: number;
  groups: SpawnGroup[];
}

// Webview message types
export type WebviewMessage =
  | { type: "getConfig" }
  | { type: "saveConfig"; config: BrainSpawnConfig }
  | { type: "pickFolder" }
  | { type: "ready" };

export type ExtensionMessage =
  | { type: "config"; config: BrainSpawnConfig }
  | { type: "folderPicked"; path: string }
  | { type: "error"; message: string };

export interface ConfigChangeEvent {
  config: BrainSpawnConfig;
}

export type ConfigChangeListener = (event: ConfigChangeEvent) => void;
