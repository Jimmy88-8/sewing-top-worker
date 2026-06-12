/**
 * Calculator — Basic, Scientific, and 64-bit Programmer modes.
 */
import { CalculatorEngine } from "./calculator-engine.js";
import { ScientificCalculatorEngine } from "./scientific-calculator-engine.js";
import { ProgrammerCalculatorEngine } from "./programmer-calculator-engine.js";

const HISTORY_KEY = "sewingos.calculator.history.v1";
const MODES = {
  basic: { label: "Basic", shortcut: "⌘1" },
  scientific: { label: "Scientific", shortcut: "⌘2" },
  programmer: { label: "Programmer", shortcut: "⌘3" },
};

const BASIC_LAYOUT = [
  ["Backspace", "⌫", "fn strong", "Delete last digit"],
  ["AC", "AC", "fn strong", "All clear"],
  ["%", "%", "fn strong", "Percent"],
  ["÷", "÷", "op", "Divide"],
  ["7", "7", "num"], ["8", "8", "num"], ["9", "9", "num"], ["×", "×", "op", "Multiply"],
  ["4", "4", "num"], ["5", "5", "num"], ["6", "6", "num"], ["−", "−", "op", "Subtract"],
  ["1", "1", "num"], ["2", "2", "num"], ["3", "3", "num"], ["+", "+", "op", "Add"],
  ["±", "±", "num sign", "Toggle positive or negative"],
  ["0", "0", "num"], [".", ".", "num", "Decimal point"], ["=", "=", "op", "Equals"],
];

const PROGRAMMER_LAYOUT = [
  ["Backspace", "⌫", "fn"], ["(", "(", "fn"], [")", ")", "fn"],
  ["D", "D", "num hex"], ["E", "E", "num hex"], ["F", "F", "num hex"], ["AC", "AC", "fn strong"],
  ["AND", "AND", "logic"], ["OR", "OR", "logic"], ["XOR", "XOR", "logic"],
  ["A", "A", "num hex"], ["B", "B", "num hex"], ["C", "C", "num hex"], ["÷", "÷", "op"],
  ["NOR", "NOR", "logic"], ["<<", "<<", "logic"], [">>", ">>", "logic"],
  ["7", "7", "num"], ["8", "8", "num"], ["9", "9", "num"], ["×", "×", "op"],
  ["NOT", "NOT", "logic"], ["<<", "X≪Y", "logic", "Shift X left by Y"], [">>", "X≫Y", "logic", "Shift X right by Y"],
  ["4", "4", "num"], ["5", "5", "num"], ["6", "6", "num"], ["−", "−", "op"],
  ["NEG", "NEG", "logic"], ["RoL", "RoL", "logic"], ["RoR", "RoR", "logic"],
  ["1", "1", "num"], ["2", "2", "num"], ["3", "3", "num"], ["+", "+", "op"],
  ["mod", "mod", "logic"], ["flip8", "flip₈", "logic"], ["flip16", "flip₁₆", "logic"],
  ["FF", "FF", "num hex-byte"], ["0", "0", "num"], ["00", "00", "num double-zero"], ["enter", "enter", "op enter"],
];

function readHistory() {
  try {
    const value = JSON.parse(localStorage.getItem(HISTORY_KEY));
    return Array.isArray(value) ? value.slice(0, 60) : [];
  } catch {
    return [];
  }
}

function saveHistory(history) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 60)));
  } catch {
    // History remains available for the current session in private browsing.
  }
}

function buttonMarkup([key, label, cls = "", aria = label]) {
  return `<button class="calc-btn ${cls}" data-k="${key}" aria-label="${aria}" title="${aria}">${label}</button>`;
}

