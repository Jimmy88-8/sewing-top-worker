/**
 * sewing-top-worker — API backend for SewingOS / Market Terminal.
 *
 * Real market data with graceful degradation:
 *   - Equities / indices / FX / futures : Yahoo Finance public endpoints
 *   - Crypto                            : Binance public API
 *   - News                             : CNBC + Yahoo Finance RSS
 *   - Weather                          : Open-Meteo (no key)
 *
 * Every provider call is cached in-memory (per isolate) with
 * stale-on-error semantics; if an upstream is unreachable the response
 * falls back to a deterministic simulation and is tagged `src: "sim"`.
 *
 * Endpoints:
 *   GET /api/quotes[?extra=TSM,BABA]     -> quotes for all registry symbols (+ ad-hoc Yahoo tickers)
 *   GET /api/history?symbol=AAPL&range=1D|5D|1M|6M|1Y   (any Yahoo ticker accepted)
 *   GET /api/search?q=apple              -> Yahoo symbol lookup (registry fallback offline)
 *   GET /api/news[?symbols=AAPL,TSLA]    -> market-wide feed, or per-symbol Yahoo RSS
 *   GET /api/movers                      -> US market gainers / losers / most active / trending
 *   GET /api/fundamentals?symbol=AAPL    -> company profile + key statistics (Yahoo quoteSummary)
 *   GET /api/weather?lat=31.2&lon=121.5
 *   GET /api/geocode?q=Shanghai
 *   GET /api/status
 */

/* ================= symbol registry ================= */

const SYMBOLS = {
  SPY:    { name: "SPDR S&P 500 ETF TRUST",     kind: "ETF", provider: "yahoo", ref: "SPY", base: 730.9, vol: 0.5 },
  QQQ:    { name: "INVESCO QQQ TRUST SERIES 1", kind: "ETF", provider: "yahoo", ref: "QQQ", base: 702.5, vol: 0.7 },
  AAPL:   { name: "APPLE INC",          kind: "Equity", provider: "yahoo",   ref: "AAPL",     base: 291.6,  vol: 1.0 },
  MSFT:   { name: "MICROSOFT CORP",     kind: "Equity", provider: "yahoo",   ref: "MSFT",     base: 512.7,  vol: 0.9 },
  NVDA:   { name: "NVIDIA CORP",        kind: "Equity", provider: "yahoo",   ref: "NVDA",     base: 165.0,  vol: 1.9 },
  TSLA:   { name: "TESLA INC",          kind: "Equity", provider: "yahoo",   ref: "TSLA",     base: 318.6,  vol: 2.4 },
  AMZN:   { name: "AMAZON.COM INC",     kind: "Equity", provider: "yahoo",   ref: "AMZN",     base: 231.5,  vol: 1.2 },
  GOOGL:  { name: "ALPHABET INC-A",     kind: "Equity", provider: "yahoo",   ref: "GOOGL",    base: 196.8,  vol: 1.1 },
  META:   { name: "META PLATFORMS INC", kind: "Equity", provider: "yahoo",   ref: "META",     base: 742.1,  vol: 1.4 },
  SPX:    { name: "S&P 500 INDEX",      kind: "Index",  provider: "yahoo",   ref: "^GSPC",    base: 6321.5, vol: 0.5 },
  NDX:    { name: "NASDAQ 100 INDEX",   kind: "Index",  provider: "yahoo",   ref: "^NDX",     base: 23184,  vol: 0.7 },
  DJI:    { name: "DOW JONES INDU AVG", kind: "Index",  provider: "yahoo",   ref: "^DJI",     base: 44120,  vol: 0.5 },
  EURUSD: { name: "EURO / US DOLLAR",   kind: "FX",     provider: "yahoo",   ref: "EURUSD=X", base: 1.0842, vol: 0.3 },
  USDJPY: { name: "US DOLLAR / YEN",    kind: "FX",     provider: "yahoo",   ref: "USDJPY=X", base: 155.2,  vol: 0.4 },
  GLD:    { name: "GOLD FUTURE $/OZ",   kind: "Cmdty",  provider: "yahoo",   ref: "GC=F",     base: 4122.5, vol: 0.6 },
  WTI:    { name: "WTI CRUDE FUTURE",   kind: "Cmdty",  provider: "yahoo",   ref: "CL=F",     base: 71.4,   vol: 1.5 },
  BTC:    { name: "BITCOIN / USD",      kind: "Crypto", provider: "binance", ref: "BTCUSDT",  base: 62776,  vol: 2.8 },
  ETH:    { name: "ETHEREUM / USD",     kind: "Crypto", provider: "binance", ref: "ETHUSDT",  base: 3310,   vol: 3.2 },
};

const REF_TO_ID = Object.fromEntries(Object.entries(SYMBOLS).map(([id, s]) => [s.ref, id]));

