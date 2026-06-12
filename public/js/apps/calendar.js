/**
 * Calendar - Apple Calendar-inspired day, week, month, and year views.
 * User-created events remain in localStorage. Built-in events are generic demos.
 */

const KEY = "sewingos.cal.events.v2";
const CALENDARS = [
  { id: "work", name: "Work", color: "#af52de" },
  { id: "personal", name: "Personal", color: "#64b5d9" },
  { id: "reminders", name: "Reminders", color: "#ff9f0a" },
  { id: "holidays", name: "Holidays", color: "#34c759" },
];
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const pad = (value) => String(value).padStart(2, "0");
const dayKey = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const sameDay = (a, b) => dayKey(a) === dayKey(b);
const mondayIndex = (date) => (date.getDay() + 6) % 7;
const startOfWeek = (date) => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() - mondayIndex(result));
  return result;
};
const addDays = (date, amount) => {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
};
const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char]));
const calendarById = (id) => CALENDARS.find((calendar) => calendar.id === id) ?? CALENDARS[0];
const calIcon = (name) => `<img class="cal-ui-icon" src="/icons/weather-ui/${name}.svg" alt="" aria-hidden="true">`;

function loadEvents() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function demoEvents(anchor) {
  const month = anchor.getMonth();
  const year = anchor.getFullYear();
  const at = (day, start, duration, title, calendar = "work", location = "") => ({
    id: `demo-${month}-${day}-${start}`,
    date: dayKey(new Date(year, month, day)),
    start,
    duration,
    title,
    calendar,
    location,
    demo: true,
  });
  return [
    at(2, 9, 60, "Weekly Planning", "work", "Video Call"),
    at(3, 11, 90, "Focus Time", "personal"),
    at(5, 14, 60, "Project Review", "work", "Studio A"),
    at(8, 10, 60, "Team Sync", "work", "Video Call"),
    at(9, 13, 90, "Design Workshop", "work", "Collaboration Room"),
    at(10, 9, 60, "Research Review", "work"),
    at(10, 14, 120, "Deep Work", "personal"),
    at(11, 10, 90, "Planning Session", "work", "Meeting Room"),
    at(12, 15, 60, "Project Check-in", "work", "Video Call"),
    at(13, 9, 90, "Community Event", "holidays", "City Centre"),
    at(14, 12, 90, "Personal Time", "personal"),
    at(16, 11, 60, "Quarterly Goals", "work"),
    at(18, 15, 60, "Documentation", "reminders"),
    at(22, 10, 60, "Team Retrospective", "work", "Video Call"),
    at(25, 13, 90, "Creative Session", "personal"),
    at(29, 9, 60, "Month-end Review", "work"),
  ];
}

function miniMonth(date, selected, events, enabled) {
  const y = date.getFullYear();
  const m = date.getMonth();
  const first = new Date(y, m, 1);
  const start = addDays(first, -mondayIndex(first));
  let cells = "";
  for (let index = 0; index < 42; index += 1) {
    const value = addDays(start, index);
    const key = dayKey(value);
    const hasEvents = events.some((event) => event.date === key && enabled.has(event.calendar));
    cells += `<button class="cal-mini-day ${value.getMonth() === m ? "" : "dim"} ${sameDay(value, selected) ? "selected" : ""} ${sameDay(value, new Date()) ? "today" : ""}"
      type="button" data-date="${key}">${value.getDate()}${hasEvents ? "<i></i>" : ""}</button>`;
  }
  return `<div class="cal-mini">
    <div class="cal-mini-head"><button type="button" data-mini-nav="-1" aria-label="Previous month">${calIcon("nav-left")}</button><b>${date.toLocaleDateString([], { month: "long", year: "numeric" })}</b><button type="button" data-mini-nav="1" aria-label="Next month">${calIcon("nav-right")}</button></div>
    <div class="cal-mini-dow">${DOW.map((day) => `<span>${day[0]}</span>`).join("")}</div>
    <div class="cal-mini-grid">${cells}</div>
  </div>`;
}

