// @ts-check

/** @type {ReturnType<typeof acquireVsCodeApi>} */
const vscode = acquireVsCodeApi();

const ICONS = [
  "account",
  "archive",
  "beaker",
  "bell",
  "book",
  "bookmark",
  "briefcase",
  "broadcast",
  "browser",
  "bug",
  "calendar",
  "check",
  "checklist",
  "circle-filled",
  "circle-large-outline",
  "clipboard",
  "clock",
  "close",
  "cloud",
  "cloud-download",
  "cloud-upload",
  "code",
  "coffee",
  "comment",
  "compass",
  "console",
  "credit-card",
  "dashboard",
  "database",
  "debug",
  "debug-alt",
  "desktop-download",
  "device-mobile",
  "edit",
  "error",
  "eye",
  "file",
  "file-code",
  "filter",
  "flame",
  "folder",
  "gear",
  "gift",
  "git-branch",
  "git-commit",
  "git-merge",
  "git-pull-request",
  "github",
  "globe",
  "graph",
  "heart",
  "home",
  "hubot",
  "inbox",
  "info",
  "inspect",
  "issue-opened",
  "key",
  "law",
  "layers",
  "library",
  "lightbulb",
  "link",
  "list-ordered",
  "list-unordered",
  "loading",
  "location",
  "lock",
  "magnet",
  "mail",
  "megaphone",
  "mention",
  "microscope",
  "milestone",
  "mortar-board",
  "music",
  "note",
  "notebook",
  "organization",
  "output",
  "package",
  "paintcan",
  "person",
  "pie-chart",
  "pinned",
  "play",
  "plug",
  "preview",
  "pulse",
  "question",
  "quote",
  "radio-tower",
  "reactions",
  "record",
  "remote",
  "repo",
  "report",
  "rocket",
  "ruby",
  "run-all",
  "save",
  "screen-full",
  "search",
  "server",
  "server-environment",
  "server-process",
  "settings",
  "settings-gear",
  "shield",
  "sign-in",
  "sign-out",
  "smiley",
  "sparkle",
  "squirrel",
  "star",
  "star-full",
  "symbol-event",
  "symbol-key",
  "symbol-method",
  "symbol-namespace",
  "symbol-number",
  "symbol-variable",
  "sync",
  "table",
  "tag",
  "target",
  "tasklist",
  "telescope",
  "terminal",
  "terminal-bash",
  "terminal-cmd",
  "terminal-linux",
  "terminal-powershell",
  "terminal-tmux",
  "terminal-ubuntu",
  "text-size",
  "thumbsdown",
  "thumbsup",
  "tools",
  "trash",
  "twitter",
  "unfold",
  "unlock",
  "variable",
  "verified",
  "vm",
  "wand",
  "warning",
  "watch",
  "window",
  "workspace-trusted",
  "workspace-untrusted",
  "zap",
];

const COLORS = [
  { name: "none", css: "transparent" },
  { name: "black", css: "#666" },
  { name: "red", css: "#cd3131" },
  { name: "green", css: "#0dbc79" },
  { name: "yellow", css: "#e5e510" },
  { name: "blue", css: "#2472c8" },
  { name: "magenta", css: "#bc3fbc" },
  { name: "cyan", css: "#11a8cd" },
  { name: "white", css: "#e5e5e5" },
];

/** @type {{ version: number, groups: Array<{ name: string, terminals: any[], source?: "user" | "workspace" }> }} */
let config = { version: 1, groups: [] };
let selectedGroupIndex = -1;
/** @type {string|null} */
let pendingFolderTarget = null;
/** @type {number|null} */
let saveTimer = null;
/** @type {number} */
let lastSaveTime = 0;
/** @type {Set<string>} Track expanded terminal cards by "groupIndex-termIndex" (collapsed by default) */
const expandedTerminals = new Set();
/** @type {number|null} After renderTerminals, scroll to and expand this terminal index */
let scrollToTerminal = null;