const RANGES = {
  // [yahooRange, yahooInterval, binanceInterval, binanceLimit, cacheTtlMs]
  "1D": ["1d",  "5m",  "5m", 288, 60_000],
  "5D": ["5d",  "15m", "30m", 240, 120_000],
  "1M": ["1mo", "60m", "2h", 372, 300_000],
  "6M": ["6mo", "1d",  "1d", 183, 600_000],
  "1Y": ["1y",  "1d",  "1d", 365, 600_000],
};

/* ================= cache & fetch helpers ================= */

// In-memory TTL cache with three protections against upstream hammering:
//   - in-flight dedup: concurrent callers share one upstream request
//   - stale-on-error: an expired value is served if refresh fails
//   - negative caching: a failure with no stale value blocks retries briefly
const mem = new Map();
const NEG_TTL = 15_000;

async function cached(key, ttl, fn) {
  const now = Date.now();
  const hit = mem.get(key);
  if (hit?.pending) return hit.pending;
  if (hit && now < hit.exp) {
    if (hit.failed) throw new Error(hit.err);
    return hit.val;
  }
  const pending = (async () => {
    try {
      const val = await fn();
      mem.set(key, { val, exp: Date.now() + ttl });
      return val;
    } catch (e) {
      if (hit && "val" in hit) {
        mem.set(key, { val: hit.val, exp: Date.now() + NEG_TTL }); // serve stale, retry soon
        return hit.val;
      }
      mem.set(key, { failed: true, err: String(e.message ?? e), exp: Date.now() + NEG_TTL });
      throw e;
    }
  })();
  mem.set(key, { ...hit, exp: 0, pending });
  return pending;
}

const health = {}; // provider -> { ok, t, error? }

const UA = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  accept: "application/json, text/xml, */*",
};

// Yahoo rate-limits per user-agent + IP; a minimal UA usually still passes
// when the browser-like one is throttled, so 429s get one retry with it.
const UA_MIN = { "user-agent": "Mozilla/5.0", accept: UA.accept };

async function upstream(provider, url, asText = false) {
  try {
    let res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(6_000) });
    if (res.status === 429) {
      res = await fetch(url, { headers: UA_MIN, signal: AbortSignal.timeout(6_000) });
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = asText ? await res.text() : await res.json();
    health[provider] = { ok: true, t: Date.now() };
    return body;
  } catch (e) {
    health[provider] = { ok: false, t: Date.now(), error: String(e.message ?? e) };
    throw e;
  }
}

const round = (x, dp) => (x == null ? null : Number(Number(x).toFixed(dp)));
const dpFor = (id) => {
  const s = SYMBOLS[id];
  return s.base < 10 ? 4 : 2;
};

/* ================= deterministic simulation (fallback) ================= */

function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand01 = (key) => mulberry32(fnv1a(key))();

function gauss(key) {
  const r = mulberry32(fnv1a(key));
  return (r() + r() + r() + r() - 2) * 1.5;
}

// Generic seeded walk over fixed time buckets; identical for every caller.
function simCandles(id, bucketMs, n, now) {
  const spec = SYMBOLS[id];
  const cur = Math.floor(now / bucketMs);
  const step = spec.vol * 0.0009 * Math.sqrt(bucketMs / 60_000);
  const wave = Math.sin(cur / 500 + rand01(`${id}|phase`) * 6.28) * 0.03;
  let price = spec.base * (1 + wave);
  const out = [];
  for (let b = cur - n + 1; b <= cur; b++) {
    const o = price;
    price *= 1 + gauss(`${id}|${bucketMs}|${b}`) * step;
    const c = price;
    const wick = spec.vol * 0.0005 * Math.sqrt(bucketMs / 60_000);
    out.push({
      t: b * bucketMs,
      o,
      h: Math.max(o, c) * (1 + rand01(`${id}|${bucketMs}|${b}|h`) * wick),
      l: Math.min(o, c) * (1 - rand01(`${id}|${bucketMs}|${b}|l`) * wick),
      c,
      v: Math.round(50_000 + rand01(`${id}|${bucketMs}|${b}|v`) * 950_000),
    });
  }
  return out;
}

// Built from the same 5-minute series as the simulated 1D history, so the
// quote, sparkline and chart never disagree (24h-change convention).
function simQuote(id, now) {
  const dp = dpFor(id);
  const candles = simCandles(id, 300_000, 288, now);
  const last = candles[candles.length - 1].c;
  const prevClose = candles[0].o;
  let hi = -Infinity, lo = Infinity;
  for (const c of candles) { if (c.h > hi) hi = c.h; if (c.l < lo) lo = c.l; }
  const spec = SYMBOLS[id];
  return {
    symbol: id,
    name: spec.name,
    kind: spec.kind,
    last: round(last, dp),
    open: round(prevClose, dp),
    high: round(hi, dp),
    low: round(lo, dp),
    prevClose: round(prevClose, dp),
    chg: round(last - prevClose, dp),
    chgPct: round(((last - prevClose) / prevClose) * 100, 2),
    volume: Math.round(1_000_000 + rand01(`${id}|v|${Math.floor(now / 86_400_000)}`) * 40_000_000),
    spark: downsample(candles.map((c) => c.c), 30).map((x) => round(x, dp)),
    src: "sim",
    t: now,
  };
}

