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

    "placeholder.compare": "Compare mode — coming next.",
    "placeholder.relocate": "Relocate mode — coming next.",
    "placeholder.quiz": "Quiz mode — coming next.",
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
