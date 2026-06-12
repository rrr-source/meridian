# Meridian

**An atlas of country development, built on [World Bank Open Data](https://data.worldbank.org/).**
Compare up to five countries across decades on any indicator, rank places to live
by what you care about, and test how well you know the world's development curves —
all from live data, no API key required.

![Meridian screenshot](docs/screenshot.png)

> _Screenshot placeholder — drop a real capture at `docs/screenshot.png`._

## Stack

- [Vite](https://vitejs.dev/) + [React](https://react.dev/) (JavaScript)
- [Tailwind CSS v4](https://tailwindcss.com/) (via the `@tailwindcss/vite` plugin — no `tailwind.config.js`)
- [recharts](https://recharts.org/) for charts
- [lucide-react](https://lucide.dev/) for icons

## Getting started

```bash
npm install && npm run dev
```

Then open the printed local URL. To produce a production build:

```bash
npm run build      # outputs to dist/
npm run preview    # serve the build locally
```

## The three modes

- **Compare** — build a shared set of up to five countries (chips with stable,
  per-country colors; add or remove any of them) that applies to every chart on
  screen. Add as many charts as you like; each chart plots any indicator you
  choose, from a curated list of ~24 presets **or** a live search over the full
  World Bank WDI catalog (~1,486 indicators). The latest value for each country is
  called out above every chart. The same indicator can't be charted twice at once.
- **Relocate** — choose what matters (income, healthcare, urbanization, internet,
  longevity), weight each criterion, and get a ranked shortlist of countries. Narrow
  it to a single World Bank region, and set a data-recency threshold (last 3, 5, or
  10 years, or all time — default 5) so the ranking only uses sufficiently fresh
  figures; each country shows the year its data comes from. The index is robust to
  outliers (see the note below).
- **Quiz** — a country's GDP-per-capita curve is drawn with no label; guess which
  country it is from four options, and keep score.

## Data

All figures come from the **World Bank Open Data API** (`https://api.worldbank.org/v2`)
— no key, CORS is open, and everything is fetched directly from the browser.

World Bank data lags ~1–2 years, so the time series end at last year and the "most
recent" value for a given country is typically from **2023–2024**, not the current
year — and different countries' latest values can come from different years. That
mismatch is exactly why Relocate exposes the per-country data year and a recency
threshold, instead of silently mixing stale and fresh numbers.

## Adding a new indicator

The curated presets live in [`src/lib/constants.js`](src/lib/constants.js), grouped
by theme. To add one, append a row to the `INDICATORS` map:

```js
gni: { key: "gni", code: "NY.GNP.PCAP.CD", label: "GNI per capita (Atlas)", unit: "$", monetary: true },
```

- `code` is the World Bank indicator code.
- `unit` drives formatting: `"$"`, `"%"`, `"yrs"`, and `"ppl"` are handled
  specially; any other string (e.g. `"per 1,000"`, `"t"`) is rendered as a suffix,
  and an empty/unknown unit falls back to compact `K`/`M`/`B` numbers — which is
  also what indicators picked via Compare's catalog search use.
- Set `monetary: true` for money values — the Relocate ranking log-transforms them.

You don't have to touch the presets to chart something one-off: Compare's per-chart
search box reaches the whole WDI catalog directly.

## A note on the Relocate ranking

The ranking is a **simplified livability index**, not an authoritative one. For each
selected criterion, monetary values are log-scaled, then every value is winsorized at
the 5th/95th percentile and min-max normalized to 0–100; the country score is the
weighted average across criteria. The log + winsorize steps keep a few extreme
outliers (e.g. oil micro-states) from dominating, so the result reflects broad
quality of life rather than a single stretched axis. When a region or recency filter
is active, those percentile bounds are recomputed over just the countries that pass —
so "best in Europe" is ranked relative to Europe, not the world.

## Roadmap

- **Richer Quiz mode** — multi-indicator clues instead of GDP-per-capita alone,
  which is hard to guess.
- **More Relocate criteria** — expose more of the preset indicators as weightable
  livability criteria.
- **A world map view** — choropleths alongside the line charts.
- **Linear / log scale toggle for Compare** — switch the Y axis per chart.
- **Shareable URL state** — encode the current selection so a view can be linked.
- **Full i18n / localized country names** — the i18n seam and country-name resolver
  are already in place; this fills in additional locales.

## License

[MIT](LICENSE)