const SIM_NEWS = [
  "Fed officials signal patience on rate path as inflation cools",
  "AI capex super-cycle intact, hyperscaler orders point higher",
  "Treasury yields edge lower ahead of 10-year auction",
  "Crude steadies as OPEC+ holds production targets",
  "Dollar drifts as markets parse mixed labor data",
  "Gold extends gains as central bank buying continues",
  "Chip supply chain tightens as packaging demand soars",
  "Earnings season beats running above five-year average",
  "Consumer confidence ticks up for third straight month",
  "Cloud growth re-accelerates as enterprise AI adoption broadens",
];

function simNews(now) {
  const slot = Math.floor(now / 300_000);
  return Array.from({ length: 12 }, (_, i) => ({
    t: (slot - i) * 300_000,
    source: "SIMULATED",
    headline: SIM_NEWS[Math.floor(rand01(`news|${slot - i}`) * SIM_NEWS.length)],
    link: null,
  }));
}

/* ================= Yahoo Finance ================= */

// Try both query hosts; they are rate-limited independently.
async function yahooGet(pathAndQuery) {
  try {
    return await upstream("yahoo", `https://query1.finance.yahoo.com${pathAndQuery}`);
  } catch {
    return upstream("yahoo", `https://query2.finance.yahoo.com${pathAndQuery}`);
  }
}

// specs: [{ id, ref }] — registry symbols pass their configured ref,
// ad-hoc tickers use the ticker itself for both.
async function yahooSpark(specs) {
  const data = await yahooGet(
    "/v7/finance/spark?symbols=" + encodeURIComponent(specs.map((s) => s.ref).join(",")) + "&range=1d&interval=5m",
  );
  const byRef = Object.fromEntries(specs.map((s) => [s.ref, s.id]));
  const out = new Map();
  for (const item of data?.spark?.result ?? []) {
    const id = byRef[item.symbol];
    const r = item.response?.[0];
    const meta = r?.meta;
    if (!id || !meta?.regularMarketPrice) continue;
    const last = meta.regularMarketPrice;
    const dp = last > 0 && last < 10 ? 4 : 2;
    const closes = (r.indicators?.quote?.[0]?.close ?? []).filter((x) => x != null);
    const prevClose = meta.previousClose ?? meta.chartPreviousClose;
    out.set(id, {
      symbol: id,
      name: SYMBOLS[id]?.name ?? null,
      kind: SYMBOLS[id]?.kind ?? null,
      last: round(last, dp),
      open: closes.length ? round(closes[0], dp) : null,
      high: round(meta.regularMarketDayHigh, dp),
      low: round(meta.regularMarketDayLow, dp),
      prevClose: round(prevClose, dp),
      chg: round(last - prevClose, dp),
      chgPct: round(((last - prevClose) / prevClose) * 100, 2),
      volume: meta.regularMarketVolume ?? null,
      high52: round(meta.fiftyTwoWeekHigh, dp),
      low52: round(meta.fiftyTwoWeekLow, dp),
      exchange: meta.exchangeName ?? null,
      spark: downsample(closes, 30).map((x) => round(x, dp)),
      src: "live",
      t: (meta.regularMarketTime ?? 0) * 1000 || Date.now(),
    });
  }
  return out;
}

async function yahooChart(id, rangeKey) {
  const [range, interval] = RANGES[rangeKey];
  const data = await yahooGet(
    `/v8/finance/chart/${encodeURIComponent(SYMBOLS[id]?.ref ?? id)}?range=${range}&interval=${interval}`,
  );
  const r = data?.chart?.result?.[0];
  if (!r?.timestamp) throw new Error("yahoo: empty chart");
  const q = r.indicators.quote[0];
  const candles = [];
  for (let i = 0; i < r.timestamp.length; i++) {
    if (q.close[i] == null) continue;
    candles.push({
      t: r.timestamp[i] * 1000,
      o: q.open[i] ?? q.close[i],
      h: q.high[i] ?? q.close[i],
      l: q.low[i] ?? q.close[i],
      c: q.close[i],
      v: q.volume[i] ?? 0,
    });
  }
  const m = r.meta;
  return {
    candles,
    meta: {
      name: m.longName ?? SYMBOLS[id]?.name ?? id,
      currency: m.currency,
      exchange: m.fullExchangeName ?? m.exchangeName,
      high52: m.fiftyTwoWeekHigh ?? null,
      low52: m.fiftyTwoWeekLow ?? null,
      prevClose: m.previousClose ?? m.chartPreviousClose ?? null,
      marketState: m.marketState ?? null,
    },
  };
}

