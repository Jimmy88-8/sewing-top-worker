/**
 * Additional SewingOS applications backed by the Tahoe icon collection.
 * These are local, frontend-only apps and never pretend to be signed in to
 * third-party services.
 */
import { EXTRA_ICONS } from "/js/icons.js";

const APPS = [
  ["activity-monitor", "Activity Monitor", "activityMonitor", createActivity, 680, 430],
  ["apps", "Apps", "apps", createApps, 700, 480],
  ["bluetooth", "Bluetooth", "bluetooth", createBluetooth, 480, 390],
  ["books", "Books", "books", createBooks, 700, 460],
  ["claude", "Claude", "claude", createAssistant, 620, 470],
  ["dictionary", "Dictionary", "dictionary", createDictionary, 560, 420],
  ["discord", "Discord", "discord", createChat, 700, 470],
  ["find-my", "Find My", "findMy", createFindMy, 640, 430],
  ["freeform", "Freeform", "freeform", createFreeform, 720, 480],
  ["games", "Games", "games", createGames, 760, 500],
  ["gemini", "Gemini", "gemini", createAssistant, 620, 470],
  ["chrome", "Google Chrome", "chrome", createBrowser, 780, 520],
  ["google-docs", "Google Docs", "googleDocs", createEditor, 700, 500],
  ["google-drive", "Google Drive", "googleDrive", createDrive, 680, 450],
  ["google", "Google", "google", createBrowser, 720, 480],
  ["translate", "Google Translate", "translate", createTranslate, 620, 430],
  ["mail", "Mail", "mail", createMail, 720, 480],
  ["maps", "Maps", "maps", createMaps, 650, 440],
  ["music", "Music", "music", createMusic, 680, 460],
  ["notion", "Notion", "notion", createEditor, 700, 500],
  ["geforce-now", "NVIDIA GeForce NOW", "geforceNow", createGames, 720, 470],
  ["photos", "Photos", "photos", createPhotos, 720, 480],
  ["quicktime", "QuickTime Player", "quicktime", createQuickTime, 680, 460],
  ["reminders", "Reminders", "reminders", createReminders, 560, 440],
  ["rockstar", "Rockstar Games Launcher", "rockstar", createGames, 720, 470],
  ["safari", "Safari", "safari", createBrowser, 780, 520],
  ["screenshot", "Screenshot", "screenshot", createScreenshot, 580, 420],
  ["shortcuts", "Shortcuts", "shortcuts", createShortcuts, 660, 450],
  ["spotify", "Spotify", "spotify", createMusic, 680, 460],
  ["time-machine", "Time Machine", "timeMachine", createTimeMachine, 620, 440],
  ["widgetsmith", "Widgetsmith", "widgetsmith", createWidgetsmith, 620, 450],
];

const WEB_URLS = {
  claude: "https://claude.ai/",
  gemini: "https://gemini.google.com/",
  chrome: "https://www.google.com/",
  google: "https://www.google.com/",
  safari: "https://www.apple.com/",
  discord: "https://discord.com/app",
  "google-docs": "https://docs.google.com/",
  "google-drive": "https://drive.google.com/",
  notion: "https://www.notion.so/",
  spotify: "https://open.spotify.com/",
  "geforce-now": "https://play.geforcenow.com/",
  rockstar: "https://www.rockstargames.com/",
};

function node(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text != null) el.textContent = text;
  return el;
}

function rootFor(kind) {
  const root = node("div", `utility-app utility-${kind}`);
  return root;
}

