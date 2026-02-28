import * as vscode from "vscode";

export class TerminalManager {
  private groups = new Map<string, vscode.Terminal[]>();
  private changeCallbacks: (() => void)[] = [];

  startListening(): vscode.Disposable {
    return vscode.window.onDidCloseTerminal((closed) => {
      for (const [groupName, terminals] of this.groups) {
        const idx = terminals.indexOf(closed);
        if (idx >= 0) {
          terminals.splice(idx, 1);
          if (terminals.length === 0) {
            this.groups.delete(groupName);
          }
          this.notifyChange();
          break;
        }
      }
    });
  }

  track(groupName: string, terminal: vscode.Terminal): void {
    let terminals = this.groups.get(groupName);
    if (!terminals) {
      terminals = [];
      this.groups.set(groupName, terminals);
    }
    terminals.push(terminal);
    this.notifyChange();
  }

  getGroupTerminals(groupName: string): vscode.Terminal[] {
    return this.groups.get(groupName) ?? [];
  }

  isGroupRunning(groupName: string): boolean {
    const terminals = this.groups.get(groupName);
    return !!terminals && terminals.length > 0;
  }

  killGroup(groupName: string): void {
    const terminals = this.groups.get(groupName);
    if (terminals) {
      for (const t of [...terminals]) {
        t.dispose();
      }
      this.groups.delete(groupName);
      this.notifyChange();
    }
  }

  getRunningGroupNames(): string[] {
    return Array.from(this.groups.keys());
  }

  getActiveTerminalCount(): number {
    let count = 0;
    for (const terminals of this.groups.values()) {
      count += terminals.length;
    }
    return count;
  }

  onDidChange(callback: () => void): vscode.Disposable {
    this.changeCallbacks.push(callback);
    return new vscode.Disposable(() => {
      const idx = this.changeCallbacks.indexOf(callback);
      if (idx >= 0) {
        this.changeCallbacks.splice(idx, 1);
      }
    });
  }

  private notifyChange(): void {
    for (const cb of this.changeCallbacks) {
      cb();
    }
  }
}
