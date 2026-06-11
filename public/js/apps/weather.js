/**
 * Weather — real data via /api/weather (Open-Meteo proxied by the Worker).
 */

const WMO = {
  0: ["☀️", "Clear"], 1: ["🌤️", "Mostly clear"], 2: ["⛅", "Partly cloudy"], 3: ["☁️", "Overcast"],
  45: ["🌫️", "Fog"], 48: ["🌫️", "Rime fog"],
  51: ["🌦️", "Light drizzle"], 53: ["🌦️", "Drizzle"], 55: ["🌧️", "Heavy drizzle"],
  61: ["🌧️", "Light rain"], 63: ["🌧️", "Rain"], 65: ["🌧️", "Heavy rain"],
  66: ["🌧️", "Freezing rain"], 67: ["🌧️", "Freezing rain"],
  71: ["🌨️", "Light snow"], 73: ["🌨️", "Snow"], 75: ["❄️", "Heavy snow"], 77: ["❄️", "Snow grains"],
  80: ["🌦️", "Showers"], 81: ["🌧️", "Showers"], 82: ["⛈️", "Heavy showers"],
  85: ["🌨️", "Snow showers"], 86: ["🌨️", "Snow showers"],
  95: ["⛈️", "Thunderstorm"], 96: ["⛈️", "Storm w/ hail"], 99: ["⛈️", "Storm w/ hail"],
};
const wmo = (code) => WMO[code] ?? ["🌡️", `Code ${code}`];

export function createWeather() {
  const root = document.createElement("div");
  root.className = "wx";
  root.innerHTML = `
    <div class="wx-search">
      <input placeholder="Search city… (e.g. Shanghai, Tokyo)" spellcheck="false" />
    </div>
    <div class="wx-body"><div class="wx-msg">Loading…</div></div>`;

  const body = root.querySelector(".wx-body");
  const input = root.querySelector("input");

  async function load(lat, lon, label) {
    body.innerHTML = `<div class="wx-msg">Loading ${label}…</div>`;
    try {
      const res = await fetch(`/api/weather?lat=${lat}&lon=${lon}`);
      if (!res.ok) throw new Error((await res.json()).error ?? res.status);
      const d = await res.json();
      const c = d.current;
      const [icon, desc] = wmo(c.weather_code);
      const days = d.daily.time.map((t, i) => {
        const [di, ddesc] = wmo(d.daily.weather_code[i]);
        const day = i === 0 ? "Today" : new Date(t).toLocaleDateString("en-US", { weekday: "short" });
        return `<div class="wx-day" title="${ddesc}">
          <span>${day}</span><span class="wx-day-icon">${di}</span>
          <span><b>${Math.round(d.daily.temperature_2m_max[i])}°</b> ${Math.round(d.daily.temperature_2m_min[i])}°</span>
        </div>`;
      }).join("");
      body.innerHTML = `
        <div class="wx-now">
          <div class="wx-city">${label}</div>
          <div class="wx-temp">${Math.round(c.temperature_2m)}°</div>
          <div class="wx-desc">${icon} ${desc}</div>
          <div class="wx-meta">Feels ${Math.round(c.apparent_temperature)}° · Humidity ${c.relative_humidity_2m}% · Wind ${Math.round(c.wind_speed_10m)} km/h</div>
        </div>
        <div class="wx-days">${days}</div>`;
    } catch (e) {
      body.innerHTML = `<div class="wx-msg">Weather unavailable (${String(e.message ?? e).slice(0, 80)}).<br>Try again later.</div>`;
    }
  }

  async function search(q) {
    body.innerHTML = `<div class="wx-msg">Searching “${q}”…</div>`;
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
      const d = await res.json();
      const hit = d.results?.[0];
      if (!hit) { body.innerHTML = `<div class="wx-msg">No city found for “${q}”.</div>`; return; }
      localStorage.setItem("sewingos.wx", JSON.stringify({ lat: hit.latitude, lon: hit.longitude, label: hit.name }));
      load(hit.latitude, hit.longitude, `${hit.name}${hit.country_code ? ", " + hit.country_code : ""}`);
    } catch {
      body.innerHTML = `<div class="wx-msg">Search failed. Try again.</div>`;
    }
  }

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && input.value.trim()) search(input.value.trim());
  });

  const saved = localStorage.getItem("sewingos.wx");
  if (saved) {
    const { lat, lon, label } = JSON.parse(saved);
    load(lat, lon, label);
  } else if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => load(pos.coords.latitude.toFixed(2), pos.coords.longitude.toFixed(2), "Current location"),
      () => load(31.23, 121.47, "Shanghai, CN"),
      { timeout: 4000 },
    );
  } else {
    load(31.23, 121.47, "Shanghai, CN");
  }

  return root;
}