function scientificLayout(second, angle) {
  return [
    ["(", "(", "fn"], [")", ")", "fn"], ["mc", "mc", "fn"], ["m+", "m+", "fn"], ["m−", "m−", "fn"],
    ["mr", "mr", "fn"], ["Backspace", "⌫", "fn strong"], ["AC", "AC", "fn strong"], ["%", "%", "fn strong"], ["÷", "÷", "op"],
    ["2nd", "2ⁿᵈ", `fn second ${second ? "selected" : ""}`], ["x²", "x²", "fn"], ["x³", "x³", "fn"],
    ["^", "xʸ", "fn"], [second ? "reversePower" : "eˣ", second ? "yˣ" : "eˣ", "fn"],
    [second ? "2ˣ" : "10ˣ", second ? "2ˣ" : "10ˣ", "fn"], ["7", "7", "num"], ["8", "8", "num"], ["9", "9", "num"], ["×", "×", "op"],
    ["1/x", "¹⁄ₓ", "fn"], ["²√x", "²√x", "fn"], ["³√x", "³√x", "fn"], ["root", "ʸ√x", "fn"],
    [second ? "logy" : "ln", second ? "logᵧ" : "ln", "fn"],
    [second ? "log₂" : "log₁₀", second ? "log₂" : "log₁₀", "fn"],
    ["4", "4", "num"], ["5", "5", "num"], ["6", "6", "num"], ["−", "−", "op"],
    ["x!", "x!", "fn"], [second ? "sin⁻¹" : "sin", second ? "sin⁻¹" : "sin", "fn"],
    [second ? "cos⁻¹" : "cos", second ? "cos⁻¹" : "cos", "fn"],
    [second ? "tan⁻¹" : "tan", second ? "tan⁻¹" : "tan", "fn"],
    ["e", "e", "fn"], ["EE", "EE", "fn"], ["1", "1", "num"], ["2", "2", "num"], ["3", "3", "num"], ["+", "+", "op"],
    ["Rand", "Rand", "fn"], [second ? "sinh⁻¹" : "sinh", second ? "sinh⁻¹" : "sinh", "fn"],
    [second ? "cosh⁻¹" : "cosh", second ? "cosh⁻¹" : "cosh", "fn"],
    [second ? "tanh⁻¹" : "tanh", second ? "tanh⁻¹" : "tanh", "fn"],
    ["π", "π", "fn"], ["Angle", angle === "deg" ? "Rad" : "Deg", "fn"],
    ["±", "±", "num sign"], ["0", "0", "num"], [".", ".", "num"], ["=", "=", "op"],
  ];
}

