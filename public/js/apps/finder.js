/**
 * Finder — virtual file browser. Apps launch on double-click;
 * text files open inline with a back button.
 */
import { ICONS, GLYPHS } from "/js/icons.js";

export function createFinder(OS) {
  const FS = {
    Applications: [
      { name: "Market Terminal", icon: ICONS.market, app: "terminal" },
      { name: "Notes", icon: ICONS.notes, app: "notes" },
      { name: "Calculator", icon: ICONS.calculator, app: "calculator" },
      { name: "Calendar", icon: ICONS.calendar(new Date().getDate()), app: "calendar" },
      { name: "Weather", icon: ICONS.weather, app: "weather" },
      { name: "Terminal", icon: ICONS.cli, app: "cli" },
      { name: "Settings", icon: ICONS.settings, app: "settings" },
    ],
    Documents: [
      {
        name: "README.md", icon: GLYPHS.doc,
        text: "# sewing.top\n\nSewingOS — macOS-style web desktop on Cloudflare Workers.\n\n- Market Terminal: live quotes via Yahoo Finance + Binance\n- Weather: Open-Meteo\n- Everything else: vanilla JS",
      },
      {
        name: "deploy-notes.txt", icon: GLYPHS.doc,
        text: "Deploy: push to GitHub -> Cloudflare Workers Builds auto-deploys.\nDomain: sewing.top bound as Worker custom domain.\nLocal dev: npm run dev (zero-dependency Node server).",
      },
    ],
    Desktop: [],
  };

  const root = document.createElement("div");
  root.className = "finder";
  let current = "Applications";

  function render() {
    const sidebar = Object.keys(FS)
      .map((k) => `<button class="fnd-side ${k === current ? "active" : ""}" data-loc="${k}">${k}</button>`)
      .join("");
    const items = FS[current];
    const grid = items.length
      ? items.map((it, i) => `
          <button class="fnd-item" data-i="${i}">
            <span class="fnd-icon">${it.icon}</span>
            <span class="fnd-name">${it.name}</span>
          </button>`).join("")
      : `<div class="fnd-empty">Folder is empty</div>`;

    root.innerHTML = `
      <div class="fnd-sidebar"><div class="fnd-side-title">Favorites</div>${sidebar}</div>
      <div class="fnd-main">${grid}</div>`;

    root.querySelectorAll(".fnd-side").forEach((b) =>
      b.addEventListener("click", () => { current = b.dataset.loc; render(); }),
    );
    root.querySelectorAll(".fnd-item").forEach((b) =>
      b.addEventListener("dblclick", () => openItem(FS[current][Number(b.dataset.i)])),
    );
  }

  function openItem(it) {
    if (it.app) { OS.launch(it.app); return; }
    if (it.text != null) {
      root.innerHTML = `
        <div class="fnd-view">
          <div class="fnd-view-bar"><button class="fnd-back">‹ Back</button><b>${it.name}</b></div>
          <pre class="fnd-text"></pre>
        </div>`;
      root.querySelector(".fnd-text").textContent = it.text;
      root.querySelector(".fnd-back").addEventListener("click", render);
    }
  }

  render();
  return root;
}
