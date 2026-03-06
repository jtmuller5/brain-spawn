// @ts-check
(function () {
  // @ts-ignore
  const vscode = acquireVsCodeApi();

  const emptyState = document.getElementById("emptyState");
  const terminalList = document.getElementById("terminalList");
  const statusSummary = document.getElementById("statusSummary");

  /** @type {Array<{terminalId: string, terminalName: string, groupName: string, description: string, status: string, lastMessage: string, lastMessageSource: string, chatHistory: Array<{role: string, text: string, timestamp: number}>, sessionId?: string, icon?: string, color?: string, createdAt: number, statusSince: number}>} */
  let terminals = [];
  /** @type {number | null} */
  let statusTimer = null;

  // Logs view state
  /** @type {'dashboard' | 'logs'} */
  let currentView = "dashboard";
  /** @type {string | null} */
  let logsTerminalId = null;
  /** @type {string} */
  let logsTerminalName = "";
  /** @type {Array<{timestamp: number, terminalId: string, sessionId?: string, event: any}>} */
  let eventLogs = [];
  /** @type {Set<string>} */
  let activeEventFilters = new Set();
  /** @type {string | null} */
  let activeTerminalId = null;

  window.addEventListener("message", (event) => {
    const msg = event.data;
    switch (msg.type) {
      case "state":
        terminals = msg.terminals || [];
        if (currentView === "dashboard") {
          render();
        } else if (currentView === "logs" && logsTerminalId) {
          // Re-request logs for live updates
          vscode.postMessage({ type: "requestLogs", terminalId: logsTerminalId });
        }
        break;
      case "activeTerminal":
        activeTerminalId = msg.terminalId || null;
        updateActiveCard();
        break;
      case "eventLogs":
        logsTerminalId = msg.terminalId;
        logsTerminalName = msg.terminalName || "Unknown";
        eventLogs = msg.events || [];
        renderLogsView();
        break;
    }
  });

  function updateStatusSummary() {
    if (terminals.length === 0) {
      statusSummary.innerHTML = "";
      return;
    }
    const idle = terminals.filter((t) => t.status === "idle").length;
    const busy = terminals.filter((t) => t.status === "busy").length;
    const waiting = terminals.filter((t) => t.status === "waiting").length;
    const badges = [];
    if (busy > 0) {
      badges.push(`<span class="summary-badge busy" title="${busy} busy">${busy}</span>`);
    }
    if (waiting > 0) {
      badges.push(`<span class="summary-badge waiting" title="${waiting} waiting">${waiting}</span>`);
    }
    if (idle > 0) {
      badges.push(`<span class="summary-badge idle" title="${idle} idle">${idle}</span>`);
    }
    statusSummary.innerHTML = badges.join("");
  }

  function updateActiveCard() {
    terminalList.querySelectorAll(".terminal-card").forEach((card) => {
      const id = /** @type {HTMLElement} */ (card).dataset.id;
      card.classList.toggle("active", id === activeTerminalId);
    });
  }

  function render() {
    if (statusTimer) {
      clearInterval(statusTimer);
      statusTimer = null;
    }

    updateStatusSummary();

    if (terminals.length === 0) {
      emptyState.style.display = "";
      terminalList.style.display = "none";
      terminalList.innerHTML = "";
      return;
    }

    emptyState.style.display = "none";
    terminalList.style.display = "";

    terminalList.innerHTML = terminals
      .map((t) => {
        const statusClass = t.status === "waiting" ? "waiting" : t.status === "busy" ? "busy" : "idle";
        const statusLabel = t.status === "waiting" ? "Waiting for input" : t.status === "busy" ? "Busy" : "Idle";
        const iconId = t.icon || "terminal";
        const colorClass = t.color ? ` icon-color-${t.color}` : "";
        const chatMessages = t.chatHistory || [];
        const messageHtml = chatMessages.length > 0
          ? `<div class="chat-history" data-id="${escapeAttr(t.terminalId)}">${chatMessages.map((m) => {
              const roleClass = m.role === "user" ? "chat-user" : "chat-assistant";
              const avatarLetter = m.role === "user" ? "Y" : "A";
              return `<div class="chat-row ${roleClass}"><span class="chat-avatar">${avatarLetter}</span><span class="chat-text">${renderMarkdown(m.text)}</span></div>`;
            }).join("")}</div>`
          : "";

        const createdLabel = formatTime(t.createdAt);
        const durationText = formatDuration(Date.now() - t.statusSince);

        const descriptionHtml = t.description
          ? `<div class="terminal-description" data-id="${escapeAttr(t.terminalId)}" title="Click to edit description">${escapeHtml(t.description)}</div>`
          : `<div class="terminal-description placeholder" data-id="${escapeAttr(t.terminalId)}" title="Click to add a description">Add description...</div>`;

        return `<div class="terminal-card" data-id="${escapeAttr(t.terminalId)}">
          <button class="close-btn" data-id="${escapeAttr(t.terminalId)}" title="Close terminal">
            <i class="codicon codicon-close"></i>
          </button>
          <button class="action-btn clear-btn send-text-btn" data-id="${escapeAttr(t.terminalId)}" data-text="/clear" title="/clear">
            <i class="codicon codicon-clear-all"></i>
          </button>
          ${t.sessionId ? `<button class="action-btn fork-btn" data-id="${escapeAttr(t.terminalId)}" title="Fork session">
            <i class="codicon codicon-repo-forked"></i>
          </button>` : ""}
          <div class="card-top-right">
            <div class="terminal-actions">
              <button class="action-btn send-text-btn" data-id="${escapeAttr(t.terminalId)}" data-text="/plan" title="/plan">
                <i class="codicon codicon-map"></i>
              </button>
              <button class="action-btn send-text-btn" data-id="${escapeAttr(t.terminalId)}" data-text="/usage" title="/usage">
                <i class="codicon codicon-dashboard"></i>
              </button>
              <button class="action-btn send-text-btn" data-id="${escapeAttr(t.terminalId)}" data-text="/simplify" title="/simplify">
                <i class="codicon codicon-sparkle"></i>
              </button>
              <button class="action-btn logs-btn" data-id="${escapeAttr(t.terminalId)}" title="View logs">
                <i class="codicon codicon-output"></i>
              </button>
            </div>
            <div class="status-dot ${statusClass}" title="${statusLabel}"></div>
          </div>
          <div class="card-header">
            <div class="terminal-name-row">
              <i class="codicon codicon-${escapeAttr(iconId)} terminal-icon${colorClass}"></i>
              <span class="terminal-name" data-id="${escapeAttr(t.terminalId)}" title="Click to rename">${escapeHtml(t.terminalName)}</span>
            </div>
            ${descriptionHtml}
            <div class="terminal-status-row">
              <span class="terminal-status" data-since="${t.statusSince}">${statusLabel} <span class="status-duration">(${durationText})</span></span>
              <span class="terminal-meta-sep">&middot;</span>
              <span>${createdLabel}</span>
            </div>
          </div>
          ${messageHtml}
        </div>`;
      })
      .join("");

    statusTimer = setInterval(updateStatusDurations, 1000);

    // Bind click handlers — clicking the card opens the terminal
    terminalList.querySelectorAll(".terminal-card").forEach((card) => {
      card.addEventListener("click", (e) => {
        // Don't open terminal if a button was clicked
        if (/** @type {HTMLElement} */ (e.target).closest("button")) {
          return;
        }
        const id = /** @type {HTMLElement} */ (card).dataset.id;
        vscode.postMessage({ type: "focusTerminal", terminalId: id });
      });
    });

    terminalList.querySelectorAll(".close-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const id = /** @type {HTMLElement} */ (e.currentTarget).dataset.id;
        vscode.postMessage({ type: "closeTerminal", terminalId: id });
      });
    });

    terminalList.querySelectorAll(".send-text-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const el = /** @type {HTMLElement} */ (e.currentTarget);
        vscode.postMessage({
          type: "sendText",
          terminalId: el.dataset.id,
          text: el.dataset.text,
        });
      });
    });

    // Auto-scroll chat histories to the bottom
    terminalList.querySelectorAll(".chat-history").forEach((el) => {
      el.scrollTop = el.scrollHeight;
    });

    terminalList.querySelectorAll(".fork-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const el = /** @type {HTMLElement} */ (e.currentTarget);
        vscode.postMessage({ type: "forkTerminal", terminalId: el.dataset.id });
      });
    });

    terminalList.querySelectorAll(".logs-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const el = /** @type {HTMLElement} */ (e.currentTarget);
        currentView = "logs";
        logsTerminalId = el.dataset.id;
        activeEventFilters.clear();
        vscode.postMessage({ type: "requestLogs", terminalId: logsTerminalId });
      });
    });

    updateActiveCard();

    terminalList.querySelectorAll(".terminal-name").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        const nameEl = /** @type {HTMLElement} */ (el);
        const id = nameEl.dataset.id;
        const terminal = terminals.find((t) => t.terminalId === id);
        if (!terminal) { return; }

        const input = document.createElement("input");
        input.type = "text";
        input.className = "name-input";
        input.value = terminal.terminalName;
        input.placeholder = "Terminal name";
        input.maxLength = 60;

        nameEl.replaceWith(input);
        input.focus();
        input.select();

        const save = () => {
          const value = input.value.trim();
          if (value && value !== terminal.terminalName) {
            vscode.postMessage({ type: "setName", terminalId: id, name: value });
          }
        };

        input.addEventListener("blur", save);
        input.addEventListener("keydown", (ke) => {
          if (ke.key === "Enter") { input.blur(); }
          if (ke.key === "Escape") {
            input.value = terminal.terminalName;
            input.blur();
          }
        });
      });
    });

    terminalList.querySelectorAll(".terminal-description").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        const descEl = /** @type {HTMLElement} */ (el);
        const id = descEl.dataset.id;
        const terminal = terminals.find((t) => t.terminalId === id);
        if (!terminal) { return; }

        const input = document.createElement("input");
        input.type = "text";
        input.className = "description-input";
        input.value = terminal.description || "";
        input.placeholder = "Add description...";
        input.maxLength = 120;

        descEl.replaceWith(input);
        input.focus();
        input.select();

        const save = () => {
          const value = input.value.trim();
          vscode.postMessage({ type: "setDescription", terminalId: id, description: value });
        };

        input.addEventListener("blur", save);
        input.addEventListener("keydown", (ke) => {
          if (ke.key === "Enter") { input.blur(); }
          if (ke.key === "Escape") {
            input.value = terminal.description || "";
            input.blur();
          }
        });
      });
    });
  }

  /**
   * Simple markdown-to-HTML renderer for inline formatting.
   * Handles: **bold**, *italic*, `code`, and line breaks.
   * @param {string} str
   * @returns {string}
   */
  function renderMarkdown(str) {
    return str
      .split("\n")
      .map((line) => {
        let html = escapeHtml(line);
        // inline code
        html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
        // bold
        html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
        // italic
        html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
        return html;
      })
      .join("<br>");
  }

  /**
   * Format a timestamp as a localized time string (e.g. "2:34 PM").
   * @param {number} ts
   * @returns {string}
   */
  function formatTime(ts) {
    return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  /**
   * Format a millisecond duration as a human-readable string.
   * @param {number} ms
   * @returns {string}
   */
  function formatDuration(ms) {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    if (totalSec < 60) {
      return totalSec + "s";
    }
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    if (min < 60) {
      return min + "m " + sec + "s";
    }
    const hr = Math.floor(min / 60);
    const remMin = min % 60;
    return hr + "h " + remMin + "m";
  }

  function updateStatusDurations() {
    terminalList.querySelectorAll(".terminal-status[data-since]").forEach((el) => {
      const since = Number(/** @type {HTMLElement} */ (el).dataset.since);
      const durationEl = el.querySelector(".status-duration");
      if (since && durationEl) {
        durationEl.textContent = "(" + formatDuration(Date.now() - since) + ")";
      }
    });
  }

  /**
   * @param {string} str
   * @returns {string}
   */
  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * @param {string} str
   * @returns {string}
   */
  function escapeAttr(str) {
    return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  }

  function renderLogsView() {
    if (statusTimer) {
      clearInterval(statusTimer);
      statusTimer = null;
    }

    emptyState.style.display = "none";
    terminalList.style.display = "";

    // Collect unique event types
    const eventTypes = [...new Set(eventLogs.map((e) => e.event.hook_event_name))];

    // If no filters set, show all
    const showAll = activeEventFilters.size === 0;
    const filtered = showAll
      ? eventLogs
      : eventLogs.filter((e) => activeEventFilters.has(e.event.hook_event_name));

    const filtersHtml = eventTypes.length > 0
      ? `<div class="logs-filters">${eventTypes
          .map(
            (t) =>
              `<label class="filter-label"><input type="checkbox" class="filter-checkbox" data-event-type="${escapeAttr(t)}" ${showAll || activeEventFilters.has(t) ? "checked" : ""}> ${escapeHtml(t)}</label>`
          )
          .join("")}</div>`
      : "";

    const entriesHtml =
      filtered.length === 0
        ? `<div class="logs-empty"><p>No events recorded yet.</p></div>`
        : `<div class="logs-list">${filtered
            .slice()
            .reverse()
            .map(
              (entry, i) =>
                `<div class="log-entry">
                  <div class="log-entry-header" data-index="${i}">
                    <span class="log-time">${formatTimePrecise(entry.timestamp)}</span>
                    <span class="log-event-name">${escapeHtml(entry.event.hook_event_name)}${entry.event.tool_name ? ": " + escapeHtml(entry.event.tool_name) : ""}</span>
                    <button class="log-expand-btn" data-index="${i}" title="Toggle payload"><i class="codicon codicon-chevron-right"></i></button>
                  </div>
                  <div class="log-payload" data-index="${i}"><pre>${escapeHtml(JSON.stringify(entry.event, null, 2))}</pre></div>
                </div>`
            )
            .join("")}</div>`;

    terminalList.innerHTML = `<div class="logs-view">
      <div class="logs-header">
        <button class="logs-back-btn" id="logsBackBtn"><i class="codicon codicon-arrow-left"></i> Back</button>
        <h2 class="logs-title">${escapeHtml(logsTerminalName)}</h2>
        <span class="logs-count">${filtered.length} of ${eventLogs.length} events</span>
      </div>
      ${filtersHtml}
      ${entriesHtml}
    </div>`;

    // Back button
    document.getElementById("logsBackBtn").addEventListener("click", () => {
      currentView = "dashboard";
      logsTerminalId = null;
      eventLogs = [];
      activeEventFilters.clear();
      render();
    });

    // Filter checkboxes
    terminalList.querySelectorAll(".filter-checkbox").forEach((cb) => {
      cb.addEventListener("change", () => {
        const el = /** @type {HTMLInputElement} */ (cb);
        const eventType = el.dataset.eventType;
        // Collect all checked types
        activeEventFilters.clear();
        terminalList.querySelectorAll(".filter-checkbox").forEach((c) => {
          const input = /** @type {HTMLInputElement} */ (c);
          if (input.checked) {
            activeEventFilters.add(input.dataset.eventType);
          }
        });
        // If all are checked, treat as "show all" (clear filters)
        if (activeEventFilters.size === eventTypes.length) {
          activeEventFilters.clear();
        }
        renderLogsView();
      });
    });

    // Expand/collapse
    terminalList.querySelectorAll(".log-entry-header").forEach((header) => {
      header.addEventListener("click", () => {
        const idx = /** @type {HTMLElement} */ (header).dataset.index;
        const payload = terminalList.querySelector(`.log-payload[data-index="${idx}"]`);
        const btn = header.querySelector(".log-expand-btn");
        if (payload) {
          payload.classList.toggle("visible");
          if (btn) {
            btn.classList.toggle("expanded");
          }
        }
      });
    });
  }

  /**
   * Format timestamp as HH:MM:SS.mmm
   * @param {number} ts
   * @returns {string}
   */
  function formatTimePrecise(ts) {
    const d = new Date(ts);
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    const s = String(d.getSeconds()).padStart(2, "0");
    const ms = String(d.getMilliseconds()).padStart(3, "0");
    return `${h}:${m}:${s}.${ms}`;
  }

  // Header button handlers
  document.getElementById("launchBtn").addEventListener("click", () => {
    vscode.postMessage({ type: "launch" });
  });
  document.getElementById("newTerminalBtn").addEventListener("click", () => {
    vscode.postMessage({ type: "newTerminal" });
  });
  document.getElementById("newPlanTerminalBtn").addEventListener("click", () => {
    vscode.postMessage({ type: "newPlanTerminal" });
  });
  document.getElementById("newPlainTerminalBtn").addEventListener("click", () => {
    vscode.postMessage({ type: "newPlainTerminal" });
  });

  // Empty state button handlers
  document.getElementById("emptyLaunchBtn").addEventListener("click", () => {
    vscode.postMessage({ type: "launch" });
  });
  document.getElementById("emptyNewTerminalBtn").addEventListener("click", () => {
    vscode.postMessage({ type: "newTerminal" });
  });
  document.getElementById("emptyNewPlanTerminalBtn").addEventListener("click", () => {
    vscode.postMessage({ type: "newPlanTerminal" });
  });
  document.getElementById("emptyNewPlainTerminalBtn").addEventListener("click", () => {
    vscode.postMessage({ type: "newPlainTerminal" });
  });

  // Signal ready
  vscode.postMessage({ type: "ready" });
})();