function readJSON(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function openExternal(url) {
  window.open(url, "_blank", "noopener,noreferrer");
}

function addExternalButton(root, spec, label = "Open web app") {
  const url = WEB_URLS[spec.id];
  if (!url) return;
  const button = node("button", "util-button util-secondary", label);
  button.addEventListener("click", () => openExternal(url));
  root.appendChild(button);
}

export function registerAdditionalApps(OS) {
  for (const [id, name, iconKey, factory, width, height] of APPS) {
    const spec = { id, name, icon: EXTRA_ICONS[iconKey] };
    OS.registerApp({
      ...spec,
      dock: id === "apps",
      open() {
        return {
          title: name,
          width,
          height,
          x: 80 + (id.length * 17) % 260,
          y: 48 + (id.length * 11) % 120,
          minWidth: Math.min(width, 440),
          minHeight: Math.min(height, 320),
        };
      },
      onOpen(win) {
        win.body.appendChild(factory(spec, OS));
      },
    });
  }
}

function createToolbar(title, subtitle) {
  const toolbar = node("div", "util-toolbar");
  const copy = node("div", "util-toolbar-copy");
  copy.append(node("b", "", title), node("span", "", subtitle));
  toolbar.appendChild(copy);
  return toolbar;
}

function createActivity() {
  const root = rootFor("activity");
  root.appendChild(createToolbar("Activity Monitor", "Live SewingOS activity"));
  const table = node("div", "process-table");
  const footer = node("div", "activity-footer");
  const canvas = node("canvas", "activity-graph");
  const legend = node("div", "activity-legend");
  footer.append(legend, canvas);
  const processes = [
    ["Bloomberg Professional", 6.2, 188],
    ["SewingOS WindowServer", 3.1, 142],
    ["IBKR Desktop", 2.2, 117],
    ["cloudflared-edge", 1.4, 64],
    ["Weather", 0.6, 38],
    ["Finder", 0.3, 34],
    ["Spotlight", 0.1, 21],
    ["notesd", 0.1, 18],
  ];
  const history = Array(80).fill(8);

  const render = () => {
    const total = processes.reduce((s, p) => s + p[1], 0);
    table.innerHTML = `
      <div class="process-row process-head"><span>Process Name</span><span>% CPU</span><span>Memory</span></div>
      ${processes
        .slice()
        .sort((a, b) => b[1] - a[1])
        .map(([name, cpu, memory]) => `
        <div class="process-row"><span>${name}</span><span>${cpu.toFixed(1)}</span><span>${memory.toFixed(0)} MB</span></div>
      `).join("")}`;
    legend.innerHTML = `<b>CPU Load</b><span>${total.toFixed(1)}% user · ${(total * 0.4).toFixed(1)}% system</span>`;
  };

  const drawGraph = () => {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    const W = rect.width, H = rect.height;
    ctx.clearRect(0, 0, W, H);
    ctx.beginPath();
    history.forEach((v, i) => {
      const x = (i / (history.length - 1)) * W;
      const y = H - 2 - (v / 40) * (H - 6);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.strokeStyle = "#30d158";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
    ctx.fillStyle = "rgba(48, 209, 88, 0.15)";
    ctx.fill();
  };

  const tick = () => {
    for (const row of processes) {
      row[1] = Math.max(0.1, Math.min(28, row[1] + (Math.random() - 0.5) * row[1] * 0.6));
      row[2] = Math.max(12, row[2] + (Math.random() - 0.5) * 4);
    }
    history.push(processes.reduce((s, p) => s + p[1], 0));
    history.shift();
    render();
    drawGraph();
  };

  const timer = setInterval(tick, 1500);
  new MutationObserver((_, obs) => {
    if (!root.isConnected) { clearInterval(timer); obs.disconnect(); }
  }).observe(document.body, { childList: true, subtree: true });
  new ResizeObserver(drawGraph).observe(canvas);

  render();
  root.append(table, footer);
  return root;
}

function createApps(spec, OS) {
  const root = rootFor("apps");
  root.appendChild(createToolbar("Applications", "Everything installed in SewingOS"));
  const grid = node("div", "app-catalog");
  for (const app of OS.appList().filter((item) => item.finder !== false && item.id !== spec.id)) {
    const card = node("button", "app-catalog-item");
    card.innerHTML = `<span>${app.icon}</span><b></b>`;
    card.querySelector("b").textContent = app.name;
    card.addEventListener("click", () => OS.launch(app.id, card));
    grid.appendChild(card);
  }
  root.appendChild(grid);
  return root;
}

function createBluetooth() {
  const root = rootFor("bluetooth");
  const toolbar = createToolbar("Bluetooth", "Discoverable as SewingOS");
  const master = node("button", "util-switch active", "On");
  toolbar.appendChild(master);
  const list = node("div", "util-list");
  const devices = [
    ["Magic Keyboard", "Connected"],
    ["Jeremy's AirPods", "Not Connected"],
    ["MX Master 3S", "Connected"],
  ];
  let enabled = true;
  const render = () => {
    list.innerHTML = "";
    for (const [name, initial] of devices) {
      const row = node("button", "util-list-row");
      const status = enabled ? initial : "Bluetooth Off";
      row.innerHTML = `<span><b></b><small></small></span><span class="util-status"></span>`;
      row.querySelector("b").textContent = name;
      row.querySelector("small").textContent = "Nearby device";
      row.querySelector(".util-status").textContent = status;
      row.disabled = !enabled;
      row.addEventListener("click", () => {
        const label = row.querySelector(".util-status");
        label.textContent = label.textContent === "Connected" ? "Not Connected" : "Connected";
      });
      list.appendChild(row);
    }
  };
  master.addEventListener("click", () => {
    enabled = !enabled;
    master.classList.toggle("active", enabled);
    master.textContent = enabled ? "On" : "Off";
    render();
  });
  render();
  root.append(toolbar, list);
  return root;
}

function createBooks() {
  const root = rootFor("books");
  root.appendChild(createToolbar("Library", "Four books available offline"));
  const layout = node("div", "split-app");
  const list = node("div", "split-list");
  const detail = node("div", "split-detail");
  const books = [
    ["Designing Interfaces", "Jenifer Tidwell", "Patterns for effective interaction design."],
    ["The Pragmatic Programmer", "Andrew Hunt", "A practical guide to software craftsmanship."],
    ["The Psychology of Money", "Morgan Housel", "Short stories about wealth and behavior."],
    ["Thinking in Systems", "Donella Meadows", "A primer for seeing systems clearly."],
  ];
  const hues = [28, 210, 150, 282];
  const show = ([title, author, summary], index) => {
    detail.innerHTML = "";
    const cover = node("div", "book-cover", title.slice(0, 1));
    const h = hues[index % hues.length];
    cover.style.background = `linear-gradient(145deg, hsl(${h} 75% 58%), hsl(${h + 28} 65% 30%))`;
    detail.append(cover, node("h2", "", title), node("p", "", author), node("p", "util-muted", summary));
  };
  books.forEach((book, index) => {
    const button = node("button", `split-row ${index === 0 ? "active" : ""}`);
    button.append(node("b", "", book[0]), node("small", "", book[1]));
    button.addEventListener("click", () => {
      list.querySelectorAll(".split-row").forEach((row) => row.classList.remove("active"));
      button.classList.add("active");
      show(book, index);
    });
    list.appendChild(button);
  });
  show(books[0], 0);
  layout.append(list, detail);
  root.appendChild(layout);
  return root;
}

function createAssistant(spec) {
  const root = rootFor("assistant");
  const toolbar = createToolbar(spec.name, "Local demo conversation");
  root.appendChild(toolbar);
  const messages = node("div", "assistant-messages");
  const composer = node("form", "assistant-compose");
  const input = node("input");
  input.placeholder = `Message ${spec.name}`;
  const send = node("button", "util-button", "Send");
  composer.append(input, send);
  const addMessage = (role, text) => {
    const bubble = node("div", `assistant-message ${role}`, text);
    messages.appendChild(bubble);
    messages.scrollTop = messages.scrollHeight;
  };
  addMessage("assistant", `${spec.name} is ready. This local demo does not send your text anywhere.`);
  composer.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    addMessage("user", text);
    input.value = "";
    addMessage("assistant", `I can help organize that idea inside SewingOS. For the full service, use the web app.`);
  });
  root.append(messages, composer);
  addExternalButton(toolbar, spec);
  return root;
}

function createDictionary() {
  const root = rootFor("dictionary");
  const toolbar = createToolbar("Dictionary", "English reference");
  const search = node("input", "util-search");
  search.placeholder = "Search a word";
  toolbar.appendChild(search);
  const result = node("article", "dictionary-result");
  const entries = {
    sewing: ["noun", "The craft or activity of fastening or joining with stitches."],
    interface: ["noun", "A point where systems, subjects, or organizations meet and interact."],
    terminal: ["noun", "A text-based interface used to communicate with a computer."],
    system: ["noun", "A set of connected things forming a complex whole."],
    design: ["noun", "A plan or specification made before something is created."],
    glass: ["noun", "A hard, transparent material; in UI design, a translucent layered surface."],
    market: ["noun", "A place or mechanism where buyers and sellers exchange assets."],
    edge: ["noun", "In computing, infrastructure located close to end users."],
    liquid: ["adjective", "Flowing freely; in finance, easily converted to cash."],
    worker: ["noun", "A lightweight serverless process that handles requests at the edge."],
  };
  const render = () => {
    const word = search.value.trim().toLowerCase() || "sewing";
    const entry = entries[word];
    result.innerHTML = "";
    result.append(node("h1", "", word));
    if (entry) {
      result.append(node("i", "", entry[0]), node("p", "", entry[1]));
    } else {
      result.append(node("p", "util-muted", "No offline definition. Try sewing, interface, terminal, system, or design."));
    }
  };
  search.addEventListener("input", render);
  render();
  root.append(toolbar, result);
  return root;
}

function createChat(spec) {
  const root = rootFor("chat");
  const toolbar = createToolbar("SewingOS Community", "Local channel preview");
  addExternalButton(toolbar, spec, "Open Discord");
  const layout = node("div", "chat-layout");
  const channels = node("div", "chat-channels");
  const main = node("div", "chat-main");
  const messages = node("div", "chat-messages");
  const history = {
    general: [["Jeremy", "The new icon set is looking sharp."], ["SewingBot", "All local services are online."]],
    design: [["Jeremy", "Bloomberg login screen now matches the real one."], ["SewingBot", "Design QA pass scheduled."]],
    markets: [["SewingBot", "NVDA GP <GO> — chart is live."], ["Jeremy", "Watching the 1Y trend today."]],
    music: [["SewingBot", "Now playing: Golden Gate Drive."]],
  };
  let channel = "general";

  const renderMessages = () => {
    messages.innerHTML = "";
    for (const [name, text] of history[channel]) {
      const row = node("div", "chat-message");
      row.append(node("b", "", name), node("span", "", text));
      messages.appendChild(row);
    }
    messages.scrollTop = messages.scrollHeight;
    input.placeholder = `Message #${channel}`;
    for (const c of channels.children) c.classList.toggle("on", c.dataset.ch === channel);
  };

  Object.keys(history).forEach((name) => {
    const b = node("button", "chat-channel", `# ${name}`);
    b.dataset.ch = name;
    b.addEventListener("click", () => { channel = name; renderMessages(); });
    channels.appendChild(b);
  });

  const form = node("form", "assistant-compose");
  const input = node("input");
  form.append(input, node("button", "util-button", "Send"));
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!input.value.trim()) return;
    history[channel].push(["You", input.value.trim()]);
    input.value = "";
    renderMessages();
  });
  main.append(messages, form);
  layout.append(channels, main);
  renderMessages();
  root.append(toolbar, layout);
  return root;
}

