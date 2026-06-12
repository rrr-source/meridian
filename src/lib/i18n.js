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
    "tab.quiz": "Quiz",

    "state.loading": "Loading…",
    "state.empty": "No data available.",
    "state.error": "Could not load data.",

    "countries.loaded": "{n} countries loaded",

    "compare.countryA": "Country A",
    "compare.countryB": "Country B",

    "relocate.criteria": "Criteria",
    "relocate.weight": "weight",
    "relocate.ranking": "Best matches",
    "relocate.crit.income": "Income",
    "relocate.crit.healthcare": "Healthcare",
    "relocate.crit.urbanization": "Urbanization",
    "relocate.crit.internet": "Internet",
    "relocate.crit.longevity": "Longevity",
    "relocate.selectHint": "Select at least one criterion to build a ranking.",
    "relocate.zeroWeightHint": "Give at least one criterion a weight above zero.",
    "relocate.note":
      "A simplified livability index: monetary values are log-scaled and outliers are trimmed at the 5th/95th percentile, so the ranking reflects broad quality of life rather than a single stretched axis.",

    "quiz.prompt": "Which country's GDP per capita is this?",
    "quiz.axisLabel": "GDP per capita ($)",
    "quiz.next": "Next question",
    "quiz.score": "Score",
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
