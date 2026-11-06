const CACHE_KEY = "feedCache";
const FILTER_KEY = "columnFilters";
const READ_KEY = "readLinks";
const MAX_READ = 3000;
const FETCH_TIMEOUT_MS = 12000;
const NEW_WINDOW_MS = 60 * 60 * 1000;

const $columns = document.getElementById("columns");
const $status = document.getElementById("status");
const $refresh = document.getElementById("refresh");

let cache = {};   // sourceName -> { items, fetchedAt, error, url }
let filters = {}; // columnIndex -> sourceName | "all"
let readLinks = new Set();

// ---------- Fetching & parsing ----------

async function fetchText(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, cache: "no-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    // Respect the declared charset (some PT feeds use ISO-8859-1).
    const head = new TextDecoder("ascii").decode(buf.slice(0, 200));
    const declared =
      head.match(/encoding=["']([\w-]+)["']/i)?.[1] ||
      res.headers.get("content-type")?.match(/charset=([\w-]+)/i)?.[1] ||
      "utf-8";
    let decoder;
    try { decoder = new TextDecoder(declared); } catch { decoder = new TextDecoder("utf-8"); }
    return decoder.decode(buf);
  } finally {
    clearTimeout(timer);
  }
}

function textOf(el, ...selectors) {
  for (const sel of selectors) {
    const node = el.getElementsByTagName(sel)[0];
    if (node && node.textContent.trim()) return node.textContent.trim();
  }
  return "";
}

function stripHtml(html) {
  if (!html) return "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  return (doc.body.textContent || "").replace(/\s+/g, " ").trim();
}

function safeUrl(href, base) {
  try {
    const u = new URL(href, base);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : null;
  } catch { return null; }
}

function parseFeed(xmlText, sourceName, feedUrl) {
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new Error("Invalid XML");

  const rssItems = [...doc.getElementsByTagName("item")];
  const atomEntries = [...doc.getElementsByTagName("entry")];
  if (!rssItems.length && !atomEntries.length) throw new Error("No items in feed");

  const items = (rssItems.length ? rssItems : atomEntries).map((el) => {
    let link = textOf(el, "link");
    if (!link) {
      const linkEl = [...el.getElementsByTagName("link")]
        .find((l) => !l.getAttribute("rel") || l.getAttribute("rel") === "alternate");
      link = linkEl?.getAttribute("href") || "";
    }
    const dateStr = textOf(el, "pubDate", "published", "updated", "dc:date");
    const time = Date.parse(dateStr);
    return {
      source: sourceName,
      title: stripHtml(textOf(el, "title")) || "(untitled)",
      link: safeUrl(link, feedUrl),
      summary: stripHtml(textOf(el, "description", "summary", "content")).slice(0, 280),
      time: Number.isNaN(time) ? 0 : time
    };
  }).filter((i) => i.link);

  return items.slice(0, ITEMS_PER_SOURCE);
}

async function discoverFeed(siteUrl) {
  const html = await fetchText(siteUrl);
  const doc = new DOMParser().parseFromString(html, "text/html");
  const link = doc.querySelector(
    'link[rel="alternate"][type="application/rss+xml"], link[rel="alternate"][type="application/atom+xml"]'
  );
  const href = link && safeUrl(link.getAttribute("href"), siteUrl);
  if (!href) throw new Error("No feed found on homepage");
  return href;
}

async function loadSource(source) {
  // Try the last working URL first, then the configured list, then autodiscovery.
  const known = cache[source.name]?.url;
  const candidates = [...new Set([known, ...source.urls].filter(Boolean))];
  let lastError;
  for (const url of candidates) {
    try {
      return { items: parseFeed(await fetchText(url), source.name, url), url };
    } catch (e) { lastError = e; }
  }
  if (source.site) {
    try {
      const url = await discoverFeed(source.site);
      return { items: parseFeed(await fetchText(url), source.name, url), url };
    } catch (e) { lastError = e; }
  }
  throw lastError || new Error("Failed to load");
}

// ---------- Rendering ----------

function relativeTime(t) {
  if (!t) return "";
  const diff = Date.now() - t;
  const m = Math.round(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function faviconUrl(pageUrl) {
  const u = new URL(chrome.runtime.getURL("/_favicon/"));
  u.searchParams.set("pageUrl", pageUrl);
  u.searchParams.set("size", "32");
  return u.toString();
}

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  for (const c of [].concat(children)) if (c) node.append(c);
  return node;
}

function markRead(link, li) {
  if (readLinks.has(link)) return;
  readLinks.add(link);
  li.classList.add("read");
  saveRead();
}

function renderItem(item, siteUrl) {
  const isNew = item.time && Date.now() - item.time < NEW_WINDOW_MS;
  const a = el("a", { href: item.link, rel: "noopener noreferrer" }, [
    el("img", { className: "favicon", src: faviconUrl(siteUrl), alt: item.source, title: item.source }),
    el("p", { className: "title", textContent: item.title }),
    item.time
      ? el("time", { className: isNew ? "time new" : "time", textContent: relativeTime(item.time),
                     dateTime: new Date(item.time).toISOString(), title: new Date(item.time).toLocaleString() })
      : null,
    item.summary ? el("p", { className: "summary", textContent: item.summary }) : null
  ]);
  const li = el("li", { className: readLinks.has(item.link) ? "item read" : "item" }, a);
  // click covers left-click and keyboard; auxclick covers middle-click (new tab).
  a.addEventListener("click", () => markRead(item.link, li));
  a.addEventListener("auxclick", (e) => { if (e.button === 1) markRead(item.link, li); });
  return li;
}

function renderColumn(col, index) {
  const active = filters[index] || "all";
  const visibleSources = col.sources.filter((s) => active === "all" || s.name === active);
  const siteBySource = Object.fromEntries(col.sources.map((s) => [s.name, s.site]));

  const select = el("select", {
    className: "source-select",
    ariaLabel: `${col.title} source`,
    onchange: (e) => { filters[index] = e.target.value; saveFilters(); render(); }
  }, [
    el("option", { value: "all", textContent: "All sources" }),
    ...col.sources.map((s) => el("option", { value: s.name, textContent: s.name }))
  ]);
  select.value = active;

  const list = el("ul", { className: "list" });
  const errors = visibleSources.filter((s) => cache[s.name]?.error && !cache[s.name]?.items?.length);
  for (const s of errors) {
    list.append(el("li", { className: "error", textContent: `${s.name}: ${cache[s.name].error}` }));
  }

  const items = visibleSources
    .flatMap((s) => cache[s.name]?.items || [])
    .sort((a, b) => b.time - a.time);

  if (!items.length && !errors.length) {
    for (let i = 0; i < 6; i++) {
      list.append(el("li", { className: "skeleton" }, [el("span"), el("span"), el("span")]));
    }
  }
  for (const item of items) list.append(renderItem(item, siteBySource[item.source]));

  return el("section", { className: "column" }, [
    el("div", { className: "col-head" }, [
      el("h2", { textContent: col.title }),
      el("div", { className: "select-wrap" }, select)
    ]),
    list
  ]);
}

function render() {
  // Preserve scroll positions across re-renders.
  const scrolls = [...$columns.querySelectorAll(".list")].map((l) => l.scrollTop);
  $columns.replaceChildren(...COLUMNS.map(renderColumn));
  $columns.querySelectorAll(".list").forEach((l, i) => { l.scrollTop = scrolls[i] || 0; });
}

function renderStatus(loading) {
  const times = Object.values(cache).map((c) => c.fetchedAt).filter(Boolean);
  const last = times.length ? Math.min(...times) : 0;
  $status.textContent = loading
    ? "Refreshing…"
    : last ? `Updated ${new Date(last).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}` : "";
  $refresh.disabled = loading;
}

// ---------- Theme ----------

function applyTheme(theme) {
  if (theme === "auto") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  try { localStorage.setItem("theme", theme); } catch {}
  document.querySelectorAll("[data-theme-value]").forEach((b) =>
    b.setAttribute("aria-checked", String(b.dataset.themeValue === theme))
  );
}

function initTheme() {
  let current = "auto";
  try { current = localStorage.getItem("theme") || "auto"; } catch {}
  applyTheme(current);
  document.querySelectorAll("[data-theme-value]").forEach((b) =>
    b.addEventListener("click", () => applyTheme(b.dataset.themeValue))
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? "Good night" : h < 12 ? "Good morning" : h < 19 ? "Good afternoon" : "Good evening";
}

// ---------- Storage ----------

async function loadState() {
  const data = await chrome.storage.local.get([CACHE_KEY, FILTER_KEY, READ_KEY]);
  cache = data[CACHE_KEY] || {};
  filters = data[FILTER_KEY] || {};
  readLinks = new Set(data[READ_KEY] || []);
}
const saveCache = () => chrome.storage.local.set({ [CACHE_KEY]: cache });
const saveFilters = () => chrome.storage.local.set({ [FILTER_KEY]: filters });
// Sets keep insertion order, so trimming from the front drops the oldest reads.
const saveRead = () => chrome.storage.local.set({ [READ_KEY]: [...readLinks].slice(-MAX_READ) });

// ---------- Refresh loop ----------

let refreshing = false;
async function refreshAll() {
  if (refreshing) return;
  refreshing = true;
  renderStatus(true);
  const sources = COLUMNS.flatMap((c) => c.sources);
  await Promise.all(sources.map(async (s) => {
    try {
      const { items, url } = await loadSource(s);
      cache[s.name] = { items, url, fetchedAt: Date.now(), error: null };
    } catch (e) {
      // Keep stale items if we have them; just record the error.
      cache[s.name] = { ...(cache[s.name] || {}), error: e.name === "AbortError" ? "Timed out" : e.message };
    }
    render(); // progressive: each source appears as soon as it lands
  }));
  await saveCache();
  refreshing = false;
  renderStatus(false);
}

function isStale() {
  const times = COLUMNS.flatMap((c) => c.sources).map((s) => cache[s.name]?.fetchedAt || 0);
  return Math.min(...times) < Date.now() - REFRESH_MINUTES * 60000;
}

async function init() {
  initTheme();
  document.getElementById("greeting").textContent = greeting();
  document.getElementById("date").textContent = new Date().toLocaleDateString(undefined, {
    weekday: "long", day: "numeric", month: "long"
  });
  await loadState();
  render();               // instant paint from cache
  renderStatus(false);
  if (isStale()) refreshAll();

  $refresh.addEventListener("click", refreshAll);
  document.addEventListener("keydown", (e) => {
    if (e.key === "t" && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const dark = document.documentElement.dataset.theme === "dark" ||
        (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
      applyTheme(dark ? "light" : "dark");
    }
    if (e.key === "r" && !e.metaKey && !e.ctrlKey && !e.altKey) refreshAll();
  });
  // Keep read state in sync across open new tabs.
  chrome.storage.onChanged.addListener((changes) => {
    if (changes[READ_KEY]) { readLinks = new Set(changes[READ_KEY].newValue || []); render(); }
  });
  setInterval(() => { if (isStale()) refreshAll(); else render(); }, 60000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && isStale()) refreshAll();
  });
}

init();