function createFindMy() {
  const root = rootFor("findmy");
  root.appendChild(createToolbar("Find My", "Sample device locations"));
  const layout = node("div", "split-app");
  const list = node("div", "split-list");
  const detail = node("div", "location-detail");
  const items = [
    ["MacBook Pro", "With You", "Updated now"],
    ["AirPods", "Office", "12 minutes ago"],
    ["Keys", "Home", "Yesterday"],
  ];
  const show = ([name, place, updated]) => {
    detail.innerHTML = "";
    detail.append(node("div", "location-pin"), node("h2", "", name), node("p", "", place), node("small", "", updated));
  };
  items.forEach((item) => {
    const button = node("button", "split-row");
    button.append(node("b", "", item[0]), node("small", "", item[1]));
    button.addEventListener("click", () => show(item));
    list.appendChild(button);
  });
  show(items[0]);
  layout.append(list, detail);
  root.appendChild(layout);
  return root;
}

function createFreeform() {
  const root = rootFor("freeform");
  const toolbar = createToolbar("Project Board", "Notes are saved in this browser");
  const add = node("button", "util-button", "Add note");
  toolbar.appendChild(add);
  const board = node("div", "freeform-board");
  const COLORS = ["#f4d86f", "#ffb38a", "#a8e6a1", "#9fd0ff", "#e3b8ff"];
  let notes = readJSON("sewingos.freeform", ["Ideas", "Launch checklist", "Icon review"]);
  const save = () => localStorage.setItem("sewingos.freeform", JSON.stringify(notes));
  const render = () => {
    board.innerHTML = "";
    notes.forEach((text, index) => {
      const wrap = node("div", "freeform-wrap");
      const area = node("textarea", "freeform-note");
      area.value = text;
      area.style.background = COLORS[index % COLORS.length];
      area.addEventListener("input", () => {
        notes[index] = area.value;
        save();
      });
      const remove = node("button", "freeform-x", "×");
      remove.title = "Delete note";
      remove.addEventListener("click", () => {
        notes.splice(index, 1);
        save();
        render();
      });
      wrap.append(area, remove);
      board.appendChild(wrap);
    });
  };
  add.addEventListener("click", () => {
    notes.push("New note");
    save();
    render();
  });
  render();
  root.append(toolbar, board);
  return root;
}

