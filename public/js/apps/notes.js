/**
 * Notes — macOS-style two-pane notes with local persistence.
 * Migrates the old single-textarea note ("sewingos.notes") on first run.
 */

const KEY = "sewingos.notes.v2";

function loadNotes() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY));
    if (Array.isArray(v) && v.length) return v;
  } catch { /* fall through to defaults */ }
  const legacy = localStorage.getItem("sewingos.notes");
  const seed = [{
    id: crypto.randomUUID(),
    text: legacy || "Welcome to Notes\nEverything you type is saved in this browser.",
    t: Date.now(),
  }];
  return seed;
}

const titleOf = (n) => (n.text.split("\n")[0] || "New Note").slice(0, 64);
const previewOf = (n) => (n.text.split("\n").slice(1).join(" ").trim() || "No additional text").slice(0, 80);
const dateOf = (n) => {
  const d = new Date(n.t);
  const today = new Date();
  return d.toDateString() === today.toDateString()
    ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString([], { month: "short", day: "numeric" });
};

export function createNotes() {
  let notes = loadNotes();
  let sel = notes[0].id;

  const root = document.createElement("div");
  root.className = "notes";
  root.innerHTML = `
    <div class="notes-list">
      <div class="notes-listbar">
        <span class="section-label">All Notes</span>
        <button class="notes-new" title="New note">＋</button>
      </div>
      <div class="notes-rows"></div>
    </div>
    <div class="notes-editor">
      <div class="notes-meta"></div>
      <textarea class="notes-text" placeholder="Start writing…" spellcheck="false"></textarea>
      <button class="notes-delete" title="Delete note">Delete</button>
    </div>`;

  const rowsEl = root.querySelector(".notes-rows");
  const textEl = root.querySelector(".notes-text");
  const metaEl = root.querySelector(".notes-meta");

  const save = () => localStorage.setItem(KEY, JSON.stringify(notes));
  const current = () => notes.find((n) => n.id === sel) ?? notes[0];

  function renderList() {
    notes.sort((a, b) => b.t - a.t);
    rowsEl.innerHTML = "";
    for (const n of notes) {
      const row = document.createElement("button");
      row.className = "notes-row" + (n.id === sel ? " active" : "");
      const b = document.createElement("b");
      b.textContent = titleOf(n);
      const small = document.createElement("small");
      small.textContent = `${dateOf(n)} · ${previewOf(n)}`;
      row.append(b, small);
      row.addEventListener("click", () => { sel = n.id; renderList(); renderEditor(); });
      rowsEl.appendChild(row);
    }
  }

  function renderEditor() {
    const n = current();
    sel = n.id;
    textEl.value = n.text;
    metaEl.textContent = new Date(n.t).toLocaleString([], {
      year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  }

  textEl.addEventListener("input", () => {
    const n = current();
    n.text = textEl.value;
    n.t = Date.now();
    save();
    renderList();
  });

  root.querySelector(".notes-new").addEventListener("click", () => {
    const n = { id: crypto.randomUUID(), text: "", t: Date.now() };
    notes.unshift(n);
    sel = n.id;
    save();
    renderList();
    renderEditor();
    textEl.focus();
  });

  root.querySelector(".notes-delete").addEventListener("click", () => {
    notes = notes.filter((n) => n.id !== sel);
    if (!notes.length) notes = [{ id: crypto.randomUUID(), text: "", t: Date.now() }];
    sel = notes[0].id;
    save();
    renderList();
    renderEditor();
  });

  renderList();
  renderEditor();
  return root;
}