// Elements
const groupListEl = /** @type {HTMLUListElement} */ (document.getElementById("groupList"));
const emptyStateEl = /** @type {HTMLElement} */ (document.getElementById("emptyState"));
const groupEditorEl = /** @type {HTMLElement} */ (document.getElementById("groupEditor"));
const groupNameInput = /** @type {HTMLInputElement} */ (document.getElementById("groupNameInput"));
const terminalsListEl = /** @type {HTMLElement} */ (document.getElementById("terminalsList"));
const addGroupBtn = /** @type {HTMLButtonElement} */ (document.getElementById("addGroupBtn"));
const addGroupDropdownBtn = /** @type {HTMLButtonElement} */ (document.getElementById("addGroupDropdownBtn"));
const addTerminalBtn = /** @type {HTMLButtonElement} */ (document.getElementById("addTerminalBtn"));
const duplicateGroupBtn = /** @type {HTMLButtonElement} */ (document.getElementById("duplicateGroupBtn"));
const deleteGroupBtn = /** @type {HTMLButtonElement} */ (document.getElementById("deleteGroupBtn"));

// Message handling
window.addEventListener("message", (event) => {
  const msg = event.data;
  switch (msg.type) {
    case "config":
      // After we save, the file watcher may fire multiple events.
      // Ignore all config echoes within a short window after saving.
      if (Date.now() - lastSaveTime < 1000) {
        return;
      }
      config = msg.config;
      if (selectedGroupIndex >= config.groups.length) {
        selectedGroupIndex = config.groups.length - 1;
      }
      render();
      break;
    case "folderPicked":
      if (pendingFolderTarget) {
        const input = /** @type {HTMLInputElement|null} */ (
          document.querySelector(`[data-folder-target="${pendingFolderTarget}"]`)
        );
        if (input) {
          input.value = msg.path;
          input.dispatchEvent(new Event("input", { bubbles: true }));
        }
        pendingFolderTarget = null;
      }
      break;
    case "error":
      showError(msg.message);
      break;
  }
});

// Request initial config
vscode.postMessage({ type: "ready" });

// --- Sidebar resize ---
{
  const resizeHandle = /** @type {HTMLElement} */ (document.getElementById("resizeHandle"));
  const sidebar = /** @type {HTMLElement} */ (document.querySelector(".sidebar"));
  let startX = 0;
  let startWidth = 0;

  resizeHandle.addEventListener("mousedown", (e) => {
    e.preventDefault();
    startX = e.clientX;
    startWidth = sidebar.getBoundingClientRect().width;
    resizeHandle.classList.add("active");
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  });

  /** @param {MouseEvent} e */
  function onMouseMove(e) {
    const newWidth = startWidth + (e.clientX - startX);
    const clamped = Math.max(120, Math.min(newWidth, window.innerWidth * 0.5));
    sidebar.style.width = clamped + "px";
  }

  function onMouseUp() {
    resizeHandle.classList.remove("active");
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }
}

// --- Error display ---

/** @param {string} message */
function showError(message) {
  let banner = document.getElementById("errorBanner");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "errorBanner";
    banner.style.cssText =
      "position:fixed;top:0;left:0;right:0;padding:8px 16px;background:var(--vscode-inputValidation-errorBackground,#5a1d1d);color:var(--vscode-errorForeground,#f48771);font-size:13px;z-index:100;display:flex;align-items:center;justify-content:space-between;";
    const close = document.createElement("span");
    close.textContent = "\u00D7";
    close.style.cssText = "cursor:pointer;font-size:18px;padding:0 4px;";
    close.addEventListener("click", () => banner?.remove());
    banner.appendChild(document.createElement("span"));
    banner.appendChild(close);
    document.body.prepend(banner);
  }
  /** @type {HTMLElement} */ (banner.firstElementChild).textContent =
    "Save error: " + message;
  // Auto-dismiss after 6s
  setTimeout(() => banner?.remove(), 6000);
}

// --- Event handlers ---