/* ---------- Yahoo crumb (cookie-authenticated endpoints) ---------- */

// v7/quote and v10/quoteSummary require a session cookie + crumb token.
// Both are free and keyless; the pair is cached and refreshed on 401/403.
let yAuth = null; // { cookie, crumb, headers, exp }

// The crumb is tied to the session cookie and user-agent, so the whole flow
// runs under one header set; on throttling it retries under the minimal UA.
async function yahooAuthWith(headers) {
  const res = await fetch("https://fc.yahoo.com/", {
    headers, redirect: "manual", signal: AbortSignal.timeout(6_000),
  });
  const cookie = (res.headers.get("set-cookie") || "").split(";")[0];
  if (!cookie) throw new Error("yahoo: no session cookie");
  const crumbRes = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", {
    headers: { ...headers, cookie }, signal: AbortSignal.timeout(6_000),
  });
  if (!crumbRes.ok) throw new Error(`yahoo crumb: HTTP ${crumbRes.status}`);
  const crumb = (await crumbRes.text()).trim();
  if (!crumb || crumb.includes("<")) throw new Error("yahoo: bad crumb");
  return { cookie, crumb, headers, exp: Date.now() + 1_800_000 };
}

async function yahooAuth(force = false) {
  if (!force && yAuth && Date.now() < yAuth.exp) return yAuth;
  try {
    yAuth = await yahooAuthWith(UA);
  } catch {
    yAuth = await yahooAuthWith(UA_MIN);
  }
  return yAuth;
}

async function yahooCrumbGet(pathAndQuery) {
  let auth = await yahooAuth();
  for (let attempt = 0; ; attempt++) {
    const url =
      `https://query2.finance.yahoo.com${pathAndQuery}` +
      `${pathAndQuery.includes("?") ? "&" : "?"}crumb=${encodeURIComponent(auth.crumb)}`;
    const res = await fetch(url, {
      headers: { ...auth.headers, cookie: auth.cookie },
      signal: AbortSignal.timeout(6_000),
    });
    if ((res.status === 401 || res.status === 403 || res.status === 429) && attempt === 0) {
      auth = await yahooAuth(true);
      continue;
    }
    if (!res.ok) {
      health.yahoo = { ok: false, t: Date.now(), error: `HTTP ${res.status}` };
      throw new Error(`yahoo: HTTP ${res.status}`);
    }
    health.yahoo = { ok: true, t: Date.now() };
    return res.json();
  }
}

const QUOTE_KINDS = {
  EQUITY: "Equity", ETF: "ETF", INDEX: "Index", CRYPTOCURRENCY: "Crypto",
  CURRENCY: "FX", FUTURE: "Cmdty", MUTUALFUND: "Fund",
};

function mapV7(r) {
  const last = r.regularMarketPrice;
  if (last == null) return null;
  const dp = last > 0 && last < 10 ? 4 : 2;
  return {
    symbol: String(r.symbol).toUpperCase(),
    name: String(r.longName ?? r.shortName ?? r.symbol).toUpperCase(),
    kind: QUOTE_KINDS[r.quoteType] ?? "Equity",
    last: round(last, dp),
    open: round(r.regularMarketOpen, dp),
    high: round(r.regularMarketDayHigh, dp),
    low: round(r.regularMarketDayLow, dp),
    prevClose: round(r.regularMarketPreviousClose, dp),
    chg: round(r.regularMarketChange, dp),
    chgPct: round(r.regularMarketChangePercent, 2),
    volume: r.regularMarketVolume ?? null,
    high52: round(r.fiftyTwoWeekHigh, dp),
    low52: round(r.fiftyTwoWeekLow, dp),
    exchange: r.fullExchangeName ?? r.exchange ?? null,
    marketCap: r.marketCap ?? null,
    pe: round(r.trailingPE, 2),
    eps: round(r.epsTrailingTwelveMonths, 2),
    src: "live",
    t: (r.regularMarketTime ?? 0) * 1000 || Date.now(),
  };
}

async function yahooQuotes(refs) {
  const data = await yahooCrumbGet(`/v7/finance/quote?symbols=${encodeURIComponent(refs.join(","))}`);
  return (data?.quoteResponse?.result ?? []).map(mapV7).filter(Boolean);
}

/* ---------- US market movers ---------- */

