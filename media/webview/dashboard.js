// @ts-check
(function () {
  // @ts-ignore
  const vscode = acquireVsCodeApi();

  const emptyState = document.getElementById("emptyState");
  const terminalList = document.getElementById("terminalList");

  /** @type {Array<{terminalId: string, terminalName: string, groupName: string, status: string, lastMessage: string, lastMessageSource: string, sessionId?: string, icon?: string, color?: string}>} */
  let terminals = [];

  window.addEventListener("message", (event) => {
    const msg = event.data;
    switch (msg.type) {
      case "state":
        terminals = msg.terminals || [];
        render();
        break;
    }
  });

  function render() {
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
        const sourceLabel =
          t.lastMessageSource === "user" ? "User:" : "Agent:";
        const lastLines = getFirstLines(t.lastMessage, 3);
        const messageHtml = lastLines
          ? `<div class="terminal-message"><span class="source-label">${sourceLabel}</span><div class="message-body">${renderMarkdown(lastLines)}</div></div>`
          : "";

        return `<div class="terminal-card" data-id="${escapeAttr(t.terminalId)}">
          <div class="card-header">
            <div class="status-dot ${statusClass}" title="${statusLabel}"></div>
            <div class="terminal-name-row">
              <i class="codicon codicon-${escapeAttr(iconId)} terminal-icon${colorClass}"></i>
              <span class="terminal-name">${escapeHtml(t.terminalName)}</span>
            </div>
            <div class="terminal-status">${statusLabel}</div>
            <div class="terminal-actions">
              <button class="action-btn send-text-btn" data-id="${escapeAttr(t.terminalId)}" data-text="/clear" title="Send /clear">
                <i class="codicon codicon-clear-all"></i> /clear
              </button>
              <button class="action-btn send-text-btn" data-id="${escapeAttr(t.terminalId)}" data-text="/usage" title="Send /usage">
                <i class="codicon codicon-dashboard"></i> /usage
              </button>
            </div>
          </div>
          ${messageHtml}
          <button class="close-btn" data-id="${escapeAttr(t.terminalId)}" title="Close terminal">
            <i class="codicon codicon-close"></i> Close
          </button>
        </div>`;
      })
      .join("");

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
  }

  /**
   * Get the last N non-empty lines from a string.
   * @param {string} str
   * @param {number} n
   * @returns {string}
   */
  function getFirstLines(str, n) {
    if (!str) {
      return "";
    }
    const lines = str.split("\n").filter((l) => l.trim() !== "");
    return lines.slice(0, n).join("\n");
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

  // Header button handlers
  document.getElementById("launchBtn").addEventListener("click", () => {
    vscode.postMessage({ type: "launch" });
  });
  document.getElementById("newTerminalBtn").addEventListener("click", () => {
    vscode.postMessage({ type: "newTerminal" });
  });

  // Signal ready
  vscode.postMessage({ type: "ready" });
})();
