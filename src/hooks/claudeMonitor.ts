import * as vscode from "vscode";

export interface ClaudeTerminalState {
  terminalId: string;
  terminalName: string;
  groupName: string;
  status: "idle" | "busy" | "waiting";
  lastMessage: string;
  lastMessageSource: "user" | "assistant";
  sessionId?: string;
  icon?: string;
  color?: string;
}

export interface HookEvent {
  hook_event_name: string;
  prompt?: string;
  last_assistant_message?: string;
  session_id?: string;
  tool_name?: string;
  tool_input?: {
    questions?: Array<{ question?: string }>;
    [key: string]: unknown;
  };
  notification_type?: string;
  message?: string;
}

export class ClaudeMonitor {
  private states = new Map<string, ClaudeTerminalState>();
  private changeCallbacks: (() => void)[] = [];

  registerTerminal(
    terminalId: string,
    name: string,
    groupName: string,
    icon?: string,
    color?: string
  ): void {
    this.states.set(terminalId, {
      terminalId,
      terminalName: name,
      groupName,
      status: "idle",
      lastMessage: "",
      lastMessageSource: "user",
      icon: icon ?? "terminal",
      color,
    });
    this.notifyChange();
  }

  unregisterTerminal(terminalId: string): void {
    if (this.states.delete(terminalId)) {
      this.notifyChange();
    }
  }

  handleHookEvent(
    terminalId: string,
    sessionId: string | undefined,
    event: HookEvent
  ): void {
    let state = this.states.get(terminalId);

    // If we don't have a registered terminal for this ID, create one for external Claude sessions
    if (!state) {
      state = {
        terminalId,
        terminalName: "Unknown",
        groupName: "External",
        status: "idle",
        lastMessage: "",
        lastMessageSource: "user",
      };
      this.states.set(terminalId, state);
    }

    if (sessionId) {
      state.sessionId = sessionId;
    }

    switch (event.hook_event_name) {
      case "SessionStart":
        state.status = "idle";
        break;

      case "UserPromptSubmit":
        state.status = "busy";
        if (event.prompt) {
          state.lastMessage = event.prompt;
          state.lastMessageSource = "user";
        }
        break;

      case "PreToolUse":
        if (event.tool_name === "AskUserQuestion") {
          state.status = "waiting";
          const firstQuestion = event.tool_input?.questions?.[0]?.question;
          if (firstQuestion) {
            state.lastMessage = firstQuestion;
            state.lastMessageSource = "assistant";
          }
        }
        break;

      case "PostToolUse":
        if (event.tool_name === "AskUserQuestion") {
          state.status = "busy";
        }
        break;

      case "Notification":
        if (
          event.notification_type === "permission_prompt" ||
          event.notification_type === "elicitation_dialog"
        ) {
          state.status = "waiting";
        }
        break;

      case "Stop":
        state.status = "idle";
        if (event.last_assistant_message) {
          state.lastMessage = event.last_assistant_message;
          state.lastMessageSource = "assistant";
        }
        break;

      case "SessionEnd":
        this.states.delete(terminalId);
        break;

      default:
        return; // Unknown event, no notification needed
    }

    this.notifyChange();
  }

  getStates(): ClaudeTerminalState[] {
    return Array.from(this.states.values());
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
