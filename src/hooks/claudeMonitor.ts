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
  editedFiles: string[];
  sessionId?: string;
  icon?: string;
  color?: string;
  cwd?: string;
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
    file_path?: string;
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
  private sessionEndTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private changeCallbacks: (() => void)[] = [];
  private externalTerminalCallbacks: ((terminalId: string) => void)[] = [];
  private fileEditedCallbacks: ((terminalId: string, filePath: string) => void)[] = [];
  private suppressUnknownUntil = 0;

  registerTerminal(
    terminalId: string,
    name: string,
    groupName: string,
    icon?: string,
    color?: string,
    cwd?: string
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
      editedFiles: [],
      icon: icon ?? "terminal",
      color,
      cwd,
      createdAt: now,
      statusSince: now,
    });
    this.notifyChange();
  }

  unregisterTerminal(terminalId: string): void {
    this.closedTerminalIds.add(terminalId);
    const pending = this.sessionEndTimers.get(terminalId);
    if (pending) {
      clearTimeout(pending);
      this.sessionEndTimers.delete(terminalId);
    }
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

    if (event.hook_event_name !== "SessionEnd") {
      const pending = this.sessionEndTimers.get(terminalId);
      if (pending) {
        clearTimeout(pending);
        this.sessionEndTimers.delete(terminalId);
      }
    }

    let state = this.states.get(terminalId);

    // If we don't have a registered terminal for this ID, create one for external Claude sessions
    if (!state && Date.now() < this.suppressUnknownUntil) {
      return;
    }
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
        editedFiles: [],
        createdAt: now,
        statusSince: now,
      };
      this.states.set(terminalId, state);
      for (const cb of this.externalTerminalCallbacks) {
        cb(terminalId);
      }
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
        if (
          (event.tool_name === "Edit" || event.tool_name === "Write") &&
          event.tool_input?.file_path
        ) {
          const filePath = event.tool_input.file_path;
          if (!state.editedFiles.includes(filePath)) {
            state.editedFiles.push(filePath);
          }
          for (const cb of this.fileEditedCallbacks) {
            cb(terminalId, filePath);
          }
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

      case "SessionEnd": {
        const timer = setTimeout(() => {
          this.sessionEndTimers.delete(terminalId);
          state.status = "idle";
          state.statusSince = Date.now();
          state.lastMessage = "";
          state.chatHistory = [];
          state.editedFiles = [];
          state.sessionId = undefined;
          this.notifyChange();
        }, 3000);
        this.sessionEndTimers.set(terminalId, timer);
        return; // Don't notifyChange yet — wait for timeout
      }

      default:
        return; // Unknown event, no notification needed
    }

    this.notifyChange();
  }

  suppressUnknownTerminals(durationMs = 10000): void {
    this.suppressUnknownUntil = Date.now() + durationMs;
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

  reorderTerminals(orderedIds: string[]): void {
    const reordered = new Map<string, ClaudeTerminalState>();
    for (const id of orderedIds) {
      const state = this.states.get(id);
      if (state) {
        reordered.set(id, state);
      }
    }
    // Append any remaining terminals not in the list
    for (const [id, state] of this.states) {
      if (!reordered.has(id)) {
        reordered.set(id, state);
      }
    }
    this.states = reordered;
    this.notifyChange();
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

  onExternalTerminalDetected(callback: (terminalId: string) => void): vscode.Disposable {
    this.externalTerminalCallbacks.push(callback);
    return new vscode.Disposable(() => {
      const idx = this.externalTerminalCallbacks.indexOf(callback);
      if (idx >= 0) {
        this.externalTerminalCallbacks.splice(idx, 1);
      }
    });
  }

  onFileEdited(callback: (terminalId: string, filePath: string) => void): vscode.Disposable {
    this.fileEditedCallbacks.push(callback);
    return new vscode.Disposable(() => {
      const idx = this.fileEditedCallbacks.indexOf(callback);
      if (idx >= 0) {
        this.fileEditedCallbacks.splice(idx, 1);
      }
    });
  }

  private notifyChange(): void {
    for (const cb of this.changeCallbacks) {
      cb();
    }
  }
}