/** @param {"workspace" | "user"} source */
function addGroup(source) {
  const name = generateGroupName();
  config.groups.push({ name, terminals: [], source });
  selectedGroupIndex = config.groups.length - 1;
  save();
  render();
  setTimeout(() => {
    groupNameInput.focus();
    groupNameInput.select();
  }, 50);
}

addGroupBtn.addEventListener("click", () => {
  addGroup("workspace");
});

addGroupDropdownBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  // Remove any existing menu
  const existing = document.querySelector(".add-group-menu");
  if (existing) {
    existing.remove();
    return;
  }

  const menu = document.createElement("div");
  menu.className = "add-group-menu";

  const wsItem = document.createElement("div");
  wsItem.className = "add-group-menu-item";
  wsItem.textContent = "Add Workspace Group";
  wsItem.addEventListener("click", () => {
    menu.remove();
    addGroup("workspace");
  });

  const userItem = document.createElement("div");
  userItem.className = "add-group-menu-item";
  userItem.textContent = "Add User Group";
  userItem.addEventListener("click", () => {
    menu.remove();
    addGroup("user");
  });

  menu.appendChild(wsItem);
  menu.appendChild(userItem);

  const wrapper = addGroupDropdownBtn.closest(".add-group-wrapper");
  if (wrapper) {
    wrapper.appendChild(menu);
  }

  // Close on outside click
  const closeMenu = () => {
    menu.remove();
    document.removeEventListener("click", closeMenu);
  };
  setTimeout(() => document.addEventListener("click", closeMenu), 0);
});

addTerminalBtn.addEventListener("click", () => {
  if (selectedGroupIndex < 0) return;
  config.groups[selectedGroupIndex].terminals.push({
    name: "New Terminal",
  });
  scrollToTerminal = config.groups[selectedGroupIndex].terminals.length - 1;
  save();
  renderTerminals();
});

duplicateGroupBtn.addEventListener("click", () => {
  if (selectedGroupIndex < 0) return;
  const srcGroup = config.groups[selectedGroupIndex];
  const copy = JSON.parse(JSON.stringify(srcGroup));
  copy.name = srcGroup.name + " (Copy)";
  config.groups.splice(selectedGroupIndex + 1, 0, copy);
  selectedGroupIndex = selectedGroupIndex + 1;
  save();
  render();
});

/** @type {number|null} */
let deleteGroupConfirmTimer = null;
let deleteGroupArmed = false;

deleteGroupBtn.addEventListener("click", () => {
  if (selectedGroupIndex < 0) return;

  if (!deleteGroupArmed) {
    deleteGroupArmed = true;
    deleteGroupBtn.textContent = "Confirm?";
    deleteGroupBtn.classList.add("armed");
    if (deleteGroupConfirmTimer !== null) clearTimeout(deleteGroupConfirmTimer);
    deleteGroupConfirmTimer = setTimeout(() => {
      deleteGroupArmed = false;
      deleteGroupBtn.textContent = "Delete";
      deleteGroupBtn.classList.remove("armed");
    }, 3000);
    return;
  }

  deleteGroupArmed = false;
  deleteGroupBtn.textContent = "Delete";
  deleteGroupBtn.classList.remove("armed");
  if (deleteGroupConfirmTimer !== null) clearTimeout(deleteGroupConfirmTimer);

  config.groups.splice(selectedGroupIndex, 1);
  if (selectedGroupIndex >= config.groups.length) {
    selectedGroupIndex = config.groups.length - 1;
  }
  save();
  render();
});

groupNameInput.addEventListener("input", () => {
  if (selectedGroupIndex < 0) return;
  config.groups[selectedGroupIndex].name = groupNameInput.value;
  debouncedSave();
  renderGroupList();
});

// --- Render ---

function render() {
  renderGroupList();
  renderEditor();
}

