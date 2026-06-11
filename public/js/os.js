/**
 * SewingOS core: window manager, dock, menu bar, app registry.
 */

const desktop = document.getElementById("desktop");
const windowsEl = document.getElementById("windows");
const dockEl = document.getElementById("dock-inner");
const appnameEl = document.getElementById("mb-appname");
const dropdownEl = document.getElementById("mb-dropdown");

let zCounter = 10;
const apps = new Map();      // id -> app spec
const openWindows = new Map(); // id -> SewWindow

class SewWindow {
  constructor(os, app, opts) {
    this.os = os;
    this.app = app;
    this.maximized = false;
    this.prevRect = null;

    const el = document.createElement("section");
    el.className = "window opening";
    el.style.width = (opts.width ?? 640) + "px";
    el.style.height = (opts.height ?? 420) + "px";
    const x = opts.x ?? Math.max(8, (desktop.clientWidth - (opts.width ?? 640)) / 2);
    const y = opts.y ?? Math.max(8, (desktop.clientHeight - (opts.height ?? 420)) / 2.4);
    el.style.left = x + "px";
    el.style.top = y + "px";

    el.innerHTML = `
      <div class="titlebar">
        <div class="traffic">
          <button class="t-close" title="Close"><span>&#215;</span></button>
          <button class="t-min" title="Minimize"><span>&#8722;</span></button>
          <button class="t-max" title="Zoom"><span>&#43;</span></button>
        </div>
        <div class="win-title"></div>
      </div>
      <div class="win-body"></div>
      <div class="win-resize"></div>`;

    el.querySelector(".win-title").textContent = opts.title ?? app.name;
    this.el = el;
    this.body = el.querySelector(".win-body");

    el.querySelector(".t-close").addEventListener("click", (e) => { e.stopPropagation(); this.close(); });
    el.querySelector(".t-min").addEventListener("click", (e) => { e.stopPropagation(); this.minimize(); });
    el.querySelector(".t-max").addEventListener("click", (e) => { e.stopPropagation(); this.toggleMaximize(); });
    el.addEventListener("pointerdown", () => this.focus());

    this.#drag(el.querySelector(".titlebar"));
    this.#resize(el.querySelector(".win-resize"));

    windowsEl.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove("opening")));
  }

  #drag(handle) {
    handle.addEventListener("pointerdown", (e) => {
      if (e.target.closest(".traffic")) return;
      if (this.maximized) return;
      e.preventDefault();
      this.focus();
      const startX = e.clientX, startY = e.clientY;
      const ox = this.el.offsetLeft, oy = this.el.offsetTop;
      const move = (ev) => {
        this.el.style.left = Math.round(ox + ev.clientX - startX) + "px";
        this.el.style.top = Math.max(0, Math.round(oy + ev.clientY - startY)) + "px";
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    });
    handle.addEventListener("dblclick", (e) => {
      if (!e.target.closest(".traffic")) this.toggleMaximize();
    });
  }

  #resize(handle) {
    handle.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      this.focus();
      const startX = e.clientX, startY = e.clientY;
      const ow = this.el.offsetWidth, oh = this.el.offsetHeight;
      const move = (ev) => {
        this.el.style.width = Math.max(320, ow + ev.clientX - startX) + "px";
        this.el.style.height = Math.max(200, oh + ev.clientY - startY) + "px";
        this.app.onResize?.(this);
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    });
  }

  focus() {
    for (const w of openWindows.values()) w.el.classList.remove("focused");
    this.el.classList.add("focused");
    this.el.style.zIndex = ++zCounter;
    appnameEl.textContent = this.app.name;
    this.el.classList.remove("minimized");
  }

  minimize() { this.el.classList.add("minimized"); }

  toggleMaximize() {
    if (this.maximized) {
      const r = this.prevRect;
      Object.assign(this.el.style, { left: r.left, top: r.top, width: r.width, height: r.height });
      this.maximized = false;
    } else {
      const s = this.el.style;
      this.prevRect = { left: s.left, top: s.top, width: s.width, height: s.height };
      Object.assign(s, { left: "0px", top: "0px", width: desktop.clientWidth + "px", height: desktop.clientHeight + "px" });
      this.maximized = true;
    }
    this.app.onResize?.(this);
  }

  close() {
    this.app.onClose?.(this);
    this.el.remove();
    openWindows.delete(this.app.id);
    dockEl.querySelector(`[data-app="${this.app.id}"]`)?.classList.remove("running");
    const remaining = [...openWindows.values()];
    if (remaining.length) remaining[remaining.length - 1].focus();
    else appnameEl.textContent = "Finder";
  }
}

