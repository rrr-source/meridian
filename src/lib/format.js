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
//   "$"   → $1.3M          "%"          → 84.2%
//   "ppl" → 331M           "yrs"        → 78.9 yrs
//   ""/null → 1.3M         "per 1,000"  → 23.3 per 1,000   "t" → 4.5 t
// A null/empty unit is how searched (arbitrary) indicators arrive — they have no
// known unit, so we fall back to smart compact (K/M/B) formatting.
export function formatValue(value, unit) {
  if (isMissing(value)) return "—";
  if (unit === "$") return `$${compact.format(value)}`;
  if (unit === "%") return `${decimal1.format(value)}%`;
  if (!unit || unit === "ppl") return compact.format(value);
  // Any other known unit (yrs, per 1,000, per 100, t…): small magnitudes read
  // better as plain decimals; large ones still get compact notation. Suffix the unit.
  const num = Math.abs(value) >= 10000 ? compact.format(value) : decimal1.format(value);
  return `${num} ${unit}`;
}

// Short axis-tick form (no unit-2: yrs suffix to keep ticks tight).
export function formatAxis(value, unit) {
  if (isMissing(value)) return "";
  if (unit === "$") return `$${compact.format(value)}`;
  if (unit === "%") return `${compact.format(value)}%`;
  return compact.format(value);
}