// S&P 100-ish large-cap universe plus Yahoo's trending list; one batched
// v7/quote call covers it, with spark batches as the keyless fallback.
const US_UNIVERSE = (
  "AAPL MSFT NVDA AMZN GOOGL GOOG META TSLA AVGO BRK-B LLY JPM UNH XOM V MA COST HD PG JNJ " +
  "WMT NFLX ABBV CRM BAC ORCL CVX WFC KO MRK CSCO ACN ADBE AMD PEP LIN TMO MCD ABT PM " +
  "IBM GE ISRG CAT QCOM TXN INTU VZ DIS BKNG SPGI GS NOW AXP T RTX PLTR MS HON AMGN " +
  "UBER NEE PFE UNP LOW BLK TJX COP SYK SCHW ETN AMAT PANW BSX DE BMY ADP MDT VRTX GILD " +
  "MMC SBUX C ADI LMT CB MU INTC PLD SO MO ELV ICE DUK REGN CL TGT FDX PGR EMR NKE " +
  "CMCSA KKR DELL ABNB CRWD MAR COIN F GM"
).split(" ");

async function trendingSymbols() {
  const data = await yahooGet("/v1/finance/trending/US?count=16");
  return (data?.finance?.result?.[0]?.quotes ?? [])
    .map((q) => String(q.symbol).toUpperCase())
    .filter((s) => TICKER_RE.test(s));
}

async function movers(now) {
  return cached("movers", 90_000, async () => {
    let trend = [];
    try { trend = await trendingSymbols(); } catch { /* trending is optional */ }
    let rows = [];
    try {
      rows = await yahooQuotes([...new Set([...US_UNIVERSE, ...trend])]);
    } catch {
      // crumb path down: spark batches still give price/change/volume
      const batches = [];
      for (let i = 0; i < US_UNIVERSE.length; i += 40) batches.push(US_UNIVERSE.slice(i, i + 40));
      const settled = await Promise.allSettled(
        batches.map((b) => yahooSpark(b.map((s) => ({ id: s, ref: s })))),
      );
      rows = settled.flatMap((r) => (r.status === "fulfilled" ? [...r.value.values()] : []));
    }
    if (!rows.length) {
      rows = (await allQuotes(now)).filter((q) => ["Equity", "ETF"].includes(q.kind));
    }
    const stocks = rows.filter((r) => r.last > 0 && r.chgPct != null && (r.kind == null || r.kind === "Equity"));
    const top = (arr) => arr.slice(0, 14);
    const byId = new Map(rows.map((r) => [r.symbol, r]));
    const actives = top([...stocks].sort((a, b) => (b.volume ?? 0) * b.last - (a.volume ?? 0) * a.last));
    const trending = top(trend.map((s) => byId.get(s)).filter(Boolean));
    return {
      src: rows.some((r) => r.src === "live") ? "live" : "sim",
      t: now,
      gainers: top([...stocks].sort((a, b) => b.chgPct - a.chgPct)),
      losers: top([...stocks].sort((a, b) => a.chgPct - b.chgPct)),
      actives,
      trending: trending.length ? trending : actives,
    };
  });
}

/* ---------- fundamentals ---------- */

const FUND_MODULES = "assetProfile,summaryDetail,defaultKeyStatistics,financialData,price";

async function fundamentals(id, ref) {
  return cached(`fund|${id}`, 1_800_000, async () => {
    try {
      const data = await yahooCrumbGet(
        `/v10/finance/quoteSummary/${encodeURIComponent(ref)}?modules=${FUND_MODULES}`,
      );
      const r = data?.quoteSummary?.result?.[0];
      if (!r) throw new Error("yahoo: empty summary");
      const num = (x) => (typeof x === "object" ? x?.raw : x) ?? null;
      const p = r.price ?? {}, sd = r.summaryDetail ?? {}, ks = r.defaultKeyStatistics ?? {};
      const fd = r.financialData ?? {}, ap = r.assetProfile ?? {};
      return {
        src: "live",
        symbol: id,
        name: p.longName ?? p.shortName ?? id,
        currency: p.currency ?? "USD",
        sector: ap.sector ?? null,
        industry: ap.industry ?? null,
        employees: ap.fullTimeEmployees ?? null,
        website: ap.website ?? null,
        summary: ap.longBusinessSummary ?? null,
        marketCap: num(p.marketCap) ?? num(sd.marketCap),
        trailingPE: num(sd.trailingPE),
        forwardPE: num(ks.forwardPE),
        eps: num(ks.trailingEps),
        beta: num(sd.beta),
        dividendYield: num(sd.dividendYield),
        payoutRatio: num(sd.payoutRatio),
        profitMargin: num(fd.profitMargins),
        grossMargin: num(fd.grossMargins),
        operatingMargin: num(fd.operatingMargins),
        revenue: num(fd.totalRevenue),
        revenueGrowth: num(fd.revenueGrowth),
        freeCashflow: num(fd.freeCashflow),
        totalCash: num(fd.totalCash),
        totalDebt: num(fd.totalDebt),
        returnOnEquity: num(fd.returnOnEquity),
        targetMeanPrice: num(fd.targetMeanPrice),
        recommendation: fd.recommendationKey ?? null,
        analystCount: num(fd.numberOfAnalystOpinions),
        sharesOutstanding: num(ks.sharesOutstanding),
        priceToBook: num(ks.priceToBook),
        avgVolume: num(sd.averageVolume),
        high52: num(sd.fiftyTwoWeekHigh),
        low52: num(sd.fiftyTwoWeekLow),
      };
    } catch (e) {
      // degrade to the leaner batch-quote fields
      const [row] = await yahooQuotes([ref]).catch(() => []);
      if (!row) throw e;
      return {
        src: "partial", symbol: id, name: row.name, currency: "USD",
        marketCap: row.marketCap, trailingPE: row.pe, eps: row.eps,
        high52: row.high52, low52: row.low52, avgVolume: row.volume,
      };
    }
  });
}

