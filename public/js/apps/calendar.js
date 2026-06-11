/**
 * Calendar — month view with real dates.
 */
export function createCalendar() {
  const root = document.createElement("div");
  root.className = "cal";
  let view = new Date();

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
      const inMonth = d.getMonth() === m;
      cells += `<div class="cal-day ${inMonth ? "" : "dim"} ${isToday ? "today" : ""}">${d.getDate()}</div>`;
      d.setDate(d.getDate() + 1);
    }

    root.innerHTML = `
      <div class="cal-head">
        <b>${monthName}</b>
        <span class="cal-nav">
          <button data-nav="-1">&#8249;</button>
          <button data-nav="0">Today</button>
          <button data-nav="1">&#8250;</button>
        </span>
      </div>
      <div class="cal-grid cal-dow">${dows.map((x) => `<div>${x}</div>`).join("")}</div>
      <div class="cal-grid">${cells}</div>`;

    root.querySelectorAll("[data-nav]").forEach((b) =>
      b.addEventListener("click", () => {
        const n = Number(b.dataset.nav);
        view = n === 0 ? new Date() : new Date(y, m + n, 1);
        render();
      }),
    );
  }

  render();
  return root;
}
