/**
 * Terminal — a small zsh-flavoured shell for SewingOS.
 */
export function createCLI(OS) {
  const root = document.createElement("div");
  root.className = "cli";
  root.innerHTML = `<div class="cli-out"></div>
    <div class="cli-line"><span class="cli-prompt">jeremmy@sewingos ~ %</span><input class="cli-in" spellcheck="false" autocomplete="off" /></div>`;

  const out = root.querySelector(".cli-out");
  const input = root.querySelector(".cli-in");
  const history = [];
  let hIdx = -1;

  const print = (text = "", cls = "") => {
    const div = document.createElement("div");
    div.className = "cli-row " + cls;
    div.textContent = text;
    out.appendChild(div);
    out.scrollTop = out.scrollHeight;
  };

  const FILES = {
    "readme.txt":
      "SewingOS — a macOS-style web desktop on Cloudflare Workers.\n" +
      "Market data: Yahoo Finance + Binance (live). Weather: Open-Meteo.\n" +
      "Source layout: src/index.js (Worker API) + public/ (this UI).",
    "motd.txt": "Measure twice, cut once. — every tailor ever",
  };

  const COMMANDS = {
    help: () =>
      print(
        "Commands: help, clear, date, whoami, uname, echo <text>, ls, cat <file>,\n" +
        "open <app>, apps, quote <SYMBOL>, neofetch",
      ),
    clear: () => (out.innerHTML = ""),
    date: () => print(new Date().toString()),
    whoami: () => print("jeremmy"),
    uname: () => print("SewingOS 27 (Golden Gate) cloudflare-edge wasm64"),
    ls: () => print(Object.keys(FILES).join("  ") + "  Applications/"),
    apps: () => print([...OS.appIds()].join(", ")),
    cat: (args) => {
      const f = FILES[args[0]];
      f === undefined ? print(`cat: ${args[0] ?? ""}: No such file`, "err") : print(f);
    },
    echo: (args) => print(args.join(" ")),
    open: (args) => {
      const id = (args[0] ?? "").toLowerCase();
      if (OS.hasApp(id)) { OS.launch(id); print(`Opening ${id}…`); }
      else print(`open: no app named "${id}". Try: apps`, "err");
    },
    quote: async (args) => {
      const sym = (args[0] ?? "").toUpperCase();
      if (!sym) return print("usage: quote <SYMBOL>   e.g. quote NVDA", "err");
      try {
        const d = await (await fetch("/api/quotes")).json();
        const q = d.quotes.find((x) => x.symbol === sym);
        if (!q) return print(`quote: unknown symbol ${sym}`, "err");
        const sign = q.chg >= 0 ? "+" : "";
        print(`${q.symbol}  ${q.last}  ${sign}${q.chg} (${sign}${q.chgPct}%)  [${q.src.toUpperCase()}]`,
          q.chg >= 0 ? "ok" : "err");
      } catch {
        print("quote: feed unreachable", "err");
      }
    },
    neofetch: () => {
      print(
        "        ✦         jeremmy@sewingos\n" +
        "      ✦ ✦ ✦       -----------------\n" +
        "    ✦ ✦ ✦ ✦ ✦     OS: SewingOS 27 Golden Gate\n" +
        "      ✦ ✦ ✦       Host: Cloudflare Workers (edge)\n" +
        "        ✦         Shell: sew-zsh 1.0\n" +
        "                  UI: vanilla JS, zero frameworks\n" +
        `                  Resolution: ${innerWidth}x${innerHeight}\n` +
        `                  Uptime: ${Math.round(performance.now() / 1000)}s`,
      );
    },
  };

  async function run(line) {
    print(`jeremmy@sewingos ~ % ${line}`, "cmd");
    const [cmd, ...args] = line.split(/\s+/);
    const fn = COMMANDS[cmd];
    if (fn) await fn(args);
    else print(`zsh: command not found: ${cmd}`, "err");
  }

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const line = input.value.trim();
      input.value = "";
      if (line) { history.push(line); hIdx = history.length; run(line); }
    } else if (e.key === "ArrowUp") {
      if (hIdx > 0) { hIdx--; input.value = history[hIdx]; e.preventDefault(); }
    } else if (e.key === "ArrowDown") {
      if (hIdx < history.length - 1) { hIdx++; input.value = history[hIdx]; }
      else { hIdx = history.length; input.value = ""; }
    }
  });

  root.addEventListener("click", () => input.focus());
  print("SewingOS Terminal — type `help` to get started.");
  setTimeout(() => input.focus(), 50);
  return root;
}