function renderGroupList() {
  groupListEl.innerHTML = "";
  config.groups.forEach((group, i) => {
    const li = document.createElement("li");
    li.className = "group-list-item" + (i === selectedGroupIndex ? " active" : "");
    li.draggable = true;
    li.dataset.index = String(i);
    li.dataset.source = group.source || "workspace";

    const label = document.createElement("span");
    label.className = "group-label";
    label.textContent = group.name;

    const badge = document.createElement("span");
    const src = group.source || "workspace";
    badge.className = "group-source-badge" + (src === "user" ? " user" : "");
    badge.textContent = src === "user" ? "U" : "W";
    badge.title = src === "user" ? "User-level group" : "Workspace group";

    const count = document.createElement("span");
    count.className = "group-count";
    count.textContent = String(group.terminals.length);

    li.appendChild(label);
    li.appendChild(badge);
    li.appendChild(count);

    li.addEventListener("click", () => {
      selectedGroupIndex = i;
      render();
    });

    // Drag and drop for group reordering (within same source only)
    li.addEventListener("dragstart", (e) => {
      if (e.dataTransfer) {
        e.dataTransfer.setData("text/plain", String(i));
        e.dataTransfer.setData("application/group-source", group.source || "workspace");
        e.dataTransfer.effectAllowed = "move";
      }
    });

    li.addEventListener("dragover", (e) => {
      const dragSource = e.dataTransfer?.types.includes("application/group-source")
        ? undefined // can't read data during dragover, check on drop
        : undefined;
      e.preventDefault();
      li.classList.add("drag-over");
    });

    li.addEventListener("dragleave", () => {
      li.classList.remove("drag-over");
    });

    li.addEventListener("drop", (e) => {
      e.preventDefault();
      li.classList.remove("drag-over");
      const fromIndex = parseInt(e.dataTransfer?.getData("text/plain") ?? "-1");
      const fromSource = e.dataTransfer?.getData("application/group-source") || "workspace";
      const toSource = group.source || "workspace";

      // Only allow reorder within same source
      if (fromIndex >= 0 && fromIndex !== i && fromSource === toSource) {
        const [moved] = config.groups.splice(fromIndex, 1);
        config.groups.splice(i, 0, moved);
        if (selectedGroupIndex === fromIndex) {
          selectedGroupIndex = i;
        } else if (fromIndex < selectedGroupIndex && i >= selectedGroupIndex) {
          selectedGroupIndex--;
        } else if (fromIndex > selectedGroupIndex && i <= selectedGroupIndex) {
          selectedGroupIndex++;
        }
        save();
        render();
      }
    });

    groupListEl.appendChild(li);
  });
}

function renderEditor() {
  if (selectedGroupIndex < 0 || selectedGroupIndex >= config.groups.length) {
    emptyStateEl.style.display = "flex";
    groupEditorEl.style.display = "none";
    return;
  }

  emptyStateEl.style.display = "none";
  groupEditorEl.style.display = "block";

  const group = config.groups[selectedGroupIndex];
  groupNameInput.value = group.name;

  // Render scope controls
  renderScopeControls(group);

  renderTerminals();
}

/** @param {{ name: string, terminals: any[], source?: "user" | "workspace" }} group */
function renderScopeControls(group) {
  let container = document.getElementById("scopeControls");
  if (!container) {
    container = document.createElement("div");
    container.id = "scopeControls";
    container.className = "scope-controls";
    // Insert after the group header
    const header = groupEditorEl.querySelector(".group-header");
    if (header && header.nextSibling) {
      header.parentNode?.insertBefore(container, header.nextSibling);
    } else {
      groupEditorEl.prepend(container);
    }
  }

  const src = group.source || "workspace";
  const targetScope = src === "workspace" ? "user" : "workspace";
  const targetLabel = targetScope === "user" ? "User Settings" : "Workspace";

  container.innerHTML = "";

  const scopeLabel = document.createElement("span");
  scopeLabel.className = "scope-label";
  scopeLabel.textContent = "Scope:";

  const scopeValue = document.createElement("span");
  scopeValue.className = "scope-value" + (src === "user" ? " user" : "");
  scopeValue.textContent = src === "user" ? "User" : "Workspace";

  const moveBtn = document.createElement("button");
  moveBtn.className = "text-btn scope-move-btn";
  moveBtn.textContent = `Move to ${targetLabel}`;
  moveBtn.addEventListener("click", () => {
    group.source = targetScope;
    save();
    render();
  });

  container.appendChild(scopeLabel);
  container.appendChild(scopeValue);
  container.appendChild(moveBtn);
}

