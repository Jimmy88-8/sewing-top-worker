/**
 * IBKR Desktop-inspired paper trading workspace.
 *
 * Market data comes from the worker API (/api/quotes, /api/history, /api/news)
 * and degrades gracefully to a bundled simulation snapshot when offline.
 * Order execution is a local paper-trading engine (positions, orders, trades,
 * realized/unrealized P&L) persisted to localStorage. No real orders are sent.
 */

const FAVORITES = ["SPY", "QQQ", "AAPL", "AMZN", "TSLA", "MSFT", "META", "NVDA", "GOOGL"];

const SEED_QUOTES = [
  { symbol: "SPY", name: "SPDR S&P 500 ETF TRUST", last: 730.97, chg: 5.54, pct: 0.76, volume: 64600000 },
  { symbol: "QQQ", name: "INVESCO QQQ TRUST SERIES 1", last: 702.51, chg: 8.81, pct: 1.27, volume: 48200000 },
  { symbol: "AAPL", name: "APPLE INC", last: 293.15, chg: 1.57, pct: 0.54, volume: 46700000 },
  { symbol: "AMZN", name: "AMAZON.COM INC", last: 240.15, chg: 2.15, pct: 0.90, volume: 44500000 },
  { symbol: "TSLA", name: "TESLA INC", last: 388.06, chg: 6.47, pct: 1.70, volume: 59100000 },
  { symbol: "MSFT", name: "MICROSOFT CORP", last: 397.50, chg: 0.30, pct: 0.08, volume: 34800000 },
  { symbol: "META", name: "META PLATFORMS INC-CLASS A", last: 572.13, chg: 1.15, pct: 0.20, volume: 17200000 },
  { symbol: "NVDA", name: "NVIDIA CORP", last: 203.06, chg: 2.64, pct: 1.32, volume: 166000000 },
  { symbol: "GOOGL", name: "ALPHABET INC-CL A", last: 357.80, chg: 1.42, pct: 0.40, volume: 29400000 },
];

const MKT_CAP = {
  NVDA: "4,850B", AAPL: "4,283B", GOOGL: "4,322B", MSFT: "2,952B", AMZN: "2,560B",
  TSLA: "1,490B", META: "1,484B", SPY: "—", QQQ: "—",
};

const NAV = [
  ["portfolio", "chart-pie", "Portfolio"],
  ["watchlist", "rectangle-stack", "Watchlist"],
  ["quote", "chart-bar", "Quote"],
  ["screeners", "globe-alt", "Screeners"],
  ["layouts", "squares-2x2", "Layouts"],
  ["news", "newspaper", "News"],
  ["sitemap", "map", "Sitemap"],
];

const SECONDARY_NAV = [
  ["feedback", "chat-bubble-left-right", "Feedback"],
  ["help", "question-mark-circle", "Help"],
  ["settings", "cog-6-tooth", "Settings"],
];

// Chart range buttons double as worker /api/history range keys.
const CHART_RANGES = ["1D", "5D", "1M", "6M", "1Y"];
const RAIL_RANGES = [["Today", "1D"], ["1W", "5D"], ["1M", "1M"], ["6M", "6M"], ["1Y", "1Y"]];

const STORE_KEY = "ibkr-paper-v1";
const DEFAULT_ACCOUNT = { cash: 1_000_000, positions: {}, orders: [], trades: [], realized: 0, dayStart: null };

const icon = (name) => `<img src="/icons/ibkr-ui/${name}.svg" alt="" draggable="false">`;
const number = (value, digits = 2) => Number(value).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const signed = (value, suffix = "", digits = 2) => `${value >= 0 ? "+" : ""}${number(value, digits)}${suffix}`;
const tone = (value) => value >= 0 ? "up" : "down";
const compact = (n) => n == null ? "--"
  : Math.abs(n) >= 1e9 ? `${(n / 1e9).toFixed(2)}B`
  : Math.abs(n) >= 1e6 ? `${(n / 1e6).toFixed(1)}M`
  : Math.abs(n) >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(Math.round(n));
const clock = (t) => new Date(t).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

// Stable pseudo-random bid/ask display sizes per symbol.
function sizeFor(symbol, salt) {
  let h = 2166136261;
  for (const ch of symbol + salt) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return 1 + (h >>> 0) % 640;
}

function element(html) {
  const template = document.createElement("template");
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
}

function loadAccount() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY));
    if (saved && typeof saved.cash === "number") return { ...structuredClone(DEFAULT_ACCOUNT), ...saved };
  } catch { /* corrupted store -> fresh account */ }
  return structuredClone(DEFAULT_ACCOUNT);
}

