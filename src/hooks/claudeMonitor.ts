import * as vscode from "vscode";

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  timestamp: number;
}

export interface ClaudeTerminalState {
  terminalId: string;
  terminalName: string;
  groupName: string;
  description: string;
  status: "idle" | "busy" | "waiting";
  lastMessage: string;
  lastMessageSource: "user" | "assistant";
  chatHistory: ChatMessage[];
  sessionId?: string;
  icon?: string;
  color?: string;
  createdAt: number;
  statusSince: number;
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

export interface StoredHookEvent {
  timestamp: number;
  terminalId: string;
  sessionId?: string;
  event: HookEvent;
}

function abbreviate(text: string, maxSentences = 2): string {
  if (!text) {
    return "";
  }
  // Split on sentence-ending punctuation followed by whitespace
  const sentences = text.match(/[^.!?]*[.!?]+[\s]*/g);
  if (sentences && sentences.length > maxSentences) {
    return sentences.slice(0, maxSentences).join("").trim() + "...";
  }
  // If no sentence boundaries found or short enough, truncate at 200 chars
  if (text.length > 200) {
    return text.slice(0, 200).trim() + "...";
  }
  return text.trim();
}

const MAX_CHAT_HISTORY = 50;

export class ClaudeMonitor {
  private states = new Map<string, ClaudeTerminalState>();
  private eventLogs = new Map<string, StoredHookEvent[]>();
  private closedTerminalIds = new Set<string>();
  private changeCallbacks: (() => void)[] = [];

  registerTerminal(
    terminalId: string,
    name: string,
    groupName: string,
    icon?: string,
    color?: string
  ): void {
    const now = Date.now();
    this.states.set(terminalId, {
      terminalId,
      terminalName: name,
      groupName,
      description: "",
      status: "idle",
      lastMessage: "",
      lastMessageSource: "user",
      chatHistory: [],
      icon: icon ?? "terminal",
      color,
      createdAt: now,
      statusSince: now,
    });
    this.notifyChange();
  }

  unregisterTerminal(terminalId: string): void {
    this.closedTerminalIds.add(terminalId);
    if (this.states.delete(terminalId)) {
      this.eventLogs.delete(terminalId);
      this.notifyChange();
    }
  }

  handleHookEvent(
    terminalId: string,
    sessionId: string | undefined,
    event: HookEvent
  ): void {
    const log = this.eventLogs.get(terminalId) ?? [];
    log.push({ timestamp: Date.now(), terminalId, sessionId, event });
    if (log.length > 500) {
      log.shift();
    }
    this.eventLogs.set(terminalId, log);

    if (this.closedTerminalIds.has(terminalId)) {
      return;
    }

    let state = this.states.get(terminalId);

    // If we don't have a registered terminal for this ID, create one for external Claude sessions
    if (!state) {
      const now = Date.now();
      state = {
        terminalId,
        terminalName: "Unknown",
        groupName: "External",
        description: "",
        status: "idle",
        lastMessage: "",
        lastMessageSource: "user",
        chatHistory: [],
        createdAt: now,
        statusSince: now,
      };
      this.states.set(terminalId, state);
    }

    if (sessionId) {
      state.sessionId = sessionId;
    }

    switch (event.hook_event_name) {
      case "SessionStart":
        state.status = "idle";
        state.statusSince = Date.now();
        break;

      case "UserPromptSubmit":
        state.status = "busy";
        state.statusSince = Date.now();
        if (event.prompt) {
          state.lastMessage = event.prompt;
          state.lastMessageSource = "user";
          state.chatHistory.push({
            role: "user",
            text: abbreviate(event.prompt),
            timestamp: Date.now(),
          });
          if (state.chatHistory.length > MAX_CHAT_HISTORY) {
            state.chatHistory.shift();
          }
        }
        break;

      case "PreToolUse":
        if (event.tool_name === "AskUserQuestion") {
          state.status = "waiting";
          state.statusSince = Date.now();
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
          state.statusSince = Date.now();
        }
        break;

      case "Notification":
        if (
          event.notification_type === "permission_prompt" ||
          event.notification_type === "elicitation_dialog"
        ) {
          state.status = "waiting";
          state.statusSince = Date.now();
        }
        break;

      case "Stop":
        state.status = "idle";
        state.statusSince = Date.now();
        if (event.last_assistant_message) {
          state.lastMessage = event.last_assistant_message;
          state.lastMessageSource = "assistant";
          state.chatHistory.push({
            role: "assistant",
            text: abbreviate(event.last_assistant_message),
            timestamp: Date.now(),
          });
          if (state.chatHistory.length > MAX_CHAT_HISTORY) {
            state.chatHistory.shift();
          }
        }
        break;

      case "SessionEnd":
        state.status = "idle";
        state.statusSince = Date.now();
        state.lastMessage = "";
        state.chatHistory = [];
        state.sessionId = undefined;
        break;

      default:
        return; // Unknown event, no notification needed
    }

    this.notifyChange();
  }

  setDescription(terminalId: string, description: string): void {
    const state = this.states.get(terminalId);
    if (state) {
      state.description = description;
      this.notifyChange();
    }
  }

  setName(terminalId: string, name: string): void {
    const state = this.states.get(terminalId);
    if (state) {
      state.terminalName = name;
      this.notifyChange();
    }
  }

  getEventLog(terminalId: string): StoredHookEvent[] {
    return this.eventLogs.get(terminalId) ?? [];
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