function normalizeUrl(value, searchBase) {
  const input = value.trim();
  if (!input) return searchBase;
  if (/^https?:\/\//i.test(input)) return input;
  if (input.includes(".") && !input.includes(" ")) return `https://${input}`;
  return `${searchBase}${encodeURIComponent(input)}`;
}

function createBrowser(spec) {
  const root = rootFor("browser");
  const toolbar = node("form", "browser-toolbar");
  const input = node("input");
  input.value = WEB_URLS[spec.id] ?? "https://www.google.com/";
  input.setAttribute("aria-label", "Address");
  const go = node("button", "util-button", "Open");
  toolbar.append(input, go);
  const start = node("div", "browser-start");
  start.innerHTML = `<span>${spec.icon}</span>`;
  start.append(node("h1", "", spec.name), node("p", "util-muted", "Enter an address or search term. Pages open in a new browser tab for security."));
  const quick = node("div", "browser-favs");
  const favs = [
    ["G", "Google", "https://google.com", "#4285f4"],
    ["S", "sewing.top", location.origin, "#ff9f0a"],
    ["B", "Bloomberg", "https://www.bloomberg.com", "#111111"],
    ["C", "Claude", "https://claude.ai", "#d97757"],
    ["Y", "YouTube", "https://youtube.com", "#ff0000"],
    ["W", "Wikipedia", "https://wikipedia.org", "#5b5b5b"],
    ["X", "X", "https://x.com", "#1d1d1f"],
    ["N", "Notion", "https://notion.so", "#3a3a3a"],
  ];
  for (const [letter, label, url, color] of favs) {
    const tile = node("button", "browser-fav");
    const badge = node("span", "browser-fav-badge", letter);
    badge.style.background = color;
    tile.append(badge, node("small", "", label));
    tile.addEventListener("click", () => openExternal(url));
    quick.appendChild(tile);
  }
  start.appendChild(quick);
  toolbar.addEventListener("submit", (event) => {
    event.preventDefault();
    openExternal(normalizeUrl(input.value, "https://www.google.com/search?q="));
  });
  root.append(toolbar, start);
  return root;
}

function createEditor(spec) {
  const root = rootFor("editor");
  const toolbar = createToolbar(spec.name, "Saved locally");
  const title = node("input", "editor-title");
  const body = node("textarea", "editor-body");
  const key = `sewingos.editor.${spec.id}`;
  const saved = readJSON(key, { title: "Untitled", body: "" });
  title.value = saved.title;
  body.value = saved.body;
  body.placeholder = "Start writing...";
  const save = () => localStorage.setItem(key, JSON.stringify({ title: title.value, body: body.value }));
  title.addEventListener("input", save);
  body.addEventListener("input", save);
  addExternalButton(toolbar, spec);
  root.append(toolbar, title, body);
  return root;
}

function createDrive(spec) {
  const root = rootFor("drive");
  const toolbar = createToolbar("My Drive", "Local sample files");
  addExternalButton(toolbar, spec);
  const list = node("div", "file-list");
  [
    ["SewingOS roadmap", "Document", "Today"],
    ["Icon exports", "Folder", "Yesterday"],
    ["Market research", "Spreadsheet", "Jun 8"],
    ["Launch assets", "Folder", "Jun 4"],
  ].forEach(([name, type, date]) => {
    const row = node("button", "file-row");
    row.append(node("b", "", name), node("span", "", type), node("span", "", date));
    row.addEventListener("dblclick", () => alert(`${name} is a local demo item.`));
    list.appendChild(row);
  });
  root.append(toolbar, list);
  return root;
}

function createTranslate() {
  const root = rootFor("translate");
  root.appendChild(createToolbar("Translate", "Offline phrase demo"));
  const panels = node("div", "translate-panels");
  const source = node("textarea");
  source.placeholder = "Enter English text";
  const target = node("textarea");
  target.readOnly = true;
  target.placeholder = "Translation";
  const phrases = {
    hello: "你好",
    "thank you": "谢谢",
    "good morning": "早上好",
    "good night": "晚安",
    weather: "天气",
    computer: "电脑",
    design: "设计",
    market: "市场",
    terminal: "终端",
    "stock market": "股市",
    news: "新闻",
    settings: "设置",
    music: "音乐",
    "see you tomorrow": "明天见",
  };
  const reverse = Object.fromEntries(Object.entries(phrases).map(([k, v]) => [v, k]));
  source.addEventListener("input", () => {
    const key = source.value.trim().toLowerCase();
    target.value = phrases[key] ?? reverse[source.value.trim()] ?? (key ? "Offline dictionary has no match." : "");
  });
  panels.append(source, target);
  root.appendChild(panels);
  return root;
}

function createMail() {
  const root = rootFor("mail");
  root.appendChild(createToolbar("Inbox", "3 messages"));
  const layout = node("div", "mail-layout");
  const list = node("div", "mail-list");
  const detail = node("div", "mail-detail");
  const messages = [
    ["Cloudflare", "Your deployment is live", "SewingOS was deployed successfully."],
    ["Design Team", "Tahoe icon review", "The new icons are ready for a final pass."],
    ["Market Desk", "Morning briefing", "Markets opened mixed with technology leading."],
  ];
  const show = ([sender, subject, body]) => {
    detail.innerHTML = "";
    detail.append(node("small", "", `From: ${sender}`), node("h2", "", subject), node("p", "", body));
  };
  messages.forEach((message) => {
    const row = node("button", "mail-row");
    row.append(node("b", "", message[0]), node("span", "", message[1]));
    row.addEventListener("click", () => show(message));
    list.appendChild(row);
  });
  show(messages[0]);
  layout.append(list, detail);
  root.appendChild(layout);
  return root;
}

function createMaps() {
  const root = rootFor("maps");
  const toolbar = createToolbar("Maps", "OpenStreetMap");
  const search = node("input", "util-search");
  search.placeholder = "Search a place… (Enter)";
  toolbar.appendChild(search);
  const places = [
    ["Kuala Lumpur", 3.139, 101.6869],
    ["Singapore", 1.3521, 103.8198],
    ["Tokyo", 35.6762, 139.6503],
    ["San Francisco", 37.7749, -122.4194],
  ];
  const chips = node("div", "maps-chips");
  const frame = node("iframe", "maps-frame");
  frame.title = "Map";
  frame.referrerPolicy = "no-referrer";
  const status = node("div", "maps-status");

  const show = (label, lat, lon) => {
    const d = 0.04;
    frame.src = `https://www.openstreetmap.org/export/embed.html?bbox=${lon - d}%2C${lat - d}%2C${lon + d}%2C${lat + d}&layer=mapnik&marker=${lat}%2C${lon}`;
    status.textContent = `${label} · ${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    for (const c of chips.children) c.classList.toggle("on", c.textContent === label);
  };

  for (const [name, lat, lon] of places) {
    const chip = node("button", "maps-chip", name);
    chip.addEventListener("click", () => show(name, lat, lon));
    chips.appendChild(chip);
  }

  search.addEventListener("keydown", async (event) => {
    if (event.key !== "Enter" || !search.value.trim()) return;
    status.textContent = `Searching “${search.value.trim()}”…`;
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(search.value.trim())}`);
      const d = await res.json();
      const hit = d.results?.[0];
      if (hit) show(hit.name, hit.latitude, hit.longitude);
      else status.textContent = "No place found.";
    } catch {
      status.textContent = "Search unavailable offline.";
    }
  });

  show(...places[0]);
  root.append(toolbar, chips, frame, status);
  return root;
}

