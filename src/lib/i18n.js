// i18n seam — English-only for v1, but every user-facing string flows through t()
// so a new locale is just another entry in `messages` (no component changes).
export const LOCALE = "en"; // single source of truth

const messages = {
  en: {
    "app.title": "Meridian",
    "app.subtitle": "An atlas of country development",
    "app.dataSource": "Data: World Bank Open Data",

    "tab.compare": "Compare",
    "tab.relocate": "Relocate",
    "tab.map": "World map",

    "state.loading": "Loading…",
    "state.empty": "No data available.",
    "state.error": "Could not load data.",

    "countries.loaded": "{n} countries loaded",

    "compare.countries": "Countries",
    "compare.addCountry": "Add country",
    "compare.removeCountry": "Remove {country}",
    "compare.countryLimit": "Up to {n} countries",
    "compare.indicator": "Indicator",
    "compare.presetGroup": "Preset indicators",
    "compare.customOption": "Searched: {label}",
    "compare.searchPlaceholder": "Search the World Bank catalog…",
    "compare.searchLabel": "Search indicators",
    "compare.searching": "Searching…",
    "compare.noResults": "No matching indicators.",
    "compare.addChart": "Add chart",
    "compare.removeChart": "Remove this chart",
    "compare.picked": "Already charted",

    "relocate.region": "Region",
    "relocate.allRegions": "All regions",
    "relocate.recency": "Recency",
    "relocate.recencyOption.3": "Last 3 years",
    "relocate.recencyOption.5": "Last 5 years",
    "relocate.recencyOption.10": "Last 10 years",
    "relocate.recencyOption.all": "All time",
    "relocate.recencyCaption": "Showing data from the last {n} years.",
    "relocate.recencyCaptionAll": "Showing data from all available years.",
    "relocate.noMatch": "No countries match the current region and recency filters.",
    "relocate.criteria": "Criteria",
    "relocate.priority": "priority",
    "relocate.priority.not": "Not important",
    "relocate.priority.important": "Important",
    "relocate.priority.very": "Very important",
    "relocate.ranking": "Best matches",
    "relocate.crit.income": "Income",
    "relocate.crit.unemployment": "Unemployment",
    "relocate.crit.inflation": "Inflation",
    "relocate.crit.healthcare": "Healthcare",
    "relocate.crit.longevity": "Longevity",
    "relocate.crit.infantmort": "Infant mortality",
    "relocate.crit.safety": "Safety",
    "relocate.crit.internet": "Internet",
    "relocate.crit.electricity": "Electricity access",
    "relocate.crit.water": "Clean water",
    "relocate.crit.urbanization": "Urbanization",
    "relocate.crit.literacy": "Literacy",
    "relocate.crit.co2": "CO₂ per capita",
    "relocate.selectHint": "Select at least one criterion to build a ranking.",
    "relocate.zeroWeightHint": "Set at least one criterion to Important or higher.",
    "relocate.fewCriteriaHint": "Pick 2 or more criteria for a meaningful ranking.",
    "relocate.note":
      "A simplified livability index: each criterion scores every country by its percentile rank within the filtered set (region and recency), then the scores are combined by your priorities. Ranking sidesteps outliers, so scores spread evenly rather than piling up at the top.",

    "map.indicator": "Indicator",
    "map.searchPlaceholder": "Search the World Bank catalog…",
    "map.searchLabel": "Search indicators",
    "map.searching": "Searching…",
    "map.noResults": "No matching indicators.",
    "map.presetGroup": "Preset indicators",
    "map.customOption": "Searched: {label}",
    "map.noData": "No data",
    "map.legendLow": "Low",
    "map.legendHigh": "High",
    "map.coverage": "{matched} of {total} countries have data for this indicator.",
    "map.note":
      "Latest available value per country (World Bank, most recent non-empty year). Microstates and a few territories are absent from this low-resolution basemap and show as no data.",
  },
};

// Lookup with a {token} interpolation pass; falls back to the key itself.
export const t = (key, vars) => {
  let str = messages[LOCALE]?.[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return str;
};
