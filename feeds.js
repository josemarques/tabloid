// Edit this file to change columns or sources.
// Each source lists feed URLs tried in order; `site` is used for
// RSS autodiscovery if every URL fails.
const COLUMNS = [
  {
    title: "Notícias",
    sources: [
      {
        name: "Expresso",
        site: "https://expresso.pt/",
        urls: ["https://expresso.pt/rss/ultimas", "https://expresso.pt/rss"]
      },
      {
        name: "Público",
        site: "https://www.publico.pt/",
        urls: ["https://feeds.feedburner.com/PublicoRSS", "https://www.publico.pt/rss"]
      }
    ]
  },
  {
    title: "Music",
    sources: [
      {
        name: "Stereogum",
        site: "https://www.stereogum.com/",
        urls: ["https://www.stereogum.com/category/news/feed/", "https://www.stereogum.com/feed/"]
      },
      {
        name: "Blitz",
        site: "https://blitz.pt/",
        urls: ["https://blitz.pt/rss/ultimas", "https://blitz.pt/rss"]
      }
    ]
  },
  {
    title: "Tech",
    sources: [
      {
        name: "Techmeme",
        site: "https://www.techmeme.com/",
        urls: ["https://www.techmeme.com/feed.xml"]
      },
      {
        name: "TechCrunch",
        site: "https://techcrunch.com/",
        urls: ["https://techcrunch.com/feed/"]
      }
    ]
  }
];

const ITEMS_PER_SOURCE = 25;
const REFRESH_MINUTES = 15;

// Weather: uses your current location when Chrome can get it,
// otherwise this fallback place.
const WEATHER = {
  useGeolocation: true,
  fallback: { name: "Lisboa", lat: 38.7223, lon: -9.1393 },
  refreshMinutes: 30
};
