/**
 * IBKR Desktop-inspired paper trading workspace.
 * Authentication and order submission are simulated locally.
 */

const QUOTES = [
  { symbol: "SPY", name: "SS SPDR S&P 500 ETF TRUST-US", bid: 730.88, ask: 730.97, last: 730.97, chg: 5.54, pct: 0.76, volume: "640K", avg: "64.6M" },
  { symbol: "QQQ", name: "INVESCO QQQ TRUST SERIES 1", bid: 702.51, ask: 702.60, last: 702.51, chg: 8.81, pct: 1.27, volume: "481K", avg: "48.2M" },
  { symbol: "AAPL", name: "APPLE INC", bid: 292.80, ask: 293.00, last: 293.15, chg: 1.57, pct: 0.54, volume: "225K", avg: "46.7M" },
  { symbol: "AMZN", name: "AMAZON.COM INC", bid: 240.02, ask: 240.24, last: 240.15, chg: 2.15, pct: 0.90, volume: "300K", avg: "44.5M" },
  { symbol: "TSLA", name: "TESLA INC", bid: 388.02, ask: 388.19, last: 388.06, chg: 6.47, pct: 1.70, volume: "779K", avg: "59.1M" },
  { symbol: "MSFT", name: "MICROSOFT CORP", bid: 397.40, ask: 397.60, last: 397.50, chg: 0.30, pct: 0.08, volume: "297K", avg: "34.8M" },
  { symbol: "META", name: "META PLATFORMS INC-CLASS A", bid: 571.80, ask: 572.26, last: 572.13, chg: 1.15, pct: 0.20, volume: "141K", avg: "17.2M" },
  { symbol: "NVDA", name: "NVIDIA CORP", bid: 202.92, ask: 203.08, last: 203.06, chg: 2.64, pct: 1.32, volume: "4.27M", avg: "166M" },
];

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

const icon = (name) => `<img src="/icons/ibkr-ui/${name}.svg" alt="" draggable="false">`;
const number = (value, digits = 2) => Number(value).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const signed = (value, suffix = "") => `${value >= 0 ? "+" : ""}${number(value)}${suffix}`;
const tone = (value) => value >= 0 ? "up" : "down";

function element(html) {
  const template = document.createElement("template");
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
}

