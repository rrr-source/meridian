import { useEffect, useMemo, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { t, SUPPORTED_LOCALES } from "./lib/i18n";
import { useLocale } from "./lib/LocaleContext.jsx";
import { fetchCountries } from "./lib/api";
import { readTab, readSearchParams } from "./lib/urlState";
import { getInitialTheme, applyTheme } from "./lib/theme";
import MeridianMark from "./components/MeridianMark";
import Compare from "./components/Compare";
import Relocate from "./components/Relocate";
import WorldMap from "./components/WorldMap";

const TABS = [
  { id: "map", labelKey: "tab.map" },
  { id: "compare", labelKey: "tab.compare" },
  { id: "relocate", labelKey: "tab.relocate" },
];

export default function App() {
  // The active tab and its settings come from the URL on load (defaults if absent).
  // Only the active tab's params live in the URL; each mode reads its own initial
  // params (when it was the active tab on load) and, while active, syncs them back.
  const initialTab = useMemo(() => readTab(), []);
  const initialParams = useMemo(() => readSearchParams(), []);
  const [tab, setTab] = useState(initialTab);
  // Modes are kept mounted once visited so their in-memory state (Compare's
  // countries/charts, Relocate's weights/ranking, World map's indicator) survives tab
  // switches. We lazy-mount on first visit so each mode's charts/map first measure
  // while visible (recharts can't size inside a display:none panel), then stay alive.
  const [visited, setVisited] = useState(() => new Set([initialTab]));
  const [countries, setCountries] = useState([]);
  const [error, setError] = useState(null);
  // Theme is light by default; the index.html inline script already applied any saved
  // choice to <html> before paint, so we just read it back as the initial state.
  const [theme, setTheme] = useState(getInitialTheme);
  // Locale is reactive via context: switching it re-renders the whole tree so every
  // t() / countryLabel() / indicatorLabel() re-resolves in the new language.
  const { locale, setLocale } = useLocale();

  const selectTab = (id) => {
    setTab(id);
    setVisited((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  };

  const toggleTheme = () => setTheme((prev) => applyTheme(prev === "dark" ? "light" : "dark"));

  useEffect(() => {
    document.title = t("app.pageTitle");
  }, [locale]);

  // Load the country list once; every mode reuses it.
  useEffect(() => {
    let alive = true;
    fetchCountries()
      .then((list) => alive && setCountries(list))
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-transparent bg-ink text-white dark:border-slate-800">
        {/* Stable layout: the brand title truncates and the lang/theme controls are
            fixed-width, so the top row never changes height between EN/RU. The tabs sit
            in their own full-width row on mobile (centered) and reflow inline on desktop
            (sm:w-auto) — so toggling language/theme/tabs never shifts the header. */}
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4">
          {/* Brand + utility controls share ONE non-wrapping row (flex, no wrap). The
              title block has min-w-0 + truncate, so it SHRINKS to make room instead of
              pushing the lang/theme controls onto a new line — at any width, in either
              language (line-wrapping otherwise uses the title's full content width). */}
          <div className="flex min-w-0 flex-1 items-center gap-x-4">
          <MeridianMark size={30} className="shrink-0" />
          <div className="mr-auto min-w-0">
            <h1 className="truncate text-xl font-semibold leading-tight">{t("app.title")}</h1>
            <p className="truncate text-sm text-slate-400">{t("app.subtitle")}</p>
          </div>

          <div role="group" aria-label={t("lang.label")} className="flex shrink-0 overflow-hidden rounded-md border border-white/15 text-xs font-semibold">
            {SUPPORTED_LOCALES.map((loc) => {
              const on = locale === loc;
              return (
                <button
                  key={loc}
                  type="button"
                  onClick={() => setLocale(loc)}
                  aria-pressed={on}
                  aria-label={t(`lang.${loc}`)}
                  className={`px-2 py-1 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent ${
                    on ? "bg-accent text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {loc.toUpperCase()}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? t("theme.toLight") : t("theme.toDark")}
            title={theme === "dark" ? t("theme.toLight") : t("theme.toDark")}
            className="shrink-0 rounded-md p-2 text-slate-300 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {theme === "dark" ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
          </button>
          </div>

          {/* Full-width own row on mobile (centered); inline on the right on desktop. */}
          <div className="flex w-full justify-center sm:w-auto">
            <nav aria-label={t("nav.modes")} className="flex flex-wrap justify-center gap-1 rounded-lg bg-white/5 p-1">
              {TABS.map((tb) => {
                const active = tab === tb.id;
                return (
                  <button
                    key={tb.id}
                    type="button"
                    onClick={() => selectTab(tb.id)}
                    aria-current={active ? "page" : undefined}
                    className={`inline-flex min-h-11 items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors sm:min-h-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                      active ? "bg-accent text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {t(tb.labelKey)}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {error ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
            {t("state.error")} {error}
          </p>
        ) : countries.length === 0 ? (
          // Country list still loading — branded spinner, matching the static splash.
          <Loader />
        ) : (
          // All visited modes stay mounted; only the active one is shown. Hiding
          // (vs. unmounting) is what preserves each mode's state across switches.
          <>
            <div hidden={tab !== "compare"}>
              {visited.has("compare") && (
                <Compare
                  countries={countries}
                  active={tab === "compare"}
                  initialParams={initialTab === "compare" ? initialParams : null}
                  theme={theme}
                />
              )}
            </div>
            <div hidden={tab !== "relocate"}>
              {visited.has("relocate") && (
                <Relocate
                  countries={countries}
                  active={tab === "relocate"}
                  initialParams={initialTab === "relocate" ? initialParams : null}
                />
              )}
            </div>
            <div hidden={tab !== "map"}>
              {visited.has("map") && (
                <WorldMap
                  countries={countries}
                  active={tab === "map"}
                  initialParams={initialTab === "map" ? initialParams : null}
                  theme={theme}
                />
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

// Centered in-app loader: the Meridian mark inside a spinning teal ring with a
// "Loading…" label — the light-background echo of the static splash in index.html.
// `animate-spin` is paused by the global prefers-reduced-motion rule in index.css.
function Loader() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24" role="status" aria-live="polite">
      <div className="relative h-12 w-12">
        <span
          className="absolute inset-0 animate-spin rounded-full border-[3px] border-accent/20 border-t-accent"
          aria-hidden="true"
        />
        <MeridianMark size={24} className="absolute inset-0 m-auto" />
      </div>
      <span className="text-sm text-slate-500">{t("state.loading")}</span>
    </div>
  );
}
