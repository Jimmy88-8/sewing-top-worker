/**
 * Bloomberg Portal — Bloomberg-style market monitor.
 * Live data from /api/quotes, /api/history, /api/news (Yahoo Finance,
 * Binance, RSS). Falls back to tagged simulation when feeds are down.
 *
 * Command line: SYM (chart) · SYM GP (chart) · SYM DES (detail) · N (news) · HELP
 */

const fmt = (x, dp) =>
  x == null ? "—" : x.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });

const dpOf = (price) => (price == null ? 2 : price >= 1000 ? 2 : price < 10 ? 4 : 2);
const signCls = (x) => (x > 0 ? "up" : x < 0 ? "down" : "flat");
const hhmm = (t) => {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const RANGES = ["1D", "5D", "1M", "6M", "1Y"];

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function createMarketTerminal() {
  const state = {
    quotes: new Map(),
    prevLast: new Map(),
    selected: "AAPL",
    range: "1D",
    chartType: "candle",
    candles: [],
    histMeta: null,
    histSrc: null,
    timers: [],
    crosshair: null,
  };

  const root = el(`
    <div class="term">
      <div class="term-cmdbar">
        <span class="prompt">&gt;</span>
        <input class="term-cmd" placeholder="Command: NVDA GP · AAPL DES · N · HELP" spellcheck="false" />
        <button class="term-go">GO</button>
        <span class="term-time"></span>
      </div>
      <div class="term-tape"><div class="tape-track"></div></div>
      <div class="term-main">
        <div class="term-panel p-watch">
          <div class="term-panel-title">MARKET MONITOR</div>
          <div class="watch-scroll">
            <table class="watch-table">
              <thead><tr><th>SYM</th><th>TREND</th><th>LAST</th><th>CHG</th><th>%CHG</th></tr></thead>
              <tbody></tbody>
            </table>
          </div>
        </div>
        <div class="term-panel p-chart">
          <div class="chart-head">
            <span class="chart-sym">—</span>
            <span class="chart-name"></span>
            <span class="chart-badge"></span>
            <span class="chart-last"></span>
            <span class="chart-ranges">
              ${RANGES.map((r) => `<button data-range="${r}" class="${r === "1D" ? "on" : ""}">${r}</button>`).join("")}
              <button data-type="toggle" title="Candles / line">⊞</button>
            </span>
          </div>
          <div class="chart-canvas-wrap"><canvas></canvas></div>
        </div>
        <div class="term-panel p-news">
          <div class="term-panel-title">TOP NEWS <span class="news-src"></span></div>
          <div class="news-scroll"></div>
        </div>
        <div class="term-panel p-detail">
          <div class="term-panel-title">SECURITY DETAIL</div>
          <div class="detail-grid"></div>
        </div>
      </div>
      <div class="term-fkeys">
        <span class="fkey"><b>F1</b> HELP</span>
        <span class="fkey"><b>F2</b> MKTS</span>
        <span class="fkey"><b>F3</b> EQTY</span>
        <span class="fkey"><b>F4</b> NEWS</span>
        <span class="fkey"><b>F8</b> CHART</span>
        <span class="term-stat"><span class="feed-stat">CONNECTING…</span>&nbsp;· SEWING TERMINAL</span>
      </div>
      <div class="term-help" hidden>
        <b>SEWING TERMINAL — FUNCTIONS</b>
        <div>&lt;SYM&gt; or &lt;SYM&gt; GP&nbsp;&nbsp;load price graph (e.g. NVDA GP)</div>
        <div>&lt;SYM&gt; DES&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;security description / detail</div>
        <div>N&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;jump to news</div>
        <div>RANGES&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;1D · 5D · 1M · 6M · 1Y buttons on the chart</div>
        <div>DATA&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Yahoo Finance (delayed) · Binance · RSS · SIM fallback</div>
        <div class="term-help-x">press any key to dismiss</div>
      </div>
    </div>`);

  const $ = (sel) => root.querySelector(sel);
  const tbody = $(".watch-table tbody");
  const canvas = $("canvas");
  const ctx = canvas.getContext("2d");
  const helpBox = $(".term-help");

  /* ---------- command bar ---------- */

  const cmd = $(".term-cmd");
  const flashPanel = (sel) => {
    const p = $(sel);
    p.classList.remove("flash");
    void p.offsetWidth;
    p.classList.add("flash");
  };

  function runCmd() {
    helpBox.hidden = true;
    const line = cmd.value.trim().toUpperCase();
    cmd.value = "";
    if (!line) return;
    const [sym, fn] = line.split(/\s+/);
    if (line === "HELP" || line === "F1") { helpBox.hidden = false; return; }
    if (line === "N" || line === "NEWS") { flashPanel(".p-news"); return; }
    if (state.quotes.has(sym)) {
      select(sym);
      if (fn === "DES") flashPanel(".p-detail");
      else flashPanel(".p-chart");
      return;
    }
    cmd.placeholder = `UNKNOWN: ${line} — try HELP`;
    setTimeout(() => (cmd.placeholder = "Command: NVDA GP · AAPL DES · N · HELP"), 2500);
  }
  cmd.addEventListener("keydown", (e) => { if (e.key === "Enter") runCmd(); });
  $(".term-go").addEventListener("click", runCmd);
  root.addEventListener("keydown", () => { helpBox.hidden = true; }, true);

  /* ---------- ticker tape ---------- */

  function renderTape() {
    const ids = ["SPX", "NDX", "DJI", "BTC", "ETH", "EURUSD", "GLD", "WTI"];
    const cells = ids
      .map((id) => {
        const q = state.quotes.get(id);
        if (!q) return "";
        const s = q.chg >= 0 ? "+" : "";
        return `<span class="tape-cell" data-sym="${id}"><b>${id}</b> ${fmt(q.last, dpOf(q.last))}
          <i class="${signCls(q.chg)}">${s}${q.chgPct}%</i></span>`;
      })
      .join("");
    const track = $(".tape-track");
    track.innerHTML = cells + cells; // duplicate for seamless loop
    track.querySelectorAll(".tape-cell").forEach((c) =>
      c.addEventListener("click", () => select(c.dataset.sym)),
    );
  }

  /* ---------- watchlist ---------- */

  function sparkSVG(points, up) {
    if (!points || points.length < 2) return "";
    let min = Infinity, max = -Infinity;
    for (const p of points) { if (p < min) min = p; if (p > max) max = p; }
    const span = max - min || 1;
    const W = 48, H = 14;
    const pts = points
      .map((p, i) => `${((i / (points.length - 1)) * W).toFixed(1)},${(H - 1.5 - ((p - min) / span) * (H - 3)).toFixed(1)}`)
      .join(" ");
    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><polyline points="${pts}" fill="none"
      stroke="${up ? "#00d26a" : "#ff3b30"}" stroke-width="1.2"/></svg>`;
  }

  function renderWatch() {
    const rows = [...state.quotes.values()];
    if (tbody.children.length !== rows.length) {
      tbody.innerHTML = rows
        .map((q) => `<tr data-sym="${q.symbol}"><td>${q.symbol}</td><td class="spark"></td><td></td><td></td><td></td></tr>`)
        .join("");
      for (const tr of tbody.children) tr.addEventListener("click", () => select(tr.dataset.sym));
    }
    for (const tr of tbody.children) {
      const q = state.quotes.get(tr.dataset.sym);
      if (!q) continue;
      const dp = dpOf(q.last);
      const cells = tr.children;
      const prev = state.prevLast.get(q.symbol);
      cells[1].innerHTML = sparkSVG(q.spark, q.chg >= 0);
      cells[2].textContent = fmt(q.last, dp);
      cells[2].className = signCls(q.chg);
      if (prev !== undefined && prev !== q.last) {
        void cells[2].offsetWidth;
        cells[2].classList.add(q.last > prev ? "fl-up" : "fl-down");
      }
      state.prevLast.set(q.symbol, q.last);
      cells[3].textContent = (q.chg > 0 ? "+" : "") + fmt(q.chg, dp);
      cells[3].className = signCls(q.chg);
      cells[4].textContent = q.chgPct == null ? "—" : (q.chgPct > 0 ? "+" : "") + q.chgPct.toFixed(2) + "%";
      cells[4].className = signCls(q.chgPct);
      tr.classList.toggle("sel", tr.dataset.sym === state.selected);
    }
  }

  /* ---------- feed status ---------- */

  function renderFeedStat() {
    const qs = [...state.quotes.values()];
    if (!qs.length) return;
    const live = qs.filter((q) => q.src === "live").length;
    const sim = qs.length - live;
    $(".feed-stat").innerHTML =
      sim === 0
        ? `<span class="up">● LIVE</span> ${live} FEEDS`
        : live === 0
          ? `<span class="down">● SIM</span> ALL SIMULATED`
          : `<span class="up">● LIVE</span> ${live} · <span class="warn">SIM ${sim}</span>`;
  }

  /* ---------- detail panel ---------- */

  function renderDetail() {
    const q = state.quotes.get(state.selected);
    if (!q) return;
    const dp = dpOf(q.last);
    const cells = [
      ["LAST", fmt(q.last, dp)],
      ["CHG", (q.chg > 0 ? "+" : "") + fmt(q.chg, dp)],
      ["CHG %", q.chgPct == null ? "—" : (q.chgPct > 0 ? "+" : "") + q.chgPct.toFixed(2) + "%"],
      ["OPEN", fmt(q.open, dp)],
      ["DAY HIGH", fmt(q.high, dp)],
      ["DAY LOW", fmt(q.low, dp)],
      ["PREV CLOSE", fmt(q.prevClose, dp)],
      ["VOLUME", q.volume == null ? "—" : q.volume.toLocaleString("en-US")],
      ["52W HIGH", fmt(q.high52, dp)],
      ["52W LOW", fmt(q.low52, dp)],
      ["EXCHANGE", q.exchange ?? state.histMeta?.exchange ?? "—"],
      ["SOURCE", q.src === "live" ? "LIVE FEED" : "SIMULATED"],
    ];
    $(".detail-grid").innerHTML = cells
      .map(([k, v]) => `<div class="detail-cell"><div class="k">${k}</div><div class="v">${v}</div></div>`)
      .join("");
  }

  /* ---------- chart ---------- */

  function renderChartHead() {
    const q = state.quotes.get(state.selected);
    if (!q) return;
    $(".chart-sym").textContent = q.symbol;
    $(".chart-name").textContent = `${state.histMeta?.name ?? q.name} · ${state.range}`;
    const badge = $(".chart-badge");
    const live = state.histSrc === "live";
    badge.textContent = live ? "LIVE" : state.histSrc ? "SIM" : "";
    badge.className = "chart-badge " + (live ? "b-live" : "b-sim");
    const lastEl = $(".chart-last");
    lastEl.textContent = `${fmt(q.last, dpOf(q.last))}  ${q.chg > 0 ? "+" : ""}${q.chgPct ?? 0}%`;
    lastEl.className = "chart-last " + signCls(q.chg);
  }

  function timeLabel(t) {
    const span = RANGES.indexOf(state.range);
    const d = new Date(t);
    if (span <= 1) return hhmm(t); // 1D / 5D
    if (span === 2) return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  }

  function drawChart() {
    const wrap = $(".chart-canvas-wrap");
    const W = wrap.clientWidth, H = wrap.clientHeight;
    if (!W || !H || !state.candles.length) return;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
      canvas.width = W * dpr;
      canvas.height = H * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const padR = 58, padT = 8, padB = 16;
    const volH = Math.max(28, (H - padT - padB) * 0.18);
    const priceH = H - padT - padB - volH - 6;
    const cw = W - padR;
    const data = state.candles;

    let min = Infinity, max = -Infinity, vmax = 0;
    for (const c of data) {
      if (c.l < min) min = c.l;
      if (c.h > max) max = c.h;
      if (c.v > vmax) vmax = c.v;
    }
    const span = (max - min) || 1;
    min -= span * 0.05; max += span * 0.05;
    const y = (p) => padT + (1 - (p - min) / (max - min)) * priceH;
    const x = (i) => (i + 0.5) * (cw / data.length);
    const volY0 = padT + priceH + 6 + volH;
    const barW = Math.max(1, Math.min(9, (cw / data.length) * 0.62));
    const dp = dpOf(data[data.length - 1].c);

    // grid + price axis
    ctx.font = "10px Menlo, monospace";
    ctx.textBaseline = "middle";
    for (let i = 0; i <= 4; i++) {
      const p = min + ((max - min) * i) / 4;
      const yy = y(p);
      ctx.strokeStyle = "#161616";
      ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(cw, yy); ctx.stroke();
      ctx.fillStyle = "#777";
      ctx.fillText(fmt(p, dp), cw + 6, yy);
    }

    // time labels
    ctx.textBaseline = "alphabetic";
    for (let i = 0; i < data.length; i += Math.ceil(data.length / 5)) {
      ctx.fillStyle = "#555";
      ctx.fillText(timeLabel(data[i].t), Math.min(x(i), cw - 40), H - 4);
    }

    // volume bars
    if (vmax > 0) {
      for (let i = 0; i < data.length; i++) {
        const c = data[i];
        ctx.fillStyle = c.c >= c.o ? "rgba(0,210,106,0.45)" : "rgba(255,59,48,0.45)";
        const h = (c.v / vmax) * volH;
        ctx.fillRect(x(i) - barW / 2, volY0 - h, barW, h);
      }
    }

    // price plot
    if (state.chartType === "line") {
      ctx.strokeStyle = "#f5a623";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      data.forEach((c, i) => (i ? ctx.lineTo(x(i), y(c.c)) : ctx.moveTo(x(i), y(c.c))));
      ctx.stroke();
      ctx.lineWidth = 1;
      const g = ctx.createLinearGradient(0, padT, 0, padT + priceH);
      g.addColorStop(0, "rgba(245,166,35,0.22)");
      g.addColorStop(1, "rgba(245,166,35,0)");
      ctx.lineTo(x(data.length - 1), padT + priceH);
      ctx.lineTo(x(0), padT + priceH);
      ctx.closePath();
      ctx.fillStyle = g;
      ctx.fill();
    } else {
      for (let i = 0; i < data.length; i++) {
        const c = data[i];
        const up = c.c >= c.o;
        ctx.strokeStyle = ctx.fillStyle = up ? "#00d26a" : "#ff3b30";
        const cx = x(i);
        ctx.beginPath(); ctx.moveTo(cx, y(c.h)); ctx.lineTo(cx, y(c.l)); ctx.stroke();
        const top = y(Math.max(c.o, c.c));
        const hgt = Math.max(1, Math.abs(y(c.o) - y(c.c)));
        ctx.fillRect(cx - barW / 2, top, barW, hgt);
      }
    }

    // last price line
    const last = data[data.length - 1].c;
    const ly = y(last);
    ctx.strokeStyle = "#f5a623";
    ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(cw, ly); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#f5a623";
    ctx.fillRect(cw, ly - 8, padR, 16);
    ctx.fillStyle = "#000";
    ctx.textBaseline = "middle";
    ctx.fillText(fmt(last, dp), cw + 6, ly);

    // crosshair
    if (state.crosshair) {
      const { mx, my } = state.crosshair;
      if (mx < cw) {
        ctx.strokeStyle = "rgba(245,166,35,0.45)";
        ctx.beginPath(); ctx.moveTo(mx, padT); ctx.lineTo(mx, volY0); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, my); ctx.lineTo(cw, my); ctx.stroke();
        const i = Math.min(data.length - 1, Math.max(0, Math.floor(mx / (cw / data.length))));
        const c = data[i];
        const txt = `${timeLabel(c.t)}  O ${fmt(c.o, dp)} H ${fmt(c.h, dp)} L ${fmt(c.l, dp)} C ${fmt(c.c, dp)}  V ${c.v.toLocaleString("en-US")}`;
        ctx.fillStyle = "rgba(0,0,0,0.85)";
        ctx.fillRect(6, padT + 2, ctx.measureText(txt).width + 12, 16);
        ctx.fillStyle = "#f5a623";
        ctx.fillText(txt, 12, padT + 10);
      }
    }
  }

  canvas.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    state.crosshair = { mx: e.clientX - r.left, my: e.clientY - r.top };
    drawChart();
  });
  canvas.addEventListener("pointerleave", () => { state.crosshair = null; drawChart(); });
  new ResizeObserver(() => drawChart()).observe($(".chart-canvas-wrap"));
  new ResizeObserver(() => root.classList.toggle("narrow", root.clientWidth < 900)).observe(root);

  $(".chart-ranges").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.type) {
      state.chartType = state.chartType === "candle" ? "line" : "candle";
      b.textContent = state.chartType === "candle" ? "⊞" : "∿";
      drawChart();
      return;
    }
    state.range = b.dataset.range;
    root.querySelectorAll("[data-range]").forEach((x) => x.classList.toggle("on", x === b));
    loadHistory();
  });

  /* ---------- news ---------- */

  function renderNews(items, src) {
    $(".news-src").textContent = src === "live" ? "· LIVE RSS" : "· SIM";
    const scroll = $(".news-scroll");
    scroll.innerHTML = items
      .map((n, i) => `
        <div class="news-item ${i === 0 ? "fresh" : ""}" ${n.link ? `data-link="${encodeURI(n.link)}"` : ""}>
          <span class="nt">${hhmm(n.t)}</span><span class="ntag">${n.source}</span>
          <div class="nh">${n.headline}</div>
        </div>`)
      .join("");
    scroll.querySelectorAll(".news-item[data-link]").forEach((item) =>
      item.addEventListener("click", () => window.open(item.dataset.link, "_blank", "noopener")),
    );
  }

  /* ---------- data flow ---------- */

  async function fetchJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return res.json();
  }

  async function pollQuotes() {
    try {
      const data = await fetchJSON("/api/quotes");
      for (const q of data.quotes) state.quotes.set(q.symbol, q);
      // keep the newest candle's close synced with the tape on intraday view
      const q = state.quotes.get(state.selected);
      const lastCandle = state.candles[state.candles.length - 1];
      if (q && lastCandle && state.range === "1D" && q.src === state.histSrc) {
        lastCandle.c = q.last;
        lastCandle.h = Math.max(lastCandle.h, q.last);
        lastCandle.l = Math.min(lastCandle.l, q.last);
      }
      renderWatch();
      renderTape();
      renderDetail();
      renderChartHead();
      renderFeedStat();
      drawChart();
    } catch { /* edge unreachable; next poll retries */ }
  }

  async function loadHistory() {
    try {
      const data = await fetchJSON(`/api/history?symbol=${state.selected}&range=${state.range}`);
      state.candles = data.candles;
      state.histMeta = data.meta;
      state.histSrc = data.src;
      renderChartHead();
      renderDetail();
      drawChart();
    } catch { /* retry on next cycle */ }
  }

  async function pollNews() {
    try {
      const data = await fetchJSON("/api/news");
      renderNews(data.items, data.src);
    } catch { /* ignore */ }
  }

  function select(sym) {
    state.selected = sym;
    state.candles = [];
    state.histMeta = null;
    renderWatch();
    renderDetail();
    renderChartHead();
    loadHistory();
  }

  function tickTime() {
    $(".term-time").textContent = new Date().toISOString().slice(11, 19) + " UTC";
  }

  /* ---------- lifecycle ---------- */

  function start() {
    tickTime();
    pollQuotes();
    loadHistory();
    pollNews();
    state.timers.push(setInterval(pollQuotes, 5_000));
    state.timers.push(setInterval(loadHistory, 60_000));
    state.timers.push(setInterval(pollNews, 120_000));
    state.timers.push(setInterval(tickTime, 1_000));
  }

  function destroy() {
    for (const t of state.timers) clearInterval(t);
    state.timers = [];
  }

  return { root, start, destroy, redraw: drawChart };
}
