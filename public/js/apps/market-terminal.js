/**
 * Bloomberg Professional — function-page terminal modeled on the real thing.
 *
 * Architecture: login screen -> shell (command line, security banner,
 * function page, bottom function bar). Every view is a "function" reached
 * from the command line, exactly like the terminal:
 *
 *   <SYM>            select security, show GP
 *   <SYM> <FN>       run function for security  (NVDA DES)
 *   <FN>             run function for current security
 *   MAIN W WEI GP DES FA N HELP OFF
 *
 * Live data from /api/quotes, /api/history, /api/news with tagged SIM
 * fallback. No real credentials are used or stored.
 */

const fmt = (x, dp) =>
  x == null ? "—" : x.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });

const dpOf = (price) => (price == null ? 2 : price >= 1000 ? 2 : price < 10 ? 4 : 2);
const signCls = (x) => (x > 0 ? "up" : x < 0 ? "down" : "flat");
const arrow = (x) => (x > 0 ? "▲" : x < 0 ? "▼" : "–");
const hhmm = (t) => {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const RANGES = ["1D", "5D", "1M", "6M", "1Y"];

const FUNCTIONS = [
  ["MAIN", "Main Menu", "终端主菜单"],
  ["W", "Watchlist Monitor", "自选股监控"],
  ["WEI", "World Markets", "全球市场指数"],
  ["GP", "Price Graph", "价格图表"],
  ["DES", "Security Description", "证券描述"],
  ["FA", "Financial Analysis", "财务分析"],
  ["N", "Top News", "头条新闻"],
  ["HELP", "Function Directory", "功能列表"],
  ["OFF", "Log Off", "退出登录"],
];

const DES_BLURB = {
  AAPL: "Apple Inc. designs, manufactures and markets smartphones, personal computers, tablets, wearables and accessories, and sells a variety of related services including the App Store, iCloud and Apple Pay.",
  MSFT: "Microsoft Corp. develops and licenses software, services, devices and solutions, including Windows, Office, Azure cloud infrastructure, LinkedIn and gaming via Xbox.",
  NVDA: "NVIDIA Corp. provides graphics, compute and networking solutions. Its GPUs and CUDA platform power gaming, professional visualization, data centers and the build-out of accelerated AI infrastructure worldwide.",
  TSLA: "Tesla Inc. designs, develops, manufactures and sells fully electric vehicles, energy generation and storage systems, and related services including autonomous driving software.",
  AMZN: "Amazon.com Inc. engages in retail e-commerce, third-party seller services, advertising, subscriptions and cloud computing through Amazon Web Services.",
  GOOGL: "Alphabet Inc. is the holding company of Google, providing web search, advertising, Android, YouTube, Google Cloud and Other Bets technology ventures.",
  META: "Meta Platforms Inc. builds applications and technologies that help people connect and share, including Facebook, Instagram, WhatsApp and the Reality Labs hardware division.",
  SPX: "The S&P 500 Index is a capitalization-weighted index of 500 leading U.S. publicly traded companies, widely used as the benchmark for U.S. large-cap equities.",
  NDX: "The NASDAQ 100 Index is a modified capitalization-weighted index of the 100 largest non-financial companies listed on the NASDAQ stock market.",
  DJI: "The Dow Jones Industrial Average is a price-weighted average of 30 blue-chip U.S. companies, the oldest continuing U.S. market index.",
  EURUSD: "Euro / U.S. Dollar cross rate. The most actively traded currency pair in the global foreign exchange market.",
  USDJPY: "U.S. Dollar / Japanese Yen cross rate, a major FX pair and barometer of rate differentials between the Fed and the Bank of Japan.",
  GLD: "COMEX Gold Futures, $/troy oz. The benchmark exchange-traded contract for gold price discovery.",
  WTI: "NYMEX West Texas Intermediate Crude Oil Futures, the benchmark U.S. light sweet crude oil contract.",
  BTC: "Bitcoin / U.S. Dollar. The largest cryptocurrency by market capitalization, traded 24/7 on global venues.",
  ETH: "Ethereum / U.S. Dollar. Native asset of the Ethereum smart-contract network, second-largest cryptocurrency by market capitalization.",
};

const KIND_GROUPS = [
  ["指数 INDICES", (s) => s.kind === "Index"],
  ["商品 COMMODITIES", (s) => s.kind === "Cmdty"],
  ["外汇 FX", (s) => s.kind === "FX"],
  ["加密货币 CRYPTO", (s) => s.kind === "Crypto"],
];

/* deterministic pseudo financials so FA is stable between sessions */
function hash32(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function rng(seed) {
  let s = seed;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export function createMarketTerminal() {
  const saved = (() => {
    try { return JSON.parse(localStorage.getItem("sewingos.bbg")) ?? {}; } catch { return {}; }
  })();

  const state = {
    logged: saved.session === true,
    sec: saved.sec ?? "NVDA",
    fn: saved.fn ?? "MAIN",
    range: saved.range ?? "1D",
    chartType: saved.type ?? "candle",
    monFilter: "ALL",
    newsFilter: "",
    quotes: new Map(),
    prevLast: new Map(),
    candles: [],
    histMeta: null,
    histSrc: null,
    news: [],
    newsSrc: null,
    read: new Set(saved.read ?? []),
    timers: [],
    crosshair: null,
    acIndex: 0,
  };

  const persist = () => {
    localStorage.setItem("sewingos.bbg", JSON.stringify({
      session: state.logged, sec: state.sec, fn: state.fn,
      range: state.range, type: state.chartType, read: [...state.read].slice(-200),
    }));
  };

  const root = el(`<div class="bbg"></div>`);
  const $ = (sel) => root.querySelector(sel);
  const $$ = (sel) => [...root.querySelectorAll(sel)];
  new ResizeObserver(() => root.classList.toggle("narrow", root.clientWidth < 880)).observe(root);

  /* ================= login ================= */

  function renderLogin() {
    root.innerHTML = `
      <div class="bbg-login">
        <div class="bbg-login-inner">
          <div class="bbg-wordmark">Bloomberg</div>
          <div class="bbg-login-cols">
            <form class="bbg-login-form">
              <label>登录名</label>
              <input class="bbg-user" autocomplete="off" spellcheck="false" aria-label="Login name">
              <label>密码</label>
              <div class="bbg-pass-wrap">
                <input class="bbg-pass" type="password" autocomplete="off" aria-label="Password">
                <span class="bbg-eye" title="Show">👁</span>
              </div>
              <button type="submit" class="bbg-login-btn">登 录</button>
              <div class="bbg-login-links">
                <span>忘记登录名？</span>
                <span>忘记密码？</span>
              </div>
              <div class="bbg-login-contact">
                <span>✆ 联系我们</span>
                <span>👤 新建登录名</span>
              </div>
            </form>
            <div class="bbg-langs">
              <p>选择分析功能和交流所用的语言：</p>
              <div class="bbg-lang-grid">
                <span>English</span><span>Português</span><span>Русский</span>
                <span>日本語</span><span>Italiano</span><span>Polski</span>
                <span>Français</span><span>繁體中文</span><span class="on">✓ 简体中文</span>
                <span>Deutsch</span><span>한국어</span><span>Türkçe</span>
                <span>Español</span>
              </div>
              <p class="bbg-lang-note">欲自设您浏览期间的语言设定，请在登录后键入LANG &lt;GO&gt;。</p>
            </div>
          </div>
          <div class="bbg-login-sn">S/N 257007-0 | SID: 5015815-3 | Version 27.0.612 | Netid SEWING</div>
          <div class="bbg-login-legal">The SEWINGOS TERMINAL service and data products are provided for demonstration only.
            Market data is delayed or simulated and is not investment advice. No account is created and no
            credentials are transmitted or stored. Any name and password will enter the simulation.</div>
        </div>
      </div>`;
    $(".bbg-login-form").addEventListener("submit", (e) => {
      e.preventDefault();
      renderConnecting();
      state.timers.push(setTimeout(() => {
        state.logged = true;
        persist();
        renderShell();
      }, 900));
    });
    $(".bbg-eye").addEventListener("pointerdown", () => { $(".bbg-pass").type = "text"; });
    $(".bbg-eye").addEventListener("pointerup", () => { $(".bbg-pass").type = "password"; });
    setTimeout(() => $(".bbg-user")?.focus(), 60);
  }

  function renderConnecting() {
    root.innerHTML = `
      <div class="bbg-login">
        <div class="bbg-login-inner bbg-connecting">
          <div class="bbg-wordmark">Bloomberg</div>
          <div class="bbg-conn-msg">正在连接 SEWING 节点 …<br><span>Negotiating session keys</span></div>
          <div class="bbg-conn-bar"><i></i></div>
          <div class="bbg-login-sn">S/N 257007-0 | SID: 5015815-3 | Version 27.0.612 | Netid SEWING</div>
        </div>
      </div>`;
  }

  /* ================= shell ================= */

  function renderShell() {
    root.innerHTML = `
      <div class="bbg-shell">
        <div class="bbg-cmdrow">
          <span class="bbg-cmd-cue"></span>
          <input class="bbg-cmd" placeholder="键入功能代码，按 <GO>　·　NVDA GP · DES · FA · N · HELP" spellcheck="false" autocomplete="off">
          <button class="bbg-go">&lt;GO&gt;</button>
          <span class="bbg-clock"></span>
          <div class="bbg-ac" hidden></div>
        </div>
        <div class="bbg-secbar">
          <span class="bbg-sec-name"></span>
          <span class="bbg-sec-fn"></span>
          <span class="bbg-sec-msg"></span>
          <span class="bbg-sec-quote"></span>
        </div>
        <div class="bbg-page"></div>
        <div class="bbg-fnbar">
          <div class="bbg-fnbtns">
            ${FUNCTIONS.filter(([c]) => c !== "OFF").map(([c, en]) =>
              `<button data-fn="${c}" title="${en}">${c}</button>`).join("")}
          </div>
          <span class="bbg-feed"></span>
          <span class="bbg-sn">SEWING TERMINAL · S/N 257007-0</span>
        </div>
      </div>`;

    const cmd = $(".bbg-cmd");
    cmd.addEventListener("keydown", onCmdKey);
    cmd.addEventListener("input", renderAC);
    cmd.addEventListener("blur", () => setTimeout(hideAC, 150));
    $(".bbg-go").addEventListener("click", () => runCmd(cmd.value));
    $$(".bbg-fnbtns button").forEach((b) =>
      b.addEventListener("click", () => exec(b.dataset.fn)));

    // typing anywhere jumps to the command line, like the real terminal
    root.addEventListener("keydown", (e) => {
      if (e.target === cmd || e.target.closest("input, textarea")) return;
      if (e.key.length === 1 && /[\w.]/.test(e.key) && !e.metaKey && !e.ctrlKey) cmd.focus();
    });

    renderSecbar();
    renderPage();
    renderFeed();
    tickClock();
  }

  /* ---------- command line ---------- */

  function acItems() {
    const q = $(".bbg-cmd").value.trim().toUpperCase();
    if (!q) return [];
    const syms = [...state.quotes.values()]
      .filter((s) => s.symbol.startsWith(q) || s.name.toUpperCase().includes(q))
      .slice(0, 5)
      .map((s) => ({ code: s.symbol, label: `${s.name}`, tag: kindTag(s), run: () => exec("GP", s.symbol) }));
    const fns = FUNCTIONS
      .filter(([c, en, cn]) => c.startsWith(q) || en.toUpperCase().includes(q))
      .map(([c, en, cn]) => ({ code: c, label: `${cn} ${en}`, tag: "FUNC", run: () => exec(c) }));
    return [...syms, ...fns].slice(0, 8);
  }

  function renderAC() {
    const box = $(".bbg-ac");
    const items = acItems();
    if (!items.length) { box.hidden = true; return; }
    state.acIndex = Math.min(state.acIndex, items.length - 1);
    box.hidden = false;
    box.innerHTML = items.map((it, i) => `
      <div class="bbg-ac-row ${i === state.acIndex ? "sel" : ""}" data-i="${i}">
        <b>${esc(it.code)}</b><span>${esc(it.label)}</span><i>${it.tag}</i>
      </div>`).join("");
    box.querySelectorAll(".bbg-ac-row").forEach((r) =>
      r.addEventListener("pointerdown", (e) => { e.preventDefault(); items[Number(r.dataset.i)].run(); clearCmd(); }));
  }

  function hideAC() { const b = $(".bbg-ac"); if (b) b.hidden = true; }
  function clearCmd() { const c = $(".bbg-cmd"); c.value = ""; hideAC(); state.acIndex = 0; }

  function onCmdKey(e) {
    const box = $(".bbg-ac");
    const items = acItems();
    if (e.key === "ArrowDown" && items.length) { state.acIndex = (state.acIndex + 1) % items.length; renderAC(); e.preventDefault(); return; }
    if (e.key === "ArrowUp" && items.length) { state.acIndex = (state.acIndex - 1 + items.length) % items.length; renderAC(); e.preventDefault(); return; }
    if (e.key === "Escape") { hideAC(); return; }
    if (e.key === "Enter") {
      if (!box.hidden && items[state.acIndex] && e.target.value.trim() &&
          !state.quotes.has(e.target.value.trim().toUpperCase().split(/\s+/)[0])) {
        items[state.acIndex].run();
        clearCmd();
        return;
      }
      runCmd(e.target.value);
      clearCmd();
    }
  }

  function runCmd(line) {
    const parts = line.trim().toUpperCase().split(/\s+/).filter(Boolean);
    if (!parts.length) return;
    const [a, b] = parts;
    const isFn = (x) => FUNCTIONS.some(([c]) => c === x) || x === "MON" || x === "MOST" || x === "NEWS";
    if (state.quotes.has(a)) { exec(isFn(b) ? b : "GP", a); return; }
    if (isFn(a)) { exec(a); return; }
    flashMsg(`无效指令 INVALID: ${a} — 键入 HELP <GO>`);
  }

  function exec(fn, sym) {
    if (fn === "MON" || fn === "MOST") fn = "W";
    if (fn === "NEWS") fn = "N";
    if (fn === "OFF") { logoff(); return; }
    if (sym) state.sec = sym;
    state.fn = fn;
    persist();
    renderSecbar();
    renderPage();
  }

  function logoff() {
    state.logged = false;
    persist();
    for (const t of state.timers) { clearInterval(t); clearTimeout(t); }
    state.timers = [];
    renderLogin();
    startPolling(); // keep quotes warm behind the login screen
  }

  let msgTimer = null;
  function flashMsg(text) {
    const m = $(".bbg-sec-msg");
    if (!m) return;
    m.textContent = text;
    m.classList.add("on");
    clearTimeout(msgTimer);
    msgTimer = setTimeout(() => m.classList.remove("on"), 2600);
  }

  /* ---------- security banner ---------- */

  function kindTag(s) {
    return { Equity: "US Equity", Index: "Index", FX: "Curncy", Cmdty: "Comdty", Crypto: "Crypto" }[s.kind] ?? s.kind;
  }

  function renderSecbar() {
    const q = state.quotes.get(state.sec);
    const nameEl = $(".bbg-sec-name");
    if (!nameEl) return;
    const fnMeta = FUNCTIONS.find(([c]) => c === state.fn);
    nameEl.textContent = q ? `${q.symbol} ${kindTag(q)}` : state.sec;
    $(".bbg-sec-fn").textContent = fnMeta ? `${state.fn} » ${fnMeta[2]}` : state.fn;
    const qEl = $(".bbg-sec-quote");
    if (q) {
      const dp = dpOf(q.last);
      const s = q.chg >= 0 ? "+" : "";
      qEl.innerHTML = `
        <i class="${signCls(q.chg)}">${arrow(q.chg)} ${fmt(q.last, dp)} ${s}${fmt(q.chg, dp)} (${s}${q.chgPct ?? 0}%)</i>
        <em>O ${fmt(q.open, dp)} H ${fmt(q.high, dp)} L ${fmt(q.low, dp)}</em>
        <u class="${q.src === "live" ? "live" : "sim"}">${q.src === "live" ? "LIVE" : "SIM"}</u>`;
    } else qEl.textContent = "";
  }

  /* ---------- pages ---------- */

  function renderPage() {
    const page = $(".bbg-page");
    if (!page) return;
    $$(".bbg-fnbtns button").forEach((b) => b.classList.toggle("on", b.dataset.fn === state.fn));
    const views = { MAIN: pageMain, W: pageMonitor, WEI: pageWEI, GP: pageGP, DES: pageDES, FA: pageFA, N: pageNews, HELP: pageHelp };
    (views[state.fn] ?? pageMain)(page);
  }

  /* MAIN — numbered amber menu, like the real master menu */
  function pageMain(page) {
    const item = (n, code, cn, en, secArg) => `
      <button class="bbg-mi" data-fn="${code}" ${secArg ? `data-sym="${secArg}"` : ""}>
        <i>${n})</i><b>${code}</b><span>${cn}</span><em>${en}</em>
      </button>`;
    page.innerHTML = `
      <div class="bbg-main">
        <div class="bbg-main-head"><b>SEWING</b> 终端主菜单 — 在命令行键入代码并按 &lt;GO&gt;</div>
        <div class="bbg-main-cols">
          <div>
            <div class="bbg-sect">行情与监控 MONITORS</div>
            ${item(1, "W", "自选股监控", "Watchlist Monitor")}
            ${item(2, "WEI", "全球市场指数", "World Market Indices")}
            <div class="bbg-sect">图表与分析 CHARTS &amp; ANALYTICS</div>
            ${item(3, "GP", "价格图表", "Price Graph")}
            ${item(4, "DES", "证券描述", "Security Description")}
            ${item(5, "FA", "财务分析", "Financial Analysis")}
          </div>
          <div>
            <div class="bbg-sect">新闻 NEWS</div>
            ${item(6, "N", "头条新闻", "Top News")}
            <div class="bbg-sect">系统 SYSTEM</div>
            ${item(7, "HELP", "功能列表", "Function Directory")}
            ${item(8, "OFF", "退出登录", "Log Off")}
            <div class="bbg-sect">快速访问 QUICK SECURITIES</div>
            ${["NVDA", "AAPL", "SPX", "BTC"].map((s, i) => `
              <button class="bbg-mi" data-fn="GP" data-sym="${s}">
                <i>${9 + i})</i><b>${s}</b><span>${esc(state.quotes.get(s)?.name ?? "")}</span><em>GP</em>
              </button>`).join("")}
          </div>
        </div>
        <div class="bbg-main-foot">提示：键入证券代码（如 NVDA）直接调出图表；NVDA DES 查看描述。数据来源 Yahoo·Binance·RSS，不可用时自动转入模拟并标注 SIM。</div>
      </div>`;
    page.querySelectorAll(".bbg-mi").forEach((b) =>
      b.addEventListener("click", () => exec(b.dataset.fn, b.dataset.sym || undefined)));
  }

  /* W — full-page monitor table */
  function pageMonitor(page) {
    const FILTERS = [["ALL", "全部"], ["Equity", "股票"], ["Index", "指数"], ["FXC", "外汇/商品"], ["Crypto", "加密"]];
    page.innerHTML = `
      <div class="bbg-mon">
        <div class="bbg-toolrow">
          ${FILTERS.map(([k, cn], i) => `<button class="bbg-tab ${state.monFilter === k ? "on" : ""}" data-f="${k}">${i + 1}) ${cn}</button>`).join("")}
          <span class="bbg-toolnote">点击行选定证券 · 双击调出图表</span>
        </div>
        <div class="bbg-mon-scroll">
          <table class="bbg-table">
            <thead><tr>
              <th class="l">证券 SECURITY</th><th class="l">名称 NAME</th><th>趋势</th>
              <th>最新价 LAST</th><th>涨跌 CHG</th><th>涨跌% %CHG</th>
              <th>开盘 OPEN</th><th>最高 HIGH</th><th>最低 LOW</th><th>来源</th>
            </tr></thead>
            <tbody></tbody>
          </table>
        </div>
      </div>`;
    page.querySelectorAll(".bbg-tab").forEach((b) =>
      b.addEventListener("click", () => { state.monFilter = b.dataset.f; renderPage(); }));
    fillMonitor();
  }

  function monitorRows() {
    const all = [...state.quotes.values()];
    if (state.monFilter === "Equity") return all.filter((q) => q.kind === "Equity");
    if (state.monFilter === "Index") return all.filter((q) => q.kind === "Index");
    if (state.monFilter === "FXC") return all.filter((q) => q.kind === "FX" || q.kind === "Cmdty");
    if (state.monFilter === "Crypto") return all.filter((q) => q.kind === "Crypto");
    return all;
  }

  function sparkSVG(points, up) {
    if (!points || points.length < 2) return "";
    let min = Infinity, max = -Infinity;
    for (const p of points) { if (p < min) min = p; if (p > max) max = p; }
    const span = max - min || 1;
    const W = 52, H = 13;
    const pts = points
      .map((p, i) => `${((i / (points.length - 1)) * W).toFixed(1)},${(H - 1.5 - ((p - min) / span) * (H - 3)).toFixed(1)}`)
      .join(" ");
    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><polyline points="${pts}" fill="none"
      stroke="${up ? "#2ee06d" : "#ff4a3d"}" stroke-width="1.2"/></svg>`;
  }

  function fillMonitor() {
    const tbody = $(".bbg-mon tbody");
    if (!tbody) return;
    const rows = monitorRows();
    if (tbody.children.length !== rows.length ||
        [...tbody.children].some((tr, i) => tr.dataset.sym !== rows[i]?.symbol)) {
      tbody.innerHTML = rows.map((q) => `
        <tr data-sym="${q.symbol}">
          <td class="l sym">${q.symbol}</td><td class="l name">${esc(q.name ?? "")}</td>
          <td class="spark"></td><td></td><td></td><td></td><td></td><td></td><td></td><td class="src"></td>
        </tr>`).join("");
      tbody.querySelectorAll("tr").forEach((tr) => {
        tr.addEventListener("click", () => { state.sec = tr.dataset.sym; persist(); renderSecbar(); fillMonitor(); });
        tr.addEventListener("dblclick", () => exec("GP", tr.dataset.sym));
      });
    }
    for (const tr of tbody.children) {
      const q = state.quotes.get(tr.dataset.sym);
      if (!q) continue;
      const dp = dpOf(q.last);
      const c = tr.children;
      const prev = state.prevLast.get(q.symbol);
      c[2].innerHTML = sparkSVG(q.spark, q.chg >= 0);
      c[3].textContent = fmt(q.last, dp);
      c[3].className = signCls(q.chg);
      if (prev !== undefined && prev !== q.last) {
        void c[3].offsetWidth;
        c[3].classList.add(q.last > prev ? "fl-up" : "fl-down");
      }
      state.prevLast.set(q.symbol, q.last);
      c[4].textContent = (q.chg > 0 ? "+" : "") + fmt(q.chg, dp);
      c[4].className = signCls(q.chg);
      c[5].textContent = q.chgPct == null ? "—" : (q.chgPct > 0 ? "+" : "") + q.chgPct.toFixed(2) + "%";
      c[5].className = signCls(q.chgPct);
      c[6].textContent = fmt(q.open, dp);
      c[7].textContent = fmt(q.high, dp);
      c[8].textContent = fmt(q.low, dp);
      c[9].innerHTML = q.src === "live" ? `<u class="live">LIVE</u>` : `<u class="sim">SIM</u>`;
      tr.classList.toggle("sel", tr.dataset.sym === state.sec);
    }
  }

  /* WEI — grouped world markets */
  function pageWEI(page) {
    page.innerHTML = `<div class="bbg-wei"></div>`;
    fillWEI();
  }

  function fillWEI() {
    const host = $(".bbg-wei");
    if (!host) return;
    host.innerHTML = KIND_GROUPS.map(([title, match]) => {
      const rows = [...state.quotes.values()].filter(match);
      return `
        <section class="bbg-wei-group">
          <header>${title}</header>
          ${rows.map((q) => {
            const dp = dpOf(q.last);
            const s = q.chg >= 0 ? "+" : "";
            return `<button class="bbg-wei-row" data-sym="${q.symbol}">
              <b>${q.symbol}</b><span class="nm">${esc(q.name ?? "")}</span>
              <span class="spark">${sparkSVG(q.spark, q.chg >= 0)}</span>
              <span class="px ${signCls(q.chg)}">${fmt(q.last, dp)}</span>
              <span class="pc ${signCls(q.chg)}">${s}${q.chgPct ?? 0}%</span>
            </button>`;
          }).join("")}
        </section>`;
    }).join("");
    host.querySelectorAll(".bbg-wei-row").forEach((r) =>
      r.addEventListener("click", () => exec("GP", r.dataset.sym)));
  }

  /* GP — full-page chart */
  function pageGP(page) {
    page.innerHTML = `
      <div class="bbg-gp">
        <div class="bbg-toolrow">
          <span class="bbg-gp-title"></span>
          <span class="bbg-gp-badge"></span>
          <span class="bbg-gp-ohlc"></span>
          <span class="bbg-gp-ranges">
            ${RANGES.map((r) => `<button class="bbg-tab ${r === state.range ? "on" : ""}" data-range="${r}">${r}</button>`).join("")}
            <button class="bbg-tab" data-type="1">${state.chartType === "candle" ? "线 LINE" : "K线 CNDL"}</button>
          </span>
        </div>
        <div class="bbg-chart-wrap"><canvas></canvas></div>
      </div>`;
    $(".bbg-gp-ranges").addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.dataset.type) {
        state.chartType = state.chartType === "candle" ? "line" : "candle";
        persist();
        renderPage();
        return;
      }
      state.range = b.dataset.range;
      persist();
      $$("[data-range]").forEach((x) => x.classList.toggle("on", x === b));
      loadHistory();
    });
    const canvas = $(".bbg-gp canvas");
    canvas.addEventListener("pointermove", (e) => {
      const r = canvas.getBoundingClientRect();
      state.crosshair = { mx: e.clientX - r.left, my: e.clientY - r.top };
      drawChart();
    });
    canvas.addEventListener("pointerleave", () => { state.crosshair = null; drawChart(); });
    new ResizeObserver(() => drawChart()).observe($(".bbg-chart-wrap"));
    renderGPHead();
    if (!state.candles.length) loadHistory();
    else drawChart();
  }

  function renderGPHead() {
    const t = $(".bbg-gp-title");
    if (!t) return;
    const q = state.quotes.get(state.sec);
    t.textContent = `${state.sec} · ${state.histMeta?.name ?? q?.name ?? ""} · ${state.range}`;
    const badge = $(".bbg-gp-badge");
    const live = state.histSrc === "live";
    badge.textContent = state.histSrc ? (live ? "LIVE" : "SIM") : "";
    badge.className = "bbg-gp-badge " + (live ? "live" : "sim");
    const c = state.candles[state.candles.length - 1];
    if (c) {
      const dp = dpOf(c.c);
      $(".bbg-gp-ohlc").innerHTML =
        `O <b>${fmt(c.o, dp)}</b> H <b>${fmt(c.h, dp)}</b> L <b>${fmt(c.l, dp)}</b> C <b class="${signCls(c.c - c.o)}">${fmt(c.c, dp)}</b>`;
    }
  }

  function timeLabel(t) {
    const i = RANGES.indexOf(state.range);
    const d = new Date(t);
    if (i <= 1) return hhmm(t);
    if (i === 2) return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  }

  function drawChart() {
    if (state.fn !== "GP") return;
    const wrap = $(".bbg-gp .bbg-chart-wrap");
    const canvas = wrap?.querySelector("canvas");
    if (!canvas) return;
    const W = wrap.clientWidth, H = wrap.clientHeight;
    if (!W || !H || !state.candles.length) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
      canvas.width = W * dpr;
      canvas.height = H * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const padR = 62, padT = 10, padB = 18;
    const volH = Math.max(30, (H - padT - padB) * 0.16);
    const priceH = H - padT - padB - volH - 8;
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
    const volY0 = padT + priceH + 8 + volH;
    const barW = Math.max(1, Math.min(9, (cw / data.length) * 0.62));
    const dp = dpOf(data[data.length - 1].c);

    ctx.font = "10px Menlo, monospace";
    ctx.textBaseline = "middle";
    for (let i = 0; i <= 4; i++) {
      const p = min + ((max - min) * i) / 4;
      const yy = y(p);
      ctx.strokeStyle = "#15140f";
      ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(cw, yy); ctx.stroke();
      ctx.fillStyle = "#8a7a4a";
      ctx.fillText(fmt(p, dp), cw + 6, yy);
    }

    ctx.textBaseline = "alphabetic";
    for (let i = 0; i < data.length; i += Math.ceil(data.length / 6)) {
      ctx.fillStyle = "#6b6147";
      ctx.fillText(timeLabel(data[i].t), Math.min(x(i), cw - 42), H - 5);
    }

    if (vmax > 0) {
      for (let i = 0; i < data.length; i++) {
        const c = data[i];
        ctx.fillStyle = c.c >= c.o ? "rgba(46,224,109,0.4)" : "rgba(255,74,61,0.4)";
        const h = (c.v / vmax) * volH;
        ctx.fillRect(x(i) - barW / 2, volY0 - h, barW, h);
      }
    }

    if (state.chartType === "line") {
      ctx.strokeStyle = "#ffa028";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      data.forEach((c, i) => (i ? ctx.lineTo(x(i), y(c.c)) : ctx.moveTo(x(i), y(c.c))));
      ctx.stroke();
      ctx.lineWidth = 1;
      const g = ctx.createLinearGradient(0, padT, 0, padT + priceH);
      g.addColorStop(0, "rgba(255,160,40,0.20)");
      g.addColorStop(1, "rgba(255,160,40,0)");
      ctx.lineTo(x(data.length - 1), padT + priceH);
      ctx.lineTo(x(0), padT + priceH);
      ctx.closePath();
      ctx.fillStyle = g;
      ctx.fill();
    } else {
      for (let i = 0; i < data.length; i++) {
        const c = data[i];
        const up = c.c >= c.o;
        ctx.strokeStyle = ctx.fillStyle = up ? "#2ee06d" : "#ff4a3d";
        const cx = x(i);
        ctx.beginPath(); ctx.moveTo(cx, y(c.h)); ctx.lineTo(cx, y(c.l)); ctx.stroke();
        const top = y(Math.max(c.o, c.c));
        const hgt = Math.max(1, Math.abs(y(c.o) - y(c.c)));
        ctx.fillRect(cx - barW / 2, top, barW, hgt);
      }
    }

    const last = data[data.length - 1].c;
    const ly = y(last);
    ctx.strokeStyle = "#ffa028";
    ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(cw, ly); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#ffa028";
    ctx.fillRect(cw, ly - 8, padR, 16);
    ctx.fillStyle = "#14100a";
    ctx.textBaseline = "middle";
    ctx.fillText(fmt(last, dp), cw + 6, ly);

    if (state.crosshair) {
      const { mx, my } = state.crosshair;
      if (mx < cw) {
        ctx.strokeStyle = "rgba(255,160,40,0.45)";
        ctx.beginPath(); ctx.moveTo(mx, padT); ctx.lineTo(mx, volY0); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, my); ctx.lineTo(cw, my); ctx.stroke();
        const i = Math.min(data.length - 1, Math.max(0, Math.floor(mx / (cw / data.length))));
        const c = data[i];
        const txt = `${timeLabel(c.t)}  O ${fmt(c.o, dp)} H ${fmt(c.h, dp)} L ${fmt(c.l, dp)} C ${fmt(c.c, dp)}  V ${c.v.toLocaleString("en-US")}`;
        ctx.fillStyle = "rgba(10,9,5,0.9)";
        ctx.fillRect(6, padT + 2, ctx.measureText(txt).width + 12, 16);
        ctx.fillStyle = "#ffa028";
        ctx.fillText(txt, 12, padT + 10);
      }
    }
  }

  /* DES — description + stats + 52w range */
  function pageDES(page) {
    const q = state.quotes.get(state.sec);
    const blurb = DES_BLURB[state.sec] ?? "No description on file for this security.";
    const dp = dpOf(q?.last);
    const cells = q ? [
      ["最新价 LAST", fmt(q.last, dp), signCls(q.chg)],
      ["涨跌 CHG", (q.chg > 0 ? "+" : "") + fmt(q.chg, dp), signCls(q.chg)],
      ["涨跌% %CHG", q.chgPct == null ? "—" : (q.chgPct > 0 ? "+" : "") + q.chgPct.toFixed(2) + "%", signCls(q.chgPct)],
      ["开盘 OPEN", fmt(q.open, dp)],
      ["最高 HIGH", fmt(q.high, dp)],
      ["最低 LOW", fmt(q.low, dp)],
      ["昨收 PREV", fmt(q.prevClose, dp)],
      ["成交量 VOLUME", q.volume == null ? "—" : q.volume.toLocaleString("en-US")],
      ["52周高 52W H", fmt(q.high52, dp)],
      ["52周低 52W L", fmt(q.low52, dp)],
      ["交易所 EXCH", q.exchange ?? state.histMeta?.exchange ?? "—"],
      ["来源 SOURCE", q.src === "live" ? "LIVE FEED" : "SIMULATED"],
    ] : [];
    let rangePos = null;
    if (q?.high52 != null && q?.low52 != null && q.high52 > q.low52) {
      rangePos = Math.min(100, Math.max(0, ((q.last - q.low52) / (q.high52 - q.low52)) * 100));
    }
    page.innerHTML = `
      <div class="bbg-des">
        <div class="bbg-des-main">
          <h1>${esc(q?.name ?? state.sec)}</h1>
          <div class="bbg-des-tag">${q ? kindTag(q) : ""} · ${q?.exchange ?? "SEWING COMPOSITE"}</div>
          <p class="bbg-des-blurb">${esc(blurb)}</p>
          ${rangePos != null ? `
            <div class="bbg-52w">
              <span>52W ${fmt(q.low52, dp)}</span>
              <div class="bbg-52w-bar"><i style="left:${rangePos}%"></i></div>
              <span>${fmt(q.high52, dp)}</span>
            </div>` : ""}
          <div class="bbg-des-grid">
            ${cells.map(([k, v, cls]) => `<div class="cell"><div class="k">${k}</div><div class="v ${cls ?? ""}">${v}</div></div>`).join("")}
          </div>
        </div>
        <div class="bbg-des-side">
          <div class="bbg-toolrow"><span class="bbg-gp-title">近一年走势 1Y</span></div>
          <div class="bbg-chart-wrap mini"><canvas></canvas></div>
          <button class="bbg-mi wide" data-fn="GP"><i>»</i><b>GP</b><span>打开完整图表</span><em>Full Price Graph</em></button>
          <button class="bbg-mi wide" data-fn="FA"><i>»</i><b>FA</b><span>财务分析</span><em>Financial Analysis</em></button>
        </div>
      </div>`;
    page.querySelectorAll(".bbg-mi").forEach((b) =>
      b.addEventListener("click", () => exec(b.dataset.fn)));
    drawMiniChart();
  }

  async function drawMiniChart() {
    const wrap = $(".bbg-chart-wrap.mini");
    if (!wrap) return;
    try {
      const data = await fetchJSON(`/api/history?symbol=${state.sec}&range=1Y`);
      const canvas = wrap.querySelector("canvas");
      if (!canvas) return;
      const W = wrap.clientWidth, H = wrap.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = W * dpr; canvas.height = H * dpr;
      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const pts = data.candles.map((c) => c.c);
      let min = Math.min(...pts), max = Math.max(...pts);
      const span = max - min || 1;
      ctx.strokeStyle = "#ffa028"; ctx.lineWidth = 1.2;
      ctx.beginPath();
      pts.forEach((p, i) => {
        const xx = (i / (pts.length - 1)) * (W - 8) + 4;
        const yy = H - 6 - ((p - min) / span) * (H - 12);
        i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy);
      });
      ctx.stroke();
    } catch { /* mini chart is decorative; ignore */ }
  }

  /* FA — deterministic simulated financials */
  function pageFA(page) {
    const q = state.quotes.get(state.sec);
    if (!q || q.kind !== "Equity") {
      page.innerHTML = `
        <div class="bbg-empty">
          <b>FA 仅适用于股票证券。</b>
          <span>Financial Analysis is available for equities only. 当前证券：${esc(state.sec)} (${q ? kindTag(q) : "—"})</span>
          <button class="bbg-mi wide" data-fn="W"><i>»</i><b>W</b><span>返回监控选择股票</span><em>Open Monitor</em></button>
        </div>`;
      page.querySelector(".bbg-mi").addEventListener("click", () => exec("W"));
      return;
    }
    const r = rng(hash32(state.sec));
    const base = (q.last ?? 100) * (8 + r() * 30); // pseudo revenue $M-scale
    const years = ["FY22", "FY23", "FY24", "FY25", "FY26E", "FY27E"];
    const grow = years.map(() => 0.04 + r() * 0.3);
    const rev = [];
    let v = base;
    for (let i = 0; i < years.length; i++) { v *= 1 + grow[i]; rev.push(v); }
    const gm = years.map(() => 38 + r() * 32);
    const om = gm.map((g) => g - 8 - r() * 14);
    const ni = rev.map((x, i) => x * (om[i] - 4) / 100);
    const eps = ni.map((x) => x / (base / 4));
    const roe = years.map(() => 8 + r() * 28);
    const row = (label, vals, fmtFn, tone) => `
      <tr><td class="l">${label}</td>${vals.map((x, i) => {
        const cls = tone === "growth" ? (x >= 0 ? "up" : "down") : i >= 4 ? "est" : "";
        return `<td class="${cls}">${fmtFn(x)}</td>`;
      }).join("")}</tr>`;
    page.innerHTML = `
      <div class="bbg-fa">
        <div class="bbg-toolrow">
          <span class="bbg-gp-title">${esc(q.name)} — 财务分析 FINANCIAL ANALYSIS</span>
          <span class="bbg-gp-badge sim">SIMULATED</span>
        </div>
        <div class="bbg-mon-scroll">
          <table class="bbg-table bbg-fa-table">
            <thead><tr><th class="l">调整后高亮项 ADJUSTED</th>${years.map((y, i) => `<th class="${i >= 4 ? "est" : ""}">${y}</th>`).join("")}</tr></thead>
            <tbody>
              <tr class="group"><td class="l" colspan="7">利润表 INCOME STATEMENT</td></tr>
              ${row("营业收入 Revenue ($M)", rev, (x) => fmt(x, 0))}
              ${row("收入增长 Growth %", grow.map((g) => g * 100), (x) => (x >= 0 ? "+" : "") + x.toFixed(1) + "%", "growth")}
              ${row("毛利率 Gross Margin %", gm, (x) => x.toFixed(1) + "%")}
              ${row("营业利润率 Op Margin %", om, (x) => x.toFixed(1) + "%")}
              ${row("净利润 Net Income ($M)", ni, (x) => fmt(x, 0))}
              <tr class="group"><td class="l" colspan="7">每股与回报 PER SHARE &amp; RETURNS</td></tr>
              ${row("每股收益 EPS ($)", eps, (x) => x.toFixed(2))}
              ${row("净资产收益率 ROE %", roe, (x) => x.toFixed(1) + "%")}
            </tbody>
          </table>
        </div>
        <div class="bbg-main-foot">FY26E/FY27E 为模拟预估。本页全部数字由确定性模拟生成，仅用于界面演示。</div>
      </div>`;
  }

  /* N — full-page news */
  function pageNews(page) {
    page.innerHTML = `
      <div class="bbg-news">
        <div class="bbg-toolrow">
          <span class="bbg-gp-title">头条新闻 TOP NEWS</span>
          <span class="bbg-gp-badge ${state.newsSrc === "live" ? "live" : "sim"}">${state.newsSrc === "live" ? "LIVE RSS" : state.newsSrc ? "SIM" : "…"}</span>
          <input class="bbg-news-q" placeholder="筛选 FILTER…" spellcheck="false" value="${esc(state.newsFilter)}">
        </div>
        <div class="bbg-news-scroll"></div>
      </div>`;
    $(".bbg-news-q").addEventListener("input", (e) => {
      state.newsFilter = e.target.value;
      fillNews();
    });
    fillNews();
  }

  function fillNews() {
    const scroll = $(".bbg-news-scroll");
    if (!scroll) return;
    const q = state.newsFilter.trim().toLowerCase();
    const items = state.news.filter((n) => !q || n.headline.toLowerCase().includes(q));
    scroll.innerHTML = items.length ? items.map((n, i) => {
      const id = n.link || n.headline;
      return `
      <button class="bbg-news-item ${state.read.has(id) ? "read" : ""} ${i === 0 ? "fresh" : ""}" data-id="${esc(id)}" ${n.link ? `data-link="${encodeURI(n.link)}"` : ""}>
        <span class="nt">${hhmm(n.t)}</span>
        <span class="nh">${esc(n.headline)}</span>
        <span class="ns">${esc(n.source ?? "")}</span>
      </button>`;
    }).join("") : `<div class="bbg-empty"><b>无匹配新闻。</b><span>No headlines match the filter.</span></div>`;
    scroll.querySelectorAll(".bbg-news-item").forEach((item) =>
      item.addEventListener("click", () => {
        state.read.add(item.dataset.id);
        persist();
        item.classList.add("read");
        if (item.dataset.link) window.open(item.dataset.link, "_blank", "noopener");
      }));
  }

  /* HELP */
  function pageHelp(page) {
    page.innerHTML = `
      <div class="bbg-main">
        <div class="bbg-main-head"><b>HELP</b> 功能列表 — Function Directory</div>
        <div class="bbg-help-list">
          ${FUNCTIONS.map(([c, en, cn]) => `
            <button class="bbg-mi wide" data-fn="${c}"><i>»</i><b>${c}</b><span>${cn}</span><em>${en}</em></button>`).join("")}
        </div>
        <div class="bbg-main-foot">命令行示例：NVDA &lt;GO&gt; 调出图表 · NVDA DES &lt;GO&gt; 证券描述 · BTC GP &lt;GO&gt; 比特币图表。任何页面直接打字即聚焦命令行。</div>
      </div>`;
    page.querySelectorAll(".bbg-mi").forEach((b) =>
      b.addEventListener("click", () => exec(b.dataset.fn)));
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
      const q = state.quotes.get(state.sec);
      const lastCandle = state.candles[state.candles.length - 1];
      if (q && lastCandle && state.range === "1D" && q.src === state.histSrc) {
        lastCandle.c = q.last;
        lastCandle.h = Math.max(lastCandle.h, q.last);
        lastCandle.l = Math.min(lastCandle.l, q.last);
      }
      if (!state.logged) return;
      renderSecbar();
      renderFeed();
      if (state.fn === "W") fillMonitor();
      else if (state.fn === "WEI") fillWEI();
      else if (state.fn === "GP") { renderGPHead(); drawChart(); }
    } catch { /* edge unreachable; next poll retries */ }
  }

  async function loadHistory() {
    try {
      const data = await fetchJSON(`/api/history?symbol=${state.sec}&range=${state.range}`);
      state.candles = data.candles;
      state.histMeta = data.meta;
      state.histSrc = data.src;
      if (state.fn === "GP") { renderGPHead(); drawChart(); }
    } catch { /* retry on next cycle */ }
  }

  async function pollNews() {
    try {
      const data = await fetchJSON("/api/news");
      state.news = data.items;
      state.newsSrc = data.src;
      if (state.logged && state.fn === "N") {
        const badge = $(".bbg-news .bbg-gp-badge");
        if (badge) {
          badge.textContent = data.src === "live" ? "LIVE RSS" : "SIM";
          badge.className = `bbg-gp-badge ${data.src === "live" ? "live" : "sim"}`;
        }
        fillNews();
      }
    } catch { /* ignore */ }
  }

  function renderFeed() {
    const elFeed = $(".bbg-feed");
    if (!elFeed) return;
    const qs = [...state.quotes.values()];
    if (!qs.length) { elFeed.textContent = "CONNECTING…"; return; }
    const live = qs.filter((x) => x.src === "live").length;
    const sim = qs.length - live;
    elFeed.innerHTML = sim === 0
      ? `<u class="live">●</u> LIVE ${live}`
      : live === 0
        ? `<u class="sim">●</u> ALL SIM`
        : `<u class="live">●</u> ${live} LIVE · <u class="sim">${sim} SIM</u>`;
  }

  function tickClock() {
    const c = $(".bbg-clock");
    if (c) c.textContent = new Date().toISOString().slice(11, 19) + " UTC";
  }

  function startPolling() {
    pollQuotes();
    pollNews();
    state.timers.push(setInterval(pollQuotes, 5_000));
    state.timers.push(setInterval(loadHistory, 60_000));
    state.timers.push(setInterval(pollNews, 120_000));
    state.timers.push(setInterval(tickClock, 1_000));
  }

  /* ---------- lifecycle ---------- */

  function start() {
    if (state.logged) renderShell();
    else renderLogin();
    startPolling();
    loadHistory();
  }

  function destroy() {
    for (const t of state.timers) { clearInterval(t); clearTimeout(t); }
    state.timers = [];
  }

  function redraw() {
    if (state.fn === "GP" && state.logged) drawChart();
  }

  return { root, start, destroy, redraw };
}
