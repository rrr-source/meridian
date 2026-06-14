// i18n: every user-facing string flows through t(), which reads the CURRENT locale.
// The locale is a runtime value (not a build-time constant): src/lib/LocaleContext.jsx
// holds it in React state so switching re-renders the whole app, and changes are
// persisted to localStorage and reflected on <html lang> (also set pre-render by the
// inline script in index.html, so the first paint is already in the right language).
//
// Adding a language = add another entry to `messages` (+ a country-name dict for
// countries.js, + label_<loc> on the constants.js presets). No component changes.

export const DEFAULT_LOCALE = "en";
export const SUPPORTED_LOCALES = ["en", "ru"];
const STORAGE_KEY = "meridian-locale";

const messages = {
  en: {
    "app.title": "Meridian",
    "app.subtitle": "An atlas of country development",
    "app.dataSource": "Data: World Bank Open Data",

    "nav.modes": "Modes",
    "tab.compare": "Compare",
    "tab.relocate": "Relocate",
    "tab.map": "World map",

    "theme.toDark": "Switch to dark theme",
    "theme.toLight": "Switch to light theme",
    "lang.label": "Language",
    "lang.en": "English",
    "lang.ru": "Russian",

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
    "compare.yScale": "Y axis scale",
    "compare.scaleLinear": "Linear",
    "compare.scaleLog": "Log",

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
    "map.highest": "Highest",
    "map.lowest": "Lowest",
    "map.note":
      "Latest available value per country (World Bank, most recent non-empty year). Microstates and a few territories are absent from this low-resolution basemap and show as no data.",
  },

  ru: {
    "app.title": "Meridian",
    "app.subtitle": "Атлас развития стран",
    "app.dataSource": "Данные: World Bank Open Data",

    "nav.modes": "Режимы",
    "tab.compare": "Сравнение",
    "tab.relocate": "Релокейт",
    "tab.map": "Карта мира",

    "theme.toDark": "Включить тёмную тему",
    "theme.toLight": "Включить светлую тему",
    "lang.label": "Язык",
    "lang.en": "Английский",
    "lang.ru": "Русский",

    "state.loading": "Загрузка…",
    "state.empty": "Нет данных.",
    "state.error": "Не удалось загрузить данные.",

    "countries.loaded": "Загружено стран: {n}",

    "compare.countries": "Страны",
    "compare.addCountry": "Добавить страну",
    "compare.removeCountry": "Убрать: {country}",
    "compare.countryLimit": "До {n} стран",
    "compare.indicator": "Показатель",
    "compare.presetGroup": "Готовые показатели",
    "compare.customOption": "Найдено: {label}",
    "compare.searchPlaceholder": "Поиск по каталогу Всемирного банка…",
    "compare.searchLabel": "Поиск показателей",
    "compare.searching": "Поиск…",
    "compare.noResults": "Ничего не найдено.",
    "compare.addChart": "Добавить график",
    "compare.removeChart": "Удалить этот график",
    "compare.picked": "Уже на графике",
    "compare.yScale": "Масштаб оси Y",
    "compare.scaleLinear": "Линейный",
    "compare.scaleLog": "Логарифм.",

    "relocate.region": "Регион",
    "relocate.allRegions": "Все регионы",
    "relocate.recency": "Свежесть данных",
    "relocate.recencyOption.3": "За 3 года",
    "relocate.recencyOption.5": "За 5 лет",
    "relocate.recencyOption.10": "За 10 лет",
    "relocate.recencyOption.all": "За всё время",
    "relocate.recencyCaption": "Показаны данные за последние {n} лет.",
    "relocate.recencyCaptionAll": "Показаны данные за все доступные годы.",
    "relocate.noMatch": "Нет стран, подходящих под текущие фильтры по региону и свежести данных.",
    "relocate.criteria": "Критерии",
    "relocate.priority": "приоритет",
    "relocate.priority.important": "Важно",
    "relocate.priority.very": "Очень важно",
    "relocate.ranking": "Лучшие совпадения",
    "relocate.crit.income": "Доход",
    "relocate.crit.unemployment": "Безработица",
    "relocate.crit.inflation": "Инфляция",
    "relocate.crit.healthcare": "Здравоохранение",
    "relocate.crit.longevity": "Продолжительность жизни",
    "relocate.crit.infantmort": "Младенческая смертность",
    "relocate.crit.safety": "Безопасность",
    "relocate.crit.internet": "Интернет",
    "relocate.crit.electricity": "Доступ к электричеству",
    "relocate.crit.water": "Чистая вода",
    "relocate.crit.urbanization": "Урбанизация",
    "relocate.crit.literacy": "Грамотность",
    "relocate.crit.co2": "CO₂ на человека",
    "relocate.selectHint": "Выберите хотя бы один критерий, чтобы построить рейтинг.",
    "relocate.fewCriteriaHint": "Выберите 2 или более критериев для осмысленного рейтинга.",
    "relocate.note":
      "Упрощённый индекс качества жизни: каждый критерий оценивает страну по её процентильному рангу внутри отфильтрованного набора (регион и свежесть данных), затем оценки объединяются по вашим приоритетам. Ранжирование сглаживает выбросы, поэтому оценки распределяются равномерно, а не скапливаются у верхней границы.",

    "map.indicator": "Показатель",
    "map.searchPlaceholder": "Поиск по каталогу Всемирного банка…",
    "map.searchLabel": "Поиск показателей",
    "map.searching": "Поиск…",
    "map.noResults": "Ничего не найдено.",
    "map.presetGroup": "Готовые показатели",
    "map.customOption": "Найдено: {label}",
    "map.noData": "Нет данных",
    "map.legendLow": "Низкое",
    "map.legendHigh": "Высокое",
    "map.coverage": "Данные есть у {matched} из {total} стран по этому показателю.",
    "map.highest": "Максимум",
    "map.lowest": "Минимум",
    "map.note":
      "Последнее доступное значение по каждой стране (Всемирный банк, последний год с данными). Микрогосударства и некоторые территории отсутствуют на этой карте низкого разрешения и показаны как «нет данных».",
  },
};

// --- current locale (runtime) ---------------------------------------------

const isSupported = (loc) => SUPPORTED_LOCALES.includes(loc);

function readStoredLocale() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (isSupported(v)) return v;
  } catch {
    /* storage unavailable */
  }
  return DEFAULT_LOCALE;
}

// Initialized once at module load (before React renders) from storage, so the very
// first render is already localized. LocaleContext keeps this in sync with its state.
let currentLocale = typeof window !== "undefined" ? readStoredLocale() : DEFAULT_LOCALE;

export const getLocale = () => currentLocale;
export const getInitialLocale = () => currentLocale;

// Set the active locale: update the module value, persist, and reflect on <html lang>.
// (Triggering a re-render is LocaleContext's job — see setLocale there.)
export function setStoredLocale(locale) {
  currentLocale = isSupported(locale) ? locale : DEFAULT_LOCALE;
  try {
    localStorage.setItem(STORAGE_KEY, currentLocale);
  } catch {
    /* storage unavailable — still applies for this session */
  }
  if (typeof document !== "undefined") document.documentElement.lang = currentLocale;
  return currentLocale;
}

// Lookup with a {token} interpolation pass. Missing key in the current locale falls
// back to English, then to the key itself — so a partial translation never blanks out.
export const t = (key, vars) => {
  let str = messages[currentLocale]?.[key] ?? messages[DEFAULT_LOCALE]?.[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return str;
};
