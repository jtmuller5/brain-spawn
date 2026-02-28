import { BrainSpawnConfig, GroupSource, SpawnGroup, TerminalDefinition } from "../types";

const VALID_COLORS = [
  "black",
  "red",
  "green",
  "yellow",
  "blue",
  "magenta",
  "cyan",
  "white",
];

export function validateConfig(data: unknown): BrainSpawnConfig {
  if (!data || typeof data !== "object") {
    throw new Error("Configuration must be an object");
  }

  const obj = data as Record<string, unknown>;
  const version = typeof obj.version === "number" ? obj.version : 1;

  if (!Array.isArray(obj.groups)) {
    throw new Error('Configuration must have a "groups" array');
  }

  const groups: SpawnGroup[] = obj.groups.map((g: unknown, i: number) =>
    validateGroup(g, i)
  );

  return { version, groups };
}

function validateGroup(data: unknown, index: number): SpawnGroup {
  if (!data || typeof data !== "object") {
    throw new Error(`Group at index ${index} must be an object`);
  }

  const obj = data as Record<string, unknown>;

  const groupName =
    typeof obj.name === "string" && obj.name.trim() !== ""
      ? obj.name
      : `Untitled Group${index > 0 ? " " + (index + 1) : ""}`;
  obj.name = groupName;

  if (!Array.isArray(obj.terminals)) {
    throw new Error(`Group "${obj.name}" must have a "terminals" array`);
  }

  const terminals: TerminalDefinition[] = obj.terminals.map(
    (t: unknown, ti: number) => validateTerminal(t, obj.name as string, ti)
  );

  const group: SpawnGroup = { name: obj.name, terminals };
  if (obj.source === "user" || obj.source === "workspace") {
    group.source = obj.source as GroupSource;
  }
  return group;
}

function validateTerminal(
  data: unknown,
  groupName: string,
  index: number
): TerminalDefinition {
  if (!data || typeof data !== "object") {
    throw new Error(
      `Terminal at index ${index} in group "${groupName}" must be an object`
    );
  }

  const obj = data as Record<string, unknown>;

  const termName =
    typeof obj.name === "string" && obj.name.trim() !== ""
      ? obj.name
      : `Terminal ${index + 1}`;

  const terminal: TerminalDefinition = { name: termName };

  if (obj.command !== undefined) {
    if (typeof obj.command !== "string") {
      throw new Error(
        `Terminal "${obj.name}" in group "${groupName}": "command" must be a string`
      );
    }
    terminal.command = obj.command;
  }

  if (obj.icon !== undefined) {
    if (typeof obj.icon !== "string") {
      throw new Error(
        `Terminal "${obj.name}" in group "${groupName}": "icon" must be a string`
      );
    }
    terminal.icon = obj.icon;
  }

  if (obj.color !== undefined) {
    if (typeof obj.color !== "string") {
      throw new Error(
        `Terminal "${obj.name}" in group "${groupName}": "color" must be a string`
      );
    }
    if (!VALID_COLORS.includes(obj.color.toLowerCase())) {
      throw new Error(
        `Terminal "${obj.name}" in group "${groupName}": invalid color "${obj.color}". Valid: ${VALID_COLORS.join(", ")}`
      );
    }
    terminal.color = obj.color.toLowerCase();
  }

  if (obj.cwd !== undefined) {
    if (typeof obj.cwd !== "string") {
      throw new Error(
        `Terminal "${obj.name}" in group "${groupName}": "cwd" must be a string`
      );
    }
    terminal.cwd = obj.cwd;
  }

  if (obj.env !== undefined) {
    if (typeof obj.env !== "object" || obj.env === null) {
      throw new Error(
        `Terminal "${obj.name}" in group "${groupName}": "env" must be an object`
      );
    }
    terminal.env = obj.env as Record<string, string>;
  }

  if (obj.focus !== undefined) {
    if (typeof obj.focus !== "boolean") {
      throw new Error(
        `Terminal "${obj.name}" in group "${groupName}": "focus" must be a boolean`
      );
    }
    terminal.focus = obj.focus;
  }

  return terminal;
}