/* ================= Binance ================= */

async function binanceQuotes(ids) {
  const refs = ids.map((id) => SYMBOLS[id].ref);
  const url =
    "https://api.binance.com/api/v3/ticker/24hr?symbols=" +
    encodeURIComponent(JSON.stringify(refs));
  const data = await upstream("binance", url);
  const out = new Map();
  for (const tkr of data ?? []) {
    const id = REF_TO_ID[tkr.symbol];
    if (!id) continue;
    const dp = dpFor(id);
    const last = Number(tkr.lastPrice);
    const open24 = Number(tkr.openPrice);
    out.set(id, {
      symbol: id,
      name: SYMBOLS[id].name,
      kind: SYMBOLS[id].kind,
      last: round(last, dp),
      open: round(open24, dp),
      high: round(Number(tkr.highPrice), dp),
      low: round(Number(tkr.lowPrice), dp),
      prevClose: round(open24, dp), // 24h convention
      chg: round(Number(tkr.priceChange), dp),
      chgPct: round(Number(tkr.priceChangePercent), 2),
      volume: Math.round(Number(tkr.quoteVolume)),
      exchange: "BINANCE",
      spark: null, // filled from klines below
      src: "live",
      t: tkr.closeTime ?? Date.now(),
    });
  }
  return out;
}

async function binanceKlines(id, rangeKey) {
  const [, , interval, limit] = RANGES[rangeKey];
  const url =
    `https://api.binance.com/api/v3/klines?symbol=${SYMBOLS[id].ref}` +
    `&interval=${interval}&limit=${limit}`;
  const data = await upstream("binance", url);
  const candles = (data ?? []).map((k) => ({
    t: k[0],
    o: Number(k[1]),
    h: Number(k[2]),
    l: Number(k[3]),
    c: Number(k[4]),
    v: Math.round(Number(k[7])),
  }));
  if (!candles.length) throw new Error("binance: empty klines");
  return {
    candles,
    meta: { name: SYMBOLS[id].name, currency: "USD", exchange: "BINANCE", marketState: "24H" },
  };
}

async function binanceSpark(id) {
  return cached(`bspark|${id}`, 120_000, async () => {
    const url = `https://api.binance.com/api/v3/klines?symbol=${SYMBOLS[id].ref}&interval=15m&limit=96`;
    const data = await upstream("binance", url);
    const dp = dpFor(id);
    return downsample((data ?? []).map((k) => Number(k[4])), 30).map((x) => round(x, dp));
  });
}

function downsample(arr, n) {
  if (arr.length <= n) return arr;
  const stride = arr.length / n;
  return Array.from({ length: n }, (_, i) => arr[Math.floor(i * stride)]);
}

/* ================= endpoint assembly ================= */

async function allQuotes(now) {
  return cached("quotes", 20_000, async () => {
    const ids = Object.keys(SYMBOLS);
    const yahooIds = ids.filter((id) => SYMBOLS[id].provider === "yahoo");
    const binanceIds = ids.filter((id) => SYMBOLS[id].provider === "binance");

    const [y, b] = await Promise.allSettled([
      yahooSpark(yahooIds.map((id) => ({ id, ref: SYMBOLS[id].ref }))),
      binanceQuotes(binanceIds),
    ]);
    const live = new Map([
      ...(y.status === "fulfilled" ? y.value : new Map()),
      ...(b.status === "fulfilled" ? b.value : new Map()),
    ]);

    // crypto sparklines (best effort)
    if (b.status === "fulfilled") {
      await Promise.allSettled(
        binanceIds.map(async (id) => {
          const q = live.get(id);
          if (q) q.spark = await binanceSpark(id).catch(() => null);
        }),
      );
    }

    return ids.map((id) => live.get(id) ?? simQuote(id, now));
  });
}