function renderTerminals() {
  if (selectedGroupIndex < 0) return;
  const group = config.groups[selectedGroupIndex];
  terminalsListEl.innerHTML = "";

  const targetIndex = scrollToTerminal;
  scrollToTerminal = null;

  group.terminals.forEach((term, ti) => {
    if (ti === targetIndex) {
      expandedTerminals.add(`${selectedGroupIndex}-${ti}`);
    }
    const card = createTerminalCard(term, ti);
    terminalsListEl.appendChild(card);
    if (ti === targetIndex) {
      requestAnimationFrame(() => card.scrollIntoView({ behavior: "smooth", block: "nearest" }));
    }
  });
}

/**
 * @param {any} term
 * @param {number} index
 * @returns {HTMLElement}
 */
function createTerminalCard(term, index) {
  const card = document.createElement("div");
  card.className = "terminal-card";
  card.draggable = true;
  card.dataset.termIndex = String(index);

  // Drag handle + preview + actions header
  const header = document.createElement("div");
  header.className = "terminal-card-header";

  const dragHandle = document.createElement("span");
  dragHandle.className = "terminal-card-drag";
  dragHandle.textContent = "\u2630";
  dragHandle.title = "Drag to reorder";

  const collapseKey = `${selectedGroupIndex}-${index}`;
  const isExpanded = expandedTerminals.has(collapseKey);

  const collapseBtn = document.createElement("span");
  collapseBtn.className = "terminal-card-collapse" + (isExpanded ? "" : " collapsed");
  collapseBtn.textContent = "\u25BE";
  collapseBtn.title = isExpanded ? "Collapse" : "Expand";

  const preview = document.createElement("span");
  preview.className = "terminal-preview";
  updatePreview(preview, term);

  const actions = document.createElement("span");
  actions.className = "terminal-card-actions";

  const duplicateBtn = document.createElement("span");
  duplicateBtn.className = "terminal-card-action duplicate";
  duplicateBtn.textContent = "\u2398";
  duplicateBtn.title = "Duplicate terminal";
  duplicateBtn.addEventListener("click", () => {
    const copy = JSON.parse(JSON.stringify(term));
    copy.name = term.name + " (Copy)";
    config.groups[selectedGroupIndex].terminals.splice(index + 1, 0, copy);
    scrollToTerminal = index + 1;
    save();
    renderTerminals();
  });

  const removeBtn = document.createElement("span");
  removeBtn.className = "terminal-card-action remove";
  removeBtn.textContent = "\u00D7";
  removeBtn.title = "Remove terminal";
  let removeArmed = false;
  /** @type {number|null} */
  let removeTimer = null;
  removeBtn.addEventListener("click", () => {
    if (!removeArmed) {
      removeArmed = true;
      removeBtn.textContent = "?";
      removeBtn.title = "Click again to confirm removal";
      removeBtn.classList.add("armed");
      if (removeTimer !== null) clearTimeout(removeTimer);
      removeTimer = setTimeout(() => {
        removeArmed = false;
        removeBtn.textContent = "\u00D7";
        removeBtn.title = "Remove terminal";
        removeBtn.classList.remove("armed");
      }, 3000);
      return;
    }
    if (removeTimer !== null) clearTimeout(removeTimer);
    expandedTerminals.delete(`${selectedGroupIndex}-${index}`);
    config.groups[selectedGroupIndex].terminals.splice(index, 1);
    save();
    renderTerminals();
  });

  actions.appendChild(duplicateBtn);
  actions.appendChild(removeBtn);

  const cmdSnippet = document.createElement("span");
  cmdSnippet.className = "terminal-card-cmd";
  cmdSnippet.textContent = term.command || "";
  cmdSnippet.title = term.command || "";

  header.appendChild(dragHandle);
  header.appendChild(collapseBtn);
  header.appendChild(preview);
  header.appendChild(cmdSnippet);
  header.appendChild(actions);
  card.appendChild(header);

  // Collapsible body wrapper
  const body = document.createElement("div");
  body.className = "terminal-card-body" + (isExpanded ? "" : " collapsed");

  if (!isExpanded) {
    header.classList.add("collapsed");
  }

  collapseBtn.addEventListener("click", () => {
    const nowCollapsed = body.classList.toggle("collapsed");
    collapseBtn.classList.toggle("collapsed", nowCollapsed);
    header.classList.toggle("collapsed", nowCollapsed);
    collapseBtn.title = nowCollapsed ? "Expand" : "Collapse";
    if (nowCollapsed) {
      expandedTerminals.delete(collapseKey);
    } else {
      expandedTerminals.add(collapseKey);
    }
  });

  // Form grid
  const grid = document.createElement("div");
  grid.className = "form-grid";

  // Name
  grid.appendChild(
    createTextField("Name", term.name, (val) => {
      term.name = val;
      updatePreview(preview, term);
      debouncedSave();
      renderGroupList();
    })
  );

  // Icon
  grid.appendChild(
    createIconPicker(term.icon || "terminal", (val) => {
      term.icon = val === "terminal" ? undefined : val;
      updatePreview(preview, term);
      save();
    })
  );

  // Command
  grid.appendChild(
    createTextField(
      "Command",
      term.command || "",
      (val) => {
        term.command = val || undefined;
        cmdSnippet.textContent = val || "";
        cmdSnippet.title = val || "";
        debouncedSave();
      },
      true, // full width
      true  // monospace
    )
  );

  // Color
  grid.appendChild(createColorPicker(term.color, (val) => {
    term.color = val || undefined;
    updatePreview(preview, term);
    save();
  }));

  // CWD
  grid.appendChild(createCwdField(term.cwd || "", index, (val) => {
    term.cwd = val || undefined;
    debouncedSave();
  }));

  // Focus toggle
  const focusGroup = document.createElement("div");
  focusGroup.className = "form-group";
  const focusToggle = document.createElement("div");
  focusToggle.className = "focus-toggle";
  const focusCheck = document.createElement("input");
  focusCheck.type = "checkbox";
  focusCheck.checked = !!term.focus;
  focusCheck.addEventListener("change", () => {
    if (focusCheck.checked) {
      config.groups[selectedGroupIndex].terminals.forEach((t, i) => {
        if (i !== index) t.focus = undefined;
      });
    }
    term.focus = focusCheck.checked || undefined;
    save();
  });
  const focusLabel = document.createElement("label");
  focusLabel.textContent = "Focus after launch";
  focusToggle.appendChild(focusCheck);
  focusToggle.appendChild(focusLabel);
  focusGroup.appendChild(focusToggle);
  grid.appendChild(focusGroup);

  body.appendChild(grid);

  // Environment variables
  body.appendChild(createEnvEditor(term, index));

  card.appendChild(body);

  // Terminal card drag & drop
  card.addEventListener("dragstart", (e) => {
    if (e.dataTransfer) {
      e.dataTransfer.setData("application/terminal-index", String(index));
      e.dataTransfer.effectAllowed = "move";
    }
  });

  card.addEventListener("dragover", (e) => {
    if (e.dataTransfer?.types.includes("application/terminal-index")) {
      e.preventDefault();
      card.classList.add("drag-over");
    }
  });

  card.addEventListener("dragleave", () => {
    card.classList.remove("drag-over");
  });

  card.addEventListener("drop", (e) => {
    e.preventDefault();
    card.classList.remove("drag-over");
    const fromStr = e.dataTransfer?.getData("application/terminal-index");
    if (fromStr === undefined) return;
    const fromIndex = parseInt(fromStr);
    if (fromIndex >= 0 && fromIndex !== index) {
      const terminals = config.groups[selectedGroupIndex].terminals;
      const [moved] = terminals.splice(fromIndex, 1);
      terminals.splice(index, 0, moved);
      save();
      renderTerminals();
    }
  });

  return card;
}

