# Meridian

**An atlas of country development, built on [World Bank Open Data](https://data.worldbank.org/).**
Compare up to five countries across decades on any indicator, rank places to live
by what you care about, and color the whole world by a chosen indicator on an
interactive map — all from live data, no API key required.

![Meridian screenshot](docs/screenshot.png)

> _Screenshot placeholder — drop a real capture at `docs/screenshot.png`._

## Stack

- [Vite](https://vitejs.dev/) + [React](https://react.dev/) (JavaScript)
- [Tailwind CSS v4](https://tailwindcss.com/) (via the `@tailwindcss/vite` plugin — no `tailwind.config.js`)
- [recharts](https://recharts.org/) for charts
- [react-simple-maps](https://www.react-simple-maps.io/) + [d3-geo-projection](https://github.com/d3/d3-geo-projection) for the world map
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
- **Relocate** — pick the criteria that matter from **13 development indicators**
  (income, unemployment, inflation, healthcare, longevity, infant mortality, safety,
  internet, electricity, clean water, urbanization, literacy, CO₂ per capita) and
  give each one a **priority** — _Not important_ / _Important_ / _Very important_.
  Direction is built in: for "lower is better" criteria (unemployment, inflation,
  infant mortality, homicide rate, CO₂) a low value scores high. Narrow the field to
  a single World Bank region, and set a data-recency threshold (last 3, 5, or 10
  years, or all time — default 5) so only sufficiently fresh figures count; each
  country shows the year its data comes from. The result is a ranked shortlist (see
  the note below on how it's scored).
- **World map** — an interactive choropleth (Miller projection) that colors every
  country by a chosen indicator, using the **same preset list and live WDI catalog
  search as Compare** (default: GDP per capita). Each country is shaded on a
  light-to-dark teal scale from its latest available value; countries with no data —
  or too small to draw on the basemap — are left gray. Hover any country for a
  tooltip with its name, value, and data year, and read the scale from the min/max
  legend.

## Data

All figures come from the **World Bank Open Data API** (`https://api.worldbank.org/v2`)
— no key, CORS is open, and everything is fetched directly from the browser.

World Bank data lags ~1–2 years, so the time series end at last year and the "most
recent" value for a given country is typically from **2023–2024**, not the current
year — and different countries' latest values can come from different years. That
mismatch is exactly why Relocate exposes the per-country data year and a recency
threshold (instead of silently mixing stale and fresh numbers), and why the World
map's tooltip always shows each country's value alongside the year it's from.

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
  also what indicators picked via catalog search use.
- Set `monetary: true` for money values — they're heavy-tailed across countries, so
  the World map places them on a logarithmic color ramp.

You don't have to touch the presets to chart or map something one-off: the catalog
search box in both Compare and the World map reaches the whole WDI catalog directly.

## A note on the Relocate ranking

The ranking is a **simplified livability index**, not an authoritative one. For each
selected criterion, every country is scored by its **percentile rank** within the
filtered set (0–100) — its standing among the countries that pass the active region
and recency filters. "Lower is better" criteria are inverted, so a low raw value
earns a high score, and a country's overall index is the **priority-weighted
average** of those per-criterion scores (_Very important_ counts double _Important_;
_Not important_ drops the criterion entirely). Scoring by percentile is naturally
robust to outliers and is recomputed whenever the filters change — so "best in
Europe" is ranked relative to Europe, not the world.

## Roadmap

- **World-map year slider** _(deferred)_ — animate the choropleth across time instead
  of showing only the latest value per country.
- **Shareable URL state** — encode the current selection so a view can be linked.
- **Linear / log scale toggle for Compare** — switch the Y axis per chart.
- **Full i18n / localized country names** — the i18n seam and country-name resolver
  are already in place; this fills in additional locales.
- **Dark mode** — a dark theme for the instrument-panel look.

## License

[MIT](LICENSE)
</content>
</invoke>
