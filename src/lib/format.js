// Number formatters — en-US, compact K/M/B notation for the "instrument panel" readouts.
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const decimal1 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

const isMissing = (v) => v == null || Number.isNaN(v);

// Bare compact number, e.g. 1.3M. Em dash for missing values.
export function formatCompact(value) {
  if (isMissing(value)) return "—";
  return compact.format(value);
}

// Unit-aware formatting for the big readouts, axes and tooltips.
//   "$"   → $1.3M     "%"   → 84.2%
//   "ppl" → 331M      "yrs" → 78.9 yrs
export function formatValue(value, unit) {
  if (isMissing(value)) return "—";
  switch (unit) {
    case "$":
      return `$${compact.format(value)}`;
    case "%":
      return `${decimal1.format(value)}%`;
    case "yrs":
      return `${decimal1.format(value)} yrs`;
    case "ppl":
    default:
      return compact.format(value);
  }
}

// Short axis-tick form (no unit-2: yrs suffix to keep ticks tight).
export function formatAxis(value, unit) {
  if (isMissing(value)) return "";
  if (unit === "$") return `$${compact.format(value)}`;
  if (unit === "%") return `${compact.format(value)}%`;
  return compact.format(value);
}
