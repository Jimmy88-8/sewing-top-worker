/**
 * Weather - a privacy-minded, Apple Weather-inspired dashboard.
 * Weather data is proxied through the Worker and saved locations stay local.
 */

const ICON_ROOT = "/icons/weather-ui";
const DEFAULT_LOCATION = { lat: 3.14, lon: 101.69, label: "Local Area", detail: "Approximate region" };
const PRESETS = [
  DEFAULT_LOCATION,
  { lat: 1.35, lon: 103.82, label: "Coastal Region", detail: "Saved locally" },
  { lat: 35.68, lon: 139.69, label: "Northern Region", detail: "Saved locally" },
  { lat: 46.95, lon: 7.45, label: "Mountain Region", detail: "Saved locally" },
];

const WMO = {
  0: ["sun", "Clear"],
  1: ["sun", "Mostly Clear"],
  2: ["cloud-sunny", "Partly Cloudy"],
  3: ["cloud", "Cloudy"],
  45: ["fog", "Foggy"],
  48: ["fog", "Rime Fog"],
  51: ["rain", "Light Drizzle"],
  53: ["rain", "Drizzle"],
  55: ["heavy-rain", "Heavy Drizzle"],
  61: ["rain", "Light Rain"],
  63: ["rain", "Rain"],
  65: ["heavy-rain", "Heavy Rain"],
  66: ["rain", "Freezing Rain"],
  67: ["heavy-rain", "Freezing Rain"],
  71: ["snow", "Light Snow"],
  73: ["snow", "Snow"],
  75: ["snow", "Heavy Snow"],
  77: ["snow", "Snow Grains"],
  80: ["rain", "Showers"],
  81: ["heavy-rain", "Showers"],
  82: ["storm", "Heavy Showers"],
  85: ["snow", "Snow Showers"],
  86: ["snow", "Snow Showers"],
  95: ["storm", "Thunderstorm"],
  96: ["storm", "Storm with Hail"],
  99: ["storm", "Storm with Hail"],
};

const condition = (code) => WMO[code] ?? ["cloud", "Variable"];
const icon = (name, className = "") =>
  `<img class="wx-icon ${className}" src="${ICON_ROOT}/${name}.svg" alt="" aria-hidden="true">`;
const round = (value, fallback = 0) => Number.isFinite(Number(value)) ? Math.round(Number(value)) : fallback;
const fmtTime = (value) => value
  ? new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })
  : "--:--";
const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char]));

function forecastRange(daily) {
  const mins = daily.temperature_2m_min ?? [];
  const maxes = daily.temperature_2m_max ?? [];
  const low = Math.min(...mins);
  const high = Math.max(...maxes);
  return { low: Number.isFinite(low) ? low : 0, high: Number.isFinite(high) ? high : 1 };
}

function windDirection(degrees) {
  const labels = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return labels[Math.round((Number(degrees) || 0) / 45) % 8];
}

function card(title, iconName, body, className = "") {
  return `<section class="wx-card ${className}">
    <div class="wx-card-title">${icon(iconName)}<span>${title}</span></div>
    ${body}
  </section>`;
}

