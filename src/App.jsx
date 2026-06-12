import { useEffect, useState } from "react";
import { Globe } from "lucide-react";
import { t } from "./lib/i18n";
import { fetchCountries } from "./lib/api";
import Compare from "./components/Compare";
import Relocate from "./components/Relocate";
import Quiz from "./components/Quiz";

const TABS = [
  { id: "compare", labelKey: "tab.compare" },
  { id: "relocate", labelKey: "tab.relocate" },
  { id: "quiz", labelKey: "tab.quiz" },
];

export default function App() {
  const [tab, setTab] = useState("compare");
  const [countries, setCountries] = useState([]);
  const [error, setError] = useState(null);

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
                  onClick={() => setTab(tb.id)}
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
        ) : tab === "compare" ? (
          <Compare countries={countries} />
        ) : tab === "relocate" ? (
          <Relocate countries={countries} />
        ) : (
          <Quiz countries={countries} />
        )}
      </main>
    </div>
  );
}