export const OS = {
  registerApp(spec) {
    apps.set(spec.id, spec);
    if (spec.dock === false) return;
    const btn = document.createElement("button");
    btn.className = "dock-item";
    btn.dataset.app = spec.id;
    btn.innerHTML = `${spec.icon}<span class="tip">${spec.name}</span>`;
    btn.addEventListener("click", () => OS.launch(spec.id, btn));
    dockEl.appendChild(btn);
  },

  addDockSeparator() {
    const sep = document.createElement("div");
    sep.className = "dock-sep";
    dockEl.appendChild(sep);
  },

  bounceIcon(source) {
    const target = source?.querySelector?.(".app-ic") ?? source;
    if (!target) return;
    target.classList.remove("icon-bounce");
    void target.offsetWidth;
    target.classList.add("icon-bounce");
    target.addEventListener("animationend", () => target.classList.remove("icon-bounce"), { once: true });
    setTimeout(() => target.classList.remove("icon-bounce"), 700);
  },

  launch(id, source) {
    const app = apps.get(id);
    if (!app) return;
    OS.bounceIcon(source ?? dockEl.querySelector(`[data-app="${id}"]`));
    const existing = openWindows.get(id);
    if (existing) { existing.focus(); return existing; }
    const opts = app.open();
    const win = new SewWindow(OS, app, opts);
    openWindows.set(id, win);
    dockEl.querySelector(`[data-app="${id}"]`)?.classList.add("running");
    win.focus();
    app.onOpen?.(win);
    return win;
  },

  focusedApp() {
    let top = null;
    for (const w of openWindows.values()) {
      if (w.el.classList.contains("focused")) top = w;
    }
    return top;
  },

  appIds() { return apps.keys(); },
  hasApp(id) { return apps.has(id); },
  appList() { return [...apps.values()]; },
};

/* ---------- dock magnification ---------- */

dockEl.addEventListener("mousemove", (e) => {
  for (const item of dockEl.querySelectorAll(".dock-item")) {
    const r = item.getBoundingClientRect();
    const d = Math.abs(e.clientX - (r.left + r.width / 2));
    const s = 1 + 0.3 * Math.exp(-(d * d) / (2 * 70 * 70)); // restrained magnify
    item.style.transition = "transform 60ms linear";
    item.style.transform = `translateY(${(-(s - 1) * 22).toFixed(1)}px) scale(${s.toFixed(3)})`;
  }
});
dockEl.addEventListener("mouseleave", () => {
  for (const item of dockEl.querySelectorAll(".dock-item")) {
    item.style.transition = "transform 200ms cubic-bezier(0.32, 0.72, 0, 1)";
    item.style.transform = "";
  }
});

/* ---------- Spotlight ---------- */

const spot = document.createElement("div");
spot.id = "spotlight";
spot.hidden = true;
spot.innerHTML = `
  <div class="spot-box">
    <div class="spot-row"><span class="spot-glass">&#128269;</span>
      <input placeholder="Search or Ask…" spellcheck="false" /></div>
    <div class="spot-results"></div>
  </div>`;
document.body.appendChild(spot);

const spotInput = spot.querySelector("input");
const spotResults = spot.querySelector(".spot-results");
let spotSel = 0;

function spotRender() {
  const q = spotInput.value.trim().toLowerCase();
  const hits = [...apps.values()].filter((a) => !q || a.name.toLowerCase().includes(q));
  spotSel = Math.min(spotSel, Math.max(0, hits.length - 1));
  spotResults.innerHTML = hits
    .map((a, i) => `<button class="spot-hit ${i === spotSel ? "sel" : ""}" data-app="${a.id}">
        <span>${a.icon}</span>${a.name}<kbd>${i === spotSel ? "↩" : ""}</kbd></button>`)
    .join("");
  spotResults.querySelectorAll(".spot-hit").forEach((b) =>
    b.addEventListener("click", () => { OS.launch(b.dataset.app, b); setTimeout(hideSpotlight, 220); }),
  );
}

function showSpotlight() {
  spot.hidden = false;
  spotInput.value = "";
  spotSel = 0;
  spotRender();
  spotInput.focus();
}
function hideSpotlight() { spot.hidden = true; }

