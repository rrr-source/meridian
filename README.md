# Meridian

**An atlas of country development, built on [World Bank Open Data](https://data.worldbank.org/).**
Compare two countries across decades, rank places to live by what you care about,
and test how well you know the world's development curves — all from live data,
no API key required.

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

- **Compare** — pick two countries and see GDP per capita, population, and internet
  adoption side by side over time, with the latest-year figures called out.
- **Relocate** — choose what matters (income, healthcare, urbanization, internet,
  longevity), weight each criterion, and get a ranked shortlist of countries. The
  index is robust to outliers (see the note below).
- **Quiz** — a country's GDP-per-capita curve is drawn with no label; guess which
  country it is from four options, and keep score.

## Data

All figures come from the **World Bank Open Data API** (`https://api.worldbank.org/v2`)
— no key, CORS is open, and everything is fetched directly from the browser. Data
lags ~1–2 years, so the time window ends at last year.

## Adding a new indicator

Indicators live in [`src/lib/constants.js`](src/lib/constants.js). To add one,
append a row to the `INDICATORS` map:

```js
gni: { key: "gni", code: "NY.GNP.PCAP.CD", label: "GNI per capita", unit: "$", monetary: true },
```

- `code` is the World Bank indicator code.
- `unit` is one of `"$"`, `"%"`, `"yrs"`, or `"ppl"` (drives formatting).
- Set `monetary: true` for money values — the Relocate ranking log-transforms them.

`constants.js` already lists a batch of high-coverage indicator codes worth adding,
in a comment block.

## A note on the Relocate ranking

The ranking is a **simplified livability index**, not an authoritative one. For each
selected criterion, monetary values are log-scaled, then every value is winsorized at
the 5th/95th percentile and min-max normalized to 0–100; the country score is the
weighted average across criteria. The log + winsorize steps keep a few extreme
outliers (e.g. oil micro-states) from dominating, so the result reflects broad
quality of life rather than a single stretched axis.

## Roadmap

- **Richer Quiz mode** — multi-indicator clues instead of GDP-per-capita alone,
  which is hard to guess.
- **Per-indicator selector in Compare** — choose any of the 2,000+ World Bank
  indicators, not just the three built-in ones.
- **A world map view** — choropleths alongside the line charts.
- **Region filters** — narrow Compare and Relocate to a continent or income group.
- **Full i18n / localized country names** — the i18n seam and country-name resolver
  are already in place; this fills in additional locales.

## License

[MIT](LICENSE)