/**
 * @param {string} label
 * @param {string} value
 * @param {(val: string) => void} onChange
 * @param {boolean} [fullWidth]
 * @param {boolean} [monospace]
 * @returns {HTMLElement}
 */
function createTextField(label, value, onChange, fullWidth, monospace) {
  const group = document.createElement("div");
  group.className = "form-group" + (fullWidth ? " full-width" : "");

  const lbl = document.createElement("label");
  lbl.textContent = label;

  const input = document.createElement("input");
  input.type = "text";
  input.value = value;
  if (monospace) input.className = "monospace";
  input.addEventListener("input", () => onChange(input.value));

  group.appendChild(lbl);
  group.appendChild(input);
  return group;
}

/**
 * @param {string} currentIcon
 * @param {(val: string) => void} onChange
 * @returns {HTMLElement}
 */
function createIconPicker(currentIcon, onChange) {
  const group = document.createElement("div");
  group.className = "form-group";

  const lbl = document.createElement("label");
  lbl.textContent = "Icon";

  const wrapper = document.createElement("div");
  wrapper.className = "icon-picker-wrapper";

  const select = document.createElement("select");
  select.className = "icon-select";
  ICONS.forEach((icon) => {
    const opt = document.createElement("option");
    opt.value = icon;
    opt.textContent = icon;
    if (icon === currentIcon) opt.selected = true;
    select.appendChild(opt);
  });

  const iconPreview = document.createElement("span");
  iconPreview.className = "codicon codicon-" + currentIcon;
  iconPreview.style.marginRight = "6px";
  iconPreview.style.fontSize = "14px";

  select.addEventListener("change", () => {
    iconPreview.className = "codicon codicon-" + select.value;
    onChange(select.value);
  });

  wrapper.appendChild(iconPreview);
  wrapper.appendChild(select);
  group.appendChild(lbl);
  group.appendChild(wrapper);
  return group;
}