async function historyFor(id, rangeKey, now) {
  const ttl = RANGES[rangeKey][4];
  const spec = SYMBOLS[id];
  return cached(`hist|${id}|${rangeKey}`, ttl, async () => {
    try {
      const fetcher = spec?.provider === "binance" ? binanceKlines : yahooChart;
      const { candles, meta } = await fetcher(id, rangeKey);
      return { src: "live", candles, meta };
    } catch (e) {
      if (!spec) throw e; // ad-hoc ticker: the client falls back to its own simulation
      const bucketMs = { "1D": 300_000, "5D": 900_000, "1M": 7_200_000, "6M": 86_400_000, "1Y": 86_400_000 }[rangeKey];
      const n = { "1D": 288, "5D": 240, "1M": 372, "6M": 183, "1Y": 365 }[rangeKey];
      return {
        src: "sim",
        candles: simCandles(id, bucketMs, n, now),
        meta: { name: spec.name, currency: "USD", exchange: "SIM", marketState: "SIM" },
      };
    }
  });
}

/* ---------- ad-hoc symbols & search ---------- */

const TICKER_RE = /^[A-Z0-9.^=-]{1,12}$/;

function parseExtra(param) {
  return [...new Set(
    (param || "")
      .toUpperCase()
      .split(",")
      .map((s) => s.trim())
      .filter((s) => TICKER_RE.test(s) && !SYMBOLS[s]),
  )].slice(0, 12);
}

function parseSymbols(param, max = 8) {
  return [...new Set(
    (param || "")
      .toUpperCase()
      .split(",")
      .map((s) => s.trim())
      .filter((s) => TICKER_RE.test(s)),
  )].slice(0, max);
}

async function extraQuotes(ids) {
  if (!ids.length) return [];
  const key = "xq|" + ids.join(",");
  return cached(key, 20_000, async () => {
    const out = await yahooSpark(ids.map((id) => ({ id, ref: id })));
    return [...out.values()];
  }).catch(() => []); // extras are best effort; the client keeps prior values
}

const SEARCH_KINDS = {
  EQUITY: "Equity", ETF: "ETF", INDEX: "Index", CRYPTOCURRENCY: "Crypto",
  CURRENCY: "FX", FUTURE: "Cmdty", MUTUALFUND: "Fund",
};

async function searchSymbols(q) {
  return cached(`srch|${q.toLowerCase()}`, 3_600_000, async () => {
    const data = await yahooGet(
      `/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=8&newsCount=0&listsCount=0`,
    );
    return (data?.quotes ?? [])
      .filter((r) => r.symbol && SEARCH_KINDS[r.quoteType])
      .map((r) => ({
        symbol: String(r.symbol).toUpperCase(),
        name: String(r.longname ?? r.shortname ?? r.symbol).toUpperCase(),
        kind: SEARCH_KINDS[r.quoteType],
        exchange: r.exchDisp ?? null,
      }));
  });
}

function localSearch(q) {
  const needle = q.toUpperCase();
  return Object.entries(SYMBOLS)
    .filter(([id, s]) => id.includes(needle) || s.name.toUpperCase().includes(needle))
    .slice(0, 8)
    .map(([id, s]) => ({ symbol: id, name: s.name, kind: s.kind, exchange: null }));
}

/* ---------- news ---------- */

const FEEDS = [
  ["CNBC", "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrbm&id=100003114"],
  ["YAHOO FIN", "https://finance.yahoo.com/news/rssindex"],
];

function decodeEntities(s) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function parseRSS(xml, source) {
  const items = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const block = m[1];
    const pick = (tag) => {
      const mm = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
      return mm ? mm[1].trim() : "";
    };
    const headline = decodeEntities(pick("title"));
    if (!headline) continue;
    items.push({
      t: Date.parse(pick("pubDate")) || Date.now(),
      source,
      headline,
      link: decodeEntities(pick("link")) || null,
    });
  }
  return items;
}

// Per-symbol headlines: Yahoo's per-ticker RSS feed, with the search
// endpoint's news block as a keyless fallback.
async function symbolNews(id) {
  const ref = SYMBOLS[id]?.provider === "yahoo" ? SYMBOLS[id].ref : id;
  return cached(`snews|${id}`, 300_000, async () => {
    try {
      const xml = await upstream(
        "news",
        `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(ref)}&region=US&lang=en-US`,
        true,
      );
      const items = parseRSS(xml, "YAHOO FIN").map((n) => ({ ...n, symbol: id }));
      if (!items.length) throw new Error("empty feed");
      return items;
    } catch {
      const data = await yahooGet(
        `/v1/finance/search?q=${encodeURIComponent(ref)}&quotesCount=0&newsCount=10&listsCount=0`,
      );
      const items = (data?.news ?? [])
        .map((n) => ({
          t: (n.providerPublishTime ?? 0) * 1000 || Date.now(),
          source: n.publisher ?? "YAHOO",
          headline: n.title,
          link: n.link ?? null,
          symbol: id,
        }))
        .filter((n) => n.headline);
      if (!items.length) throw new Error("no news");
      return items;
    }
  });
}