function createMusic(spec) {
  const root = rootFor("music");
  const toolbar = createToolbar(spec.name, "Local player demo");
  addExternalButton(toolbar, spec);
  const tracks = spec.id === "spotify"
    ? [["Discover Weekly", "Made for you", 214], ["Daily Mix 1", "Indie · Dream pop", 187], ["Release Radar", "New this week", 243], ["Focus Flow", "Instrumental beats", 198]]
    : [["SewingOS Mix", "Various Artists", 226], ["Golden Gate Drive", "Midnight Runners", 204], ["Liquid Glass", "Translucent", 191], ["Edge Computing Blues", "The Isolates", 233]];
  let idx = 0, playing = false, pos = 28;

  const player = node("div", "music-player");
  player.innerHTML = `<span class="music-art">${spec.icon}</span>`;
  const title = node("h2");
  const artist = node("p", "util-muted");
  const range = node("input", "music-range");
  range.type = "range"; range.min = "0"; range.max = "100"; range.value = String(pos);
  const time = node("div", "music-time");
  const controls = node("div", "music-controls");
  const prev = node("button", "music-skip", "⏮");
  const control = node("button", "music-play", "▶");
  const next = node("button", "music-skip", "⏭");
  controls.append(prev, control, next);
  const list = node("div", "music-list");

  const fmtT = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const renderTrack = () => {
    const [t, a, dur] = tracks[idx];
    title.textContent = t;
    artist.textContent = a;
    time.textContent = `${fmtT(dur * pos / 100)} / ${fmtT(dur)}`;
    for (const [i, row] of [...list.children].entries()) row.classList.toggle("on", i === idx);
  };
  const select = (i) => { idx = i; pos = 0; range.value = "0"; renderTrack(); };

  tracks.forEach(([t, a], i) => {
    const row = node("button", "music-row");
    row.append(node("b", "", t), node("span", "", a));
    row.addEventListener("click", () => { select(i); });
    list.appendChild(row);
  });

  control.addEventListener("click", () => {
    playing = !playing;
    control.textContent = playing ? "⏸" : "▶";
  });
  prev.addEventListener("click", () => select((idx + tracks.length - 1) % tracks.length));
  next.addEventListener("click", () => select((idx + 1) % tracks.length));
  range.addEventListener("input", () => { pos = Number(range.value); renderTrack(); });

  const timer = setInterval(() => {
    if (!playing) return;
    pos += 100 / tracks[idx][2];
    if (pos >= 100) { select((idx + 1) % tracks.length); return; }
    range.value = String(pos);
    renderTrack();
  }, 1000);
  new MutationObserver((_, obs) => {
    if (!root.isConnected) { clearInterval(timer); obs.disconnect(); }
  }).observe(document.body, { childList: true, subtree: true });

  player.append(title, artist, range, time, controls);
  renderTrack();
  root.append(toolbar, player, list);
  return root;
}

