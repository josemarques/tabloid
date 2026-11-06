// Edit this file to change columns or sources.
// Each source lists feed URLs tried in order; `site` is used for
// RSS autodiscovery if every URL fails. Optional `match` keeps only
// items whose link contains that text (for feeds shared between sites).
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
        urls: [
          "https://www.stereogum.com/category/news/feed/",
          "https://stereogum.com/category/news/feed/",
          "https://www.stereogum.com/feed/"
        ]
      },
      {
        // Blitz now lives under expresso.pt/blitz; blitz.pt redirects to
        // Expresso's main feed, so `match` filters out non-Blitz items.
        name: "Blitz",
        site: "https://expresso.pt/blitz",
        match: "/blitz",
        urls: [
          "https://expresso.pt/rss/blitz",
          "https://expresso.pt/blitz/rss",
          "https://expresso.pt/rss/ultimas"
        ]
      },
      {
        name: "Consequence",
        site: "https://consequence.net/",
        urls: ["https://consequence.net/category/news/feed/", "https://consequence.net/feed/"]
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