export function createCalendar() {
  const root = document.createElement("div");
  root.className = "cal";
  let selected = new Date();
  let cursor = new Date(selected);
  let miniCursor = new Date(selected);
  let view = "month";
  let enabled = new Set(CALENDARS.map((calendar) => calendar.id));
  let userEvents = loadEvents();
  let selectedEventId = null;
  const save = () => localStorage.setItem(KEY, JSON.stringify(userEvents));
  const allEvents = () => [...demoEvents(cursor), ...userEvents];
  const visibleEvents = () => allEvents().filter((event) => enabled.has(event.calendar));

  root.innerHTML = `
    <aside class="cal-sidebar"></aside>
    <main class="cal-main">
      <header class="cal-toolbar">
        <button class="cal-add-button" type="button" aria-label="New event">${calIcon("plus")}</button>
        <nav class="cal-segments" aria-label="Calendar view">
          ${["day", "week", "month", "year"].map((name) => `<button type="button" data-view="${name}">${name[0].toUpperCase() + name.slice(1)}</button>`).join("")}
        </nav>
        <div class="cal-toolbar-actions">
          <button type="button" data-nav="-1" aria-label="Previous">${calIcon("nav-left")}</button>
          <button type="button" data-nav="0">Today</button>
          <button type="button" data-nav="1" aria-label="Next">${calIcon("nav-right")}</button>
          <button class="cal-search-button" type="button" aria-label="Search">${calIcon("search")}</button>
        </div>
      </header>
      <div class="cal-search-panel" hidden><input type="search" placeholder="Search events" aria-label="Search events"></div>
      <section class="cal-content"></section>
    </main>
    <div class="cal-modal-backdrop" hidden>
      <form class="cal-modal">
        <div class="cal-modal-head"><b>New Event</b><button type="button" data-close aria-label="Close">${calIcon("xmark")}</button></div>
        <label>Title<input name="title" required maxlength="80" placeholder="Event title"></label>
        <div class="cal-form-row"><label>Date<input name="date" type="date" required></label><label>Time<input name="time" type="time" value="10:00" required></label></div>
        <label>Calendar<select name="calendar">${CALENDARS.map((calendar) => `<option value="${calendar.id}">${calendar.name}</option>`).join("")}</select></label>
        <label>Location<input name="location" maxlength="80" placeholder="Optional"></label>
        <p>Saved only in this browser.</p>
        <button class="cal-modal-save" type="submit">Add Event</button>
      </form>
    </div>`;

  const sidebar = root.querySelector(".cal-sidebar");
  const content = root.querySelector(".cal-content");
  const modalBackdrop = root.querySelector(".cal-modal-backdrop");
  const modal = root.querySelector(".cal-modal");
  const searchPanel = root.querySelector(".cal-search-panel");
  const searchInput = searchPanel.querySelector("input");

  function eventsForDate(date) {
    const key = dayKey(date);
    const query = searchInput.value.trim().toLowerCase();
    return visibleEvents()
      .filter((event) => event.date === key && (!query || `${event.title} ${event.location}`.toLowerCase().includes(query)))
      .sort((a, b) => a.start - b.start);
  }

  function eventChip(event, compact = false) {
    const calendar = calendarById(event.calendar);
    const hour = pad(event.start);
    return `<button class="cal-event-chip ${compact ? "compact" : ""}" type="button" data-event="${event.id}"
      style="--event-color:${calendar.color}" title="${escapeHTML(event.title)}">
      <span>${compact ? "" : `${hour}:00 `}${escapeHTML(event.title)}</span>
    </button>`;
  }

  function renderSidebar() {
    sidebar.innerHTML = `
      <div class="cal-side-top"><b>Calendars</b><span>Local only</span></div>
      <div class="cal-calendar-list">
        ${CALENDARS.map((calendar) => `<label><input type="checkbox" value="${calendar.id}" ${enabled.has(calendar.id) ? "checked" : ""}><i style="--calendar-color:${calendar.color}"></i><span>${calendar.name}</span></label>`).join("")}
      </div>
      ${miniMonth(miniCursor, selected, visibleEvents(), enabled)}
      <div class="cal-privacy-note">Sample events use generic names. Your events never leave this device.</div>`;
    sidebar.querySelectorAll('.cal-calendar-list input').forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) enabled.add(checkbox.value);
        else enabled.delete(checkbox.value);
        render();
      });
    });
    sidebar.querySelectorAll(".cal-mini-day").forEach((button) => {
      button.addEventListener("click", () => {
        selected = new Date(`${button.dataset.date}T12:00:00`);
        cursor = new Date(selected);
        render();
      });
    });
    sidebar.querySelectorAll("[data-mini-nav]").forEach((button) => {
      button.addEventListener("click", () => {
        miniCursor = new Date(miniCursor.getFullYear(), miniCursor.getMonth() + Number(button.dataset.miniNav), 1);
        renderSidebar();
      });
    });
  }

  function monthView() {
    const y = cursor.getFullYear();
    const m = cursor.getMonth();
    const first = new Date(y, m, 1);
    const start = addDays(first, -mondayIndex(first));
    let cells = "";
    for (let index = 0; index < 42; index += 1) {
      const date = addDays(start, index);
      const events = eventsForDate(date);
      cells += `<div class="cal-month-day ${date.getMonth() === m ? "" : "outside"} ${sameDay(date, selected) ? "selected" : ""}" data-date="${dayKey(date)}">
        <button class="cal-date-number ${sameDay(date, new Date()) ? "today" : ""}" type="button" data-select-date="${dayKey(date)}">${date.getDate()}</button>
        <div class="cal-month-events">${events.slice(0, 3).map((event) => eventChip(event, true)).join("")}${events.length > 3 ? `<button class="cal-more" type="button" data-select-date="${dayKey(date)}">+${events.length - 3} more</button>` : ""}</div>
      </div>`;
    }
    return `<div class="cal-view-title"><h1>${cursor.toLocaleDateString([], { month: "long" })} <span>${y}</span></h1></div>
      <div class="cal-month-dow">${DOW.map((day) => `<div>${day}</div>`).join("")}</div>
      <div class="cal-month-grid">${cells}</div>`;
  }

  function timeGrid(days) {
    const startHour = 7;
    const endHour = 21;
    const labels = Array.from({ length: endHour - startHour + 1 }, (_, index) => startHour + index);
    const columns = days.map((date) => {
      const events = eventsForDate(date).filter((event) => event.start >= startHour && event.start <= endHour);
      return `<div class="cal-time-column" data-date="${dayKey(date)}">
        ${labels.map(() => "<div class=\"cal-time-slot\"></div>").join("")}
        ${events.map((event) => {
          const calendar = calendarById(event.calendar);
          const top = (event.start - startHour) * 58;
          const height = Math.max(42, (event.duration / 60) * 58 - 4);
          return `<button class="cal-timed-event" type="button" data-event="${event.id}" style="--event-color:${calendar.color};top:${top}px;height:${height}px">
            <b>${escapeHTML(event.title)}</b><span>${pad(event.start)}:00 · ${escapeHTML(event.location || calendar.name)}</span>
          </button>`;
        }).join("")}
      </div>`;
    }).join("");
    return `<div class="cal-time-labels">${labels.map((hour) => `<span>${pad(hour)}:00</span>`).join("")}</div>
      <div class="cal-time-columns" style="--day-count:${days.length}">${columns}</div>`;
  }

  function weekView() {
    const start = startOfWeek(cursor);
    const days = Array.from({ length: 7 }, (_, index) => addDays(start, index));
    return `<div class="cal-view-title"><h1>${start.toLocaleDateString([], { month: "long" })} <span>${start.getFullYear()}</span></h1></div>
      <div class="cal-week-head"><div></div>${days.map((date) => `<button type="button" data-select-date="${dayKey(date)}"><span>${date.toLocaleDateString([], { weekday: "short" })}</span><b class="${sameDay(date, new Date()) ? "today" : ""}">${date.getDate()}</b></button>`).join("")}</div>
      <div class="cal-time-grid">${timeGrid(days)}</div>`;
  }

  function detailPanel() {
    const event = visibleEvents().find((item) => item.id === selectedEventId) ?? eventsForDate(selected)[0];
    if (!event) return `<aside class="cal-detail"><div class="cal-detail-empty"><b>No event selected</b><span>Choose an event or create a new one.</span></div></aside>`;
    const calendar = calendarById(event.calendar);
    return `<aside class="cal-detail">
      <div class="cal-detail-card" style="--event-color:${calendar.color}">
        <small>${calendar.name}</small>
        <h2>${escapeHTML(event.title)}</h2>
        <div><b>${new Date(`${event.date}T12:00:00`).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</b><span>${pad(event.start)}:00 - ${pad(event.start + Math.ceil(event.duration / 60))}:00</span></div>
        <p>${escapeHTML(event.location || "No location")}</p>
        <p>${event.demo ? "Generic sample event" : "Saved locally in this browser"}</p>
        ${event.demo ? "" : `<button type="button" data-delete-event="${event.id}">Delete Event</button>`}
      </div>
    </aside>`;
  }

  function dayView() {
    const events = eventsForDate(selected);
    return `<div class="cal-view-title"><h1>${selected.getDate()} <span>${selected.toLocaleDateString([], { month: "long", year: "numeric" })}</span></h1><p>${selected.toLocaleDateString([], { weekday: "long" })}</p></div>
      <div class="cal-day-layout"><div class="cal-day-timeline"><div class="cal-all-day">all-day</div><div class="cal-time-grid">${timeGrid([selected])}</div></div>${detailPanel()}</div>
      <div class="cal-day-event-count">${events.length} event${events.length === 1 ? "" : "s"} shown</div>`;
  }

  function tinyMonth(date) {
    const first = new Date(date.getFullYear(), date.getMonth(), 1);
    const start = addDays(first, -mondayIndex(first));
    const dates = Array.from({ length: 42 }, (_, index) => addDays(start, index));
    return `<button class="cal-year-month" type="button" data-open-month="${date.getMonth()}">
      <b>${date.toLocaleDateString([], { month: "long" })}</b>
      <div class="cal-year-dow">${DOW.map((day) => `<span>${day[0]}</span>`).join("")}</div>
      <div class="cal-year-grid">${dates.map((value) => `<span class="${value.getMonth() === date.getMonth() ? "" : "outside"} ${sameDay(value, new Date()) ? "today" : ""}">${value.getDate()}</span>`).join("")}</div>
    </button>`;
  }

  function yearView() {
    const year = cursor.getFullYear();
    return `<div class="cal-view-title"><h1>${year}</h1></div><div class="cal-year-grid-wrap">${Array.from({ length: 12 }, (_, month) => tinyMonth(new Date(year, month, 1))).join("")}</div>`;
  }

  function bindContent() {
    content.querySelectorAll("[data-select-date]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        selected = new Date(`${button.dataset.selectDate}T12:00:00`);
        cursor = new Date(selected);
        if (view === "month" && button.classList.contains("cal-more")) view = "day";
        render();
      });
    });
    content.querySelectorAll("[data-event]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        selectedEventId = button.dataset.event;
        const selectedEvent = visibleEvents().find((item) => item.id === selectedEventId);
        if (selectedEvent) selected = new Date(`${selectedEvent.date}T12:00:00`);
        if (view === "month" || view === "week") view = "day";
        render();
      });
    });
    content.querySelectorAll("[data-delete-event]").forEach((button) => {
      button.addEventListener("click", () => {
        userEvents = userEvents.filter((event) => event.id !== button.dataset.deleteEvent);
        selectedEventId = null;
        save();
        render();
      });
    });
    content.querySelectorAll("[data-open-month]").forEach((button) => {
      button.addEventListener("click", () => {
        cursor = new Date(cursor.getFullYear(), Number(button.dataset.openMonth), 1);
        selected = new Date(cursor);
        view = "month";
        render();
      });
    });
  }

  function render() {
    renderSidebar();
    root.querySelectorAll("[data-view]").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
    content.innerHTML = view === "day" ? dayView() : view === "week" ? weekView() : view === "year" ? yearView() : monthView();
    bindContent();
  }

  root.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      view = button.dataset.view;
      render();
    });
  });
  root.querySelectorAll("[data-nav]").forEach((button) => {
    button.addEventListener("click", () => {
      const amount = Number(button.dataset.nav);
      if (amount === 0) {
        cursor = new Date();
        selected = new Date();
      } else if (view === "day") {
        cursor = addDays(cursor, amount);
        selected = new Date(cursor);
      } else if (view === "week") {
        cursor = addDays(cursor, amount * 7);
        selected = new Date(cursor);
      } else if (view === "year") {
        cursor = new Date(cursor.getFullYear() + amount, cursor.getMonth(), 1);
        selected = new Date(cursor);
      } else {
        cursor = new Date(cursor.getFullYear(), cursor.getMonth() + amount, 1);
        selected = new Date(cursor);
      }
      miniCursor = new Date(cursor);
      render();
    });
  });
  root.querySelector(".cal-add-button").addEventListener("click", () => {
    modal.elements.date.value = dayKey(selected);
    modalBackdrop.hidden = false;
    modal.elements.title.focus();
  });
  root.querySelector("[data-close]").addEventListener("click", () => { modalBackdrop.hidden = true; });
  modalBackdrop.addEventListener("click", (event) => {
    if (event.target === modalBackdrop) modalBackdrop.hidden = true;
  });
  modal.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(modal);
    const hour = Number(String(data.get("time")).split(":")[0]);
    const newEvent = {
      id: `local-${Date.now()}`,
      date: String(data.get("date")),
      start: Number.isFinite(hour) ? hour : 10,
      duration: 60,
      title: String(data.get("title")).trim(),
      calendar: String(data.get("calendar")),
      location: String(data.get("location")).trim(),
    };
    if (!newEvent.title) return;
    userEvents.push(newEvent);
    selected = new Date(`${newEvent.date}T12:00:00`);
    cursor = new Date(selected);
    selectedEventId = newEvent.id;
    save();
    modal.reset();
    modalBackdrop.hidden = true;
    render();
  });
  root.querySelector(".cal-search-button").addEventListener("click", () => {
    searchPanel.hidden = !searchPanel.hidden;
    if (!searchPanel.hidden) searchInput.focus();
  });
  searchInput.addEventListener("input", render);
  render();
  return root;
}
