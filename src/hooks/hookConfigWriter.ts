import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

const BRAIN_SPAWN_MARKER = "brain-spawn-hook";

// Tracks whether we are currently writing so file watchers can ignore self-triggered events.
let _writing = false;
export function isWriting(): boolean {
  return _writing;
}

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

// These events only support type: "command" hooks, not HTTP hooks
const COMMAND_ONLY_EVENTS = new Set([
  "SessionStart",
  "SessionEnd",
  "Notification",
  "SubagentStart",
]);

interface HttpHookHandler {
  type: "http";
  url: string;
  headers?: Record<string, string>;
  allowedEnvVars?: string[];
}

interface CommandHookHandler {
  type: "command";
  command: string;
}

type HookHandler = HttpHookHandler | CommandHookHandler;

interface MatcherGroup {
  matcher?: string;
  hooks: HookHandler[];
  _marker?: string;
}

interface ClaudeSettings {
  hooks?: Record<string, MatcherGroup[]>;
  [key: string]: unknown;
}

function buildHttpHandler(port: number): HttpHookHandler {
  return {
    type: "http",
    url: `http://127.0.0.1:${port}/hooks`,
    headers: {
      "X-Terminal-Id": "$BRAIN_SPAWN_TERMINAL_ID",
    },
    allowedEnvVars: ["BRAIN_SPAWN_TERMINAL_ID"],
  };
}

function buildCommandHandler(port: number): CommandHookHandler {
  // For events that only support command hooks, use curl to POST to our HTTP server.
  // Pipe stdin (the hook JSON) as the request body.
  return {
    type: "command",
    command: `cat | curl -s -X POST -H "Content-Type: application/json" -H "X-Terminal-Id: $BRAIN_SPAWN_TERMINAL_ID" -d @- http://127.0.0.1:${port}/hooks > /dev/null 2>&1; exit 0`,
  };
}

function buildHooks(port: number): Record<string, MatcherGroup[]> {
  const httpHandler = buildHttpHandler(port);
  const cmdHandler = buildCommandHandler(port);
  const hooks: Record<string, MatcherGroup[]> = {};
  for (const event of HOOK_EVENTS) {
    const handler = COMMAND_ONLY_EVENTS.has(event) ? cmdHandler : httpHandler;
    const group: MatcherGroup = {
      hooks: [handler],
      _marker: BRAIN_SPAWN_MARKER,
    };
    // Tool events: no matcher means all tools fire the hook
    if (TOOL_MATCHER_EVENTS.has(event)) {
      // intentionally no matcher — capture all tool events
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

export async function findExistingHookPort(): Promise<number | undefined> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders) {
    return undefined;
  }

  for (const folder of folders) {
    const settingsPath = getSettingsPath(folder.uri);
    try {
      const content = await fs.promises.readFile(settingsPath, "utf-8");
      const settings: ClaudeSettings = JSON.parse(content);
      if (!settings.hooks) {
        continue;
      }
      for (const groups of Object.values(settings.hooks)) {
        for (const group of groups) {
          if (group._marker !== BRAIN_SPAWN_MARKER) {
            continue;
          }
          for (const hook of group.hooks) {
            if (hook.type === "http" && (hook as HttpHookHandler).url) {
              const match = (hook as HttpHookHandler).url.match(/:(\d+)\//);
              if (match) {
                return parseInt(match[1], 10);
              }
            }
          }
        }
      }
    } catch {
      continue;
    }
  }
  return undefined;
}

export async function hooksPresent(): Promise<boolean> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders) {
    return false;
  }

  for (const folder of folders) {
    const settingsPath = getSettingsPath(folder.uri);
    try {
      const content = await fs.promises.readFile(settingsPath, "utf-8");
      const settings: ClaudeSettings = JSON.parse(content);
      if (!settings.hooks) {
        return false;
      }
      // Check that every expected event has a brain-spawn marker group
      for (const event of HOOK_EVENTS) {
        const groups = settings.hooks[event];
        if (!groups || !groups.some((g: MatcherGroup) => g._marker === BRAIN_SPAWN_MARKER)) {
          return false;
        }
      }
    } catch {
      return false;
    }
  }
  return true;
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

    _writing = true;
    try {
      await fs.promises.writeFile(
        settingsPath,
        JSON.stringify(settings, null, 2),
        "utf-8"
      );
    } finally {
      // Keep the flag set briefly so the watcher event (which fires async) sees it
      setTimeout(() => { _writing = false; }, 200);
    }
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
      _writing = true;
      try {
        await fs.promises.writeFile(
          settingsPath,
          JSON.stringify(settings, null, 2),
          "utf-8"
        );
      } finally {
        setTimeout(() => { _writing = false; }, 200);
      }
    }
  }
}