export function createIBKRDesktop() {
  const state = {
    mode: "paper",
    screen: "login",
    options: false,
    user: "kinglimmy",
    page: "portfolio",
    selected: "SPY",
    quotes: new Map(QUOTES.map((quote) => [quote.symbol, { ...quote }])),
    candles: makeCandles(),
    timers: [],
  };

  const root = element(`<div class="ibkr"></div>`);

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
              <label>${icon("user-circle")}<input name="username" value="${state.user}" autocomplete="username" aria-label="Username"></label>
              <label>${icon("rectangle-stack")}<input name="password" type="password" placeholder="Password" value="papertrade" autocomplete="current-password" aria-label="Password"></label>
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
      state.user = event.currentTarget.elements.username.value.trim() || "kinglimmy";
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
            <span class="ib-sync">↑ <b>0</b></span><span class="ib-sync muted">✓ <b>0</b></span>
            <span><small>NET LIQ</small><b>1,080,834</b></span>
            <span><small>DAILY P&amp;L</small><b class="up">--</b></span>
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
        <footer class="ib-statusbar"><span><i></i> NORMAL OPERATIONS</span><span>Build 3.2f, May 20, 2026 9:25:51 PM &nbsp;&nbsp;&nbsp; MARKET DATA POWERED BY <b>GFIS</b></span></footer>
        <div class="ib-modal-layer" hidden></div>
      </div>`;
    bindShell();
    renderPage();
    refreshQuotes();
    state.timers.push(setInterval(refreshQuotes, 15000));
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
    root.querySelector(".ib-global-search input").addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      const symbol = event.currentTarget.value.trim().toUpperCase();
      if (state.quotes.has(symbol)) {
        state.selected = symbol;
        state.page = "quote";
        renderPage();
      }
    });
  }

  function renderPage() {
    const host = root.querySelector(".ib-page-host");
    const pages = { portfolioPage, watchlistPage, quotePage, screenersPage, layoutsPage, newsPage, sitemapPage };
    host.innerHTML = (pages[`${state.page}Page`] || portfolioPage)();
    bindPage();
    requestAnimationFrame(drawVisibleCharts);
  }

  function portfolioPage() {
    return `
      <section class="ib-page ib-portfolio-page">
        ${accountMetrics()}
        <div class="ib-split-page">
          <div class="ib-main-panel">
            ${tabs(["Positions", "Orders", "Trades", "AI Instructions", "Balances"], "Positions")}
            <div class="ib-toolbar"><select><option>Portfolio View</option></select><select><option>Sort By</option></select>${icon("funnel")}${icon("cog-6-tooth")}</div>
            ${portfolioTable()}
          </div>
          ${emptyPortfolioRail()}
        </div>
      </section>`;
  }

  function watchlistPage() {
    return `
      <section class="ib-page ib-split-page">
        <div class="ib-main-panel">
          <div class="ib-section-title"><b>Favorites</b><button>+</button><select><option>Watchlist View</option></select>${icon("cog-6-tooth")}</div>
          ${watchTable()}
        </div>
        ${quoteRail(true)}
      </section>`;
  }

  function quotePage() {
    return `
      <section class="ib-page ib-quote-grid">
        <div class="ib-mini-watch"><select><option>Favorites</option></select>${miniWatch()}</div>
        <div class="ib-chart-workspace">
          ${tabs(["Charts", "Options", "Connections", "News", "Fundamentals"], "Charts")}
          <div class="ib-chart-toolbar"><b>⊕</b><span>1m</span><span>♮</span><span>ƒx</span><span>▦</span><span>↶</span><span>↷</span><span>□</span><b>Unnamed⌄</b><span>◉</span><span>⬡</span><span>⛶</span></div>
          <div class="ib-chart-title"><b>${state.selected} · ${selected().name} · 1 · SMART</b><span class="down">O726.81 H726.81 L725.33 C725.42</span><span>Volume <b class="down">1.19 M</b></span></div>
          <canvas class="ib-candle-chart"></canvas>
          <div class="ib-chart-bottom"><span>5y</span><span>1y</span><span>6m</span><span>3m</span><span>1m</span><span>1w</span><span>1d</span><b>${new Date().toLocaleTimeString("en-GB")} UTC+8</b><span>RTH</span><span>%</span><span>log</span><span class="active">auto</span></div>
        </div>
        ${quoteRail(true)}
      </section>`;
  }

  function screenersPage() {
    const results = [
      ["NVDA", "NVIDIA CORP", "203.06", "+2.64", "1.32%", "4,850.164B", "4.27M", "166M"],
      ["AAPL", "APPLE INC", "293.15", "+1.57", "0.54%", "4,282.54B", "225K", "46.7M"],
      ["MSFT", "MICROSOFT CORP", "397.66", "+0.30", "0.08%", "2,951.763B", "297K", "34.8M"],
      ["KLAC", "KLA CORP", "2219.00", "+83.36", "3.90%", "278.973B", "8.26K", "1.02M"],
      ["AMZN", "AMAZON.COM INC", "240.15", "+2.15", "0.90%", "2,560.192B", "300K", "44.5M"],
      ["TSM", "TAIWAN SEMICONDUCTOR-SP ADR", "416.88", "+9.09", "2.23%", "1,851.608B", "176K", "13.6M"],
      ["GOOGL", "ALPHABET INC-CL A", "357.80", "+1.42", "0.40%", "4,321.984B", "1.68M", "29.4M"],
      ["AVGO", "BROADCOM INC", "375.12", "+3.02", "0.81%", "1,856.748B", "355K", "25.4M"],
      ["TSLA", "TESLA INC", "388.06", "+6.47", "1.70%", "1,489.821B", "779K", "59.1M"],
      ["META", "META PLATFORMS INC-CLASS A", "572.13", "+1.15", "0.20%", "1,483.937B", "141K", "17.2M"],
      ["LLY", "ELI LILLY & CO", "1136.02", "-0.35", "-0.03%", "1,070.167B", "7.81K", "3.23M"],
    ];
    return `
      <section class="ib-page ib-screeners">
        <div class="ib-category-tabs">${["My Screeners","US Stocks","Asia Stocks","EUR Stocks","ETFs","Options","Bonds"].map((x, i) => `<b class="${i === 1 ? "active" : ""}">${x}</b>`).join("")}</div>
        <div class="ib-market-tabs">${["All US Stocks","NYSE","AMEX","NASDAQ","Pink Sheets","Airlines","Biotech","Energy","Financial","Media","Retail","Technology","SaaS","E-Commerce"].map((x) => `<span>${x}</span>`).join("")}</div>
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
            <div class="ib-results-head"><b>⚑ &nbsp; Displaying 200 of 7120 Results</b><span>Generated at ${new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span><a>⟳ Refresh results</a></div>
            <table><thead><tr><th>□</th><th>Financial Instrument</th><th>Company Name</th><th>Last</th><th>Change</th><th>Change %</th><th>Market Cap</th><th>Volume</th><th>Average Vol.</th></tr></thead>
            <tbody>${results.map((r) => `<tr><td>□</td><td><b>${r[0]}</b></td><td>${r[1]}</td><td class="${r[3].startsWith("-") ? "down" : "up"}">${r[2]}</td><td class="${r[3].startsWith("-") ? "down" : "up"}">${r[3]}</td><td class="${r[4].startsWith("-") ? "down" : "up"}">${r[4]}</td><td>${r[5]}</td><td>${r[6]}</td><td>${r[7]}</td></tr>`).join("")}</tbody></table>
          </div>
        </div>
      </section>`;
  }

  function layoutsPage() {
    return `
      <section class="ib-page ib-layouts">
        <div class="ib-layout-title"><b>Basic Trading</b><button>+</button></div>
        <div class="ib-layout-grid">
          <article class="ib-module order"><header>Rapid Order Entry <span>× &nbsp; + &nbsp; •••</span></header>${orderEntry()}</article>
          <article class="ib-module chart"><header>Chart <span>× &nbsp; + &nbsp; •••</span></header><div class="ib-chart-title"><b>SPY · SS SPDR S&amp;P 500 ETF TRUST-US · 1 · SMART</b><span class="down">O726.81 H726.81 L725.33 C725.42</span></div><canvas class="ib-candle-chart"></canvas></article>
          <article class="ib-module portfolio"><header>Portfolio <span>× &nbsp; Watchlist &nbsp; +</span></header>${portfolioTable()}</article>
          <article class="ib-module orders"><header>Orders Table <span>× &nbsp; Trades &nbsp; +</span></header><table><thead><tr><th>Financial Instrument</th><th>Action</th><th>Order Type</th><th>Quantity</th><th>Limit Price</th></tr></thead></table></article>
          <article class="ib-module news"><header>News <span>× &nbsp; +</span></header>${newsList()}</article>
        </div>
      </section>`;
  }

  function newsPage() {
    return `
      <section class="ib-page ib-news-page">
        <aside class="ib-news-nav">${["Daily Overview","Portfolio News","Watchlist News","Read Later","Browse","Manage Subscriptions ↗","Language Settings"].map((x, i) => `<button class="${i === 0 ? "active" : ""}">${x}</button>`).join("")}<button class="feedback">☁ &nbsp; Give Feedback</button></aside>
        <main class="ib-news-main">
          <div class="ib-news-heading"><h1>Daily Overview</h1><label><input placeholder="Search for instruments, asset classes, and topics">${icon("magnifying-glass")}</label></div>
          <div class="ib-news-cards">
            <article class="ib-news-hero"><img src="/images/ibkr/news-ai-keyboard.png" alt=""><b>Companies in the News</b><h2>Anthropic v. OpenAI: Behind the bitter battle for the future of AI</h2></article>
            <article class="ib-market-card"><h2>Market Performance</h2><div><b>U.S.</b> Europe &nbsp; Asia &nbsp; FX</div><div class="ib-indexes"><span>S&amp;P 500 <b class="up">0.01%</b></span><span>NASDAQ <b>--</b></span><span>RUSSELL 1000 <b>0.00%</b></span></div><canvas class="ib-line-chart"></canvas><footer>Today &nbsp;&nbsp; 5D &nbsp;&nbsp; 1M &nbsp;&nbsp; 1Y &nbsp;&nbsp; 2Y</footer></article>
          </div>
          <article class="ib-ai-summary"><h2>✦ AI Summaries</h2><small>From Daily Overview News</small><p>Oracle reports Q4 fiscal 2026 earnings June 10. Revenue expected up 19-21% to $19.08 billion; secured a major U.S. government cloud agreement.</p></article>
        </main>
        ${eventsRail()}
      </section>`;
  }

  function sitemapPage() {
    const left = ["PORTFOLIO","Positions","Balances","Portfolio News","Tax Optimizer ↗","TRADE","Charts","Orders","Trades","Option Chain","Option Wizard","Option Analysis","Prediction Markets ↗","Trading Permissions ↗","Convert Currency ↗","Market Alerts ↗","RESEARCH","Ask IBKR ↗","Watchlist","Screeners"];
    const right = ["FUNDAMENTALS EXPLORER","Fundamentals Explorer","Profile","Investment Themes","Key Ratios","Dividends","Financials","Impact & ESG","Analyst Ratings","Analyst Forecast","Ownership","Social Sentiment","Short Selling","Securities Lending Analytics","SETTINGS","Display Settings","Hot Keys","Column Management","Trading Presets","Messages"];
    const links = (items) => items.map((x) => x === x.toUpperCase() ? `<h4>${x}</h4>` : `<a>${x}</a>`).join("");
    return `
      <section class="ib-page ib-sitemap-page">
        <main class="ib-sitemap-main"><div class="ib-sitemap-search"><b>× &nbsp; SITEMAP</b><label>${icon("magnifying-glass")}<input placeholder="Search for tools"><span>×</span></label></div><div class="ib-link-columns"><div>${links(left)}</div><div>${links(right)}</div></div><footer><button>▣ Deposit Funds</button><button>▣ Withdraw Funds</button></footer></main>
        ${eventsRail()}
      </section>`;
  }

  function accountMetrics() {
    const metrics = [["Account","DU9559074"],["Daily P&L","--"],["Daily P&L %","--"],["Unrealized P&L","--"],["Realized P&L","--"],["Net Liquidity","1.1M"],["Excess Liq","1.1M"],["Maintenance","0"],["Initial Margin","0"],["Available Funds","1.1M"],["Buying Power","4.3M"]];
    return `<div class="ib-metrics">${metrics.map(([label, value]) => `<span><small>${label}</small><b>${value}</b></span>`).join("")}</div>`;
  }

  function tabs(items, active) {
    return `<div class="ib-tabs">${items.map((item) => `<button class="${item === active ? "active" : ""}">${item}</button>`).join("")}</div>`;
  }

  function portfolioTable() {
    return `<table class="ib-table ib-portfolio-table"><thead><tr><th>Financial Instrument</th><th>Company Name</th><th>Position</th><th>Last</th><th>Change</th><th>Change %</th><th>Trend</th></tr></thead><tbody><tr class="cash"><td><b>BASE CASH</b></td><td></td><td></td><td></td><td></td><td></td><td></td></tr><tr class="cash"><td><b>USD CASH</b></td><td></td><td></td><td></td><td></td><td></td><td></td></tr></tbody></table>`;
  }

  function watchTable() {
    return `<table class="ib-table ib-watch-table"><thead><tr><th>Financial Instrument</th><th>Company Name</th><th>Bid Size</th><th>Bid</th><th>Ask</th><th>Ask Size</th><th>Last</th><th>Change %</th></tr></thead><tbody>${[...state.quotes.values()].slice(0, 7).map((q, i) => `<tr data-symbol="${q.symbol}" class="${state.selected === q.symbol ? "selected" : ""}"><td><b>${q.symbol}</b></td><td>${q.name}</td><td>${[550,656,12,4,1,3,111][i]}</td><td>${number(q.bid)}</td><td>${number(q.ask)}</td><td>${[410,481,2,10,40,21,50][i]}</td><td class="${tone(q.chg)}">${number(q.last)}</td><td class="${tone(q.pct)}">${signed(q.pct, "%")}</td></tr>`).join("")}</tbody></table>`;
  }

  function miniWatch() {
    return [...state.quotes.values()].slice(0, 7).map((q) => `<button data-symbol="${q.symbol}" class="${state.selected === q.symbol ? "selected" : ""}"><span><b>${q.symbol}</b><small>${q.name}</small></span><span><b>${number(q.last)}</b><small class="${tone(q.pct)}">${number(Math.abs(q.pct))}%</small></span></button>`).join("");
  }

  function quoteRail(detailed = false) {
    const q = selected();
    return `
      <aside class="ib-quote-rail">
        <header><span>${q.name.slice(0, 22)}...</span><span>Odd Lot Data &nbsp; 🇺🇸</span></header>
        <div class="ib-quote-name"><b>${q.symbol}</b><span>☆ &nbsp; ♥</span></div>
        <div class="ib-big-price"><b class="${tone(q.chg)}">${number(q.last)}</b><small>x361</small><span class="${tone(q.chg)}">${number(q.chg)} &nbsp; ${signed(q.pct, "%")}</span><div><small>Ask</small><b class="down">${number(q.ask)}</b><small>Bid</small><b class="blue">${number(q.bid)}</b></div></div>
        <div class="ib-realtime">REALTIME PRICE: NON-CONSOLIDATED <b>⟳ SNAPSHOT</b></div>
        <div class="ib-order-buttons"><button data-order="BUY">Buy Order</button><button data-order="SELL">Sell Order</button><button>ϟ</button></div>
        <div class="ib-quote-stats"><div><span>Opening Price <b>--</b></span><span>Prior Close <b>${number(q.last - q.chg)}</b></span><span>High <b>--</b></span><span>Low <b>--</b></span><span>52 Wk Hgh <b>${number(q.last * 1.04)}</b></span><span>52 Wk Lw <b>${number(q.last * .8)}</b></span></div><div><span>Volume <b>${q.volume}</b></span><span>Average Volume <b>${q.avg}</b></span><span>Hist Vol Cls <b>12.748%</b></span><span>Opt. IV% <b>18.2%</b></span><span>Open Int <b>19.9M</b></span><span>Put/Call Vol <b>1.30</b></span></div></div>
        ${detailed ? `<article class="ib-connections"><h3>${q.symbol} Connections ›</h3><p>Discover related companies, sectors, and tradable instruments.</p><button>Open the Connections Tab</button></article>` : `<div class="ib-rail-chart"><div><button class="active">Today</button><button>1W</button><button>1M</button><button>3M</button><button>1Y</button></div><canvas class="ib-line-chart"></canvas></div>`}
      </aside>`;
  }

  function emptyPortfolioRail() {
    return `
      <aside class="ib-quote-rail ib-empty-rail">
        <div class="ib-empty-close">×</div>
        <div class="ib-empty-market"><span>x</span><div><small>Ask</small><b class="down">x</b><small>Bid</small><b class="blue">x</b></div></div>
        <button class="ib-empty-bolt">ϟ</button>
        <div class="ib-rail-chart"><div><button class="active">Today</button><button>1W</button><button>1M</button><button>3M</button><button>1Y</button><button>5Y</button></div><canvas class="ib-line-chart"></canvas></div>
      </aside>`;
  }

  function orderEntry() {
    return `<div class="ib-order-entry"><input placeholder="⌕ Search"><h3>SPY <small>SS SPDR S&amp;P 500 ETF TRUST-US</small></h3><div class="ib-bidask">Last <b>730.90</b><br>Change <b class="up">5.47 +0.75%</b><br>Ask <b class="down">650 × 730.99</b><br>Bid <b class="blue">455 × 730.89</b></div><div class="ib-order-tabs"><button>Buy Order</button><button>Sell Order</button></div><p>Account <b>DU9559074</b> &nbsp; Position -</p><p>Available Funds <b>1.08M</b></p><label>Quantity <input value="100"> Shares</label><div class="ib-order-types">Limit &nbsp;&nbsp;&nbsp; Market &nbsp;&nbsp;&nbsp; Stop</div><label>Limit Price <input placeholder="--"></label><button class="ib-submit-order" data-order="BUY">Submit Order</button></div>`;
  }

  function newsList() {
    return `<input placeholder="⌕ Search"><h4>SPY: &nbsp; Latest News</h4>${["What's Going On With Micron Stock Today","U.S. Forces Disable Third Oil Tanker","Justin Wolfers Warns Of Affordability","Stock Market Today: Dow Jones, S&P 500"].map((x, i) => `<p><small>${19 - i}:4${5 - i}</small> &nbsp; BZ ${x}</p>`).join("")}`;
  }

  function eventsRail() {
    return `<aside class="ib-events"><header>World Exchanges <small>June 11, 2026 at 08:17 PM GMT+8</small></header><img src="/images/ibkr/world-exchanges.png" alt=""><h3>SEHK : <b>CLOSED</b> &nbsp; | &nbsp; NYSE : <b>CLOSED</b><br>LSE : <strong>OPEN</strong></h3><div class="ib-events-title"><b>Upcoming Events &nbsp; US⌄</b><a>All Events</a></div><div class="ib-event-tabs">EARNINGS &nbsp;&nbsp; ECONOMIC &nbsp;&nbsp; DIVIDENDS &nbsp;&nbsp; IPOs</div>${["CHWY Q1 2026 Chewy Inc Earnings","CMCM Q1 2026 Cheetah Mobile","CNM Q1 2026 Core & Main Inc","JILL Q1 2026 J.Jill Inc Earnings","RMSL Q1 2026 REMSleep Holdings","SMID Q1 2026 Smith-Midland Corp","VGES Q3 2026 Vanguard Green","YB Q1 2026 Yuanbao Inc Earnings","ADMIE Q1 2026 Holding Company","ANIX Q2 2026 Anixa Biosciences"].map((x) => `<p><small>08:30 PM</small> <b>${x.split(" ")[0]}</b> ${x.split(" ").slice(1).join(" ")}</p>`).join("")}</aside>`;
  }

  function bindPage() {
    root.querySelectorAll("[data-symbol]").forEach((row) => row.addEventListener("click", () => {
      state.selected = row.dataset.symbol;
      renderPage();
    }));
    root.querySelectorAll("[data-order]").forEach((button) => button.addEventListener("click", () => showOrder(button.dataset.order)));
  }

  function selected() {
    return state.quotes.get(state.selected) || QUOTES[0];
  }

  async function refreshQuotes() {
    try {
      const symbols = QUOTES.filter((q) => !["SPY", "QQQ"].includes(q.symbol)).map((q) => q.symbol).join(",");
      const response = await fetch(`/api/quotes?symbols=${symbols}`);
      if (!response.ok) return;
      const data = await response.json();
      const rows = Array.isArray(data) ? data : data.quotes || data.data || [];
      rows.forEach((row) => {
        const prior = state.quotes.get(row.symbol);
        if (!prior) return;
        const last = Number(row.price ?? row.last ?? row.c ?? prior.last);
        const chg = Number(row.change ?? row.chg ?? row.d ?? prior.chg);
        state.quotes.set(row.symbol, { ...prior, last, chg, pct: Number(row.changePercent ?? row.dp ?? prior.pct), bid: last - .08, ask: last + .08 });
      });
      if (state.screen === "workspace") renderPage();
    } catch {
      // The app remains useful with its bundled simulation snapshot.
    }
  }

  function drawVisibleCharts() {
    root.querySelectorAll(".ib-candle-chart").forEach(drawCandles);
    root.querySelectorAll(".ib-line-chart").forEach(drawLine);
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
    const { context: ctx, width, height } = prepareCanvas(canvas);
    if (width < 10 || height < 10) return;
    const pad = { l: 20, r: 48, t: 18, b: 34 };
    const values = state.candles.flatMap((c) => [c.high, c.low]);
    const min = Math.min(...values) - .15;
    const max = Math.max(...values) + .15;
    const y = (v) => pad.t + (max - v) / (max - min) * (height - pad.t - pad.b);
    ctx.strokeStyle = "#e3e5e8"; ctx.lineWidth = 1;
    for (let i = 0; i < 6; i += 1) {
      const yy = pad.t + i * (height - pad.t - pad.b) / 5;
      ctx.beginPath(); ctx.moveTo(pad.l, yy); ctx.lineTo(width - pad.r, yy); ctx.stroke();
    }
    const step = (width - pad.l - pad.r) / state.candles.length;
    state.candles.forEach((c, i) => {
      const x = pad.l + i * step + step / 2;
      const color = c.close >= c.open ? "#0b9c55" : "#e21b2c";
      ctx.strokeStyle = color; ctx.fillStyle = color;
      ctx.beginPath(); ctx.moveTo(x, y(c.high)); ctx.lineTo(x, y(c.low)); ctx.stroke();
      const top = Math.min(y(c.open), y(c.close));
      ctx.fillRect(x - Math.max(2, step * .3), top, Math.max(4, step * .6), Math.max(2, Math.abs(y(c.open) - y(c.close))));
    });
    ctx.fillStyle = "#333"; ctx.font = "12px Arial";
    [max, (max + min) / 2, min].forEach((v, i) => ctx.fillText(number(v), width - 44, pad.t + i * (height - pad.t - pad.b) / 2 + 4));
  }

  function drawLine(canvas) {
    const { context: ctx, width, height } = prepareCanvas(canvas);
    if (width < 10 || height < 10) return;
    const points = state.candles.map((c) => c.close);
    const min = Math.min(...points); const max = Math.max(...points);
    ctx.strokeStyle = "#287de5"; ctx.lineWidth = 2;
    ctx.beginPath();
    points.forEach((value, i) => {
      const x = 6 + i * (width - 12) / (points.length - 1);
      const y = 10 + (max - value) / Math.max(.01, max - min) * (height - 22);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  function showOrder(side) {
    const q = selected();
    showModal(`<h2>${side === "BUY" ? "Buy" : "Sell"} ${q.symbol}</h2><p>${q.name}</p><label>Quantity<input value="100" type="number"></label><label>Order Type<select><option>Limit</option><option>Market</option></select></label><label>Limit Price<input value="${number(side === "BUY" ? q.ask : q.bid)}"></label><div><button data-cancel>Cancel</button><button class="${side === "BUY" ? "buy" : "sell"}" data-confirm>Preview Order</button></div>`);
  }

  function showSettings() {
    showModal(`<h2>Display Settings</h2><label>Theme<select><option>Light</option><option>Dark</option></select></label><label>Text Size<select><option>Default</option><option>Large</option></select></label><div><button data-logout>Log Out</button><button data-cancel>Close</button></div>`);
    root.querySelector("[data-logout]").addEventListener("click", () => {
      root.querySelector(".ib-modal-layer").hidden = true;
      state.screen = "login";
      renderLogin();
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
    layer.querySelector("[data-confirm]")?.addEventListener("click", () => {
      layer.innerHTML = `<div class="ib-modal"><h2>Order ready for simulation</h2><p>No brokerage order was transmitted.</p><div><button data-cancel>Done</button></div></div>`;
      layer.querySelector("[data-cancel]").addEventListener("click", () => { layer.hidden = true; });
    });
  }

  function destroy() {
    state.timers.forEach((timer) => { clearTimeout(timer); clearInterval(timer); });
    state.timers = [];
  }

  renderLogin();
  return { root, start() {}, destroy, redraw: drawVisibleCharts };
}

function wordmark() {
  return `<div class="ib-wordmark"><img class="ib-wordmark-logo" src="/images/ibkr/ib-logo-text-white.png" alt="Interactive Brokers"></div>`;
}

function makeCandles() {
  let value = 728.3;
  return Array.from({ length: 58 }, (_, index) => {
    const open = value;
    const drift = Math.sin(index / 4) * .11 + (Math.random() - .55) * .42;
    const close = index === 57 ? 725.42 : open + drift;
    const high = Math.max(open, close) + Math.random() * .25;
    const low = Math.min(open, close) - Math.random() * .25;
    value = close;
    return { open, high, low, close };
  });
}

function escapeHtml(value) {
  const span = document.createElement("span");
  span.textContent = value;
  return span.innerHTML;
}
