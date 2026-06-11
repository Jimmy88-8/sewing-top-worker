/**
 * SewingOS bootstrap: wallpaper, app registry, boot sequence.
 */
import { OS, pingEdge } from "/js/os.js";
import { initWallpaper } from "/js/wallpapers.js";
import { createMarketTerminal } from "/js/apps/market-terminal.js";
import { createSettings } from "/js/apps/settings.js";
import { createCalculator } from "/js/apps/calculator.js";
import { createCalendar } from "/js/apps/calendar.js";
import { createWeather } from "/js/apps/weather.js";
import { createCLI } from "/js/apps/cli.js";
import { createFinder } from "/js/apps/finder.js";
import { createNotes } from "/js/apps/notes.js";
import { createIBKRDesktop } from "/js/apps/ibkr.js";
import { registerAdditionalApps } from "/js/apps/additional-apps.js";
import { ICONS } from "/js/icons.js";

initWallpaper();

/* ---------- Finder ---------- */

OS.registerApp({
  id: "finder",
  name: "Finder",
  icon: ICONS.finder,
  finder: false,
  open() { return { title: "Finder", width: 640, height: 400, x: 90, y: 70, minWidth: 460, minHeight: 300 }; },
  onOpen(win) { win.body.appendChild(createFinder(OS)); },
});

/* ---------- Bloomberg Portal ---------- */

let term = null;

OS.registerApp({
  id: "terminal",
  name: "Bloomberg",
  icon: ICONS.market,
  open() {
    term = createMarketTerminal();
    const w = Math.min(1240, window.innerWidth - 60);
    const h = Math.min(780, window.innerHeight - 120);
    return { title: "Bloomberg Professional — SEWING<GO>", width: w, height: h, x: 30, y: 24, minWidth: 700, minHeight: 440 };
  },
  onOpen(win) {
    win.body.appendChild(term.root);
    term.start();
  },
  onResize() { term?.redraw(); },
  onClose() { term?.destroy(); term = null; },
});

/* ---------- IBKR Desktop ---------- */

let ibkr = null;

OS.registerApp({
  id: "ibkr",
  name: "IBKR Desktop",
  icon: ICONS.ibkr,
  open() {
    ibkr = createIBKRDesktop();
    const w = Math.min(1882, window.innerWidth - 32);
    const h = Math.min(1230, window.innerHeight - 92);
    return { title: "IBKR Desktop", width: w, height: h, x: 16, y: 12, minWidth: 720, minHeight: 540 };
  },
  onOpen(win) {
    win.body.appendChild(ibkr.root);
    ibkr.start();
  },
  onResize() { ibkr?.redraw(); },
  onClose() { ibkr?.destroy(); ibkr = null; },
});

/* ---------- Notes ---------- */

OS.registerApp({
  id: "notes",
  name: "Notes",
  icon: ICONS.notes,
  open() { return { title: "Notes", width: 620, height: 440, x: 130, y: 90, minWidth: 460, minHeight: 300 }; },
  onOpen(win) { win.body.appendChild(createNotes()); },
});

/* ---------- Calculator ---------- */

OS.registerApp({
  id: "calculator",
  name: "Calculator",
  icon: ICONS.calculator,
  open() { return { title: "Calculator", width: 248, height: 380, x: 640, y: 120, minWidth: 232, minHeight: 340 }; },
  onOpen(win) {
    win.body.appendChild(createCalculator());
  },
});

/* ---------- Calendar ---------- */

OS.registerApp({
  id: "calendar",
  name: "Calendar",
  icon: ICONS.calendar,
  open() { return { title: "Calendar", width: 420, height: 440, x: 480, y: 110, minWidth: 340, minHeight: 380 }; },
  onOpen(win) { win.body.appendChild(createCalendar()); },
});

/* ---------- Weather ---------- */

OS.registerApp({
  id: "weather",
  name: "Weather",
  icon: ICONS.weather,
  open() { return { title: "Weather", width: 420, height: 480, x: 560, y: 80, minWidth: 320, minHeight: 380 }; },
  onOpen(win) { win.body.appendChild(createWeather()); },
});

/* ---------- Terminal (CLI) ---------- */

OS.registerApp({
  id: "cli",
  name: "Terminal",
  icon: ICONS.cli,
  open() { return { title: "jeremmy — -zsh — 80×24", width: 560, height: 360, x: 220, y: 140, minWidth: 420, minHeight: 240 }; },
  onOpen(win) { win.body.appendChild(createCLI(OS)); },
});

/* ---------- System Settings ---------- */

OS.registerApp({
  id: "settings",
  name: "System Settings",
  icon: ICONS.settings,
  open() { return { title: "System Settings", width: 560, height: 500, x: 300, y: 70, minWidth: 460, minHeight: 380 }; },
  onOpen(win) { win.body.appendChild(createSettings()); },
});

/* ---------- About ---------- */

OS.registerApp({
  id: "about",
  name: "About SewingOS",
  icon: ICONS.about,
  finder: false,
  open() { return { title: "", width: 300, height: 525, minWidth: 280, minHeight: 460 }; },
  async onOpen(win) {
    const div = document.createElement("div");
    div.className = "about";
    div.innerHTML = `
      <div class="about-icon">${ICONS.finder}</div>
      <h1>SewingOS</h1>
      <div class="about-version">Version 27.0 (Golden Gate)</div>
      <div class="about-rows">
        <div><span>Chip</span><b>Cloudflare Edge</b></div>
        <div><span>Memory</span><b>Workers Isolate</b></div>
        <div><span>Startup Disk</span><b>Static Assets</b></div>
        <div><span>Serial Number</span><b>SEW-27-0612</b></div>
        <div><span>Edge Location</span><b class="about-colo">—</b></div>
      </div>
      <div class="about-actions">
        <button class="about-btn" data-act="info">More Info…</button>
        <button class="about-btn" data-act="report">Service Report…</button>
      </div>
      <div class="about-legal">™ and © 2026 SewingOS at sewing.top.<br>All data delayed or simulated. Not investment advice.</div>`;
    div.querySelector('[data-act="info"]').addEventListener("click", () => OS.launch("settings"));
    div.querySelector('[data-act="report"]').addEventListener("click", () => OS.launch("cli"));
    win.body.appendChild(div);
    const colo = await pingEdge();
    const el = div.querySelector(".about-colo");
    if (el) el.textContent = colo ? `${colo.colo} · ${colo.country}` : "Offline";
  },
});

registerAdditionalApps(OS);

OS.addDockSeparator();

OS.registerApp({
  id: "trash",
  name: "Trash",
  icon: ICONS.trash,
  finder: false,
  open() { return { title: "Trash", width: 360, height: 240 }; },
  onOpen(win) {
    const div = document.createElement("div");
    div.className = "app-pad";
    div.innerHTML = `
      <h1>Trash</h1>
      <p>3 items are waiting to be permanently deleted.</p>
      <div class="trash-items">
        <span>old-icon-export.png</span>
        <span>draft-notes.txt</span>
        <span>unused-assets</span>
      </div>`;
    win.body.appendChild(div);
  },
});

/* ---------- boot ---------- */

const boot = document.getElementById("boot");
pingEdge();
setInterval(pingEdge, 60_000);

setTimeout(() => {
  boot.classList.add("done");
  setTimeout(() => boot.remove(), 700);
  OS.launch("terminal");
}, 1_600);
