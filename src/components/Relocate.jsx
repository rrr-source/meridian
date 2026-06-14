import { useEffect, useMemo, useRef, useState } from "react";
import { t } from "../lib/i18n";
import { countryLabel, regionLabel } from "../lib/countries";
import { fetchLatestAll } from "../lib/api";
import { END_YEAR } from "../lib/constants";
import { computeRanking } from "../lib/ranking";
import { decodeRelocate, encodeRelocate, writeUrl } from "../lib/urlState";

// Criteria offered as toggle chips. Each is self-contained: a World Bank `code`,
// `monetary` (log-transform on normalize), and `higherIsBetter` — the DIRECTION.
// For higherIsBetter: false the normalized 0..100 score is inverted, so a low raw
// value (low unemployment, low homicide rate, low CO₂) earns a HIGH livability
// score. Without this, high unemployment/inflation/mortality would rank as "good".
const CRITERIA = [
  { key: "income", labelKey: "relocate.crit.income", code: "NY.GDP.PCAP.CD", monetary: true, higherIsBetter: true },
  { key: "unemployment", labelKey: "relocate.crit.unemployment", code: "SL.UEM.TOTL.ZS", monetary: false, higherIsBetter: false },
  { key: "inflation", labelKey: "relocate.crit.inflation", code: "FP.CPI.TOTL.ZG", monetary: false, higherIsBetter: false },
  { key: "healthcare", labelKey: "relocate.crit.healthcare", code: "SH.XPD.CHEX.PC.CD", monetary: true, higherIsBetter: true },
  { key: "longevity", labelKey: "relocate.crit.longevity", code: "SP.DYN.LE00.IN", monetary: false, higherIsBetter: true },
  { key: "infantmort", labelKey: "relocate.crit.infantmort", code: "SP.DYN.IMRT.IN", monetary: false, higherIsBetter: false },
  { key: "safety", labelKey: "relocate.crit.safety", code: "VC.IHR.PSRC.P5", monetary: false, higherIsBetter: false },
  { key: "internet", labelKey: "relocate.crit.internet", code: "IT.NET.USER.ZS", monetary: false, higherIsBetter: true },
  { key: "electricity", labelKey: "relocate.crit.electricity", code: "EG.ELC.ACCS.ZS", monetary: false, higherIsBetter: true },
  { key: "water", labelKey: "relocate.crit.water", code: "SH.H2O.BASW.ZS", monetary: false, higherIsBetter: true },
  { key: "urban", labelKey: "relocate.crit.urbanization", code: "SP.URB.TOTL.IN.ZS", monetary: false, higherIsBetter: true },
  { key: "literacy", labelKey: "relocate.crit.literacy", code: "SE.ADT.LITR.ZS", monetary: false, higherIsBetter: true },
  { key: "co2", labelKey: "relocate.crit.co2", code: "EN.GHG.CO2.PC.CE.AR5", monetary: false, higherIsBetter: false },
];
const CRIT_BY_KEY = Object.fromEntries(CRITERIA.map((c) => [c.key, c]));

// Selected on first load — the original broad index, so existing behavior is recognizable.
const DEFAULT_SELECTED = ["income", "healthcare", "urban", "internet", "longevity"];

// 3-level priority → weight in the weighted average. "Not important" (0) drops the
// criterion from the score; the others give Very important twice the pull of Important.
const PRIORITY_LEVELS = [
  { value: 0, labelKey: "relocate.priority.not" },
  { value: 1, labelKey: "relocate.priority.important" },
  { value: 2, labelKey: "relocate.priority.very" },
];
const DEFAULT_PRIORITY = 1; // new selections start at "Important"
const TOP_N = 15;

// Recency windows, in years back from the freshest possible data year (END_YEAR,
// dynamic). mrnev returns values from different years per country; this lets the
// user require recent data instead of silently mixing stale and fresh figures.
const RECENCY_OPTIONS = [
  { key: "3", years: 3 },
  { key: "5", years: 5 },
  { key: "10", years: 10 },
  { key: "all", years: null },
];
const DEFAULT_RECENCY = "5";