async function newsForSymbols(ids, now) {
  const settled = await Promise.allSettled(ids.map(symbolNews));
  const items = settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  if (!items.length) return { src: "sim", items: simNews(now) };
  items.sort((a, b) => b.t - a.t);
  const seen = new Set();
  const dedup = items.filter((n) => {
    const k = n.headline.toLowerCase().slice(0, 60);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return { src: "live", items: dedup.slice(0, 30) };
}

async function allNews(now) {
  return cached("news", 240_000, async () => {
    const results = await Promise.allSettled(
      FEEDS.map(async ([source, url]) => parseRSS(await upstream("news", url, true), source)),
    );
    const items = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
    if (!items.length) return { src: "sim", items: simNews(now) };
    items.sort((a, b) => b.t - a.t);
    // de-duplicate near-identical headlines
    const seen = new Set();
    const dedup = items.filter((n) => {
      const k = n.headline.toLowerCase().slice(0, 60);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    return { src: "live", items: dedup.slice(0, 20) };
  });
}

/* ---------- weather ---------- */

async function weather(lat, lon) {
  const key = `wx|${Math.round(lat * 20) / 20}|${Math.round(lon * 20) / 20}`;
  return cached(key, 600_000, async () => {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,precipitation,` +
      `wind_speed_10m,wind_direction_10m,wind_gusts_10m,pressure_msl,visibility` +
      `&hourly=temperature_2m,precipitation_probability,weather_code` +
      `&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max,` +
      `precipitation_sum,sunrise,sunset,uv_index_max&timezone=auto&forecast_days=10`;
    return upstream("weather", url);
  });
}

async function geocode(q) {
  return cached(`geo|${q.toLowerCase()}`, 86_400_000, async () => {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5`;
    return upstream("weather", url);
  });
}

/* ================= HTTP ================= */

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "access-control-allow-origin": "*",
};

const ok = (data) => new Response(JSON.stringify(data), { headers: JSON_HEADERS });
const err = (status, message) =>
  new Response(JSON.stringify({ error: message }), { status, headers: JSON_HEADERS });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const now = Date.now();

    if (path.startsWith("/api/")) {
      try {
        switch (path) {
          case "/api/quotes": {
            const [base, dyn] = await Promise.all([
              allQuotes(now),
              extraQuotes(parseExtra(url.searchParams.get("extra"))),
            ]);
            return ok({ t: now, quotes: [...base, ...dyn] });
          }

          case "/api/history": {
            const id = (url.searchParams.get("symbol") || "").toUpperCase();
            if (!SYMBOLS[id] && !TICKER_RE.test(id)) return err(404, `unknown symbol: ${id || "(none)"}`);
            const rangeKey = (url.searchParams.get("range") || "1D").toUpperCase();
            if (!RANGES[rangeKey]) return err(400, `bad range: ${rangeKey}`);
            const h = await historyFor(id, rangeKey, now);
            return ok({ symbol: id, range: rangeKey, t: now, ...h });
          }

          case "/api/search": {
            const q = (url.searchParams.get("q") || "").trim().slice(0, 40);
            if (!q) return err(400, "q required");
            try {
              return ok({ t: now, src: "live", results: await searchSymbols(q) });
            } catch {
              return ok({ t: now, src: "local", results: localSearch(q) });
            }
          }

          case "/api/news": {
            const ids = parseSymbols(url.searchParams.get("symbols"));
            if (ids.length) return ok({ t: now, ...(await newsForSymbols(ids, now)) });
            return ok({ t: now, ...(await allNews(now)) });
          }

          case "/api/movers":
            return ok(await movers(now));

          case "/api/fundamentals": {
            const id = (url.searchParams.get("symbol") || "").toUpperCase();
            if (!TICKER_RE.test(id)) return err(400, "symbol required");
            const ref = SYMBOLS[id]?.provider === "yahoo" ? SYMBOLS[id].ref : id;
            return ok({ t: now, ...(await fundamentals(id, ref)) });
          }

          case "/api/weather": {
            const lat = parseFloat(url.searchParams.get("lat"));
            const lon = parseFloat(url.searchParams.get("lon"));
            if (!Number.isFinite(lat) || !Number.isFinite(lon)) return err(400, "lat/lon required");
            return ok(await weather(lat, lon));
          }

          case "/api/geocode": {
            const q = (url.searchParams.get("q") || "").trim();
            if (!q) return err(400, "q required");
            return ok(await geocode(q));
          }

          case "/api/status":
            return ok({
              t: now,
              colo: request.cf?.colo ?? "DEV",
              country: request.cf?.country ?? "XX",
              providers: health,
              symbols: Object.keys(SYMBOLS),
            });

          default:
            return err(404, "not found");
        }
      } catch (e) {
        return err(502, `upstream failure: ${String(e.message ?? e)}`);
      }
    }

    // Non-API, non-asset path: serve the SPA shell so deep links land on the desktop.
    return env.ASSETS.fetch(new Request(new URL("/", url), request));
  },
};