function createGames(spec) {
  const root = rootFor("games");
  const toolbar = createToolbar(spec.name, spec.id === "games" ? "All games" : "Cloud library preview");
  addExternalButton(toolbar, spec, "Open service");
  const grid = node("div", "game-grid");
  const rockstarGames = [
    ["Grand Theft Auto V", "/images/games/urban-crime.jpg"],
    ["Red Dead Redemption 2", "/images/games/western-frontier.jpg"],
    ["L.A. Noire", "/images/games/noir-detective.jpg"],
  ];
  const cloudGames = [
    ["Cyberpunk 2077", "/images/games/cyber-future.jpg"],
    ["Fortnite", "/images/games/urban-crime.jpg"],
    ["Forza Horizon 5", "/images/games/western-frontier.jpg"],
    ["Baldur's Gate 3", "/images/games/noir-detective.jpg"],
  ];
  const games = spec.id === "rockstar"
    ? rockstarGames
    : spec.id === "geforce-now" ? cloudGames : [...rockstarGames, ...cloudGames];
  games.forEach(([name, cover]) => {
    const card = node("div", "game-card");
    const launch = node("button", "util-button", "Launch");
    const status = node("small", "", "Ready");
    launch.addEventListener("click", () => {
      status.textContent = "Demo launch complete";
      launch.textContent = "Play";
    });
    const image = node("img", "game-cover");
    image.src = cover;
    image.alt = "";
    card.append(image, node("b", "", name), status, launch);
    grid.appendChild(card);
  });
  root.append(toolbar, grid);
  return root;
}