// Oldest data year a window still admits (inclusive); null = no limit ("All time").
function recencyCutoff(key) {
  const opt = RECENCY_OPTIONS.find((o) => o.key === key);
  if (!opt || opt.years == null) return null;
  return END_YEAR - opt.years + 1;
}

export default function Relocate({ countries, active = false, initialParams = null }) {
  // Initial settings come from the URL when Relocate was the active tab on load
  // (criteria/priorities, region, recency — all validated; defaults otherwise).
  // The region is reconciled against the live list once it loads (see below).
  const urlInit = useMemo(
    () =>
      decodeRelocate(initialParams, {
        critKeys: CRITERIA.map((c) => c.key),
        recencyKeys: RECENCY_OPTIONS.map((o) => o.key),
        regions: [], // live region list isn't ready at first mount; reconciled later
        defaults: { selected: DEFAULT_SELECTED, priority: DEFAULT_PRIORITY, recency: DEFAULT_RECENCY },
      }),
    [initialParams]
  );

  const [selected, setSelected] = useState(() => new Set(urlInit.selected));
  const [weights, setWeights] = useState(() => ({ ...urlInit.weights }));
  const [cache, setCache] = useState({}); // key -> raw WB rows (loaded once per indicator)
  const [region, setRegion] = useState(urlInit.region); // "all" or a WB region.value
  const [recency, setRecency] = useState(urlInit.recency); // RECENCY_OPTIONS key
  const reconciledRef = useRef(false);
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

  // Once regions load, drop a URL-supplied region that isn't a real one. Runs once.
  useEffect(() => {
    if (reconciledRef.current || countries.length === 0) return;
    reconciledRef.current = true;
    setRegion((r) => (r === "all" || regions.includes(r) ? r : "all"));
  }, [countries, regions]);

  // While this is the active tab, mirror region/recency/criteria+priorities to the URL.
  useEffect(() => {
    if (active) writeUrl("relocate", encodeRelocate({ region, recency, selectedKeys: [...selected], weights }));
  }, [active, region, recency, selected, weights]);

  // Load latest values (mrnev=1) for any selected-but-uncached indicator.
  useEffect(() => {
    const missing = [...selected].filter((k) => !cache[k]);
    if (missing.length === 0) return;

    let alive = true;
    setLoading(true);
    setError(null);
    Promise.all(missing.map((k) => fetchLatestAll(CRIT_BY_KEY[k].code).then((rows) => [k, rows])))
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

    // Per region: collect each country's value and the YEAR it comes from (mrnev's
    // date). A country's "data year" is the OLDEST year across its selected criteria
    // — worst-case freshness.
    const valueMaps = {};
    const dataYear = new Map(); // code -> oldest selected-criterion year
    for (const k of activeKeys) {
      const m = new Map();
      for (const r of cache[k]) {
        if (r.value == null || !regionCodes.has(r.countryiso3code)) continue;
        m.set(r.countryiso3code, r.value);
        const year = Number(r.date);
        if (Number.isFinite(year)) {
          const prev = dataYear.get(r.countryiso3code);
          if (prev == null || year < prev) dataYear.set(r.countryiso3code, year);
        }
      }
      valueMaps[k] = m;
    }

    // Recency filter: drop countries whose data year is older than the cutoff BEFORE
    // normalizing, so p5/p95 recompute over countries passing BOTH region & recency.
    const cutoff = recencyCutoff(recency);
    if (cutoff != null) {
      for (const k of activeKeys) {
        const m = valueMaps[k];
        for (const code of [...m.keys()]) {
          const y = dataYear.get(code);
          if (y == null || y < cutoff) m.delete(code);
        }
      }
    }

    const activeIndicators = activeKeys.map((k) => CRIT_BY_KEY[k]);
    const result = computeRanking(activeIndicators, weights, valueMaps);
    return result.map((row) => ({ ...row, year: dataYear.get(row.code) ?? null }));
  }, [selected, weights, cache, regionCodes, recency, countries.length]);

  const recencyYears = RECENCY_OPTIONS.find((o) => o.key === recency)?.years ?? null;
  const recencyCaption =
    recencyYears == null
      ? t("relocate.recencyCaptionAll")
      : t("relocate.recencyCaption", { n: recencyYears });
  // Criteria actually pulling on the score (selected AND above "Not important").
  const activeCount = [...selected].filter((k) => (weights[k] ?? 0) > 0).length;
  const someWeight = activeCount > 0;

  const toggle = (key) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
    // First time a criterion is turned on, give it the default priority.
    setWeights((prev) => (key in prev ? prev : { ...prev, [key]: DEFAULT_PRIORITY }));
  };

  const setWeight = (key, value) => setWeights((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-6">
      {/* Region + recency filters. */}
      <section className="rounded-xl border border-slate-200 bg-surface p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row">
          <label className="flex flex-1 items-center gap-3">
            <span className="text-sm font-medium text-slate-500">{t("relocate.region")}</span>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="ml-auto min-w-0 max-w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <option value="all">{t("relocate.allRegions")}</option>
              {regions.map((r) => (
                <option key={r} value={r}>
                  {regionLabel(r)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-1 items-center gap-3">
            <span className="text-sm font-medium text-slate-500">{t("relocate.recency")}</span>
            <select
              value={recency}
              onChange={(e) => setRecency(e.target.value)}
              className="ml-auto min-w-0 max-w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {RECENCY_OPTIONS.map((o) => (
                <option key={o.key} value={o.key}>
                  {t(`relocate.recencyOption.${o.key}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="mt-3 text-xs text-slate-500">{recencyCaption}</p>
      </section>

      {/* Criteria chips */}
      <section className="rounded-xl border border-slate-200 bg-surface p-5 shadow-sm">
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
                    : "border-slate-200 bg-surface text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                {t(c.labelKey)}
              </button>
            );
          })}
        </div>

        {/* Per-criterion priority: a compact 3-level segmented control instead of a
            slider — scales to 13 criteria and drops the false precision of 0–100. */}
        {selected.size > 0 && (
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {CRITERIA.filter((c) => selected.has(c.key)).map((c) => {
              const level = weights[c.key] ?? DEFAULT_PRIORITY;
              return (
                <div key={c.key}>
                  <span className="text-sm text-slate-600">{t(c.labelKey)}</span>
                  <div
                    role="group"
                    aria-label={`${t(c.labelKey)} ${t("relocate.priority")}`}
                    className="mt-1 flex overflow-hidden rounded-md border border-slate-200"
                  >
                    {PRIORITY_LEVELS.map((p) => {
                      const on = level === p.value;
                      return (
                        <button
                          key={p.value}
                          type="button"
                          onClick={() => setWeight(c.key, p.value)}
                          aria-pressed={on}
                          className={`flex-1 border-l border-slate-200 px-2 py-1 text-xs font-medium transition-colors first:border-l-0 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent ${
                            on ? "bg-accent text-white" : "bg-surface text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          {t(p.labelKey)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Ranking */}
      <section className="rounded-xl border border-slate-200 bg-surface p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">{t("relocate.ranking")}</h2>

        {/* Non-blocking nudge: one criterion can be misleading (e.g. low formal
            unemployment in a country with no formal labor market). Still rank. */}
        {Array.isArray(ranking) && ranking.length > 0 && activeCount < 2 && (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
            {t("relocate.fewCriteriaHint")}
          </p>
        )}

        {error ? (
          <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
            {t("state.error")} {error}
          </p>
        ) : ranking === null ? (
          <p className="mt-4 text-sm text-slate-500">{t("relocate.selectHint")}</p>
        ) : ranking === undefined || loading ? (
          <p className="mt-4 text-sm text-slate-500">{t("state.loading")}</p>
        ) : ranking.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            {someWeight ? t("relocate.noMatch") : t("relocate.zeroWeightHint")}
          </p>
        ) : (
          <ol className="mt-4 space-y-3">
            {ranking.slice(0, TOP_N).map((row, i) => {
              const country = byId.get(row.code);
              return (
                <li key={row.code} className="flex items-center gap-3">
                  <span className="num w-6 shrink-0 text-right text-sm text-slate-500">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="flex min-w-0 items-baseline gap-2">
                        <span className="truncate text-sm text-slate-900">
                          {country ? countryLabel(country) : row.code}
                        </span>
                        {row.year != null && (
                          <span className="num shrink-0 text-xs text-slate-400">{row.year}</span>
                        )}
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
