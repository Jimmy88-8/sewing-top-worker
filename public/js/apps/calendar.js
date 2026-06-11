/**
 * Calendar — month view with selectable days and local events.
 */

const KEY = "sewingos.cal.events";
const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function createCalendar() {
  const root = document.createElement("div");
  root.className = "cal";
  let view = new Date();
  let selected = new Date();
  let events = (() => {
    try { return JSON.parse(localStorage.getItem(KEY)) ?? {}; } catch { return {}; }
  })();
  const save = () => localStorage.setItem(KEY, JSON.stringify(events));

  function render() {
    const y = view.getFullYear(), m = view.getMonth();
    const today = new Date();
    const first = new Date(y, m, 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay()); // back to Sunday

    const monthName = view.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const dows = ["S", "M", "T", "W", "T", "F", "S"];

    let cells = "";
    const d = new Date(start);
    for (let i = 0; i < 42; i++) {
      const isToday = d.toDateString() === today.toDateString();
      const isSel = d.toDateString() === selected.toDateString();
      const inMonth = d.getMonth() === m;
      const has = (events[dayKey(d)] ?? []).length > 0;
      cells += `<button class="cal-day ${inMonth ? "" : "dim"} ${isToday ? "today" : ""} ${isSel ? "sel" : ""}"
        data-d="${d.toISOString()}">${d.getDate()}${has ? '<i class="cal-dot"></i>' : ""}</button>`;
      d.setDate(d.getDate() + 1);
    }

    const selKey = dayKey(selected);
    const dayEvents = events[selKey] ?? [];
    const selLabel = selected.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

    root.innerHTML = `
      <div class="cal-head">
        <b>${monthName}</b>
        <span class="cal-nav">
          <button data-nav="-1" title="Previous month">&#8249;</button>
          <button data-nav="0">Today</button>
          <button data-nav="1" title="Next month">&#8250;</button>
        </span>
      </div>
      <div class="cal-grid cal-dow">${dows.map((x) => `<div>${x}</div>`).join("")}</div>
      <div class="cal-grid cal-days">${cells}</div>
      <div class="cal-events">
        <div class="cal-events-head">
          <span class="section-label">${selLabel}</span>
        </div>
        <div class="cal-events-list">
          ${dayEvents.length
            ? dayEvents.map((ev, i) => `
                <div class="cal-event"><span></span><button class="cal-event-x" data-i="${i}" title="Remove">×</button></div>`).join("")
            : `<div class="cal-empty">No events</div>`}
        </div>
        <form class="cal-add"><input placeholder="Add event…" spellcheck="false"><button title="Add">＋</button></form>
      </div>`;

    // textContent assignment keeps user input safe
    root.querySelectorAll(".cal-event span").forEach((s, i) => { s.textContent = dayEvents[i]; });

    root.querySelectorAll("[data-nav]").forEach((b) =>
      b.addEventListener("click", () => {
        const n = Number(b.dataset.nav);
        if (n === 0) { view = new Date(); selected = new Date(); }
        else view = new Date(y, m + n, 1);
        render();
      }),
    );
    root.querySelectorAll(".cal-day").forEach((b) =>
      b.addEventListener("click", () => {
        selected = new Date(b.dataset.d);
        if (selected.getMonth() !== m) view = new Date(selected);
        render();
      }),
    );
    root.querySelector(".cal-add").addEventListener("submit", (e) => {
      e.preventDefault();
      const input = e.currentTarget.querySelector("input");
      const text = input.value.trim();
      if (!text) return;
      (events[selKey] ??= []).push(text);
      save();
      render();
    });
    root.querySelectorAll(".cal-event-x").forEach((b) =>
      b.addEventListener("click", () => {
        events[selKey].splice(Number(b.dataset.i), 1);
        if (!events[selKey].length) delete events[selKey];
        save();
        render();
      }),
    );
  }

  render();
  return root;
}
