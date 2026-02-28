import * as vscode from "vscode";
import * as path from "path";
import { BrainSpawnConfig, ConfigChangeListener, SpawnGroup } from "../types";
import { validateConfig } from "./configSchema";

const CONFIG_FILENAME = "brain-spawn.json";

export class ConfigLoader {
  private config: BrainSpawnConfig = { version: 1, groups: [] };
  private listeners: ConfigChangeListener[] = [];
  private fileWatcher: vscode.FileSystemWatcher | undefined;
  private settingsListener: vscode.Disposable | undefined;

  async load(): Promise<BrainSpawnConfig> {
    const allGroups: SpawnGroup[] = [];

    // Load workspace groups from .vscode/brain-spawn.json
    const fileConfig = await this.loadFromFile();
    if (fileConfig) {
      for (const g of fileConfig.groups) {
        g.source = "workspace";
        allGroups.push(g);
      }
    }

    // Load user-level groups from VS Code settings (globalValue only)
    const userGroups = this.loadUserGroups();
    if (userGroups) {
      for (const g of userGroups) {
        g.source = "user";
        allGroups.push(g);
      }
    }

    this.config = { version: 1, groups: allGroups };
    return this.config;
  }

  getConfig(): BrainSpawnConfig {
    return this.config;
  }

  onChange(listener: ConfigChangeListener): vscode.Disposable {
    this.listeners.push(listener);
    return new vscode.Disposable(() => {
      const idx = this.listeners.indexOf(listener);
      if (idx >= 0) {
        this.listeners.splice(idx, 1);
      }
    });
  }

  startWatching(): vscode.Disposable[] {
    const disposables: vscode.Disposable[] = [];

    this.fileWatcher = vscode.workspace.createFileSystemWatcher(
      `**/.vscode/${CONFIG_FILENAME}`
    );

    const reload = async () => {
      await this.load();
      this.notifyListeners();
    };

    this.fileWatcher.onDidChange(reload);
    this.fileWatcher.onDidCreate(reload);
    this.fileWatcher.onDidDelete(reload);
    disposables.push(this.fileWatcher);

    this.settingsListener = vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("brainSpawn.groups")) {
        reload();
      }
    });
    disposables.push(this.settingsListener);

    return disposables;
  }

  async saveToFile(config: BrainSpawnConfig): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      throw new Error("No workspace folder open");
    }

    const vscodePath = vscode.Uri.joinPath(workspaceFolder.uri, ".vscode");
    try {
      await vscode.workspace.fs.stat(vscodePath);
    } catch {
      await vscode.workspace.fs.createDirectory(vscodePath);
    }

    const stripped = {
      ...config,
      groups: config.groups.map((g) => this.stripSource(g)),
    };

    const configUri = vscode.Uri.joinPath(vscodePath, CONFIG_FILENAME);
    const content = JSON.stringify(stripped, null, 2) + "\n";
    await vscode.workspace.fs.writeFile(
      configUri,
      Buffer.from(content, "utf-8")
    );
  }

  async saveToUserSettings(groups: SpawnGroup[]): Promise<void> {
    const stripped = groups.map((g) => this.stripSource(g));
    await vscode.workspace
      .getConfiguration("brainSpawn")
      .update("groups", stripped.length > 0 ? stripped : undefined, vscode.ConfigurationTarget.Global);
  }

  async saveAll(config: BrainSpawnConfig): Promise<void> {
    const workspaceGroups = config.groups.filter((g) => g.source === "workspace");
    const userGroups = config.groups.filter((g) => g.source === "user");

    // Save workspace groups to file (only if there's a workspace folder)
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      if (workspaceGroups.length > 0) {
        await this.saveToFile({ version: config.version, groups: workspaceGroups });
      } else {
        // If no workspace groups remain, delete the file if it exists
        const configUri = vscode.Uri.joinPath(
          workspaceFolder.uri,
          ".vscode",
          CONFIG_FILENAME
        );
        try {
          await vscode.workspace.fs.stat(configUri);
          await vscode.workspace.fs.delete(configUri);
        } catch {
          // File doesn't exist, nothing to delete
        }
      }
    }

    // Save user groups to settings
    await this.saveToUserSettings(userGroups);

    // Reload merged config and notify
    await this.load();
    this.notifyListeners();
  }

  getConfigFilePath(): string | undefined {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return undefined;
    }
    return path.join(workspaceFolder.uri.fsPath, ".vscode", CONFIG_FILENAME);
  }

  private stripSource(group: SpawnGroup): SpawnGroup {
    const { source, ...rest } = group;
    return rest;
  }

  private async loadFromFile(): Promise<BrainSpawnConfig | undefined> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return undefined;
    }

    const configUri = vscode.Uri.joinPath(
      workspaceFolder.uri,
      ".vscode",
      CONFIG_FILENAME
    );

    try {
      const data = await vscode.workspace.fs.readFile(configUri);
      const json = JSON.parse(Buffer.from(data).toString("utf-8"));
      return validateConfig(json);
    } catch (e) {
      if (
        e instanceof Error &&
        (e.message.includes("does not exist") ||
          e.message.includes("ENOENT") ||
          e.name === "EntryNotFound")
      ) {
        return undefined;
      }
      // File exists but is invalid
      if (e instanceof Error) {
        vscode.window.showWarningMessage(
          `Brain Spawn: Invalid config — ${e.message}`
        );
      }
      return undefined;
    }
  }

  private loadUserGroups(): SpawnGroup[] | undefined {
    const inspection = vscode.workspace
      .getConfiguration("brainSpawn")
      .inspect<unknown[]>("groups");

    const groups = inspection?.globalValue;
    if (!groups || groups.length === 0) {
      return undefined;
    }

    try {
      const validated = validateConfig({ version: 1, groups });
      return validated.groups;
    } catch (e) {
      if (e instanceof Error) {
        vscode.window.showWarningMessage(
          `Brain Spawn: Invalid user settings — ${e.message}`
        );
      }
      return undefined;
    }
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener({ config: this.config });
    }
  }
}