/**
 * @param {string|undefined} currentColor
 * @param {(val: string|undefined) => void} onChange
 * @returns {HTMLElement}
 */
function createColorPicker(currentColor, onChange) {
  const group = document.createElement("div");
  group.className = "form-group";

  const lbl = document.createElement("label");
  lbl.textContent = "Color";

  const picker = document.createElement("div");
  picker.className = "color-picker";

  COLORS.forEach((c) => {
    const swatch = document.createElement("div");
    swatch.className = "color-swatch" + (c.name === "none" ? " none" : "");
    if (c.name !== "none") {
      swatch.style.background = c.css;
    }
    if (
      (c.name === "none" && !currentColor) ||
      c.name === currentColor
    ) {
      swatch.classList.add("selected");
    }
    swatch.title = c.name;
    swatch.addEventListener("click", () => {
      picker.querySelectorAll(".color-swatch").forEach((s) => s.classList.remove("selected"));
      swatch.classList.add("selected");
      onChange(c.name === "none" ? undefined : c.name);
    });
    picker.appendChild(swatch);
  });

  group.appendChild(lbl);
  group.appendChild(picker);
  return group;
}

/**
 * @param {string} value
 * @param {number} termIndex
 * @param {(val: string) => void} onChange
 * @returns {HTMLElement}
 */
function createCwdField(value, termIndex, onChange) {
  const group = document.createElement("div");
  group.className = "form-group";

  const lbl = document.createElement("label");
  lbl.textContent = "Working Directory";

  const wrapper = document.createElement("div");
  wrapper.className = "input-with-btn";

  const input = document.createElement("input");
  input.type = "text";
  input.value = value;
  input.className = "monospace";
  input.dataset.folderTarget = `cwd-${selectedGroupIndex}-${termIndex}`;
  input.addEventListener("input", () => onChange(input.value));

  const btn = document.createElement("button");
  btn.className = "text-btn";
  btn.textContent = "Browse";
  btn.addEventListener("click", () => {
    pendingFolderTarget = input.dataset.folderTarget ?? null;
    vscode.postMessage({ type: "pickFolder" });
  });

  wrapper.appendChild(input);
  wrapper.appendChild(btn);
  group.appendChild(lbl);
  group.appendChild(wrapper);
  return group;
}

