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
import { registerAdditionalApps } from "/js/apps/additional-apps.js";
import { ICONS } from "/js/icons.js";

initWallpaper();

/* ---------- Finder ---------- */

OS.registerApp({
  id: "finder",
  name: "Finder",
  icon: ICONS.finder,
  finder: false,
  open() { return { title: "Finder", width: 640, height: 400, x: 90, y: 70 }; },
  onOpen(win) { win.body.appendChild(createFinder(OS)); },
});

/* ---------- Bloomberg Portal ---------- */

let term = null;

OS.registerApp({
  id: "terminal",
  name: "Bloomberg Portal",
  icon: ICONS.market,
  open() {
    term = createMarketTerminal();
    const w = Math.min(1240, window.innerWidth - 60);
    const h = Math.min(760, window.innerHeight - 140);
    return { title: "BLOOMBERG PORTAL — SEWING<GO>", width: w, height: h, x: 30, y: 24 };
  },
  onOpen(win) {
    win.body.appendChild(term.root);
    term.start();
  },
  onResize() { term?.redraw(); },
  onClose() { term?.destroy(); term = null; },
});

/* ---------- Notes ---------- */

OS.registerApp({
  id: "notes",
  name: "Notes",
  icon: ICONS.notes,
  open() { return { title: "Notes", width: 420, height: 380, x: 130, y: 90 }; },
  onOpen(win) {
    const ta = document.createElement("textarea");
    ta.className = "notes-area";
    ta.placeholder = "Type here. Notes persist in this browser.";
    ta.value = localStorage.getItem("sewingos.notes") ?? "";
    ta.addEventListener("input", () => localStorage.setItem("sewingos.notes", ta.value));
    win.body.appendChild(ta);
  },
});

/* ---------- Calculator ---------- */

OS.registerApp({
  id: "calculator",
  name: "Calculator",
  icon: ICONS.calculator,
  open() { return { title: "Calculator", width: 248, height: 380, x: 640, y: 120 }; },
  onOpen(win) {
    win.el.style.minWidth = "232px";
    win.el.style.minHeight = "340px";
    win.body.appendChild(createCalculator());
  },
});

/* ---------- Calendar ---------- */

OS.registerApp({
  id: "calendar",
  name: "Calendar",
  icon: ICONS.calendar,
  open() { return { title: "Calendar", width: 380, height: 400, x: 480, y: 110 }; },
  onOpen(win) { win.body.appendChild(createCalendar()); },
});

/* ---------- Weather ---------- */

OS.registerApp({
  id: "weather",
  name: "Weather",
  icon: ICONS.weather,
  open() { return { title: "Weather", width: 420, height: 460, x: 560, y: 80 }; },
  onOpen(win) { win.body.appendChild(createWeather()); },
});

/* ---------- Terminal (CLI) ---------- */

OS.registerApp({
  id: "cli",
  name: "Terminal",
  icon: ICONS.cli,
  open() { return { title: "jeremmy — -zsh — 80×24", width: 560, height: 360, x: 220, y: 140 }; },
  onOpen(win) { win.body.appendChild(createCLI(OS)); },
});

/* ---------- System Settings ---------- */

OS.registerApp({
  id: "settings",
  name: "System Settings",
  icon: ICONS.settings,
  open() { return { title: "System Settings", width: 560, height: 480, x: 300, y: 70 }; },
  onOpen(win) { win.body.appendChild(createSettings()); },
});

/* ---------- About ---------- */

OS.registerApp({
  id: "about",
  name: "About SewingOS",
  icon: ICONS.about,
  finder: false,
  open() { return { title: "About SewingOS", width: 460, height: 440 }; },
  onOpen(win) {
    const div = document.createElement("div");
    div.className = "app-pad";
    div.innerHTML = `
      <h1>✦ SewingOS</h1>
      <p>A macOS-style web desktop running in your browser, served from the
         Cloudflare edge at <code>sewing.top</code>.</p>
      <h2>Bloomberg Portal</h2>
      <p>A Bloomberg-style market monitor with <em>live data</em>: equities,
         indices, FX and futures from Yahoo Finance (delayed), crypto from
         Binance, headlines from CNBC / Yahoo RSS. When a feed is unreachable
         it falls back to a clearly-tagged simulation. Not investment advice.</p>
      <h2>Tips</h2>
      <p>⌘Space opens Spotlight. Drag title bars to move windows, bottom-right
         corner to resize, double-click a title bar to zoom. Try <code>NVDA GP</code>
         in the terminal command line, or <code>help</code> in the shell.</p>
      <h2>Stack</h2>
      <p><code>Cloudflare Workers</code> + <code>Static Assets</code> + vanilla JS.
         No frameworks, no build step.</p>`;
    win.body.appendChild(div);
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
