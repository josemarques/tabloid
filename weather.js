// Header weather: current conditions + today's max/min from Open-Meteo (no API key).
(() => {
  const WEATHER_KEY = "weatherCache";
  const TTL_MS = WEATHER.refreshMinutes * 60000;

  const $weather = document.getElementById("weather");
  const $icon = $weather.querySelector(".wx-icon");
  const $temp = $weather.querySelector(".wx-temp");
  const $range = $weather.querySelector(".wx-range");
  const $place = $weather.querySelector(".wx-place");

  // ---------- Icons (static markup, Lucide-style strokes) ----------

  const CLOUD = "M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z";
  const CLOUD_TOP = "M4 14.9A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.24";
  const SUN_RAYS = "M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41";
  const MOON = "M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z";

  const ICONS = {
    "clear-day": `<circle class="sun" cx="12" cy="12" r="4"/><path class="sun" d="${SUN_RAYS}"/>`,
    "clear-night": `<path class="moon" d="${MOON}"/>`,
    "partly-day": `<path class="sun" d="M12 2v2M4.93 4.93l1.41 1.41M20 12h2M19.07 4.93l-1.41 1.41M15.95 12.65a4 4 0 0 0-5.93-4.13"/><path d="M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z"/>`,
    "partly-night": `<path class="moon" d="M10.1 9A6 6 0 0 1 16 4a4 4 0 0 0 6 6 6 6 0 0 1-3 5.2"/><path d="M13 16a3 3 0 1 1 0 6H7a5 5 0 1 1 4.9-6Z"/>`,
    cloudy: `<path d="${CLOUD}"/>`,
    fog: `<path d="${CLOUD_TOP}"/><path d="M16 17H7M17 21H9"/>`,
    drizzle: `<path d="${CLOUD_TOP}"/><path class="wet" d="M8 19v1M8 14v1M16 19v1M16 14v1M12 21v1M12 16v1"/>`,
    rain: `<path d="${CLOUD_TOP}"/><path class="wet" d="M16 14v6M8 14v6M12 16v6"/>`,
    snow: `<path d="${CLOUD_TOP}"/><path class="wet" d="M8 15h.01M8 19h.01M12 17h.01M12 21h.01M16 15h.01M16 19h.01"/>`,
    storm: `<path d="M6 16.33A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.97"/><path class="bolt" d="m13 12-3 5h4l-3 5"/>`
  };

  // WMO weather codes -> [icon, label]
  function describe(code, isDay) {
    if (code === 0) return [isDay ? "clear-day" : "clear-night", "Clear"];
    if (code === 1) return [isDay ? "clear-day" : "clear-night", "Mostly clear"];
    if (code === 2) return [isDay ? "partly-day" : "partly-night", "Partly cloudy"];
    if (code === 3) return ["cloudy", "Overcast"];
    if (code === 45 || code === 48) return ["fog", "Fog"];
    if (code >= 51 && code <= 57) return ["drizzle", "Drizzle"];
    if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return ["rain", code >= 80 ? "Showers" : "Rain"];
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return ["snow", "Snow"];
    if (code >= 95) return ["storm", "Thunderstorm"];
    return ["cloudy", "—"];
  }

  // ---------- Data ----------

  function getPosition() {
    if (!WEATHER.useGeolocation || !navigator.geolocation) return Promise.resolve(null);
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
        () => resolve(null),
        { timeout: 8000, maximumAge: TTL_MS, enableHighAccuracy: false }
      );
    });
  }

  async function placeName(lat, lon) {
    try {
      const u = new URL("https://api.bigdatacloud.net/data/reverse-geocode-client");
      u.search = new URLSearchParams({ latitude: lat, longitude: lon, localityLanguage: "pt" });
      const data = await (await fetch(u)).json();
      return data.city || data.locality || "";
    } catch { return ""; }
  }

  async function fetchWeather(prev) {
    const pos = await getPosition();
    const { lat, lon } = pos || WEATHER.fallback;

    // Only reverse-geocode when we've moved more than ~5 km.
    let name = WEATHER.fallback.name;
    if (pos) {
      const moved = !prev || Math.abs(prev.lat - lat) > 0.05 || Math.abs(prev.lon - lon) > 0.05;
      name = moved ? await placeName(lat, lon) : prev.name;
    }

    const u = new URL("https://api.open-meteo.com/v1/forecast");
    u.search = new URLSearchParams({
      latitude: lat.toFixed(3),
      longitude: lon.toFixed(3),
      current: "temperature_2m,weather_code,is_day",
      daily: "temperature_2m_max,temperature_2m_min",
      timezone: "auto",
      forecast_days: "1"
    });
    const res = await fetch(u);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const d = await res.json();
    return {
      lat, lon, name,
      temp: d.current.temperature_2m,
      code: d.current.weather_code,
      isDay: d.current.is_day === 1,
      max: d.daily.temperature_2m_max[0],
      min: d.daily.temperature_2m_min[0],
      fetchedAt: Date.now()
    };
  }

  // ---------- Render ----------

  const deg = (n) => `${Math.round(n)}°`;

  function render(w) {
    if (!w) return;
    const [icon, label] = describe(w.code, w.isDay);
    $icon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${ICONS[icon]}</svg>`;
    $temp.textContent = deg(w.temp);
    $range.replaceChildren(
      document.createTextNode(`↑ ${deg(w.max)}`),
      Object.assign(document.createElement("span"), { className: "lo", textContent: `↓ ${deg(w.min)}` })
    );
    $place.textContent = [w.name, label].filter(Boolean).join(" · ");
    $weather.title = `${label}, ${deg(w.temp)} (max ${deg(w.max)}, min ${deg(w.min)})`;
    $weather.hidden = false;
  }

  let cached = null;
  async function refresh() {
    try {
      cached = await fetchWeather(cached);
      chrome.storage.local.set({ [WEATHER_KEY]: cached });
      render(cached);
    } catch {
      // Keep showing the last reading; the header stays clean on failure.
    }
  }

  async function init() {
    cached = (await chrome.storage.local.get(WEATHER_KEY))[WEATHER_KEY] || null;
    render(cached);
    if (!cached || Date.now() - cached.fetchedAt > TTL_MS) refresh();
    setInterval(() => { if (Date.now() - (cached?.fetchedAt || 0) > TTL_MS) refresh(); }, 60000);
  }

  init();
})();