/**
 * @param {any} term
 * @param {number} termIndex
 * @returns {HTMLElement}
 */
function createEnvEditor(term, termIndex) {
  const container = document.createElement("div");
  container.className = "env-editor";

  const lbl = document.createElement("label");
  lbl.textContent = "Environment Variables";
  lbl.style.fontSize = "11px";
  lbl.style.color = "var(--vscode-descriptionForeground)";
  lbl.style.textTransform = "uppercase";
  lbl.style.letterSpacing = "0.3px";
  lbl.style.display = "block";
  lbl.style.marginBottom = "4px";
  container.appendChild(lbl);

  const rowsContainer = document.createElement("div");
  rowsContainer.className = "env-rows";

  const env = term.env || {};

  function renderEnvRows() {
    rowsContainer.innerHTML = "";
    const entries = Object.entries(env);
    entries.forEach(([key, val]) => {
      const row = document.createElement("div");
      row.className = "env-row";

      const keyInput = document.createElement("input");
      keyInput.type = "text";
      keyInput.value = key;
      keyInput.placeholder = "KEY";

      const valInput = document.createElement("input");
      valInput.type = "text";
      valInput.value = /** @type {string} */ (val);
      valInput.placeholder = "value";

      const removeSpan = document.createElement("span");
      removeSpan.className = "env-remove";
      removeSpan.textContent = "\u00D7";
      removeSpan.addEventListener("click", () => {
        delete env[key];
        term.env = Object.keys(env).length > 0 ? { ...env } : undefined;
        save();
        renderEnvRows();
      });

      keyInput.addEventListener("change", () => {
        const oldVal = env[key];
        delete env[key];
        if (keyInput.value) {
          env[keyInput.value] = oldVal;
        }
        term.env = Object.keys(env).length > 0 ? { ...env } : undefined;
        save();
      });

      valInput.addEventListener("change", () => {
        env[key] = valInput.value;
        term.env = { ...env };
        save();
      });

      row.appendChild(keyInput);
      row.appendChild(valInput);
      row.appendChild(removeSpan);
      rowsContainer.appendChild(row);
    });
  }

  renderEnvRows();
  container.appendChild(rowsContainer);

  const addBtn = document.createElement("button");
  addBtn.className = "text-btn add-env-btn";
  addBtn.textContent = "+ Add Variable";
  addBtn.addEventListener("click", () => {
    env["NEW_VAR"] = "";
    term.env = { ...env };
    save();
    renderEnvRows();
  });
  container.appendChild(addBtn);

  return container;
}

/**
 * @param {HTMLElement} el
 * @param {any} term
 */
function updatePreview(el, term) {
  const colorCss = COLORS.find((c) => c.name === (term.color || "none"))?.css || "";
  el.innerHTML = "";

  const icon = document.createElement("span");
  icon.className = "codicon codicon-" + (term.icon || "terminal");
  if (term.color && colorCss !== "transparent") {
    icon.style.color = colorCss;
  }

  const name = document.createElement("span");
  name.textContent = term.name || "Untitled";

  el.appendChild(icon);
  el.appendChild(name);
}

function generateGroupName() {
  const existing = config.groups.map((g) => g.name);
  let name = "New Group";
  let i = 1;
  while (existing.includes(name)) {
    name = `New Group ${++i}`;
  }
  return name;
}

function save() {
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  lastSaveTime = Date.now();
  vscode.postMessage({ type: "saveConfig", config });
}

function debouncedSave() {
  if (saveTimer !== null) {
    clearTimeout(saveTimer);
  }
  saveTimer = setTimeout(() => {
    saveTimer = null;
    save();
  }, 300);
}
