import { useEffect, useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";
import { t } from "../lib/i18n";
import { countryLabel } from "../lib/countries";
import { fetchSeries } from "../lib/api";
import { INDICATORS, START_YEAR, END_YEAR, SERIES_A, SERIES_B } from "../lib/constants";
import { formatValue, formatAxis } from "../lib/format";
import { useReducedMotion } from "../lib/useReducedMotion";

// The three indicators shown side by side in Compare.
const SHOWN = ["gdppc", "pop", "internet"];
const DEFAULT_A = "USA";
const DEFAULT_B = "CHN";

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

export default function Compare({ countries }) {
  const [codeA, setCodeA] = useState(DEFAULT_A);
  const [codeB, setCodeB] = useState(DEFAULT_B);
  const [series, setSeries] = useState(null); // { gdppc: [...], pop: [...], internet: [...] }
  const [loading, setLoading] = useState(true);
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

  // Load the three indicators (one request each, both countries per request)
  // whenever either selection changes.
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    Promise.all(SHOWN.map((key) => fetchSeries([codeA, codeB], INDICATORS[key].code, START_YEAR, END_YEAR)))
      .then((results) => {
        if (!alive) return;
        const next = {};
        SHOWN.forEach((key, i) => {
          next[key] = mergeSeries(results[i], codeA, codeB);
        });
        setSeries(next);
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
  }, [codeA, codeB]);

  const labelA = labelFor(codeA);
  const labelB = labelFor(codeB);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row">
        <CountryPicker
          label={t("compare.countryA")}
          color={SERIES_A}
          value={codeA}
          onChange={setCodeA}
          countries={countries}
        />
        <CountryPicker
          label={t("compare.countryB")}
          color={SERIES_B}
          value={codeB}
          onChange={setCodeB}
          countries={countries}
        />
      </div>

      {error ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {t("state.error")} {error}
        </p>
      ) : (
        <div className="grid gap-6">
          {SHOWN.map((key) => (
            <IndicatorCard
              key={key}
              indicator={INDICATORS[key]}
              data={series?.[key] ?? []}
              loading={loading}
              labelA={labelA}
              labelB={labelB}
            />
          ))}
        </div>
      )}
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

function IndicatorCard({ indicator, data, loading, labelA, labelB }) {
  const { unit } = indicator;
  const reduced = useReducedMotion();
  const latestA = latest(data, "A");
  const latestB = latest(data, "B");
  const hasData = data.some((d) => d.A != null || d.B != null);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">{indicator.label}</h2>

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
            <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
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
    </section>
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
