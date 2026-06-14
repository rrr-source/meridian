import { useEffect, useMemo, useRef, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";
import { Plus, X, Search } from "lucide-react";
import { t } from "../lib/i18n";
import { countryLabel } from "../lib/countries";
import { fetchSeries } from "../lib/api";
import { INDICATOR_LIST, DEFAULT_COUNTRIES, MAX_COUNTRIES, START_YEAR, END_YEAR } from "../lib/constants";
import { addCountry, removeCountry, initCountrySet, colorForSlot, pairKey, normalizeSeriesFor, buildRows, latestFor, logYDomain } from "../lib/compareData";
import { describeIndicator, searchIndicators, indicatorLabel } from "../lib/indicators";
import { decodeCompare, encodeCompare, writeUrl } from "../lib/urlState";
import { CHART_COLORS } from "../lib/theme";
import { formatValue, formatAxis } from "../lib/format";
import { useReducedMotion } from "../lib/useReducedMotion";

const SEARCH_DEBOUNCE_MS = 400;

// Stable per-chart id, independent of the chosen indicator (so React keys survive
// indicator swaps and we can have a chart with no selection mid-edit). `scale` is the
// per-chart y-axis mode: "linear" (default) or "log".
let nextChartId = 0;
const makeChart = (indicator, scale = "linear") => ({ id: ++nextChartId, indicator, scale });

export default function Compare({ countries, active = false, initialParams = null, theme = "light" }) {
  const chartColors = CHART_COLORS[theme] ?? CHART_COLORS.light;
  // Initial country set + charts come from the URL when Compare was the active tab
  // on load (validated; defaults otherwise). decodeCompare never throws on bad input.
  const urlInit = useMemo(() => decodeCompare(initialParams), [initialParams]);

  // Shared country set — { code, slot }[] — applies to every chart. Slots give each
  // country a stable palette color across charts and chips (see compareData.js).
  const [countrySet, setCountrySet] = useState(() => initCountrySet(urlInit.codes));
  const [charts, setCharts] = useState(() => {
    const logSet = new Set(urlInit.logCodes);
    return urlInit.charts.map((code) => makeChart(describeIndicator(code), logSet.has(code) ? "log" : "linear"));
  });
  const reconciledRef = useRef(false);

  // Series cache, keyed per (indicator, country) PAIR — see compareData.js. Keeping
  // it per-pair (not per whole-set) means removing a country needs no fetch at all,
  // and adding one fetches only the new country.
  const [cache, setCache] = useState({}); // pairKey -> [{ year, value }]
  const [failed, setFailed] = useState({}); // pairKey -> true (errored; render partial)

  const byId = useMemo(() => {
    const m = new Map();
    for (const c of countries) m.set(c.id, c);
    return m;
  }, [countries]);

  const labelFor = (code) => {
    const c = byId.get(code);
    return c ? countryLabel(c) : code;
  };

  const codes = useMemo(() => countrySet.map((e) => e.code), [countrySet]);
  const activeIndicatorCodes = useMemo(() => charts.map((c) => c.indicator.code), [charts]);
  const logCodes = useMemo(() => charts.filter((c) => c.scale === "log").map((c) => c.indicator.code), [charts]);

  // Once the country list loads, drop any URL-supplied code that isn't a real
  // country (ISO-3 shape passed at mount, but the live list is the source of truth).
  // Runs once; no user edits can happen before the list — the add UI needs it.
  useEffect(() => {
    if (reconciledRef.current || countries.length === 0) return;
    reconciledRef.current = true;
    setCountrySet((set) => {
      const valid = new Set(countries.map((c) => c.id));
      const pruned = set.filter((e) => valid.has(e.code));
      if (pruned.length === set.length) return set;
      return pruned.length ? pruned : initCountrySet(DEFAULT_COUNTRIES);
    });
  }, [countries]);

  // While this is the active tab, mirror the country set, chart order, and per-chart
  // log scales into the URL.
  useEffect(() => {
    if (active) writeUrl("compare", encodeCompare({ codes, indicatorCodes: activeIndicatorCodes, logCodes }));
  }, [active, codes, activeIndicatorCodes, logCodes]);

  // Every (indicator, country) pair currently on screen.
  const neededPairs = useMemo(() => {
    const seen = new Set();
    const pairs = [];
    for (const ic of new Set(activeIndicatorCodes)) {
      for (const e of countrySet) {
        const key = pairKey(ic, e.code);
        if (!seen.has(key)) {
          seen.add(key);
          pairs.push({ key, indicatorCode: ic, country: e.code });
        }
      }
    }
    return pairs;
  }, [activeIndicatorCodes, countrySet]);

  // Drop "failed" marks for pairs no longer on screen, so a removed-then-re-added
  // country (or indicator) gets a fresh attempt instead of staying stuck failed.
  useEffect(() => {
    const need = new Set(neededPairs.map((p) => p.key));
    setFailed((prev) => {
      let changed = false;
      const next = {};
      for (const k of Object.keys(prev)) {
        if (need.has(k)) next[k] = prev[k];
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [neededPairs]);

  // Fetch only the pairs we don't already have (and haven't failed). Removing a
  // country leaves `missing` empty → no request. Adding one fetches just that pair.
  //
  // Race safety: each run owns an AbortController; the cleanup aborts it, so a
  // request from a superseded run can never write stale data. Results are recorded
  // with `allSettled`, so one failed indicator can't reject the others, and EVERY
  // requested pair ends up either cached or marked failed — loading is derived from
  // that state, so it can never get stuck "true".
  useEffect(() => {
    const missing = neededPairs.filter((p) => !(p.key in cache) && !(p.key in failed));
    if (missing.length === 0) return;

    // Batch missing countries by indicator into one multi-country request each
    // (country/A;B;C/indicator/…) instead of a request-per-country in a tight loop.
    const byIndicator = new Map();
    for (const p of missing) {
      if (!byIndicator.has(p.indicatorCode)) byIndicator.set(p.indicatorCode, []);
      byIndicator.get(p.indicatorCode).push(p.country);
    }
    const groups = [...byIndicator];
    const controller = new AbortController();

    (async () => {
      const settled = await Promise.allSettled(
        groups.map(([ic, group]) => fetchSeries(group, ic, START_YEAR, END_YEAR, controller.signal))
      );
      if (controller.signal.aborted) return; // superseded run — ignore entirely

      const ok = {};
      const bad = {};
      groups.forEach(([ic, group], i) => {
        const res = settled[i];
        if (res.status === "fulfilled") {
          for (const country of group) ok[pairKey(ic, country)] = normalizeSeriesFor(res.value, country);
        } else if (res.reason?.name !== "AbortError") {
          for (const country of group) bad[pairKey(ic, country)] = true;
        }
      });

      if (Object.keys(ok).length) setCache((prev) => ({ ...prev, ...ok }));
      if (Object.keys(bad).length) setFailed((prev) => ({ ...prev, ...bad }));
    })();

    return () => controller.abort();
  }, [neededPairs, cache, failed]);

  // Per-chart view state, derived purely from cache/failed — never a stuck flag.
  const hasValues = (points) => points != null && points.some((p) => p.value != null);
  const chartState = (indicatorCode) => {
    const haveAny = countrySet.some((e) => hasValues(cache[pairKey(indicatorCode, e.code)]));
    const pending = countrySet.some((e) => {
      const k = pairKey(indicatorCode, e.code);
      return !(k in cache) && !(k in failed);
    });
    const anyFailed = countrySet.some((e) => failed[pairKey(indicatorCode, e.code)]);
    return {
      rows: buildRows(countrySet, cache, indicatorCode),
      loading: pending && !haveAny, // only block when there is nothing to show yet
      errored: !haveAny && !pending && anyFailed,
    };
  };

  // --- Country set actions ---
  const selectedCodes = useMemo(() => new Set(codes), [codes]);
  const canAddCountry = countrySet.length < MAX_COUNTRIES;
  const onAddCountry = (code) => setCountrySet((set) => addCountry(set, code));
  const onRemoveCountry = (code) => setCountrySet((set) => removeCountry(set, code));

  // --- Chart actions (unchanged behavior: pick / search / add / remove + dedupe) ---
  const pickedIndicators = useMemo(() => new Set(activeIndicatorCodes), [activeIndicatorCodes]);
  const setIndicator = (id, indicator) => setCharts((prev) => prev.map((c) => (c.id === id ? { ...c, indicator } : c)));
  const setScale = (id, scale) => setCharts((prev) => prev.map((c) => (c.id === id ? { ...c, scale } : c)));
  const removeChart = (id) => setCharts((prev) => prev.filter((c) => c.id !== id));
  const addChart = () => {
    const free = INDICATOR_LIST.find((i) => !pickedIndicators.has(i.code));
    if (!free) return;
    setCharts((prev) => [...prev, makeChart(describeIndicator(free.code))]);
  };
  const canAddChart = INDICATOR_LIST.some((i) => !pickedIndicators.has(i.code));

  return (
    <div className="space-y-6">
      <CountryBar
        countrySet={countrySet}
        countries={countries}
        selectedCodes={selectedCodes}
        canAdd={canAddCountry}
        labelFor={labelFor}
        onAdd={onAddCountry}
        onRemove={countrySet.length > 1 ? onRemoveCountry : null}
      />

      <div className="grid gap-6">
        {charts.map((chart) => {
          const { rows, loading, errored } = chartState(chart.indicator.code);
          return (
            <IndicatorCard
              key={chart.id}
              indicator={chart.indicator}
              scale={chart.scale}
              chartColors={chartColors}
              data={rows}
              loading={loading}
              errored={errored}
              countrySet={countrySet}
              labelFor={labelFor}
              pickedCodes={pickedIndicators}
              onChange={(indicator) => setIndicator(chart.id, indicator)}
              onScaleChange={(scale) => setScale(chart.id, scale)}
              onRemove={charts.length > 1 ? () => removeChart(chart.id) : null}
            />
          );
        })}
      </div>

      <button
        type="button"
        onClick={addChart}
        disabled={!canAddChart}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-surface px-4 py-3 text-sm font-medium text-slate-600 transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <Plus size={16} aria-hidden="true" />
        {t("compare.addChart")}
      </button>
    </div>
  );
}

// Shared country selector: a row of colored chips (name + remove ×) plus an
// "Add country" dropdown. Min 1, max 5, deduped.
function CountryBar({ countrySet, countries, selectedCodes, canAdd, labelFor, onAdd, onRemove }) {
  const available = useMemo(
    () => countries.filter((c) => !selectedCodes.has(c.id)),
    [countries, selectedCodes]
  );

  return (
    <section className="rounded-xl border border-slate-200 bg-surface px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-slate-500">{t("compare.countries")}</span>

        {countrySet.map((entry) => {
          const color = colorForSlot(entry.slot);
          const name = labelFor(entry.code);
          return (
            <span
              key={entry.code}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 py-1 pl-2.5 pr-1.5 text-sm"
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
              <span className="text-slate-900">{name}</span>
              {onRemove && (
                <button
                  type="button"
                  onClick={() => onRemove(entry.code)}
                  aria-label={t("compare.removeCountry", { country: name })}
                  title={t("compare.removeCountry", { country: name })}
                  className="rounded-full p-0.5 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              )}
            </span>
          );
        })}

        {canAdd && countries.length > 0 && (
          <label className="inline-flex items-center">
            <span className="sr-only">{t("compare.addCountry")}</span>
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) onAdd(e.target.value);
              }}
              aria-label={t("compare.addCountry")}
              className="min-h-11 rounded-full border border-dashed border-slate-300 bg-surface py-1.5 pl-3 pr-2 text-sm font-medium text-slate-600 hover:border-accent hover:text-accent sm:min-h-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <option value="">+ {t("compare.addCountry")}</option>
              {available.map((c) => (
                <option key={c.id} value={c.id}>
                  {countryLabel(c)}
                </option>
              ))}
            </select>
          </label>
        )}

        {!canAdd && (
          <span className="text-xs text-slate-400">{t("compare.countryLimit", { n: MAX_COUNTRIES })}</span>
        )}
      </div>
    </section>
  );
}

function IndicatorCard({ indicator, scale, chartColors, data, loading, errored, countrySet, labelFor, pickedCodes, onChange, onScaleChange, onRemove }) {
  const { unit } = indicator;
  const reduced = useReducedMotion();
  const rows = data ?? [];
  const hasData = rows.some((d) => countrySet.some((e) => d[e.code] != null));

  // Log mode: derive the axis domain from positive values only (log is undefined for
  // <= 0). If there are no positives, fall back to "auto" so the chart still renders.
  const isLog = scale === "log";
  const logDomain = isLog ? logYDomain(rows, countrySet.map((e) => e.code)) : null;

  return (
    // min-w-0: as a grid item this card must be allowed to shrink below its content
    // width, otherwise recharts' ResponsiveContainer keeps it wider than the phone
    // viewport and the chart spills past the right edge. p-4 on mobile gives the plot
    // a little more room; p-5 on desktop is unchanged.
    <section className="min-w-0 rounded-xl border border-slate-200 bg-surface p-4 shadow-sm sm:p-5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <IndicatorPicker value={indicator} pickedCodes={pickedCodes} onChange={onChange} />
        </div>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={t("compare.removeChart")}
            title={t("compare.removeChart")}
            className="shrink-0 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <X size={18} aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Per-country latest-value readouts — double as the legend; wrap on mobile. */}
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3">
        {countrySet.map((entry) => (
          <Readout
            key={entry.code}
            color={colorForSlot(entry.slot)}
            name={labelFor(entry.code)}
            point={latestFor(rows, entry.code)}
            unit={unit}
          />
        ))}
      </div>

      {/* Per-chart y-axis scale toggle. */}
      <div className="mt-4 flex justify-end">
        <ScaleToggle scale={scale} onChange={onScaleChange} />
      </div>

      <div className="mt-3 h-60">
        {loading ? (
          <Centered>{t("state.loading")}</Centered>
        ) : errored ? (
          <Centered>{t("state.error")}</Centered>
        ) : !hasData ? (
          <Centered>{t("state.empty")}</Centered>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
              <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="year"
                tick={{ fontSize: 12, fill: chartColors.axis }}
                tickLine={false}
                axisLine={{ stroke: chartColors.grid }}
                minTickGap={40}
              />
              <YAxis
                width={64}
                tick={{ fontSize: 12, fill: chartColors.axis }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatAxis(v, unit)}
                scale={isLog ? "log" : "auto"}
                domain={isLog ? logDomain ?? ["auto", "auto"] : undefined}
                allowDataOverflow={isLog || undefined}
              />
              <Tooltip
                labelFormatter={(y) => String(y)}
                formatter={(value, name) => [formatValue(value, unit), name]}
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: `1px solid ${chartColors.tooltipBorder}`,
                  backgroundColor: chartColors.tooltipBg,
                  color: chartColors.tooltipText,
                }}
                labelStyle={{ color: chartColors.tooltipText }}
                itemStyle={{ color: chartColors.tooltipText }}
              />
              {countrySet.map((entry) => (
                <Line
                  key={entry.code}
                  type="monotone"
                  dataKey={entry.code}
                  name={labelFor(entry.code)}
                  stroke={colorForSlot(entry.slot)}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                  isAnimationActive={!reduced}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Screen readers announce the active indicator name (the picker shows it visually). */}
      <span className="sr-only">{indicatorLabel(indicator)}</span>
    </section>
  );
}

// Preset dropdown + debounced live catalog search. Already-charted indicators are
// disabled (in both the dropdown and the search results) so no two charts collide.
function IndicatorPicker({ value, pickedCodes, onChange }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  // Debounced search: only hit the (cached) catalog once typing settles.
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    let alive = true;
    const handle = setTimeout(() => {
      searchIndicators(q)
        .then((rows) => {
          if (alive) {
            setResults(rows);
            setSearching(false);
          }
        })
        .catch(() => {
          if (alive) {
            setResults([]);
            setSearching(false);
          }
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      alive = false;
      clearTimeout(handle);
    };
  }, [query]);

  // Close the results panel on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const isTaken = (code) => code !== value.code && pickedCodes.has(code);

  const choose = (indicator) => {
    onChange(indicator);
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  // The <select> shows presets; if the current pick is a searched (non-preset)
  // indicator, surface it as a selected-but-non-listed "Searched: …" option.
  const selectValue = value.preset ? value.code : "__custom";

  return (
    <div ref={boxRef} className="relative">
      <span className="sr-only">{t("compare.indicator")}</span>
      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          aria-label={t("compare.indicator")}
          value={selectValue}
          onChange={(e) => choose(describeIndicator(e.target.value))}
          className="min-h-11 min-w-0 flex-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-2 text-sm font-medium text-slate-900 sm:min-h-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <optgroup label={t("compare.presetGroup")}>
            {INDICATOR_LIST.map((i) => (
              <option key={i.code} value={i.code} disabled={isTaken(i.code)}>
                {indicatorLabel(i)}
                {isTaken(i.code) ? ` — ${t("compare.picked")}` : ""}
              </option>
            ))}
          </optgroup>
          {!value.preset && (
            <option value="__custom">{t("compare.customOption", { label: value.label })}</option>
          )}
        </select>

        <div className="relative sm:w-56">
          <Search size={15} aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder={t("compare.searchPlaceholder")}
            aria-label={t("compare.searchLabel")}
            className="w-full rounded-md border border-slate-200 bg-surface py-2 pl-8 pr-2 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
        </div>
      </div>

      {open && query.trim() && (
        <ul className="absolute right-0 z-10 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-slate-200 bg-surface py-1 text-sm shadow-lg sm:w-72">
          {searching ? (
            <li className="px-3 py-2 text-slate-500">{t("compare.searching")}</li>
          ) : results.length === 0 ? (
            <li className="px-3 py-2 text-slate-500">{t("compare.noResults")}</li>
          ) : (
            results.map((r) => {
              const taken = isTaken(r.code);
              return (
                <li key={r.code}>
                  <button
                    type="button"
                    disabled={taken}
                    onClick={() => choose(r)}
                    className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent focus-visible:bg-slate-50 focus-visible:outline-none"
                  >
                    <span className="text-slate-900">
                      {r.label}
                      {taken ? ` — ${t("compare.picked")}` : ""}
                    </span>
                    <span className="num text-xs text-slate-400">{r.code}</span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}

// Compact segmented Linear/Log control for one chart's y-axis.
function ScaleToggle({ scale, onChange }) {
  return (
    <div
      role="group"
      aria-label={t("compare.yScale")}
      className="inline-flex overflow-hidden rounded-md border border-slate-200"
    >
      {[
        ["linear", t("compare.scaleLinear")],
        ["log", t("compare.scaleLog")],
      ].map(([value, labelText]) => {
        const on = scale === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => onChange(value)}
            aria-pressed={on}
            className={`border-l border-slate-200 px-2.5 py-1 text-xs font-medium transition-colors first:border-l-0 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent ${
              on ? "bg-accent text-white" : "bg-surface text-slate-600 hover:bg-slate-50"
            }`}
          >
            {labelText}
          </button>
        );
      })}
    </div>
  );
}

function Readout({ color, name, point, unit }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
        <span className="truncate text-sm text-slate-500">{name}</span>
      </div>
      <div className="num mt-0.5 text-xl font-semibold text-slate-900">{point ? formatValue(point.value, unit) : "—"}</div>
      {point && <div className="num text-xs text-slate-500">{point.year}</div>}
    </div>
  );
}

function Centered({ children }) {
  return <div className="flex h-full items-center justify-center text-sm text-slate-500">{children}</div>;
}
