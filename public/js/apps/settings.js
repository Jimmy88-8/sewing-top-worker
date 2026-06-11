/**
 * System Settings — wallpaper picker, Liquid Glass slider, system info.
 */
import {
  WALLPAPERS,
  applyWallpaper,
  currentWallpaper,
  setGlass,
  currentGlass,
} from "/js/wallpapers.js";

export function createSettings() {
  const root = document.createElement("div");
  root.className = "settings";

  const wpGrid = WALLPAPERS.map(
    (w) => `
    <button class="wp-tile ${w.id === currentWallpaper() ? "active" : ""}" data-wp="${w.id}" title="${w.name}">
      <span class="wp-thumb" style='background:${w.css.replaceAll("'", '"')};background-size:cover;background-position:center'></span>
      <span class="wp-name">${w.name}</span>
    </button>`,
  ).join("");

  root.innerHTML = `
    <section>
      <div class="section-label">Wallpaper</div>
      <div class="card"><div class="wp-grid">${wpGrid}</div></div>
    </section>
    <section>
      <div class="section-label">Liquid Glass</div>
      <div class="card glass-row">
        <span>Ultra-clear</span>
        <input type="range" min="0" max="100" value="${Math.round(currentGlass() * 100)}" aria-label="Liquid Glass tint" />
        <span>Tinted</span>
      </div>
    </section>
    <section>
      <div class="section-label">About</div>
      <div class="card settings-about">
        <div><span>System</span><b>SewingOS 27 "Golden Gate"</b></div>
        <div><span>Host</span><b>sewing.top · Cloudflare edge</b></div>
        <div><span>Design</span><b>Liquid Glass · adjustable tint</b></div>
        <div><span>Market data</span><b>Yahoo Finance · Binance</b></div>
        <div><span>Weather</span><b>Open-Meteo</b></div>
      </div>
    </section>`;

  for (const tile of root.querySelectorAll(".wp-tile")) {
    tile.addEventListener("click", () => {
      applyWallpaper(tile.dataset.wp);
      root.querySelectorAll(".wp-tile").forEach((t) => t.classList.remove("active"));
      tile.classList.add("active");
    });
  }

  root.querySelector(".glass-row input").addEventListener("input", (e) => {
    setGlass(Number(e.target.value) / 100);
  });

  return root;
}