export function createCalculator() {
  const root = document.createElement("div");
  root.className = "calc mode-basic";
  root.tabIndex = 0;
  root.setAttribute("role", "application");
  root.setAttribute("aria-label", "Calculator");

  root.innerHTML = `
    <div class="calc-toolbar">
      <button class="calc-tool calc-mode-button" aria-label="Calculator mode" aria-expanded="false">
        <span class="calc-mode-name">Basic</span><span class="calc-chevron">⌄</span>
      </button>
      <button class="calc-tool calc-history-button" aria-label="Show history" aria-pressed="false">History</button>
      <div class="calc-mode-menu" hidden>
        ${Object.entries(MODES).map(([id, item]) => `
          <button data-mode="${id}"><span>${item.label}</span><kbd>${item.shortcut}</kbd></button>
        `).join("")}
      </div>
    </div>
    <div class="calc-workspace">
      <aside class="calc-history" hidden>
        <div class="calc-history-head"><b>History</b><button class="calc-clear-history">Clear</button></div>
        <div class="calc-history-list"></div>
      </aside>
      <main class="calc-panel">
        <div class="calc-display" aria-live="polite" aria-atomic="true">
          <div class="calc-character"></div>
          <div class="calc-expression"></div>
          <div class="calc-value">0</div>
        </div>
        <div class="calc-programmer-tools"></div>
        <div class="calc-binary"></div>
        <div class="calc-grid"></div>
      </main>
    </div>`;

  const engines = {
    basic: new CalculatorEngine(),
    scientific: new ScientificCalculatorEngine(),
    programmer: new ProgrammerCalculatorEngine(),
  };
  let mode = "basic";
  let history = readHistory();
  let historyOpen = false;

  const modeButton = root.querySelector(".calc-mode-button");
  const modeName = root.querySelector(".calc-mode-name");
  const modeMenu = root.querySelector(".calc-mode-menu");
  const historyButton = root.querySelector(".calc-history-button");
  const historyPanel = root.querySelector(".calc-history");
  const historyList = root.querySelector(".calc-history-list");
  const expression = root.querySelector(".calc-expression");
  const value = root.querySelector(".calc-value");
  const character = root.querySelector(".calc-character");
  const programmerTools = root.querySelector(".calc-programmer-tools");
  const binary = root.querySelector(".calc-binary");
  const grid = root.querySelector(".calc-grid");

  function currentEngine() {
    return engines[mode];
  }

  function resizeWindow() {
    const win = root.closest(".window");
    const desktop = document.getElementById("desktop");
    if (!win || !desktop) return;
    const sizes = mode === "scientific"
      ? { width: 1000, height: 580 }
      : mode === "programmer"
        ? { width: 960, height: 580 }
        : { width: historyOpen ? 680 : 292, height: historyOpen ? 580 : 500 };
    const width = Math.min(sizes.width, desktop.clientWidth - 16);
    const height = Math.min(sizes.height, desktop.clientHeight - 16);
    win.style.width = `${width}px`;
    win.style.height = `${height}px`;
    if (mode !== "basic" || historyOpen) {
      win.style.left = `${Math.max(8, Math.round((desktop.clientWidth - width) / 2))}px`;
      win.style.top = "8px";
    }
  }

  function addHistory(state) {
    if (mode === "programmer" || state.error || !state.expression.endsWith("=")) return;
    const record = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      mode,
      expression: state.expression,
      result: state.display,
      value: state.value,
      timestamp: Date.now(),
    };
    history.unshift(record);
    saveHistory(history);
    renderHistory();
  }

  function renderHistory() {
    if (!history.length) {
      historyList.innerHTML = `<div class="calc-history-empty">No calculations yet</div>`;
      return;
    }
    const today = new Date().toDateString();
    let currentGroup = "";
    historyList.innerHTML = history.map((item) => {
      const group = new Date(item.timestamp).toDateString() === today ? "Today" : "Previous";
      const heading = group !== currentGroup ? `<h3>${group}</h3>` : "";
      currentGroup = group;
      return `${heading}<button class="calc-history-item" data-history-id="${item.id}">
        <span>${item.expression.replace(/\s=$/, "")}</span><strong>${item.result}</strong>
      </button>`;
    }).join("");
  }

  function renderProgrammerTools(state) {
    if (mode !== "programmer") {
      programmerTools.innerHTML = "";
      binary.innerHTML = "";
      return;
    }
    programmerTools.innerHTML = `
      <div class="calc-segmented">
        <button data-k="ASCII" class="${state.characterMode === "ASCII" ? "active" : ""}">ASCII</button>
        <button data-k="Unicode" class="${state.characterMode === "Unicode" ? "active" : ""}">Unicode</button>
      </div>
      <button class="calc-binary-toggle" data-k="Binary">${state.showBinary ? "Hide Binary" : "Show Binary"}</button>
      <div class="calc-segmented calc-base-switch">
        ${[8, 10, 16].map((base) => `<button data-k="base${base}" class="${state.base === base ? "active" : ""}">${base}</button>`).join("")}
      </div>`;
    binary.hidden = !state.showBinary;
    binary.innerHTML = state.showBinary
      ? [...state.bits].map((bit, offset) => {
          const index = 63 - offset;
          return `<button data-bit="${index}" class="${bit === "1" ? "on" : ""}">
            <span>${bit}</span>${index % 16 === 15 ? `<small>${index}</small>` : ""}
          </button>`;
        }).join("")
      : "";
    for (const button of programmerTools.querySelectorAll("[data-k]")) {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        press(button.dataset.k);
        root.focus({ preventScroll: true });
      });
    }
    for (const button of binary.querySelectorAll("[data-bit]")) {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        render(engines.programmer.toggleBit(Number(button.dataset.bit)));
        root.focus({ preventScroll: true });
      });
    }
  }

  function renderGrid(state) {
    const layout = mode === "basic"
      ? BASIC_LAYOUT
      : mode === "scientific"
        ? scientificLayout(state.second, state.angle)
        : PROGRAMMER_LAYOUT;
    grid.innerHTML = layout.map(buttonMarkup).join("");
    for (const button of grid.querySelectorAll(".calc-btn")) {
      button.classList.toggle("selected", button.dataset.k === state.operator);
      if (mode === "programmer" && button.classList.contains("hex")) {
        button.disabled = parseInt(button.dataset.k, 16) >= state.base;
      }
      if (mode === "programmer" && button.classList.contains("hex-byte")) {
        button.disabled = state.base !== 16;
      }
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        if (button.dataset.k === "FF") {
          press("F");
          press("F");
        } else if (button.dataset.k === "00") {
          press("0");
          press("0");
        } else {
          press(button.dataset.k);
        }
        root.focus({ preventScroll: true });
      });
    }
  }

  function render(state = currentEngine().snapshot(), rebuildGrid = true) {
    expression.textContent = state.expression;
    value.textContent = state.display;
    character.textContent = state.character ?? "";
    value.classList.toggle("error", state.error);
    value.classList.toggle("compact", state.display.length > (mode === "programmer" ? 18 : 9));
    value.classList.toggle("tiny", state.display.length > (mode === "programmer" ? 24 : 14));
    root.className = `calc mode-${mode}${historyOpen ? " history-open" : ""}`;
    modeName.textContent = MODES[mode].label;
    historyButton.hidden = mode === "programmer";
    if (mode === "programmer" && historyOpen) toggleHistory(false);
    renderProgrammerTools(state);
    if (rebuildGrid) {
      renderGrid(state);
    } else {
      for (const button of grid.querySelectorAll(".calc-btn")) {
        button.classList.toggle("selected", button.dataset.k === state.operator);
      }
    }
  }

  function press(key) {
    const state = currentEngine().press(key);
    if ((key === "=" || key === "enter") && mode !== "programmer") addHistory(state);
    const rebuild = mode === "scientific" && (key === "2nd" || key === "Angle")
      || mode === "programmer" && /^(base|ASCII|Unicode|Binary)/.test(key);
    render(state, rebuild);
  }

  function setMode(nextMode) {
    if (!MODES[nextMode] || nextMode === mode) {
      modeMenu.hidden = true;
      modeButton.setAttribute("aria-expanded", "false");
      return;
    }
    mode = nextMode;
    modeMenu.hidden = true;
    modeButton.setAttribute("aria-expanded", "false");
    render();
    resizeWindow();
    root.focus({ preventScroll: true });
  }

  function toggleHistory(force) {
    historyOpen = typeof force === "boolean" ? force : !historyOpen;
    historyPanel.hidden = !historyOpen;
    historyButton.setAttribute("aria-pressed", String(historyOpen));
    historyButton.textContent = historyOpen ? "Hide History" : "History";
    renderHistory();
    render();
    resizeWindow();
  }

  modeButton.addEventListener("click", (event) => {
    event.stopPropagation();
    modeMenu.hidden = !modeMenu.hidden;
    modeButton.setAttribute("aria-expanded", String(!modeMenu.hidden));
  });

  modeMenu.addEventListener("click", (event) => {
    const button = event.target.closest("[data-mode]");
    if (button) setMode(button.dataset.mode);
  });

  historyButton.addEventListener("click", () => toggleHistory());
  root.querySelector(".calc-clear-history").addEventListener("click", () => {
    history = [];
    saveHistory(history);
    renderHistory();
  });

  historyList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-history-id]");
    const item = history.find((entry) => entry.id === button?.dataset.historyId);
    if (!item) return;
    setMode(item.mode);
    render(currentEngine().loadValue(item.value));
  });

  root.addEventListener("click", (event) => {
    if (!event.target.closest(".calc-mode-button") && !event.target.closest(".calc-mode-menu")) {
      modeMenu.hidden = true;
      modeButton.setAttribute("aria-expanded", "false");
    }
  });

  root.addEventListener("keydown", (event) => {
    if (event.metaKey && !event.ctrlKey && ["1", "2", "3"].includes(event.key)) {
      event.preventDefault();
      setMode(["basic", "scientific", "programmer"][Number(event.key) - 1]);
      return;
    }
    if (event.metaKey && event.ctrlKey && event.key.toLowerCase() === "s" && mode !== "programmer") {
      event.preventDefault();
      toggleHistory();
      return;
    }
    if (event.altKey && !event.metaKey && !event.ctrlKey) {
      if (mode === "scientific" && event.key.toLowerCase() === "v") {
        event.preventDefault();
        press("²√x");
      } else if (event.key === "-") {
        event.preventDefault();
        press("±");
      }
      return;
    }
    if (event.metaKey || event.ctrlKey || event.altKey) return;

    const common = {
      "/": "÷", "*": "×", "-": "−", "+": "+", Enter: mode === "programmer" ? "enter" : "=",
      "=": mode === "programmer" ? "enter" : "=", Escape: "AC", Delete: "Backspace",
      Backspace: "Backspace", "%": "%", ".": ".", ",": ".",
    };
    let key = common[event.key];
    if (/^\d$/.test(event.key)) key = event.key;
    if (mode === "scientific") {
      if (event.key.toLowerCase() === "p") key = "π";
      else if (event.key === "e") key = "ln";
      else if (event.key === "E") key = "EE";
      else if (event.key === "^") key = "^";
      else if (event.key === "!") key = "x!";
      else if (event.key === "(" || event.key === ")") key = event.key;
      else if (event.key.toLowerCase() === "c") key = "AC";
    }
    if (mode === "programmer") {
      const upper = event.key.toUpperCase();
      if (/^[A-F]$/.test(upper)) key = upper;
      else if (event.key === "&") key = "AND";
      else if (event.key === "|") key = "OR";
      else if (event.key === "~") key = "NOT";
      else if (event.key === "<") key = "<<";
      else if (event.key === ">") key = ">>";
      else if (event.key.toLowerCase() === "r") {
        const bases = [8, 10, 16];
        const next = bases[(bases.indexOf(engines.programmer.base) + 1) % bases.length];
        key = `base${next}`;
      }
    }
    if (key) {
      event.preventDefault();
      press(key);
    }
  });

  renderHistory();
  render();
  setTimeout(() => root.focus(), 50);
  return root;
}