export function createWeather() {
  const root = document.createElement("div");
  root.className = "wx";
  root.innerHTML = `
    <aside class="wx-sidebar">
      <div class="wx-side-tools">
        <label class="wx-search">
          ${icon("search")}
          <input placeholder="Search" aria-label="Search city" autocomplete="off" spellcheck="false">
        </label>
      </div>
      <div class="wx-locations" aria-label="Saved locations"></div>
      <div class="wx-privacy">${icon("privacy")}<span>Location labels are generalized. Saved places stay on this device.</span></div>
    </aside>
    <main class="wx-main">
      <button class="wx-sidebar-toggle" type="button" aria-label="Toggle locations">${icon("sidebar")}</button>
      <div class="wx-status"><div class="wx-spinner"></div><span>Loading forecast...</span></div>
    </main>`;

  const main = root.querySelector(".wx-main");
  const locations = root.querySelector(".wx-locations");
  const input = root.querySelector("input");
  let active = (() => {
    try {
      const saved = JSON.parse(localStorage.getItem("sewingos.wx"));
      return saved?.lat && saved?.lon ? { ...saved, label: saved.label || "Saved Area", detail: "Saved locally" } : DEFAULT_LOCATION;
    } catch {
      return DEFAULT_LOCATION;
    }
  })();
  let latest = null;

  function renderLocations() {
    const items = [active, ...PRESETS.filter((place) =>
      Math.abs(place.lat - active.lat) > 0.01 || Math.abs(place.lon - active.lon) > 0.01)];
    locations.innerHTML = items.map((place, index) => {
      const temp = index === 0 && latest ? `${round(latest.current?.temperature_2m)}°` : `${28 - index * 2}°`;
      const desc = index === 0 && latest ? condition(latest.current?.weather_code)[1] : ["Cloudy", "Partly Cloudy", "Clear"][index % 3];
      return `<button class="wx-location ${index === 0 ? "active" : ""}" type="button"
        data-lat="${place.lat}" data-lon="${place.lon}" data-label="${escapeHTML(place.label)}">
        <span class="wx-location-copy"><b>${escapeHTML(place.label)}</b><small>${escapeHTML(place.detail || "Approximate region")}</small></span>
        <strong>${temp}</strong><span class="wx-location-desc">${desc}</span>
      </button>`;
    }).join("");
    locations.querySelectorAll(".wx-location").forEach((button) => {
      button.addEventListener("click", () => {
        active = {
          lat: Number(button.dataset.lat),
          lon: Number(button.dataset.lon),
          label: button.dataset.label,
          detail: "Saved locally",
        };
        load();
      });
    });
  }

  function render(data) {
    latest = data;
    renderLocations();
    const current = data.current ?? {};
    const daily = data.daily ?? {};
    const hourly = data.hourly ?? {};
    const [currentIcon, description] = condition(current.weather_code);
    const todayHigh = round(daily.temperature_2m_max?.[0], round(current.temperature_2m));
    const todayLow = round(daily.temperature_2m_min?.[0], round(current.temperature_2m));
    const now = Date.now();
    let start = Math.max(0, (hourly.time ?? []).findIndex((time) => new Date(time).getTime() >= now - 1_800_000));
    if (start < 0) start = 0;
    const hourlyRows = (hourly.time ?? []).slice(start, start + 12).map((time, index) => {
      const sourceIndex = start + index;
      const [hourIcon] = condition(hourly.weather_code?.[sourceIndex]);
      const probability = round(hourly.precipitation_probability?.[sourceIndex]);
      return `<div class="wx-hour">
        <b>${index === 0 ? "Now" : new Date(time).toLocaleTimeString([], { hour: "2-digit", hour12: false })}</b>
        ${icon(hourIcon)}
        <small>${probability > 0 ? `${probability}%` : "&nbsp;"}</small>
        <strong>${round(hourly.temperature_2m?.[sourceIndex], round(current.temperature_2m))}°</strong>
      </div>`;
    }).join("");
    const range = forecastRange(daily);
    const rangeSpan = Math.max(1, range.high - range.low);
    const forecastRows = (daily.time ?? []).map((time, index) => {
      const low = round(daily.temperature_2m_min?.[index]);
      const high = round(daily.temperature_2m_max?.[index]);
      const [dayIcon, dayDesc] = condition(daily.weather_code?.[index]);
      const probability = round(daily.precipitation_probability_max?.[index]);
      const left = ((low - range.low) / rangeSpan) * 54;
      const width = Math.max(12, ((high - low) / rangeSpan) * 54);
      return `<div class="wx-forecast-row" title="${dayDesc}">
        <b>${index === 0 ? "Today" : new Date(`${time}T12:00:00`).toLocaleDateString([], { weekday: "short" })}</b>
        <span class="wx-day-condition">${icon(dayIcon)}<small>${probability ? `${probability}%` : ""}</small></span>
        <span class="wx-low">${low}°</span>
        <span class="wx-range"><i style="left:${left}%;width:${width}%"></i></span>
        <strong>${high}°</strong>
      </div>`;
    }).join("");
    const precipitation = round(daily.precipitation_sum?.[0], round(current.precipitation));
    const uv = Number(daily.uv_index_max?.[0] ?? 0);
    const uvLabel = uv < 3 ? "Low" : uv < 6 ? "Moderate" : uv < 8 ? "High" : "Very High";
    const visibility = Math.max(0, round((current.visibility ?? 0) / 1000));
    const pressure = round(current.pressure_msl);
    const gust = round(current.wind_gusts_10m, round(current.wind_speed_10m));
    const humidity = round(current.relative_humidity_2m);
    const summary = precipitation > 0
      ? `Rain is possible today. Wind gusts may reach ${gust} km/h.`
      : `Cloud cover will vary today. Wind gusts may reach ${gust} km/h.`;

    main.innerHTML = `
      <button class="wx-sidebar-toggle" type="button" aria-label="Toggle locations">${icon("sidebar")}</button>
      <header class="wx-hero">
        <div class="wx-place">${escapeHTML(active.label)}</div>
        <div class="wx-current-temp">${round(current.temperature_2m)}°</div>
        <div class="wx-current-line">${icon(currentIcon)}<b>${description}</b></div>
        <div class="wx-high-low">H:${todayHigh}° &nbsp; L:${todayLow}°</div>
      </header>
      <div class="wx-dashboard">
        ${card("Hourly Forecast", "clock", `<p class="wx-summary">${summary}</p><div class="wx-hourly">${hourlyRows}</div>`, "wx-hourly-card")}
        ${card("10-Day Forecast", "calendar", `<div class="wx-forecast">${forecastRows}</div>`, "wx-forecast-card")}
        ${card("Precipitation", "umbrella", `<div class="wx-map"><img src="/images/weather/precipitation-map.png" alt="Generalized precipitation radar map"><span>${round(current.temperature_2m)}°</span></div>`, "wx-map-card")}
        ${card("UV Index", "sun", `<div class="wx-metric"><strong>${round(uv)}</strong><b>${uvLabel}</b><div class="wx-spectrum"><i style="left:${Math.min(96, uv * 9)}%"></i></div><p>${uv < 3 ? "Protection is optional." : "Use sun protection this afternoon."}</p></div>`)}
        ${card("Sunset", "sun", `<div class="wx-metric"><strong>${fmtTime(daily.sunset?.[0])}</strong><div class="wx-sun-track"><i></i></div><p>Sunrise: ${fmtTime(daily.sunrise?.[0])}</p></div>`)}
        ${card("Wind", "wind", `<div class="wx-metric"><strong>${round(current.wind_speed_10m)} <small>km/h</small></strong><b>${windDirection(current.wind_direction_10m)}</b><p>Gusts up to ${gust} km/h</p></div>`)}
        ${card("Precipitation", "droplet", `<div class="wx-metric"><strong>${precipitation} <small>mm</small></strong><b>Today</b><p>${round(daily.precipitation_probability_max?.[0])}% chance of rain.</p></div>`)}
        ${card("Feels Like", "temperature", `<div class="wx-metric"><strong>${round(current.apparent_temperature)}°</strong><p>Compared with an actual temperature of ${round(current.temperature_2m)}°.</p></div>`)}
        ${card("Visibility", "visibility", `<div class="wx-metric"><strong>${visibility || "--"} <small>km</small></strong><p>${visibility >= 10 ? "Clear viewing conditions." : "Reduced visibility nearby."}</p></div>`)}
        ${card("Humidity", "droplet", `<div class="wx-metric"><strong>${humidity}%</strong><p>Current relative humidity.</p></div>`)}
        ${card("Pressure", "wind", `<div class="wx-metric"><strong>${pressure || "--"} <small>hPa</small></strong><p>Mean sea-level pressure.</p></div>`)}
        ${card("Moon", "moon", `<div class="wx-metric"><strong>Waning</strong><b>Crescent</b><p>General lunar phase display.</p></div>`)}
      </div>
      <footer class="wx-footer">Weather for ${escapeHTML(active.label)} · Approximate location · Open-Meteo</footer>`;

    main.querySelector(".wx-sidebar-toggle").addEventListener("click", () => root.classList.toggle("sidebar-hidden"));
  }

  async function load() {
    main.innerHTML = `<button class="wx-sidebar-toggle" type="button" aria-label="Toggle locations">${icon("sidebar")}</button>
      <div class="wx-status"><div class="wx-spinner"></div><span>Loading ${escapeHTML(active.label)}...</span></div>`;
    main.querySelector(".wx-sidebar-toggle").addEventListener("click", () => root.classList.toggle("sidebar-hidden"));
    try {
      const response = await fetch(`/api/weather?lat=${active.lat}&lon=${active.lon}`);
      if (!response.ok) throw new Error((await response.json()).error ?? response.status);
      render(await response.json());
    } catch (error) {
      main.innerHTML = `<button class="wx-sidebar-toggle" type="button" aria-label="Toggle locations">${icon("sidebar")}</button>
        <div class="wx-status wx-error"><b>Forecast unavailable</b><span>${escapeHTML(String(error.message ?? error).slice(0, 90))}</span><button type="button">Try Again</button></div>`;
      main.querySelector(".wx-sidebar-toggle").addEventListener("click", () => root.classList.toggle("sidebar-hidden"));
      main.querySelector(".wx-error button").addEventListener("click", load);
    }
  }

  async function search(query) {
    input.disabled = true;
    try {
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      const hit = data.results?.[0];
      if (!hit) throw new Error("No matching place found");
      active = {
        lat: hit.latitude,
        lon: hit.longitude,
        label: "Saved Area",
        detail: hit.country_code ? `Region · ${hit.country_code}` : "Search result",
      };
      localStorage.setItem("sewingos.wx", JSON.stringify(active));
      input.value = "";
      load();
    } catch (error) {
      input.value = "";
      input.placeholder = String(error.message ?? "Search failed");
      setTimeout(() => { input.placeholder = "Search"; }, 2200);
    } finally {
      input.disabled = false;
    }
  }

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && input.value.trim()) search(input.value.trim());
  });
  root.querySelector(".wx-sidebar-toggle").addEventListener("click", () => root.classList.toggle("sidebar-hidden"));
  renderLocations();
  load();
  return root;
}
