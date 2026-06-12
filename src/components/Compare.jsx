import { useEffect, useMemo, useRef, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";
import { Plus, X, Search } from "lucide-react";
import { t } from "../lib/i18n";
import { countryLabel } from "../lib/countries";
import { fetchSeries } from "../lib/api";
import { INDICATORS, INDICATOR_LIST, DEFAULT_COMPARE, START_YEAR, END_YEAR, SERIES_A, SERIES_B } from "../lib/constants";
import { describeIndicator, searchIndicators } from "../lib/indicators";
import { formatValue, formatAxis } from "../lib/format";
import { useReducedMotion } from "../lib/useReducedMotion";

const DEFAULT_A = "USA";
const DEFAULT_B = "CHN";
const SEARCH_DEBOUNCE_MS = 400;

// Fold WB rows for two countries into recharts data: [{ year, A, B }, ...].
function mergeSeries(rows, codeA, codeB) {
  const byYear = new Map();
  for (const r of rows ?? []) {
    const year = Number(r.date);
    if (!Number.isFinite(year)) continue;
    if (!byYear.has(year)) byYear.set(year, { year });
    const slot = byYear.get(year);
    if (r.countryiso3code === codeA) slot.A = r.value;
    else if (r.countryiso3code === codeB) slot.B = r.value;
  }
  return [...byYear.values()].sort((a, b) => a.year - b.year);
}

// Most recent non-null point for a series key ("A" | "B").
function latest(data, key) {
  for (let i = data.length - 1; i >= 0; i--) {
    if (data[i][key] != null) return { year: data[i].year, value: data[i][key] };
  }
  return null;
}

// Stable per-chart id, independent of the chosen indicator (so React keys survive
// indicator swaps and we can have a chart with no selection mid-edit).
let nextChartId = 0;
const makeChart = (indicator) => ({ id: ++nextChartId, indicator });

export default function Compare({ countries }) {
  const [codeA, setCodeA] = useState(DEFAULT_A);
  const [codeB, setCodeB] = useState(DEFAULT_B);
  const [charts, setCharts] = useState(() => DEFAULT_COMPARE.map((key) => makeChart(describeIndicator(INDICATORS[key].code))));

  // Series cache keyed by `${codeA}|${codeB}|${indicatorCode}` — survives chart
  // add/remove/reorder, and changing a country naturally invalidates every key.
  const [seriesByKey, setSeriesByKey] = useState({});
  const [error, setError] = useState(null);

  // id → country, for labels in dropdowns, readouts and chart lines.
  const byId = useMemo(() => {
    const m = new Map();
    for (const c of countries) m.set(c.id, c);
    return m;
  }, [countries]);

  const labelFor = (code) => {
    const c = byId.get(code);
    return c ? countryLabel(c) : code;
  };

  const keyFor = (code) => `${codeA}|${codeB}|${code}`;
  const activeCodes = useMemo(() => charts.map((c) => c.indicator.code), [charts]);

  // Fetch any active indicator not yet cached for the current country pair.
  useEffect(() => {
    const missing = [...new Set(activeCodes)].filter((code) => !(keyFor(code) in seriesByKey));
    if (missing.length === 0) return;

    let alive = true;
    setError(null);
    Promise.all(
      missing.map((code) =>
        fetchSeries([codeA, codeB], code, START_YEAR, END_YEAR).then((rows) => [code, mergeSeries(rows, codeA, codeB)])
      )
    )
      .then((results) => {
        if (!alive) return;
        setSeriesByKey((prev) => {
          const next = { ...prev };
          for (const [code, data] of results) next[`${codeA}|${codeB}|${code}`] = data;
          return next;
        });
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });

    return () => {
      alive = false;
    };
  }, [activeCodes, seriesByKey, codeA, codeB]);

  // Codes already charted — used to disable duplicate picks across charts.
  const pickedCodes = useMemo(() => new Set(activeCodes), [activeCodes]);

  const setIndicator = (id, indicator) =>
    setCharts((prev) => prev.map((c) => (c.id === id ? { ...c, indicator } : c)));

  const removeChart = (id) => setCharts((prev) => prev.filter((c) => c.id !== id));

  // Add a chart defaulting to the first preset not already shown.
  const addChart = () => {
    const free = INDICATOR_LIST.find((i) => !pickedCodes.has(i.code));
    if (!free) return;
    setCharts((prev) => [...prev, makeChart(describeIndicator(free.code))]);
  };

  const canAdd = INDICATOR_LIST.some((i) => !pickedCodes.has(i.code));
  const labelA = labelFor(codeA);
  const labelB = labelFor(codeB);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row">
        <CountryPicker label={t("compare.countryA")} color={SERIES_A} value={codeA} onChange={setCodeA} countries={countries} />
        <CountryPicker label={t("compare.countryB")} color={SERIES_B} value={codeB} onChange={setCodeB} countries={countries} />
      </div>

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {t("state.error")} {error}
        </p>
      ) : (
        <div className="grid gap-6">
          {charts.map((chart) => (
            <IndicatorCard
              key={chart.id}
              indicator={chart.indicator}
              data={seriesByKey[keyFor(chart.indicator.code)]}
              pickedCodes={pickedCodes}
              onChange={(indicator) => setIndicator(chart.id, indicator)}
              onRemove={charts.length > 1 ? () => removeChart(chart.id) : null}
              labelA={labelA}
              labelB={labelB}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={addChart}
        disabled={!canAdd}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-600 transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <Plus size={16} aria-hidden="true" />
        {t("compare.addChart")}
      </button>
    </div>
  );
}

function CountryPicker({ label, color, value, onChange, countries }) {
  return (
    <label className="flex flex-1 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
      <span className="text-sm font-medium text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="ml-auto min-w-0 flex-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {countries.length === 0 ? (
          <option value={value}>{t("state.loading")}</option>
        ) : (
          countries.map((c) => (
            <option key={c.id} value={c.id}>
              {countryLabel(c)}
            </option>
          ))
        )}
      </select>
    </label>
  );
}

function IndicatorCard({ indicator, data, pickedCodes, onChange, onRemove, labelA, labelB }) {
  const { unit, label } = indicator;
  const reduced = useReducedMotion();
  const loading = data === undefined;
  const rows = data ?? [];
  const latestA = latest(rows, "A");
  const latestB = latest(rows, "B");
  const hasData = rows.some((d) => d.A != null || d.B != null);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
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

      <div className="mt-4 flex gap-8">
        <Readout color={SERIES_A} name={labelA} point={latestA} unit={unit} />
        <Readout color={SERIES_B} name={labelB} point={latestB} unit={unit} />
      </div>

      <div className="mt-5 h-60">
        {loading ? (
          <Centered>{t("state.loading")}</Centered>
        ) : !hasData ? (
          <Centered>{t("state.empty")}</Centered>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
              <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="year"
                tick={{ fontSize: 12, fill: "#64748b" }}
                tickLine={false}
                axisLine={{ stroke: "#e2e8f0" }}
                minTickGap={40}
              />
              <YAxis
                width={64}
                tick={{ fontSize: 12, fill: "#64748b" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatAxis(v, unit)}
              />
              <Tooltip
                labelFormatter={(y) => String(y)}
                formatter={(value, name) => [formatValue(value, unit), name]}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
              />
              <Line type="monotone" dataKey="A" name={labelA} stroke={SERIES_A} strokeWidth={2} dot={false} connectNulls isAnimationActive={!reduced} />
              <Line type="monotone" dataKey="B" name={labelB} stroke={SERIES_B} strokeWidth={2} dot={false} connectNulls isAnimationActive={!reduced} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Screen readers announce the active indicator name (the picker shows it visually). */}
      <span className="sr-only">{label}</span>
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
          className="min-w-0 flex-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-2 text-sm font-medium text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <optgroup label={t("compare.presetGroup")}>
            {INDICATOR_LIST.map((i) => (
              <option key={i.code} value={i.code} disabled={isTaken(i.code)}>
                {i.label}
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
            className="w-full rounded-md border border-slate-200 bg-white py-2 pl-8 pr-2 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
        </div>
      </div>

      {open && query.trim() && (
        <ul className="absolute right-0 z-10 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg sm:w-72">
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

function Readout({ color, name, point, unit }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
        <span className="truncate text-sm text-slate-500">{name}</span>
      </div>
      <div className="num mt-1 text-2xl font-semibold text-slate-900">{point ? formatValue(point.value, unit) : "—"}</div>
      {point && <div className="num text-xs text-slate-500">{point.year}</div>}
    </div>
  );
}

function Centered({ children }) {
  return <div className="flex h-full items-center justify-center text-sm text-slate-500">{children}</div>;
}
