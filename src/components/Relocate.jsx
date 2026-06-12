import { useEffect, useMemo, useState } from "react";
import { t } from "../lib/i18n";
import { countryLabel } from "../lib/countries";
import { fetchLatestAll } from "../lib/api";
import { INDICATORS, ACCENT } from "../lib/constants";
import { computeRanking } from "../lib/ranking";

// Criteria offered as toggle chips. Each maps to an indicator key.
const CRITERIA = [
  { key: "gdppc", labelKey: "relocate.crit.income" },
  { key: "health", labelKey: "relocate.crit.healthcare" },
  { key: "urban", labelKey: "relocate.crit.urbanization" },
  { key: "internet", labelKey: "relocate.crit.internet" },
  { key: "life", labelKey: "relocate.crit.longevity" },
];
const DEFAULT_WEIGHT = 50;
const TOP_N = 15;

export default function Relocate({ countries }) {
  // Default selection: all five criteria active, equal weight — a broad index.
  const [selected, setSelected] = useState(() => new Set(CRITERIA.map((c) => c.key)));
  const [weights, setWeights] = useState(() => Object.fromEntries(CRITERIA.map((c) => [c.key, DEFAULT_WEIGHT])));
  const [cache, setCache] = useState({}); // key -> raw WB rows (loaded once per indicator)
  const [region, setRegion] = useState("all"); // "all" or a WB region.value
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const byId = useMemo(() => new Map(countries.map((c) => [c.id, c])), [countries]);
  const validCodes = useMemo(() => new Set(countries.map((c) => c.id)), [countries]);

  // Distinct WB regions present in the loaded list (aggregates already removed
  // upstream), alphabetical. Region data ships with the country list — no new fetch.
  const regions = useMemo(
    () => [...new Set(countries.map((c) => c.region).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [countries]
  );

  // The candidate codes the ranking is computed over. "all" = every country (today's
  // global behavior); otherwise only countries in the chosen region — so the
  // normalize/winsorize bounds below are recomputed within the region.
  const regionCodes = useMemo(() => {
    if (region === "all") return validCodes;
    return new Set(countries.filter((c) => c.region === region).map((c) => c.id));
  }, [region, countries, validCodes]);

  // Load latest values (mrnev=1) for any selected-but-uncached indicator.
  useEffect(() => {
    const missing = [...selected].filter((k) => !cache[k]);
    if (missing.length === 0) return;

    let alive = true;
    setLoading(true);
    setError(null);
    Promise.all(missing.map((k) => fetchLatestAll(INDICATORS[k].code).then((rows) => [k, rows])))
      .then((results) => {
        if (!alive) return;
        setCache((prev) => {
          const next = { ...prev };
          for (const [k, rows] of results) next[k] = rows;
          return next;
        });
        setLoading(false);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e.message);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
    // Re-run on selection change; the cached-set guard above prevents refetching.
  }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps

  // null = no criteria selected; undefined = still loading; array = ranked result.
  const ranking = useMemo(() => {
    const activeKeys = [...selected];
    if (activeKeys.length === 0) return null;
    if (!countries.length || activeKeys.some((k) => !cache[k])) return undefined;

    // Filter candidates to the selected region BEFORE normalizing, so p5/p95 and
    // the min-max stretch are relative to the region, not the world.
    const valueMaps = {};
    for (const k of activeKeys) {
      const m = new Map();
      for (const r of cache[k]) {
        if (r.value != null && regionCodes.has(r.countryiso3code)) m.set(r.countryiso3code, r.value);
      }
      valueMaps[k] = m;
    }
    const activeIndicators = activeKeys.map((k) => INDICATORS[k]);
    return computeRanking(activeIndicators, weights, valueMaps);
  }, [selected, weights, cache, regionCodes, countries.length]);

  const toggle = (key) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const setWeight = (key, value) => setWeights((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-6">
      {/* Region filter — ranks within one WB region (or all). */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-slate-500">{t("relocate.region")}</span>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="ml-auto min-w-0 max-w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <option value="all">{t("relocate.allRegions")}</option>
            {regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
      </section>

      {/* Criteria chips */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-medium text-slate-500">{t("relocate.criteria")}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {CRITERIA.map((c) => {
            const active = selected.has(c.key);
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => toggle(c.key)}
                aria-pressed={active}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                  active
                    ? "border-accent bg-accent text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                {t(c.labelKey)}
              </button>
            );
          })}
        </div>

        {/* Per-criterion weight sliders */}
        {selected.size > 0 && (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {CRITERIA.filter((c) => selected.has(c.key)).map((c) => (
              <label key={c.key} className="block">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-slate-600">{t(c.labelKey)}</span>
                  <span className="num text-sm font-semibold text-slate-900">{weights[c.key]}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={weights[c.key]}
                  onChange={(e) => setWeight(c.key, Number(e.target.value))}
                  style={{ accentColor: ACCENT }}
                  className="mt-1 w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  aria-label={`${t(c.labelKey)} ${t("relocate.weight")}`}
                />
              </label>
            ))}
          </div>
        )}
      </section>

      {/* Ranking */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">{t("relocate.ranking")}</h2>

        {error ? (
          <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {t("state.error")} {error}
          </p>
        ) : ranking === null ? (
          <p className="mt-4 text-sm text-slate-500">{t("relocate.selectHint")}</p>
        ) : ranking === undefined || loading ? (
          <p className="mt-4 text-sm text-slate-500">{t("state.loading")}</p>
        ) : ranking.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">{t("relocate.zeroWeightHint")}</p>
        ) : (
          <ol className="mt-4 space-y-3">
            {ranking.slice(0, TOP_N).map((row, i) => {
              const country = byId.get(row.code);
              return (
                <li key={row.code} className="flex items-center gap-3">
                  <span className="num w-6 shrink-0 text-right text-sm text-slate-500">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm text-slate-900">
                        {country ? countryLabel(country) : row.code}
                      </span>
                      <span className="num text-sm font-semibold text-slate-900">{row.index.toFixed(1)}</span>
                    </div>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${row.index}%` }} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        <p className="mt-5 border-t border-slate-100 pt-4 text-xs text-slate-500">{t("relocate.note")}</p>
      </section>
    </div>
  );
}