spotInput.addEventListener("input", () => { spotSel = 0; spotRender(); });
spotInput.addEventListener("keydown", (e) => {
  const hits = spotResults.querySelectorAll(".spot-hit");
  if (e.key === "Escape") hideSpotlight();
  else if (e.key === "ArrowDown") { spotSel = Math.min(spotSel + 1, hits.length - 1); spotRender(); e.preventDefault(); }
  else if (e.key === "ArrowUp") { spotSel = Math.max(spotSel - 1, 0); spotRender(); e.preventDefault(); }
  else if (e.key === "Enter" && hits[spotSel]) {
    OS.launch(hits[spotSel].dataset.app, hits[spotSel]);
    setTimeout(hideSpotlight, 220);
  }
});
spot.addEventListener("click", (e) => { if (e.target === spot) hideSpotlight(); });

window.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.code === "Space") {
    e.preventDefault();
    spot.hidden ? showSpotlight() : hideSpotlight();
  }
});

document.getElementById("mb-spot")?.addEventListener("click", (e) => {
  e.stopPropagation();
  showSpotlight();
});

/* ---------- battery (real where the API exists) ---------- */

async function initBattery() {
  const fill = document.getElementById("mb-batt-fill");
  const label = document.getElementById("mb-batt-label");
  if (!fill) return;
  const render = (level, charging) => {
    fill.style.width = `${Math.round(level * 100) * 0.085}px`;
    fill.style.background = charging ? "#34c759" : level < 0.2 ? "#ff453a" : "#f2f2f5";
    if (label) label.textContent = `${Math.round(level * 100)}%`;
  };
  try {
    const b = await navigator.getBattery();
    render(b.level, b.charging);
    b.addEventListener("levelchange", () => render(b.level, b.charging));
    b.addEventListener("chargingchange", () => render(b.level, b.charging));
  } catch {
    render(1, false);
  }
}
initBattery();

/* ---------- menu bar ---------- */

const MENUS = {
  system: [
    ["About SewingOS", () => OS.launch("about")],
    ["—"],
    ["System Settings…", () => OS.launch("settings")],
    ["Bloomberg Portal", () => OS.launch("terminal")],
    ["IBKR Desktop", () => OS.launch("ibkr")],
    ["—"],
    ["Restart…", () => location.reload()],
  ],
  file: [
    ["New Terminal Window", () => OS.launch("terminal")],
    ["Open IBKR Desktop", () => OS.launch("ibkr")],
    ["New Note", () => OS.launch("notes")],
    ["—"],
    ["Close Window", () => OS.focusedApp()?.close()],
  ],
  view: [
    ["Toggle Full Screen", () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen?.();
    }],
  ],
  window: [
    ["Minimize", () => OS.focusedApp()?.minimize()],
    ["Zoom", () => OS.focusedApp()?.toggleMaximize()],
  ],
  help: [
    ["SewingOS Help", () => OS.launch("about")],
    ["sewing.top on GitHub", () => window.open("https://github.com", "_blank")],
  ],
};

let openMenu = null;

function showMenu(name, anchor) {
  dropdownEl.innerHTML = "";
  for (const [label, action] of MENUS[name]) {
    if (label === "—") {
      dropdownEl.appendChild(document.createElement("hr"));
      continue;
    }
    const b = document.createElement("button");
    b.textContent = label;
    b.addEventListener("click", () => { hideMenu(); action(); });
    dropdownEl.appendChild(b);
  }
  const r = anchor.getBoundingClientRect();
  dropdownEl.style.left = Math.min(r.left, window.innerWidth - 230) + "px";
  dropdownEl.hidden = false;
  openMenu = name;
}

function hideMenu() {
  dropdownEl.hidden = true;
  openMenu = null;
}

for (const btn of document.querySelectorAll("[data-menu]")) {
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const name = btn.dataset.menu;
    openMenu === name ? hideMenu() : showMenu(name, btn);
  });
}
appnameEl.addEventListener("click", (e) => e.stopPropagation());
document.addEventListener("click", hideMenu);

/* ---------- clock & edge status ---------- */

const clockEl = document.getElementById("mb-clock");
function tickClock() {
  const d = new Date();
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  clockEl.textContent = `${days[d.getDay()]} ${months[d.getMonth()]} ${d.getDate()}  ${hh}:${mm}`;
}
tickClock();
setInterval(tickClock, 5_000);

export async function pingEdge() {
  const el = document.getElementById("mb-net");
  try {
    const res = await fetch("/api/status");
    const data = await res.json();
    el.classList.remove("off");
    el.title = `Edge: ${data.colo} (${data.country})`;
    return data;
  } catch {
    el.classList.add("off");
    el.title = "Edge unreachable";
    return null;
  }
}
