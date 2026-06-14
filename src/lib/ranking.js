// Relocate ranking math — percentile-rank normalization.
//
// Why this shape: each country's per-criterion score is its PERCENTILE RANK within
// the filtered set (region + recency) — the share of countries it scores at or below,
// mapped to 0..100. Rank is scale-invariant, so heavy-tailed monetary series need no
// log step and a handful of outliers can't stretch the axis. Scores spread evenly
// across [0,100] instead of piling up at 100 the way winsorize+min-max did.
//
// This module is pure (no React, no imports) so it can be unit-tested directly.

// Normalize one indicator's values to a 0..100 percentile rank within `valueMap`:
//   1. drop missing/NaN values
//   2. sort ascending; each country's rank = its average position (ties share a
//      position) over n-1, times 100 — lowest value → 0, highest → 100
//   3. (higherIsBetter === false) invert: rank → 100 - rank, so a LOW raw value
//      (e.g. low unemployment, low homicide rate) maps to a HIGH 0..100 score.
// valueMap: Map<code, rawValue>. Returns Map<code, score>.
export function normalizeIndicator(valueMap, higherIsBetter = true) {
  const entries = [];
  for (const [code, raw] of valueMap) {
    if (raw == null || Number.isNaN(raw)) continue;
    entries.push([code, raw]);
  }

  const norm = new Map();
  const n = entries.length;
  if (n === 0) return norm;
  if (n === 1) {
    norm.set(entries[0][0], 50); // a single country → neutral score
    return norm;
  }

  // Ascending by value; tie groups share their average index so equal raw values
  // get an identical rank (no arbitrary ordering within a tie).
  entries.sort((a, b) => a[1] - b[1]);
  for (let i = 0; i < n; ) {
    let j = i;
    while (j + 1 < n && entries[j + 1][1] === entries[i][1]) j++;
    const rank = (((i + j) / 2) / (n - 1)) * 100; // average position of the tie group
    const score = higherIsBetter ? rank : 100 - rank;
    for (let k = i; k <= j; k++) norm.set(entries[k][0], score);
    i = j + 1;
  }
  return norm;
}

// Country index = Σ(norm_i * weight_i) / Σ(weight_i), over active indicators.
// activeIndicators: [{ key, higherIsBetter }]; weights: { [key]: number }.
// In the app weights are 1 (Important) or 2 (Very important) — Very important pulls
// twice as hard — and only selected criteria are passed in (a deselected criterion
// is omitted, not weighted 0). The math stays general: a non-positive total weight
// yields [] rather than dividing by zero.
// valueMaps: { [key]: Map<code, rawValue> }.
// Only countries with data for ALL selected criteria are ranked. Sorted descending.
export function computeRanking(activeIndicators, weights, valueMaps) {
  if (activeIndicators.length === 0) return [];
  const totalWeight = activeIndicators.reduce((s, ind) => s + (weights[ind.key] ?? 0), 0);
  if (totalWeight <= 0) return [];

  const norms = activeIndicators.map((ind) => ({
    weight: weights[ind.key] ?? 0,
    norm: normalizeIndicator(valueMaps[ind.key] ?? new Map(), ind.higherIsBetter ?? true),
  }));

  // Candidates come from the first indicator; a ranked country must appear in ALL.
  const result = [];
  for (const code of norms[0].norm.keys()) {
    let sum = 0;
    let complete = true;
    for (const { weight, norm } of norms) {
      const v = norm.get(code);
      if (v == null) {
        complete = false;
        break;
      }
      sum += v * weight;
    }
    if (complete) result.push({ code, index: sum / totalWeight });
  }

  result.sort((a, b) => b.index - a.index);
  return result;
}
