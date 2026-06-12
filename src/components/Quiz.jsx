import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";
import { Trophy } from "lucide-react";
import { t } from "../lib/i18n";
import { countryLabel } from "../lib/countries";
import { fetchSeries } from "../lib/api";
import { INDICATORS, QUIZ_POOL, START_YEAR, END_YEAR, INK } from "../lib/constants";
import { formatValue, formatAxis } from "../lib/format";
import { useReducedMotion } from "../lib/useReducedMotion";

const GDPPC = INDICATORS.gdppc;
const N_OPTIONS = 4;

// Fisher–Yates shuffle (non-mutating).
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Build one round: a random answer + 3 unique distractors, all shuffled.
function makeRound() {
  const answer = pickOne(QUIZ_POOL);
  const distractors = shuffle(QUIZ_POOL.filter((c) => c !== answer)).slice(0, N_OPTIONS - 1);
  return { answer, options: shuffle([answer, ...distractors]) };
}

export default function Quiz({ countries }) {
  const [round, setRound] = useState(null); // { answer, options, data, loading, error }
  const [selected, setSelected] = useState(null); // chosen option code
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const reqId = useRef(0);
  const reduced = useReducedMotion();

  const byId = useMemo(() => new Map(countries.map((c) => [c.id, c])), [countries]);
  const nameOf = (code) => {
    const c = byId.get(code);
    return c ? countryLabel(c) : code;
  };

  const startRound = useCallback(() => {
    const { answer, options } = makeRound();
    const token = ++reqId.current;
    setSelected(null);
    setRound({ answer, options, data: null, loading: true, error: null });

    fetchSeries(answer, GDPPC.code, START_YEAR, END_YEAR)
      .then((rows) => {
        if (token !== reqId.current) return; // a newer round superseded this fetch
        const data = (rows ?? [])
          .map((r) => ({ year: Number(r.date), value: r.value }))
          .filter((d) => Number.isFinite(d.year))
          .sort((a, b) => a.year - b.year);
        setRound((r) => ({ ...r, data, loading: false }));
      })
      .catch((e) => {
        if (token !== reqId.current) return;
        setRound((r) => ({ ...r, error: e.message, loading: false }));
      });
  }, []);

  useEffect(() => {
    startRound();
  }, [startRound]);

  const onSelect = (code) => {
    if (selected != null || !round) return; // already answered
    setSelected(code);
    setScore((s) => ({ correct: s.correct + (code === round.answer ? 1 : 0), total: s.total + 1 }));
  };

  const answered = selected != null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">{t("quiz.prompt")}</h2>
        <span className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
          <Trophy className="h-4 w-4 text-accent" aria-hidden="true" />
          <span className="num text-sm font-semibold text-slate-900" aria-label={t("quiz.score")}>
            {score.correct} / {score.total}
          </span>
        </span>
      </div>

      {/* The mystery curve — one line, no country label. */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-slate-500">{t("quiz.axisLabel")}</p>
        <div className="mt-2 h-72">
          {!round || round.loading ? (
            <Centered>{t("state.loading")}</Centered>
          ) : round.error ? (
            <Centered>{t("state.error")}</Centered>
          ) : !round.data?.some((d) => d.value != null) ? (
            <Centered>{t("state.empty")}</Centered>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={round.data} margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
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
                  tickFormatter={(v) => formatAxis(v, GDPPC.unit)}
                />
                <Tooltip
                  labelFormatter={(y) => String(y)}
                  formatter={(value) => [formatValue(value, GDPPC.unit), t("quiz.axisLabel")]}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
                />
                <Line type="monotone" dataKey="value" stroke={INK} strokeWidth={2} dot={false} connectNulls isAnimationActive={!reduced} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* Four options */}
      <div className="grid gap-3 sm:grid-cols-2">
        {round?.options.map((code) => {
          const isAnswer = code === round.answer;
          const isPicked = code === selected;
          let style = "border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50";
          if (answered) {
            if (isAnswer) style = "border-emerald-500 bg-emerald-50 text-emerald-800";
            else if (isPicked) style = "border-rose-500 bg-rose-50 text-rose-800";
            else style = "border-slate-200 bg-white text-slate-400";
          }
          return (
            <button
              key={code}
              type="button"
              onClick={() => onSelect(code)}
              disabled={answered}
              className={`rounded-xl border px-4 py-3 text-left text-sm font-medium shadow-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default ${style}`}
            >
              {nameOf(code)}
            </button>
          );
        })}
      </div>

      {answered && (
        <div>
          <button
            type="button"
            onClick={startRound}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {t("quiz.next")}
          </button>
        </div>
      )}
    </div>
  );
}

function Centered({ children }) {
  return <div className="flex h-full items-center justify-center text-sm text-slate-500">{children}</div>;
}
