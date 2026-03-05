import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

const BRAIN_SPAWN_MARKER = "brain-spawn-hook";

const HOOK_EVENTS = [
  "SessionStart",
  "UserPromptSubmit",
  "PreToolUse",
  "PostToolUse",
  "Notification",
  "Stop",
  "SessionEnd",
] as const;

const TOOL_MATCHER_EVENTS = new Set(["PreToolUse", "PostToolUse"]);
const NOTIFICATION_MATCHER_EVENTS = new Set(["Notification"]);

interface HookHandler {
  type: string;
  url: string;
  headers?: Record<string, string>;
  allowedEnvVars?: string[];
}

interface MatcherGroup {
  matcher?: string;
  hooks: HookHandler[];
  _marker?: string;
}

interface ClaudeSettings {
  hooks?: Record<string, MatcherGroup[]>;
  [key: string]: unknown;
}

function buildHookHandler(port: number): HookHandler {
  return {
    type: "http",
    url: `http://127.0.0.1:${port}/hooks`,
    headers: {
      "X-Terminal-Id": "$BRAIN_SPAWN_TERMINAL_ID",
    },
    allowedEnvVars: ["BRAIN_SPAWN_TERMINAL_ID"],
  };
}

function buildHooks(port: number): Record<string, MatcherGroup[]> {
  const handler = buildHookHandler(port);
  const hooks: Record<string, MatcherGroup[]> = {};
  for (const event of HOOK_EVENTS) {
    const group: MatcherGroup = {
      hooks: [handler],
      _marker: BRAIN_SPAWN_MARKER,
    };
    // Tool events require a matcher to filter by tool name
    if (TOOL_MATCHER_EVENTS.has(event)) {
      group.matcher = "AskUserQuestion";
    }
    // Notification events match on permission and elicitation dialogs
    if (NOTIFICATION_MATCHER_EVENTS.has(event)) {
      group.matcher = "permission_prompt|elicitation_dialog";
    }
    hooks[event] = [group];
  }
  return hooks;
}

function getSettingsPath(workspaceFolder: vscode.Uri): string {
  return path.join(workspaceFolder.fsPath, ".claude", "settings.local.json");
}

export async function writeHookConfig(port: number): Promise<void> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders) {
    return;
  }

  const brainSpawnHooks = buildHooks(port);

  for (const folder of folders) {
    const settingsPath = getSettingsPath(folder.uri);
    const dir = path.dirname(settingsPath);

    // Ensure .claude directory exists
    await fs.promises.mkdir(dir, { recursive: true });

    let settings: ClaudeSettings = {};
    try {
      const content = await fs.promises.readFile(settingsPath, "utf-8");
      settings = JSON.parse(content);
    } catch {
      // File doesn't exist or invalid JSON — start fresh
    }

    if (!settings.hooks) {
      settings.hooks = {};
    }

    // Merge: remove existing BrainSpawn matcher groups, then add ours
    for (const event of HOOK_EVENTS) {
      const existing = settings.hooks[event] ?? [];
      const filtered = existing.filter(
        (g: MatcherGroup) => g._marker !== BRAIN_SPAWN_MARKER
      );
      settings.hooks[event] = [
        ...filtered,
        ...brainSpawnHooks[event],
      ];
    }

    await fs.promises.writeFile(
      settingsPath,
      JSON.stringify(settings, null, 2),
      "utf-8"
    );
  }
}

export async function removeHookConfig(): Promise<void> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders) {
    return;
  }

  for (const folder of folders) {
    const settingsPath = getSettingsPath(folder.uri);

    let settings: ClaudeSettings;
    try {
      const content = await fs.promises.readFile(settingsPath, "utf-8");
      settings = JSON.parse(content);
    } catch {
      continue; // File doesn't exist — nothing to clean
    }

    if (!settings.hooks) {
      continue;
    }

    let changed = false;
    for (const event of HOOK_EVENTS) {
      const existing = settings.hooks[event];
      if (!existing) {
        continue;
      }
      const filtered = existing.filter(
        (g: MatcherGroup) => g._marker !== BRAIN_SPAWN_MARKER
      );
      if (filtered.length !== existing.length) {
        changed = true;
        if (filtered.length === 0) {
          delete settings.hooks[event];
        } else {
          settings.hooks[event] = filtered;
        }
      }
    }

    // Remove hooks key entirely if empty
    if (
      changed &&
      settings.hooks &&
      Object.keys(settings.hooks).length === 0
    ) {
      delete settings.hooks;
    }

    if (changed) {
      await fs.promises.writeFile(
        settingsPath,
        JSON.stringify(settings, null, 2),
        "utf-8"
      );
    }
  }
}
