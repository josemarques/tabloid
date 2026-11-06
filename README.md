# Tabloid

A Chrome new-tab page with three columns of RSS headlines and the local weather in the header.

| Column | Sources |
|---|---|
| Notícias | Expresso, Público |
| Music | Stereogum (news), Blitz, Consequence (news) |
| Tech | Techmeme, TechCrunch |

## Install

1. Clone the repo, or download it as a ZIP and unzip it.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and select this folder.
4. When Chrome asks whether to keep the new tab page change, click **Keep it**.

To update: `git pull`, then click reload on the extension's card in `chrome://extensions`.

## Features

- Each column mixes its sources newest-first, or shows a single source from the dropdown.
- Articles you've opened fade back, and stay faded across tabs and restarts.
- Light / Auto / Dark theme switch. Shortcuts: `R` refreshes the feeds, `T` flips the theme.
- Weather from [Open-Meteo](https://open-meteo.com) (no API key): condition icon, current temperature, today's high and low.

## Configure

Everything is in `feeds.js`:

- `COLUMNS`: column titles and sources. Each source lists feed URLs tried in order, plus a `site` used to find the feed on its homepage if they all fail.
- `ITEMS_PER_SOURCE`, `REFRESH_MINUTES`.
- `WEATHER`: set `useGeolocation: false` to always use the `fallback` place instead of your location.

Adding a source on a new domain also means adding that domain to `host_permissions` in `manifest.json`.

## Privacy

Feeds are fetched directly from each site. For the weather, your approximate coordinates are sent to Open-Meteo, and to BigDataCloud to look up the town name. Nothing else leaves your browser.

## License

Copyright © 2026 José Marques.

Tabloid is free software: you can redistribute it and/or modify it under the terms of the [GNU General Public License v3.0](LICENSE), or (at your option) any later version. It is distributed WITHOUT ANY WARRANTY; see the license for details.

Weather icons are adapted from [Lucide](https://lucide.dev) (ISC License). Headlines and summaries belong to their publishers; Tabloid only fetches them in your browser and doesn't republish anything.