export function createIBKRDesktop() {
  const state = {
    mode: "paper",
    screen: "login",
    options: false,
    user: "",
    page: "portfolio",
    portfolioTab: "Positions",
    selected: "SPY",
    chartRange: "1D",
    railRange: "Today",
    quotes: new Map(SEED_QUOTES.map((q) => [q.symbol, normalizeQuote(q, null)])),
    history: new Map(),  // `${symbol}|${range}` -> { candles, meta, src }
    news: null,          // { items, src }
    account: loadAccount(),
    live: false,
    renderSeq: 0,
    orderSeq: 0,
    timers: [],
  };

  const root = element(`<div class="ibkr"></div>`);

  /* ================= account engine ================= */

  function saveAccount() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state.account)); } catch { /* private mode */ }
  }

  function nextId() {
    state.orderSeq += 1;
    return `${Date.now().toString(36)}-${state.orderSeq}`.toUpperCase();
  }

  function applyFill(symbol, side, qty, price) {
    const acct = state.account;
    const dir = side === "BUY" ? 1 : -1;
    acct.cash -= dir * qty * price;
    const pos = acct.positions[symbol] || { qty: 0, avgCost: 0 };
    const newQty = pos.qty + dir * qty;
    if (pos.qty !== 0 && Math.sign(dir) !== Math.sign(pos.qty)) {
      const closed = Math.min(qty, Math.abs(pos.qty));
      acct.realized += (price - pos.avgCost) * closed * Math.sign(pos.qty);
      if (newQty !== 0 && Math.sign(newQty) !== Math.sign(pos.qty)) pos.avgCost = price;
    } else if (newQty !== 0) {
      pos.avgCost = (pos.avgCost * Math.abs(pos.qty) + price * qty) / Math.abs(newQty);
    }
    pos.qty = newQty;
    if (newQty === 0) delete acct.positions[symbol];
    else acct.positions[symbol] = pos;
    acct.trades.unshift({ id: nextId(), symbol, side, qty, price, t: Date.now() });
    acct.trades = acct.trades.slice(0, 200);
    saveAccount();
  }

  function placeOrder(symbol, side, qty, type, limit) {
    const q = quote(symbol);
    qty = Math.max(1, Math.floor(Number(qty) || 0));
    const stats = accountStats();
    const refPrice = type === "Market" ? (side === "BUY" ? q.ask : q.bid) : Number(limit);
    if (!Number.isFinite(refPrice) || refPrice <= 0) return { error: "Enter a valid limit price." };
    if (side === "BUY" && qty * refPrice > stats.buyingPower) return { error: "Insufficient buying power for this order." };
    const order = {
      id: nextId(), symbol, side, type, qty,
      limit: type === "Limit" ? Number(limit) : null,
      status: "Working", t: Date.now(),
    };
    const marketable = type === "Market" || (side === "BUY" ? order.limit >= q.ask : order.limit <= q.bid);
    if (marketable) {
      const price = type === "Market"
        ? (side === "BUY" ? q.ask : q.bid)
        : (side === "BUY" ? Math.min(order.limit, q.ask) : Math.max(order.limit, q.bid));
      order.status = "Filled";
      order.fillPrice = price;
      order.fillT = Date.now();
      applyFill(symbol, side, qty, price);
    }
    state.account.orders.unshift(order);
    state.account.orders = state.account.orders.slice(0, 200);
    saveAccount();
    return { order };
  }

  function cancelOrder(id) {
    const order = state.account.orders.find((o) => o.id === id);
    if (order && order.status === "Working") {
      order.status = "Cancelled";
      saveAccount();
    }
  }

  function fillWorkingOrders() {
    let filled = false;
    for (const order of state.account.orders) {
      if (order.status !== "Working") continue;
      const q = state.quotes.get(order.symbol);
      if (!q) continue;
      if (order.side === "BUY" ? q.ask <= order.limit : q.bid >= order.limit) {
        order.status = "Filled";
        order.fillPrice = order.limit;
        order.fillT = Date.now();
        applyFill(order.symbol, order.side, order.qty, order.limit);
        toast(`${order.side} ${order.qty} ${order.symbol} filled @ ${number(order.limit)}`);
        filled = true;
      }
    }
    if (filled) saveAccount();
  }

  function accountStats() {
    const acct = state.account;
    let marketValue = 0, unrealized = 0;
    for (const [symbol, pos] of Object.entries(acct.positions)) {
      const last = state.quotes.get(symbol)?.last ?? pos.avgCost;
      marketValue += pos.qty * last;
      unrealized += (last - pos.avgCost) * pos.qty;
    }
    const netLiq = acct.cash + marketValue;
    const today = new Date().toDateString();
    if (acct.dayStart?.date !== today) {
      acct.dayStart = { date: today, netLiq };
      saveAccount();
    }
    return {
      cash: acct.cash, marketValue, netLiq, unrealized,
      realized: acct.realized,
      daily: netLiq - acct.dayStart.netLiq,
      buyingPower: Math.max(0, acct.cash > 0 ? acct.cash * 4 : netLiq * 4),
    };
  }

  /* ================= data layer ================= */

  function quote(symbol) {
    return state.quotes.get(symbol) || state.quotes.get("SPY") || normalizeQuote(SEED_QUOTES[0], null);
  }

  async function refreshQuotes() {
    try {
      const response = await fetch("/api/quotes");
      if (!response.ok) return;
      const data = await response.json();
      const rows = data.quotes ?? [];
      for (const row of rows) {
        const prior = state.quotes.get(row.symbol) || null;
        state.quotes.set(row.symbol, normalizeQuote(row, prior));
      }
      state.live = rows.some((row) => row.src === "live");
      fillWorkingOrders();
      if (state.screen === "workspace") {
        updateTopbar();
        updateLive();
      }
    } catch {
      // Bundled snapshot keeps the app usable offline.
    }
  }

  async function loadHistory(symbol, rangeKey) {
    const key = `${symbol}|${rangeKey}`;
    if (state.history.has(key)) return state.history.get(key);
    try {
      const response = await fetch(`/api/history?symbol=${encodeURIComponent(symbol)}&range=${rangeKey}`);
      if (!response.ok) throw new Error("history unavailable");
      const data = await response.json();
      if (!data.candles?.length) throw new Error("empty");
      state.history.set(key, data);
      // History stays fresh enough for a paper workspace; drop after 2 min.
      state.timers.push(setTimeout(() => state.history.delete(key), 120_000));
      return data;
    } catch {
      const sim = { src: "sim", candles: simSeries(symbol), meta: { exchange: "SIM" } };
      state.history.set(key, sim);
      return sim;
    }
  }

  async function loadNews() {
    try {
      const response = await fetch("/api/news");
      if (!response.ok) return;
      state.news = await response.json();
      if (state.screen === "workspace" && ["news", "layouts"].includes(state.page)) updateLive();
    } catch { /* keep previous headlines */ }
  }

  function simSeries(symbol) {
    let value = quote(symbol).last || 100;
    const t0 = Date.now() - 58 * 300_000;
    return Array.from({ length: 58 }, (_, i) => {
      const o = value;
      const drift = Math.sin(i / 4) * value * 0.00015 + (Math.random() - 0.52) * value * 0.0006;
      const c = o + drift;
      value = c;
      return {
        t: t0 + i * 300_000, o,
        h: Math.max(o, c) * (1 + Math.random() * 0.0004),
        l: Math.min(o, c) * (1 - Math.random() * 0.0004),
        c, v: Math.round(50_000 + Math.random() * 900_000),
      };
    });
  }

  /* ================= screens ================= */

  function renderLogin() {
    const buttonLabel = state.mode === "paper" ? "Log In to Simulation" : "Log In";
    root.innerHTML = `
      <div class="ib-login">
        <section class="ib-login-main">
          <div class="ib-window-dots"><i></i><i></i><i></i></div>
          <div class="ib-login-tools"><button>A<span>文</span></button><button class="pro">IBKR<br><b>PRO</b></button></div>
          <div class="ib-login-card">
            ${wordmark()}
            <h1>Welcome to IBKR Desktop.</h1>
            <div class="ib-login-tabs">
              <button data-mode="live" class="${state.mode === "live" ? "active" : ""}">Live Trading</button>
              <button data-mode="paper" class="${state.mode === "paper" ? "active" : ""}">Paper Trading</button>
            </div>
            <form class="ib-login-form">
              <label>${icon("user-circle")}<input name="username" placeholder="Username" autocomplete="off" aria-label="Username"></label>
              <label>${icon("rectangle-stack")}<input name="password" type="password" placeholder="Password" autocomplete="off" aria-label="Password"></label>
              <button class="ib-help-link" type="button">Get Help</button>
              <button class="ib-login-button" type="submit">${buttonLabel}</button>
            </form>
          </div>
          <button class="ib-more-options" type="button">${state.options ? "Fewer Options" : "More Options"}</button>
        </section>
        ${state.options ? optionsPanel() : `
          <section class="ib-login-art">
            <img src="/images/ibkr/login-wave.png" alt="">
            <small>Build 3.2f, May 20, 2026 9:25:51 PM</small>
          </section>`}
      </div>`;
    bindLogin();
  }

  function optionsPanel() {
    return `
      <section class="ib-options-panel">
        <div class="ib-options-form">
          ${selectRow("Change Version", "LATEST")}
          ${selectRow("Theme", "dark")}
          ${selectRow("Graphics API", "Default")}
          ${selectRow("Language", "English")}
          ${selectRow("Time Zone", "(UTC+08:00) Asia/Kuala Lumpur")}
          <div class="ib-current-time">${new Date().toLocaleTimeString("en-GB")} (UTC+08:00) Asia/Kuala Lumpur</div>
          ${inputRow("Host")}
          ${inputRow("Port")}
          ${inputRow("Browser Path", true)}
          <label class="ib-check"><input type="checkbox"> No internet connectivity</label>
          <label class="ib-check"><input type="checkbox" checked> Use SSL</label>
        </div>
        <small>Build 3.2f, May 20, 2026 9:25:51 PM</small>
      </section>`;
  }

  function selectRow(label, value) {
    return `<label class="ib-option-row"><span>${label}</span><select><option>${value}</option></select></label>`;
  }

  function inputRow(label, search = false) {
    return `<label class="ib-option-row"><span>${label}</span><div class="ib-option-input"><input placeholder="--">${search ? icon("magnifying-glass") : ""}</div></label>`;
  }

  function bindLogin() {
    root.querySelectorAll("[data-mode]").forEach((button) => button.addEventListener("click", () => {
      state.mode = button.dataset.mode;
      renderLogin();
    }));
    root.querySelector(".ib-more-options").addEventListener("click", () => {
      state.options = !state.options;
      renderLogin();
    });
    root.querySelector(".ib-login-form").addEventListener("submit", (event) => {
      event.preventDefault();
      state.user = event.currentTarget.elements.username.value.trim() || "Paper Trader";
      renderConnecting();
      state.timers.push(setTimeout(renderWorkspace, 1100));
    });
  }

  function renderConnecting() {
    root.innerHTML = `
      <section class="ib-connecting">
        <div class="ib-window-dots"><i></i><i></i><i></i></div>
        <div class="ib-connecting-center">${wordmark()}<h2>Logging in ${escapeHtml(state.user)}</h2><div class="ib-progress"><i></i></div></div>
        <small class="status">Connecting to server (trying for another 1 seconds)...</small>
        <small class="build">Build 3.2f, May 20, 2026 9:25:51 PM</small>
      </section>`;
  }

  function renderWorkspace() {
    state.screen = "workspace";
    root.innerHTML = `
      <div class="ib-shell">
        <header class="ib-topbar">
          <div class="ib-window-dots light"><i></i><i></i><i></i></div>
          <label class="ib-global-search">${icon("magnifying-glass")}<input placeholder="Search"><kbd>⌘ + K</kbd></label>
          <button class="ib-arrow">‹</button><button class="ib-arrow">›</button>
          <span class="ib-top-logo"><img src="/images/ibkr/ibkr-logo.svg" alt="IBKR"></span>
          <div class="ib-account-summary">
            <span class="ib-sync" data-feed>↑ <b>0</b></span><span class="ib-sync muted">✓ <b>0</b></span>
            <span><small>NET LIQ</small><b data-netliq>--</b></span>
            <span><small>DAILY P&amp;L</small><b data-dailypnl class="up">--</b></span>
            ${icon("user-circle")}
          </div>
        </header>
        <div class="ib-sim-strip">${Array(8).fill("<span>SIMULATED TRADING</span>").join("")}</div>
        <div class="ib-body">
          <aside class="ib-nav">
            <div>${NAV.map(navItem).join("")}</div>
            <div>${SECONDARY_NAV.map(navItem).join("")}</div>
          </aside>
          <main class="ib-page-host"></main>
        </div>
        <footer class="ib-statusbar"><span><i data-health></i> <span data-conn>NORMAL OPERATIONS</span></span><span>Build 3.2f, May 20, 2026 9:25:51 PM &nbsp;&nbsp;&nbsp; MARKET DATA POWERED BY <b>GFIS</b></span></footer>
        <div class="ib-modal-layer" hidden></div>
        <div class="ib-toast-host"></div>
      </div>`;
    bindShell();
    renderPage();
    updateTopbar();
    refreshQuotes();
    loadNews();
    state.timers.push(setInterval(refreshQuotes, 15_000));
    state.timers.push(setInterval(loadNews, 240_000));
  }

  function navItem([id, image, label]) {
    return `<button data-page="${id}" class="${state.page === id ? "active" : ""}">${icon(image)}<span>${label}</span></button>`;
  }

  function bindShell() {
    root.querySelectorAll("[data-page]").forEach((button) => button.addEventListener("click", () => {
      if (["feedback", "help"].includes(button.dataset.page)) return showNotice(button.dataset.page === "help" ? "IBKR Help Center" : "Thank you for helping improve IBKR Desktop.");
      if (button.dataset.page === "settings") return showSettings();
      state.page = button.dataset.page;
      root.querySelectorAll("[data-page]").forEach((item) => item.classList.toggle("active", item.dataset.page === state.page));
      renderPage();
    }));
    const search = root.querySelector(".ib-global-search input");
    search.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      const text = event.currentTarget.value.trim().toUpperCase();
      if (!text) return;
      const hit = state.quotes.has(text)
        ? text
        : [...state.quotes.values()].find((q) => q.name?.toUpperCase().includes(text))?.symbol;
      if (hit) {
        state.selected = hit;
        state.page = "quote";
        root.querySelectorAll("[data-page]").forEach((item) => item.classList.toggle("active", item.dataset.page === "quote"));
        event.currentTarget.value = "";
        renderPage();
      } else {
        toast(`No match for "${text}"`);
      }
    });
    root.addEventListener("keydown", (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        search.focus();
      }
    });
  }

  function updateTopbar() {
    if (state.screen !== "workspace") return;
    const stats = accountStats();
    const netliq = root.querySelector("[data-netliq]");
    if (!netliq) return;
    netliq.textContent = number(stats.netLiq, 0);
    const daily = root.querySelector("[data-dailypnl]");
    daily.textContent = stats.daily === 0 ? "--" : signed(stats.daily, "", 0);
    daily.className = tone(stats.daily);
    const conn = root.querySelector("[data-conn]");
    const health = root.querySelector("[data-health]");
    if (conn) conn.textContent = state.live ? "NORMAL OPERATIONS" : "SIMULATED DATA";
    if (health) health.classList.toggle("sim", !state.live);
    const feed = root.querySelector("[data-feed]");
    if (feed) feed.innerHTML = `↑ <b>${state.account.orders.filter((o) => o.status === "Working").length}</b>`;
  }

  // Re-render the visible page unless the user is mid-interaction.
  function updateLive() {
    const layer = root.querySelector(".ib-modal-layer");
    if (layer && !layer.hidden) return;
    const active = document.activeElement;
    if (active && root.contains(active) && ["INPUT", "SELECT", "TEXTAREA"].includes(active.tagName)) return;
    renderPage(true);
  }

  function renderPage(preserveScroll = false) {
    const host = root.querySelector(".ib-page-host");
    if (!host) return;
    const scrollers = preserveScroll
      ? [...host.querySelectorAll("*")].filter((el) => el.scrollTop > 0).map((el) => [el.className, el.scrollTop])
      : [];
    const pages = { portfolioPage, watchlistPage, quotePage, screenersPage, layoutsPage, newsPage, sitemapPage };
    host.innerHTML = (pages[`${state.page}Page`] || portfolioPage)();
    for (const [className, top] of scrollers) {
      const el = [...host.querySelectorAll("*")].find((node) => node.className === className);
      if (el) el.scrollTop = top;
    }
    bindPage();
    hydratePage();
  }

  /* ================= pages ================= */

  function portfolioPage() {
    const tab = state.portfolioTab;
    const panel = tab === "Orders" ? ordersTable()
      : tab === "Trades" ? tradesTable()
      : tab === "Balances" ? balancesPanel()
      : positionsTable();
    return `
      <section class="ib-page ib-portfolio-page">
        ${accountMetrics()}
        <div class="ib-split-page">
          <div class="ib-main-panel">
            ${tabs(["Positions", "Orders", "Trades", "Balances"], tab, "portfolio-tab")}
            <div class="ib-toolbar"><select><option>Portfolio View</option></select><select><option>Sort By</option></select>${icon("funnel")}${icon("cog-6-tooth")}</div>
            <div class="ib-panel-scroll">${panel}</div>
          </div>
          ${quoteRail(false)}
        </div>
      </section>`;
  }

  function watchlistPage() {
    return `
      <section class="ib-page ib-split-page">
        <div class="ib-main-panel">
          <div class="ib-section-title"><b>Favorites</b><button>+</button><select><option>Watchlist View</option></select>${icon("cog-6-tooth")}</div>
          <div class="ib-panel-scroll">${watchTable()}</div>
        </div>
        ${quoteRail(true)}
      </section>`;
  }

  function quotePage() {
    const q = quote(state.selected);
    return `
      <section class="ib-page ib-quote-grid">
        <div class="ib-mini-watch"><select><option>Favorites</option></select>${miniWatch()}</div>
        <div class="ib-chart-workspace">
          ${tabs(["Charts", "Options", "Connections", "News", "Fundamentals"], "Charts")}
          <div class="ib-chart-toolbar"><b>⊕</b><span>${state.chartRange}</span><span>♮</span><span>ƒx</span><span>▦</span><span>↶</span><span>↷</span><span>□</span><b>Unnamed⌄</b><span>◉</span><span>⬡</span><span>⛶</span></div>
          <div class="ib-chart-title"><b>${q.symbol} · ${escapeHtml(q.name)} · ${state.chartRange} · ${q.exchange || "SMART"}</b><span data-ohlc class="${tone(q.chg)}">--</span><span>Volume <b data-chartvol class="${tone(q.chg)}">--</b></span></div>
          <canvas class="ib-candle-chart" data-chart-symbol="${q.symbol}"></canvas>
          <div class="ib-chart-bottom">${CHART_RANGES.map((key) => `<span data-range="${key}" class="${state.chartRange === key ? "active" : ""}">${key}</span>`).join("")}<b>${new Date().toLocaleTimeString("en-GB")} UTC+8</b><span>RTH</span><span>%</span><span>log</span><span class="active">auto</span></div>
        </div>
        ${quoteRail(true)}
      </section>`;
  }

  function screenersPage() {
    const rows = [...state.quotes.values()]
      .filter((q) => ["Equity", "ETF"].includes(q.kind) || FAVORITES.includes(q.symbol))
      .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
    return `
      <section class="ib-page ib-screeners">
        <div class="ib-category-tabs">${["My Screeners", "US Stocks", "Asia Stocks", "EUR Stocks", "ETFs", "Options", "Bonds"].map((x, i) => `<b class="${i === 1 ? "active" : ""}">${x}</b>`).join("")}</div>
        <div class="ib-market-tabs">${["All US Stocks", "NYSE", "AMEX", "NASDAQ", "Pink Sheets", "Airlines", "Biotech", "Energy", "Financial", "Media", "Retail", "Technology", "SaaS", "E-Commerce"].map((x) => `<span>${x}</span>`).join("")}</div>
        <div class="ib-screener-body">
          <aside class="ib-screener-aside">
            <p>Choose an option below to narrow results.</p>
            <article class="ai"><b>Configure Screener with AI</b><span>Describe what you're looking for.</span><a>Learn More</a></article>
            <h3>Screener Types</h3>
            <article><b>MultiSort Screener</b><span>Rank stocks on a blended score of factors.</span></article>
            <article><b>Standard Screener</b><span>Define factor ranges to narrow stock results.</span></article>
            <h3>Popular Screeners</h3>
            <article><b>Attractive Valuation</b><span>Lowest P/E Ratio, Price/Book Ratio, and highest Cash Flow per share.</span></article>
          </aside>
          <div class="ib-results">
            <div class="ib-results-head"><b>⚑ &nbsp; Top Movers — sorted by % change ${state.live ? "(live)" : "(simulated)"}</b><span>Generated at ${clock(Date.now())}</span><a data-refresh>⟳ Refresh results</a></div>
            <table><thead><tr><th>□</th><th>Financial Instrument</th><th>Company Name</th><th>Last</th><th>Change</th><th>Change %</th><th>Market Cap</th><th>Volume</th><th>52W High</th></tr></thead>
            <tbody>${rows.map((q) => `<tr data-symbol="${q.symbol}"><td>□</td><td><b>${q.symbol}</b></td><td>${escapeHtml(q.name)}</td><td class="${tone(q.chg)}">${number(q.last, q.dp)}</td><td class="${tone(q.chg)}">${signed(q.chg, "", q.dp)}</td><td class="${tone(q.pct)}">${signed(q.pct, "%")}</td><td>${MKT_CAP[q.symbol] || "—"}</td><td>${compact(q.volume)}</td><td>${q.high52 ? number(q.high52, q.dp) : "--"}</td></tr>`).join("")}</tbody></table>
          </div>
        </div>
      </section>`;
  }

  function layoutsPage() {
    const q = quote(state.selected);
    return `
      <section class="ib-page ib-layouts">
        <div class="ib-layout-title"><b>Basic Trading</b><button>+</button></div>
        <div class="ib-layout-grid">
          <article class="ib-module order"><header>Rapid Order Entry <span>× &nbsp; + &nbsp; •••</span></header>${orderEntry()}</article>
          <article class="ib-module chart"><header>Chart <span>× &nbsp; + &nbsp; •••</span></header><div class="ib-chart-title"><b>${q.symbol} · ${escapeHtml(q.name)} · ${state.chartRange} · ${q.exchange || "SMART"}</b><span data-ohlc class="${tone(q.chg)}">--</span></div><canvas class="ib-candle-chart" data-chart-symbol="${q.symbol}"></canvas></article>
          <article class="ib-module portfolio"><header>Portfolio <span>× &nbsp; Watchlist &nbsp; +</span></header><div class="ib-module-scroll">${positionsTable(true)}</div></article>
          <article class="ib-module orders"><header>Orders Table <span>× &nbsp; Trades &nbsp; +</span></header><div class="ib-module-scroll">${ordersTable(true)}</div></article>
          <article class="ib-module news"><header>News <span>× &nbsp; +</span></header>${newsList()}</article>
        </div>
      </section>`;
  }

  function newsPage() {
    const items = state.news?.items ?? [];
    const hero = items[0];
    const spx = state.quotes.get("SPX");
    const ndx = state.quotes.get("NDX");
    const dji = state.quotes.get("DJI");
    const fmtIdx = (q) => q ? `<b class="${tone(q.pct)}">${signed(q.pct, "%")}</b>` : "<b>--</b>";
    return `
      <section class="ib-page ib-news-page">
        <aside class="ib-news-nav">${["Daily Overview", "Portfolio News", "Watchlist News", "Read Later", "Browse", "Manage Subscriptions ↗", "Language Settings"].map((x, i) => `<button class="${i === 0 ? "active" : ""}">${x}</button>`).join("")}<button class="feedback">☁ &nbsp; Give Feedback</button></aside>
        <main class="ib-news-main">
          <div class="ib-news-heading"><h1>Daily Overview</h1><label><input placeholder="Search for instruments, asset classes, and topics">${icon("magnifying-glass")}</label></div>
          <div class="ib-news-cards">
            <article class="ib-news-hero"><img src="/images/ibkr/news-ai-keyboard.png" alt=""><b>${hero ? escapeHtml(hero.source) : "Companies in the News"}</b><h2>${hero ? escapeHtml(hero.headline) : "Anthropic v. OpenAI: Behind the bitter battle for the future of AI"}</h2></article>
            <article class="ib-market-card"><h2>Market Performance</h2><div><b>U.S.</b> Europe &nbsp; Asia &nbsp; FX</div><div class="ib-indexes"><span>S&amp;P 500 ${fmtIdx(spx)}</span><span>NASDAQ 100 ${fmtIdx(ndx)}</span><span>DOW JONES ${fmtIdx(dji)}</span></div><canvas class="ib-line-chart" data-spark-symbol="SPX"></canvas><footer>Today &nbsp;&nbsp; 5D &nbsp;&nbsp; 1M &nbsp;&nbsp; 1Y &nbsp;&nbsp; 2Y</footer></article>
          </div>
          <div class="ib-headline-feed">
            <h2>Latest Headlines ${state.news?.src === "live" ? "" : "(simulated)"}</h2>
            ${items.slice(1, 11).map((n) => `<p><small>${clock(n.t)}</small> <b>${escapeHtml(n.source)}</b> ${n.link ? `<a href="${encodeURI(n.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(n.headline)}</a>` : escapeHtml(n.headline)}</p>`).join("") || "<p>Loading headlines…</p>"}
          </div>
        </main>
        ${eventsRail()}
      </section>`;
  }

  function sitemapPage() {
    const left = ["PORTFOLIO", "Positions", "Balances", "Portfolio News", "Tax Optimizer ↗", "TRADE", "Charts", "Orders", "Trades", "Option Chain", "Option Wizard", "Option Analysis", "Prediction Markets ↗", "Trading Permissions ↗", "Convert Currency ↗", "Market Alerts ↗", "RESEARCH", "Ask IBKR ↗", "Watchlist", "Screeners"];
    const right = ["FUNDAMENTALS EXPLORER", "Fundamentals Explorer", "Profile", "Investment Themes", "Key Ratios", "Dividends", "Financials", "Impact & ESG", "Analyst Ratings", "Analyst Forecast", "Ownership", "Social Sentiment", "Short Selling", "Securities Lending Analytics", "SETTINGS", "Display Settings", "Hot Keys", "Column Management", "Trading Presets", "Messages"];
    const links = (items) => items.map((x) => x === x.toUpperCase() ? `<h4>${x}</h4>` : `<a>${x}</a>`).join("");
    return `
      <section class="ib-page ib-sitemap-page">
        <main class="ib-sitemap-main"><div class="ib-sitemap-search"><b>× &nbsp; SITEMAP</b><label>${icon("magnifying-glass")}<input placeholder="Search for tools"><span>×</span></label></div><div class="ib-link-columns"><div>${links(left)}</div><div>${links(right)}</div></div><footer><button>▣ Deposit Funds</button><button>▣ Withdraw Funds</button></footer></main>
        ${eventsRail()}
      </section>`;
  }

  /* ================= shared fragments ================= */

  function accountMetrics() {
    const s = accountStats();
    const metrics = [
      ["Account", "DU•••••74"],
      ["Daily P&L", s.daily === 0 ? "--" : signed(s.daily, "", 0), tone(s.daily)],
      ["Unrealized P&L", s.unrealized === 0 ? "--" : signed(s.unrealized, "", 0), tone(s.unrealized)],
      ["Realized P&L", s.realized === 0 ? "--" : signed(s.realized, "", 0), tone(s.realized)],
      ["Net Liquidity", compact(s.netLiq)],
      ["Mkt Value", compact(s.marketValue)],
      ["Cash", compact(s.cash)],
      ["Maintenance", "0"],
      ["Initial Margin", "0"],
      ["Available Funds", compact(Math.max(0, s.cash))],
      ["Buying Power", compact(s.buyingPower)],
    ];
    return `<div class="ib-metrics">${metrics.map(([label, value, cls]) => `<span><small>${label}</small><b class="${cls || ""}">${value}</b></span>`).join("")}</div>`;
  }

  function tabs(items, active, action) {
    return `<div class="ib-tabs">${items.map((item) => `<button ${action ? `data-${action}="${item}"` : ""} class="${item === active ? "active" : ""}">${item}</button>`).join("")}</div>`;
  }

  function positionsTable(compactMode = false) {
    const positions = Object.entries(state.account.positions);
    const stats = accountStats();
    const rows = positions.map(([symbol, pos]) => {
      const q = state.quotes.get(symbol);
      const last = q?.last ?? pos.avgCost;
      const unrl = (last - pos.avgCost) * pos.qty;
      return `<tr data-symbol="${symbol}"><td><b>${symbol}</b></td>${compactMode ? "" : `<td>${escapeHtml(q?.name || "")}</td>`}<td class="${pos.qty < 0 ? "down" : ""}">${number(pos.qty, 0)}</td><td>${number(pos.avgCost)}</td><td class="${q ? tone(q.chg) : ""} ib-tick-${q?.dir > 0 ? "up" : q?.dir < 0 ? "down" : "flat"}">${number(last, q?.dp ?? 2)}</td><td>${number(pos.qty * last, 0)}</td><td class="${tone(unrl)}">${signed(unrl, "", 0)}</td>${compactMode ? "" : `<td class="${q ? tone(q.pct) : ""}">${q ? signed(q.pct, "%") : "--"}</td><td><canvas class="ib-spark-cell" data-spark-symbol="${symbol}"></canvas></td>`}</tr>`;
    }).join("");
    const empty = `<tr><td colspan="${compactMode ? 6 : 9}" class="ib-empty-row">No open positions — use Buy Order / Sell Order to start paper trading.</td></tr>`;
    return `<table class="ib-table ib-portfolio-table"><thead><tr><th>Financial Instrument</th>${compactMode ? "" : "<th>Company Name</th>"}<th>Position</th><th>Avg Price</th><th>Last</th><th>Mkt Value</th><th>Unrlzd P&amp;L</th>${compactMode ? "" : "<th>Change %</th><th>Trend</th>"}</tr></thead><tbody>${rows || empty}<tr class="cash"><td><b>USD CASH</b></td>${compactMode ? "" : "<td></td>"}<td></td><td></td><td></td><td>${number(stats.cash, 0)}</td><td></td>${compactMode ? "" : "<td></td><td></td>"}</tr></tbody></table>`;
  }

  function ordersTable(compactMode = false) {
    const orders = state.account.orders.slice(0, compactMode ? 6 : 50);
    const rows = orders.map((o) => `<tr><td><b>${o.symbol}</b></td><td class="${o.side === "BUY" ? "blue" : "down"}">${o.side}</td><td>${o.type}</td><td>${number(o.qty, 0)}</td><td>${o.limit != null ? number(o.limit) : "MKT"}</td><td>${o.fillPrice != null ? number(o.fillPrice) : "--"}</td><td class="ib-status ${o.status.toLowerCase()}">${o.status}</td><td>${clock(o.t)}</td>${compactMode ? "" : `<td>${o.status === "Working" ? `<button class="ib-cancel" data-cancel-order="${o.id}">Cancel</button>` : ""}</td>`}</tr>`).join("");
    const empty = `<tr><td colspan="${compactMode ? 8 : 9}" class="ib-empty-row">No orders yet.</td></tr>`;
    return `<table class="ib-table ib-orders-table"><thead><tr><th>Financial Instrument</th><th>Action</th><th>Type</th><th>Quantity</th><th>Limit</th><th>Fill</th><th>Status</th><th>Time</th>${compactMode ? "" : "<th></th>"}</tr></thead><tbody>${rows || empty}</tbody></table>`;
  }

  function tradesTable() {
    const rows = state.account.trades.slice(0, 50).map((t) => `<tr><td><b>${t.symbol}</b></td><td class="${t.side === "BUY" ? "blue" : "down"}">${t.side}</td><td>${number(t.qty, 0)}</td><td>${number(t.price)}</td><td>${number(t.qty * t.price, 0)}</td><td>${clock(t.t)}</td></tr>`).join("");
    return `<table class="ib-table"><thead><tr><th>Financial Instrument</th><th>Action</th><th>Quantity</th><th>Price</th><th>Value</th><th>Time</th></tr></thead><tbody>${rows || `<tr><td colspan="6" class="ib-empty-row">No executions yet.</td></tr>`}</tbody></table>`;
  }

  function balancesPanel() {
    const s = accountStats();
    const row = (label, value, cls = "") => `<div class="ib-balance-row"><span>${label}</span><b class="${cls}">${value}</b></div>`;
    return `
      <div class="ib-balances">
        ${row("Cash", number(s.cash, 0))}
        ${row("Securities Market Value", number(s.marketValue, 0))}
        ${row("Net Liquidation Value", number(s.netLiq, 0))}
        ${row("Unrealized P&L", signed(s.unrealized, "", 0), tone(s.unrealized))}
        ${row("Realized P&L", signed(s.realized, "", 0), tone(s.realized))}
        ${row("Daily P&L", signed(s.daily, "", 0), tone(s.daily))}
        ${row("Buying Power (4:1)", number(s.buyingPower, 0))}
        <button class="ib-reset-account" data-reset-account>Reset Paper Account</button>
      </div>`;
  }

  function watchTable() {
    return `<table class="ib-table ib-watch-table"><thead><tr><th>Financial Instrument</th><th>Company Name</th><th>Bid Size</th><th>Bid</th><th>Ask</th><th>Ask Size</th><th>Last</th><th>Change %</th></tr></thead><tbody>${FAVORITES.map((symbol) => {
      const q = quote(symbol);
      return `<tr data-symbol="${q.symbol}" class="${state.selected === q.symbol ? "selected" : ""}"><td><b>${q.symbol}</b></td><td>${escapeHtml(q.name)}</td><td>${sizeFor(q.symbol, "b")}</td><td>${number(q.bid, q.dp)}</td><td>${number(q.ask, q.dp)}</td><td>${sizeFor(q.symbol, "a")}</td><td class="${tone(q.chg)} ib-tick-${q.dir > 0 ? "up" : q.dir < 0 ? "down" : "flat"}">${number(q.last, q.dp)}</td><td class="${tone(q.pct)}">${signed(q.pct, "%")}</td></tr>`;
    }).join("")}</tbody></table>`;
  }

  function miniWatch() {
    return FAVORITES.map((symbol) => {
      const q = quote(symbol);
      return `<button data-symbol="${q.symbol}" class="${state.selected === q.symbol ? "selected" : ""}"><span><b>${q.symbol}</b><small>${escapeHtml(q.name)}</small></span><span><b>${number(q.last, q.dp)}</b><small class="${tone(q.pct)}">${signed(q.pct, "%")}</small></span></button>`;
    }).join("");
  }

  function quoteRail(detailed = false) {
    const q = quote(state.selected);
    const pos = state.account.positions[q.symbol];
    return `
      <aside class="ib-quote-rail">
        <header><span>${escapeHtml(q.name.slice(0, 26))}${q.name.length > 26 ? "…" : ""}</span><span>${q.kind || "Equity"} &nbsp; 🇺🇸</span></header>
        <div class="ib-quote-name"><b>${q.symbol}</b><span>☆ &nbsp; ♥</span></div>
        <div class="ib-big-price"><b class="${tone(q.chg)} ib-tick-${q.dir > 0 ? "up" : q.dir < 0 ? "down" : "flat"}">${number(q.last, q.dp)}</b><small>x${sizeFor(q.symbol, "x")}</small><span class="${tone(q.chg)}">${signed(q.chg, "", q.dp)} &nbsp; ${signed(q.pct, "%")}</span><div><small>Ask</small><b class="down">${number(q.ask, q.dp)}</b><small>Bid</small><b class="blue">${number(q.bid, q.dp)}</b></div></div>
        <div class="ib-realtime">${state.live ? "REALTIME PRICE: NON-CONSOLIDATED" : "SIMULATED SNAPSHOT"} <b>⟳ ${state.live ? "LIVE" : "SIM"}</b></div>
        <div class="ib-order-buttons"><button data-order="BUY">Buy Order</button><button data-order="SELL">Sell Order</button><button title="Rapid order">ϟ</button></div>
        ${pos ? `<div class="ib-position-line">Position <b class="${pos.qty < 0 ? "down" : "blue"}">${number(pos.qty, 0)}</b> @ ${number(pos.avgCost)} &nbsp; Unrlzd <b class="${tone((q.last - pos.avgCost) * pos.qty)}">${signed((q.last - pos.avgCost) * pos.qty, "", 0)}</b></div>` : ""}
        <div class="ib-quote-stats"><div><span>Opening Price <b>${q.open != null ? number(q.open, q.dp) : "--"}</b></span><span>Prior Close <b>${q.prevClose != null ? number(q.prevClose, q.dp) : "--"}</b></span><span>High <b>${q.high != null ? number(q.high, q.dp) : "--"}</b></span><span>Low <b>${q.low != null ? number(q.low, q.dp) : "--"}</b></span><span>52 Wk Hgh <b>${q.high52 != null ? number(q.high52, q.dp) : "--"}</b></span><span>52 Wk Lw <b>${q.low52 != null ? number(q.low52, q.dp) : "--"}</b></span></div><div><span>Volume <b>${compact(q.volume)}</b></span><span>Exchange <b>${q.exchange || "SMART"}</b></span><span>Kind <b>${q.kind || "Equity"}</b></span><span>Data <b class="${state.live ? "up" : "down"}">${q.src === "live" ? "LIVE" : "SIM"}</b></span><span>Updated <b>${q.t ? clock(q.t) : "--"}</b></span><span>Spread <b>${number(q.ask - q.bid, q.dp)}</b></span></div></div>
        ${detailed ? `<article class="ib-connections"><h3>${q.symbol} Connections ›</h3><p>Discover related companies, sectors, and tradable instruments.</p><button>Open the Connections Tab</button></article>` : ""}
        <div class="ib-rail-chart"><div>${RAIL_RANGES.map(([label]) => `<button data-rail-range="${label}" class="${state.railRange === label ? "active" : ""}">${label}</button>`).join("")}</div><canvas class="ib-line-chart" data-rail-symbol="${q.symbol}"></canvas></div>
      </aside>`;
  }

  function orderEntry() {
    const q = quote(state.selected);
    const pos = state.account.positions[q.symbol];
    const stats = accountStats();
    return `<div class="ib-order-entry" data-entry-side="BUY">
      <input data-entry-search placeholder="⌕ Search">
      <h3>${q.symbol} <small>${escapeHtml(q.name)}</small></h3>
      <div class="ib-bidask">Last <b class="${tone(q.chg)}">${number(q.last, q.dp)}</b><br>Change <b class="${tone(q.chg)}">${signed(q.chg, "", q.dp)} ${signed(q.pct, "%")}</b><br>Ask <b class="down">${sizeFor(q.symbol, "a")} × ${number(q.ask, q.dp)}</b><br>Bid <b class="blue">${sizeFor(q.symbol, "b")} × ${number(q.bid, q.dp)}</b></div>
      <div class="ib-order-tabs"><button data-entry-tab="BUY" class="active">Buy Order</button><button data-entry-tab="SELL">Sell Order</button></div>
      <p>Account <b>DU•••••74</b> &nbsp; Position <b>${pos ? number(pos.qty, 0) : "-"}</b></p>
      <p>Available Funds <b>${compact(Math.max(0, stats.cash))}</b></p>
      <label>Quantity <input data-entry-qty type="number" min="1" value="100"> Shares</label>
      <div class="ib-order-types">${["Limit", "Market"].map((t) => `<button data-entry-type="${t}" class="${t === "Limit" ? "active" : ""}">${t}</button>`).join("")}</div>
      <label>Limit Price <input data-entry-limit type="number" step="0.01" value="${(q.ask).toFixed(2)}"></label>
      <button class="ib-submit-order" data-entry-submit>Submit Order</button>
    </div>`;
  }

  function newsList() {
    const items = (state.news?.items ?? []).slice(0, 5);
    return `<input placeholder="⌕ Search"><h4>Latest News ${state.news?.src === "live" ? "" : "(sim)"}</h4>${items.map((n) => `<p><small>${clock(n.t)}</small> &nbsp; <b>${escapeHtml(n.source)}</b> ${escapeHtml(n.headline)}</p>`).join("") || "<p>Loading headlines…</p>"}`;
  }

  function eventsRail() {
    return `<aside class="ib-events"><header>World Exchanges <small>${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} at ${clock(Date.now())} GMT+8</small></header><img src="/images/ibkr/world-exchanges.png" alt=""><h3>SEHK : <b>CLOSED</b> &nbsp; | &nbsp; NYSE : <b>CLOSED</b><br>LSE : <strong>OPEN</strong></h3><div class="ib-events-title"><b>Upcoming Events &nbsp; US⌄</b><a>All Events</a></div><div class="ib-event-tabs">EARNINGS &nbsp;&nbsp; ECONOMIC &nbsp;&nbsp; DIVIDENDS &nbsp;&nbsp; IPOs</div>${["CHWY Q1 2026 Chewy Inc Earnings", "CMCM Q1 2026 Cheetah Mobile", "CNM Q1 2026 Core & Main Inc", "JILL Q1 2026 J.Jill Inc Earnings", "RMSL Q1 2026 REMSleep Holdings", "SMID Q1 2026 Smith-Midland Corp", "VGES Q3 2026 Vanguard Green", "YB Q1 2026 Yuanbao Inc Earnings", "ADMIE Q1 2026 Holding Company", "ANIX Q2 2026 Anixa Biosciences"].map((x) => `<p><small>08:30 PM</small> <b>${x.split(" ")[0]}</b> ${x.split(" ").slice(1).join(" ")}</p>`).join("")}</aside>`;
  }

  /* ================= page wiring ================= */

  function bindPage() {
    root.querySelectorAll("[data-symbol]").forEach((row) => row.addEventListener("click", () => {
      state.selected = row.dataset.symbol;
      renderPage();
    }));
    root.querySelectorAll("[data-order]").forEach((button) => button.addEventListener("click", (event) => {
      event.stopPropagation();
      showOrder(button.dataset.order);
    }));
    root.querySelectorAll("[data-portfolio-tab]").forEach((button) => button.addEventListener("click", () => {
      state.portfolioTab = button.dataset.portfolioTab;
      renderPage();
    }));
    root.querySelectorAll("[data-range]").forEach((button) => button.addEventListener("click", () => {
      state.chartRange = button.dataset.range;
      renderPage();
    }));
    root.querySelectorAll("[data-rail-range]").forEach((button) => button.addEventListener("click", () => {
      state.railRange = button.dataset.railRange;
      renderPage();
    }));
    root.querySelectorAll("[data-cancel-order]").forEach((button) => button.addEventListener("click", (event) => {
      event.stopPropagation();
      cancelOrder(button.dataset.cancelOrder);
      toast("Order cancelled");
      renderPage();
    }));
    root.querySelector("[data-reset-account]")?.addEventListener("click", showResetAccount);
    root.querySelector("[data-refresh]")?.addEventListener("click", () => refreshQuotes());
    bindOrderEntry();
  }

  function bindOrderEntry() {
    const entry = root.querySelector("[data-entry-side]");
    if (!entry) return;
    entry.querySelectorAll("[data-entry-tab]").forEach((button) => button.addEventListener("click", () => {
      entry.dataset.entrySide = button.dataset.entryTab;
      entry.querySelectorAll("[data-entry-tab]").forEach((b) => b.classList.toggle("active", b === button));
    }));
    entry.querySelectorAll("[data-entry-type]").forEach((button) => button.addEventListener("click", () => {
      entry.querySelectorAll("[data-entry-type]").forEach((b) => b.classList.toggle("active", b === button));
      entry.querySelector("[data-entry-limit]").disabled = button.dataset.entryType === "Market";
    }));
    entry.querySelector("[data-entry-search]").addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      const symbol = event.currentTarget.value.trim().toUpperCase();
      if (state.quotes.has(symbol)) {
        state.selected = symbol;
        renderPage();
      } else {
        toast(`No match for "${symbol}"`);
      }
    });
    entry.querySelector("[data-entry-submit]").addEventListener("click", () => {
      const side = entry.dataset.entrySide;
      const type = entry.querySelector("[data-entry-type].active").dataset.entryType;
      const qty = entry.querySelector("[data-entry-qty]").value;
      const limit = entry.querySelector("[data-entry-limit]").value;
      const result = placeOrder(state.selected, side, qty, type, limit);
      if (result.error) return toast(result.error);
      toast(result.order.status === "Filled"
        ? `${side} ${result.order.qty} ${state.selected} filled @ ${number(result.order.fillPrice)}`
        : `${side} ${result.order.qty} ${state.selected} working @ ${number(result.order.limit)}`);
      renderPage();
      updateTopbar();
    });
  }

  // Async fill-in after a page render: history-backed charts + sparklines.
  async function hydratePage() {
    const seq = ++state.renderSeq;
    drawVisibleCharts();
    const candleCanvas = root.querySelector("[data-chart-symbol]");
    if (candleCanvas) {
      const rangeKey = CHART_RANGES.includes(state.chartRange) ? state.chartRange : "1D";
      const data = await loadHistory(candleCanvas.dataset.chartSymbol, rangeKey);
      if (seq !== state.renderSeq) return;
      root.querySelectorAll("[data-chart-symbol]").forEach((canvas) => {
        canvas._series = data.candles;
        canvas._range = rangeKey;
        drawCandles(canvas);
      });
      const lastCandle = data.candles[data.candles.length - 1];
      const ohlc = root.querySelector("[data-ohlc]");
      if (ohlc && lastCandle) {
        const q = quote(state.selected);
        ohlc.textContent = `O${number(lastCandle.o, q.dp)} H${number(lastCandle.h, q.dp)} L${number(lastCandle.l, q.dp)} C${number(lastCandle.c, q.dp)}`;
        ohlc.className = tone(lastCandle.c - lastCandle.o);
        const vol = root.querySelector("[data-chartvol]");
        if (vol) vol.textContent = compact(lastCandle.v);
      }
    }
    const railCanvas = root.querySelector("[data-rail-symbol]");
    if (railCanvas) {
      const symbol = railCanvas.dataset.railSymbol;
      const railKey = RAIL_RANGES.find(([label]) => label === state.railRange)?.[1] ?? "1D";
      const sparkOk = state.railRange === "Today" && quote(symbol).spark?.length > 1;
      const points = sparkOk
        ? quote(symbol).spark
        : (await loadHistory(symbol, railKey)).candles.map((c) => c.c);
      if (seq !== state.renderSeq) return;
      railCanvas._points = points;
      drawLine(railCanvas);
    }
  }

  /* ================= drawing ================= */

  function drawVisibleCharts() {
    root.querySelectorAll(".ib-candle-chart").forEach((canvas) => drawCandles(canvas));
    root.querySelectorAll(".ib-line-chart").forEach((canvas) => {
      if (!canvas._points) {
        const symbol = canvas.dataset.railSymbol || canvas.dataset.sparkSymbol;
        const spark = symbol ? state.quotes.get(symbol)?.spark : null;
        if (spark?.length > 1) canvas._points = spark;
      }
      drawLine(canvas);
    });
    root.querySelectorAll(".ib-spark-cell").forEach((canvas) => {
      const spark = state.quotes.get(canvas.dataset.sparkSymbol)?.spark;
      if (spark?.length > 1) drawSpark(canvas, spark);
    });
  }

  function prepareCanvas(canvas) {
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, rect.width * ratio);
    canvas.height = Math.max(1, rect.height * ratio);
    const context = canvas.getContext("2d");
    context.scale(ratio, ratio);
    return { context, width: rect.width, height: rect.height };
  }

  function drawCandles(canvas) {
    const series = canvas._series ?? [];
    const { context: ctx, width, height } = prepareCanvas(canvas);
    if (width < 10 || height < 10) return;
    const pad = { l: 20, r: 56, t: 18, b: 34 };
    if (!series.length) {
      ctx.fillStyle = "#9aa0a8"; ctx.font = "13px Arial";
      ctx.fillText("Loading chart…", pad.l + 8, height / 2);
      return;
    }
    const plotWidth = width - pad.l - pad.r;
    const maxBars = Math.max(20, Math.floor(plotWidth / 7));
    const candles = series.slice(-maxBars);
    const dp = quote(state.selected).dp;
    const values = candles.flatMap((c) => [c.h, c.l]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = Math.max(max - min, max * 0.0005);
    const y = (v) => pad.t + (max - v) / span * (height - pad.t - pad.b);
    ctx.strokeStyle = "#e3e5e8"; ctx.lineWidth = 1;
    for (let i = 0; i < 6; i += 1) {
      const yy = pad.t + i * (height - pad.t - pad.b) / 5;
      ctx.beginPath(); ctx.moveTo(pad.l, yy); ctx.lineTo(width - pad.r, yy); ctx.stroke();
    }
    const step = plotWidth / candles.length;
    candles.forEach((c, i) => {
      const x = pad.l + i * step + step / 2;
      const color = c.c >= c.o ? "#0b9c55" : "#e21b2c";
      ctx.strokeStyle = color; ctx.fillStyle = color;
      ctx.beginPath(); ctx.moveTo(x, y(c.h)); ctx.lineTo(x, y(c.l)); ctx.stroke();
      const top = Math.min(y(c.o), y(c.c));
      ctx.fillRect(x - Math.max(1.5, step * .3), top, Math.max(3, step * .6), Math.max(1.5, Math.abs(y(c.o) - y(c.c))));
    });
    ctx.fillStyle = "#333"; ctx.font = "12px Arial";
    [max, (max + min) / 2, min].forEach((v, i) => ctx.fillText(number(v, dp), width - pad.r + 6, pad.t + i * (height - pad.t - pad.b) / 2 + 4));
    // time axis: first / middle / last bar
    const intraday = ["1D", "5D"].includes(canvas._range ?? "1D");
    const fmt = (t) => intraday
      ? clock(t)
      : new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    ctx.fillStyle = "#7a7f86";
    [[0, pad.l], [Math.floor(candles.length / 2), pad.l + plotWidth / 2 - 18], [candles.length - 1, width - pad.r - 40]].forEach(([idx, x]) => {
      if (candles[idx]?.t) ctx.fillText(fmt(candles[idx].t), x, height - 12);
    });
  }

  function drawLine(canvas) {
    const points = canvas._points ?? [];
    const { context: ctx, width, height } = prepareCanvas(canvas);
    if (width < 10 || height < 10 || points.length < 2) return;
    const min = Math.min(...points); const max = Math.max(...points);
    const up = points[points.length - 1] >= points[0];
    ctx.strokeStyle = up ? "#0b9c55" : "#e21b2c"; ctx.lineWidth = 2;
    ctx.beginPath();
    points.forEach((value, i) => {
      const x = 6 + i * (width - 12) / (points.length - 1);
      const y = 10 + (max - value) / Math.max(.01, max - min) * (height - 22);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.lineTo(width - 6, height - 4); ctx.lineTo(6, height - 4); ctx.closePath();
    ctx.fillStyle = up ? "rgba(11,156,85,.08)" : "rgba(226,27,44,.08)";
    ctx.fill();
  }

  function drawSpark(canvas, points) {
    const { context: ctx, width, height } = prepareCanvas(canvas);
    if (width < 5 || height < 5 || points.length < 2) return;
    const min = Math.min(...points); const max = Math.max(...points);
    ctx.strokeStyle = points[points.length - 1] >= points[0] ? "#0b9c55" : "#e21b2c";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    points.forEach((value, i) => {
      const x = 2 + i * (width - 4) / (points.length - 1);
      const y = 2 + (max - value) / Math.max(.0001, max - min) * (height - 4);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  /* ================= modals & toasts ================= */

  function showOrder(side) {
    const q = quote(state.selected);
    const layer = showModal(`
      <h2 class="${side === "BUY" ? "blue" : "down"}">${side === "BUY" ? "Buy" : "Sell"} ${q.symbol}</h2><p>${escapeHtml(q.name)}</p>
      <label>Quantity<input data-m-qty value="100" type="number" min="1"></label>
      <label>Order Type<select data-m-type><option>Limit</option><option>Market</option></select></label>
      <label>Limit Price<input data-m-limit type="number" step="0.01" value="${(side === "BUY" ? q.ask : q.bid).toFixed(2)}"></label>
      <p class="ib-est">Est. ${side === "BUY" ? "cost" : "proceeds"} <b data-m-est>--</b></p>
      <div><button data-cancel>Cancel</button><button class="${side === "BUY" ? "buy" : "sell"}" data-m-submit>Submit Order</button></div>`);
    const qtyInput = layer.querySelector("[data-m-qty]");
    const typeInput = layer.querySelector("[data-m-type]");
    const limitInput = layer.querySelector("[data-m-limit]");
    const est = layer.querySelector("[data-m-est]");
    const updateEst = () => {
      const type = typeInput.value;
      limitInput.disabled = type === "Market";
      const px = type === "Market" ? (side === "BUY" ? q.ask : q.bid) : Number(limitInput.value);
      const qty = Number(qtyInput.value);
      est.textContent = Number.isFinite(px) && qty > 0 ? number(px * qty, 0) + " USD" : "--";
    };
    [qtyInput, typeInput, limitInput].forEach((el) => el.addEventListener("input", updateEst));
    updateEst();
    layer.querySelector("[data-m-submit]").addEventListener("click", () => {
      const result = placeOrder(q.symbol, side, qtyInput.value, typeInput.value, limitInput.value);
      if (result.error) {
        layer.querySelector(".ib-est b").textContent = result.error;
        return;
      }
      const o = result.order;
      layer.innerHTML = `<div class="ib-modal"><h2>${o.status === "Filled" ? "Order Filled" : "Order Working"}</h2><p>${o.side} ${number(o.qty, 0)} ${o.symbol} ${o.type}${o.limit != null ? ` @ ${number(o.limit)}` : ""}${o.fillPrice != null ? ` — filled @ <b>${number(o.fillPrice)}</b>` : " — waiting for marketable price"}.</p><p class="ib-fineprint">Simulated execution. No brokerage order was transmitted.</p><div><button data-cancel>Done</button></div></div>`;
      layer.querySelector("[data-cancel]").addEventListener("click", () => {
        layer.hidden = true; layer.innerHTML = "";
        renderPage();
        updateTopbar();
      });
    });
  }

  function showSettings() {
    const layer = showModal(`<h2>Display Settings</h2><label>Theme<select><option>Light</option><option>Dark</option></select></label><label>Text Size<select><option>Default</option><option>Large</option></select></label><div><button data-reset-modal>Reset Paper Account</button><button data-logout>Log Out</button><button data-cancel>Close</button></div>`);
    layer.querySelector("[data-logout]").addEventListener("click", () => {
      layer.hidden = true;
      state.screen = "login";
      renderLogin();
    });
    layer.querySelector("[data-reset-modal]").addEventListener("click", () => {
      layer.hidden = true; layer.innerHTML = "";
      showResetAccount();
    });
  }

  function showResetAccount() {
    const layer = showModal(`<h2>Reset Paper Account?</h2><p>This clears all simulated positions, orders, and trade history, and restores the starting cash of ${number(DEFAULT_ACCOUNT.cash, 0)} USD.</p><div><button data-cancel>Keep Account</button><button class="sell" data-do-reset>Reset</button></div>`);
    layer.querySelector("[data-do-reset]").addEventListener("click", () => {
      state.account = structuredClone(DEFAULT_ACCOUNT);
      saveAccount();
      layer.hidden = true; layer.innerHTML = "";
      toast("Paper account reset");
      renderPage();
      updateTopbar();
    });
  }

  function showNotice(message) {
    showModal(`<h2>${message}</h2><p>This interactive prototype keeps support actions local.</p><div><button data-cancel>Close</button></div>`);
  }

  function showModal(contents) {
    const layer = root.querySelector(".ib-modal-layer");
    layer.hidden = false;
    layer.innerHTML = `<div class="ib-modal" role="dialog" aria-modal="true">${contents}</div>`;
    layer.querySelectorAll("[data-cancel]").forEach((button) => button.addEventListener("click", () => {
      layer.hidden = true; layer.innerHTML = "";
    }));
    layer.addEventListener("pointerdown", (event) => {
      if (event.target === layer) { layer.hidden = true; layer.innerHTML = ""; }
    }, { once: true });
    return layer;
  }

  function toast(message) {
    const host = root.querySelector(".ib-toast-host");
    if (!host) return;
    const node = element(`<div class="ib-toast">${escapeHtml(message)}</div>`);
    host.appendChild(node);
    state.timers.push(setTimeout(() => node.remove(), 3500));
  }

  function destroy() {
    state.timers.forEach((timer) => { clearTimeout(timer); clearInterval(timer); });
    state.timers = [];
  }

  renderLogin();
  return { root, start() {}, destroy, redraw: drawVisibleCharts };
}

/* ================= helpers ================= */

// Map a worker /api/quotes row (or seed row) into the app's quote shape,
// synthesizing a display bid/ask and tick direction against the prior value.
function normalizeQuote(row, prior) {
  const last = Number(row.last ?? prior?.last ?? 0);
  const dp = last > 0 && last < 10 ? 4 : 2;
  const spread = Math.max(last < 10 ? 0.0002 : 0.01, last * 0.00012);
  return {
    symbol: row.symbol,
    name: row.name ?? prior?.name ?? row.symbol,
    kind: row.kind ?? prior?.kind ?? "Equity",
    last,
    chg: Number(row.chg ?? prior?.chg ?? 0),
    pct: Number(row.chgPct ?? row.pct ?? prior?.pct ?? 0),
    open: row.open ?? prior?.open ?? null,
    high: row.high ?? prior?.high ?? null,
    low: row.low ?? prior?.low ?? null,
    prevClose: row.prevClose ?? prior?.prevClose ?? (Number.isFinite(last - (row.chg ?? 0)) ? last - (row.chg ?? prior?.chg ?? 0) : null),
    high52: row.high52 ?? prior?.high52 ?? null,
    low52: row.low52 ?? prior?.low52 ?? null,
    volume: row.volume ?? prior?.volume ?? null,
    exchange: row.exchange ?? prior?.exchange ?? null,
    spark: row.spark ?? prior?.spark ?? null,
    src: row.src ?? prior?.src ?? "seed",
    t: row.t ?? Date.now(),
    bid: Number((last - spread).toFixed(dp === 4 ? 4 : 2)),
    ask: Number((last + spread).toFixed(dp === 4 ? 4 : 2)),
    dir: prior?.last ? Math.sign(last - prior.last) : 0,
    dp,
  };
}

function wordmark() {
  return `<div class="ib-wordmark"><img class="ib-wordmark-logo" src="/images/ibkr/ib-logo-text-white.png" alt="Interactive Brokers"></div>`;
}

function escapeHtml(value) {
  const span = document.createElement("span");
  span.textContent = value ?? "";
  return span.innerHTML;
}