function createPhotos() {
  const root = rootFor("photos");
  root.appendChild(createToolbar("Library", "Built-in SewingOS images"));
  const grid = node("div", "photo-grid");
  const sources = [
    "/wallpapers/sequoia.jpg",
    "/icons/finder.png",
    "/icons/weather.png",
    "/icons/notes.png",
    "/icons/photos-tahoe.png",
    "/icons/maps-tahoe.png",
  ];
  const preview = node("div", "photo-preview");
  const large = node("img");
  let current = 0;
  const showAt = (i) => {
    current = (i + sources.length) % sources.length;
    large.src = sources[current];
    preview.classList.add("open");
  };
  const navPrev = node("button", "photo-nav", "‹");
  const navNext = node("button", "photo-nav", "›");
  const close = node("button", "util-button", "Close");
  navPrev.addEventListener("click", () => showAt(current - 1));
  navNext.addEventListener("click", () => showAt(current + 1));
  close.addEventListener("click", () => preview.classList.remove("open"));
  preview.append(navPrev, large, navNext, close);
  sources.forEach((src, i) => {
    const button = node("button", "photo-cell");
    const img = node("img");
    img.src = src;
    img.alt = "";
    img.loading = "lazy";
    button.appendChild(img);
    button.addEventListener("click", () => showAt(i));
    grid.appendChild(button);
  });
  root.append(grid, preview);
  return root;
}

function createQuickTime() {
  const root = rootFor("quicktime");
  const toolbar = createToolbar("QuickTime Player", "Open a local video or audio file");
  const picker = node("input");
  picker.type = "file";
  picker.accept = "video/*,audio/*";
  toolbar.appendChild(picker);
  const empty = node("div", "media-empty", "Choose a media file to begin.");
  const media = node("video", "media-player");
  media.controls = true;
  picker.addEventListener("change", () => {
    const file = picker.files?.[0];
    if (!file) return;
    media.src = URL.createObjectURL(file);
    empty.hidden = true;
    media.hidden = false;
  });
  media.hidden = true;
  root.append(toolbar, empty, media);
  return root;
}

function createReminders() {
  const root = rootFor("reminders");
  root.appendChild(createToolbar("Reminders", "Saved locally"));
  const form = node("form", "reminder-form");
  const input = node("input");
  input.placeholder = "New reminder";
  form.append(input, node("button", "util-button", "Add"));
  const list = node("div", "reminder-list");
  let reminders = readJSON("sewingos.reminders", [
    { text: "Review application icons", done: false },
    { text: "Check the market dashboard", done: true },
  ]);
  const save = () => localStorage.setItem("sewingos.reminders", JSON.stringify(reminders));
  const render = () => {
    list.innerHTML = "";
    reminders.forEach((item, index) => {
      const row = node("label", `reminder-row ${item.done ? "done" : ""}`);
      const check = node("input");
      check.type = "checkbox";
      check.checked = item.done;
      const text = node("span", "", item.text);
      const remove = node("button", "reminder-remove", "Remove");
      check.addEventListener("change", () => {
        item.done = check.checked;
        save();
        render();
      });
      remove.addEventListener("click", (event) => {
        event.preventDefault();
        reminders.splice(index, 1);
        save();
        render();
      });
      row.append(check, text, remove);
      list.appendChild(row);
    });
  };
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!input.value.trim()) return;
    reminders.push({ text: input.value.trim(), done: false });
    input.value = "";
    save();
    render();
  });
  render();
  root.append(form, list);
  return root;
}

