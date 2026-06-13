import { useEffect, useMemo, useState } from "react";
import { Globe } from "lucide-react";
import { t } from "./lib/i18n";
import { fetchCountries } from "./lib/api";
import { readTab, readSearchParams } from "./lib/urlState";
import Compare from "./components/Compare";
import Relocate from "./components/Relocate";
import WorldMap from "./components/WorldMap";

const TABS = [
  { id: "compare", labelKey: "tab.compare" },
  { id: "relocate", labelKey: "tab.relocate" },
  { id: "map", labelKey: "tab.map" },
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

  const selectTab = (id) => {
    setTab(id);
    setVisited((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  };

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
      <header className="bg-ink text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4">
          <Globe className="h-7 w-7 shrink-0 text-accent" aria-hidden="true" />
          <div className="mr-auto">
            <h1 className="text-xl font-semibold leading-tight">{t("app.title")}</h1>
            <p className="text-sm text-slate-400">{t("app.subtitle")}</p>
          </div>

          <nav aria-label="Modes" className="flex gap-1 rounded-lg bg-white/5 p-1">
            {TABS.map((tb) => {
              const active = tab === tb.id;
              return (
                <button
                  key={tb.id}
                  type="button"
                  onClick={() => selectTab(tb.id)}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                    active ? "bg-accent text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {t(tb.labelKey)}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {error ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
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
                />
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

// Centered in-app loader: the accent-teal globe inside a spinning teal ring with a
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
        <Globe className="absolute inset-0 m-auto h-6 w-6 text-accent" aria-hidden="true" />
      </div>
      <span className="text-sm text-slate-500">{t("state.loading")}</span>
    </div>
  );
}