function createScreenshot() {
  const root = rootFor("screenshot");
  const toolbar = createToolbar("Screenshot", "Capture a screen or window you choose");
  const capture = node("button", "util-button", "Choose screen");
  toolbar.appendChild(capture);
  const result = node("div", "capture-result", "No capture yet.");
  capture.addEventListener("click", async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      result.textContent = "Screen capture is not supported in this browser.";
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const video = document.createElement("video");
      video.srcObject = stream;
      await video.play();
      await new Promise((resolve) => setTimeout(resolve, 120));
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d").drawImage(video, 0, 0);
      stream.getTracks().forEach((track) => track.stop());
      const img = node("img");
      img.src = canvas.toDataURL("image/png");
      result.innerHTML = "";
      result.appendChild(img);
    } catch {
      result.textContent = "Capture cancelled.";
    }
  });
  root.append(toolbar, result);
  return root;
}

function createShortcuts(spec, OS) {
  const root = rootFor("shortcuts");
  root.appendChild(createToolbar("All Shortcuts", "One-click SewingOS actions"));
  const grid = node("div", "shortcut-grid");
  const shortcuts = [
    ["Open Weather", () => OS.launch("weather")],
    ["Open Bloomberg", () => OS.launch("terminal")],
    ["New Note", () => OS.launch("notes")],
    ["Show Reminders", () => OS.launch("reminders")],
    ["Open Finder", () => OS.launch("finder")],
    ["System Settings", () => OS.launch("settings")],
  ];
  shortcuts.forEach(([name, action]) => {
    const button = node("button", "shortcut-card");
    button.innerHTML = `<span>${spec.icon}</span>`;
    button.appendChild(node("b", "", name));
    button.addEventListener("click", action);
    grid.appendChild(button);
  });
  root.appendChild(grid);
  return root;
}

function createTimeMachine() {
  const root = rootFor("timemachine");
  const toolbar = createToolbar("Time Machine", "Local SewingOS snapshots");
  const backup = node("button", "util-button", "Back Up Now");
  toolbar.appendChild(backup);
  const list = node("div", "backup-list");
  let snapshots = readJSON("sewingos.backups", []);
  const render = () => {
    list.innerHTML = "";
    if (!snapshots.length) list.appendChild(node("div", "util-empty", "No backups yet."));
    snapshots.forEach((snapshot) => {
      const row = node("div", "backup-row");
      row.append(node("b", "", new Date(snapshot.time).toLocaleString()), node("span", "", `${snapshot.items} local items`));
      list.appendChild(row);
    });
  };
  backup.addEventListener("click", () => {
    const reminders = readJSON("sewingos.reminders", []);
    const notes = localStorage.getItem("sewingos.notes") ? 1 : 0;
    snapshots.unshift({ time: Date.now(), items: reminders.length + notes });
    snapshots = snapshots.slice(0, 8);
    localStorage.setItem("sewingos.backups", JSON.stringify(snapshots));
    render();
  });
  render();
  root.append(toolbar, list);
  return root;
}

function createWidgetsmith() {
  const root = rootFor("widgets");
  root.appendChild(createToolbar("Widgetsmith", "Build a desktop widget"));
  const layout = node("div", "widget-layout");
  const controls = node("div", "widget-controls");
  const preview = node("div", "widget-preview");
  const title = node("input");
  title.value = "Kuala Lumpur";
  const color = node("input");
  color.type = "color";
  color.value = "#ff9f0a";
  const style = node("select");
  [["clock", "Clock"], ["weather", "Weather"], ["quote", "Quote"]].forEach(([value, label]) => {
    const option = node("option", "", label);
    option.value = value;
    style.appendChild(option);
  });
  controls.append(node("label", "", "Title"), title, node("label", "", "Accent"), color, node("label", "", "Style"), style);
  const render = () => {
    preview.style.setProperty("--widget-accent", color.value);
    preview.innerHTML = "";
    preview.append(node("small", "", title.value || "Widget"));
    const content = style.value === "clock"
      ? new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      : style.value === "weather" ? "29 C  Clear" : "Make it useful.";
    preview.appendChild(node("b", "", content));
  };
  title.addEventListener("input", render);
  color.addEventListener("input", render);
  style.addEventListener("change", render);
  const timer = setInterval(() => { if (style.value === "clock") render(); }, 1000);
  new MutationObserver((_, obs) => {
    if (!root.isConnected) { clearInterval(timer); obs.disconnect(); }
  }).observe(document.body, { childList: true, subtree: true });
  render();
  layout.append(controls, preview);
  root.appendChild(layout);
  return root;
}
