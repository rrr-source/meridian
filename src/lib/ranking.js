// Relocate ranking math — robust to outliers.
//
// Why this shape: monetary indicators (GDP/capita, health spend) are heavy-tailed
// across countries, so we log them to compress the scale. Then we winsorize at the
// 5th/95th percentile to trim extreme outliers (e.g. oil micro-states) before a
// min-max stretch to 0..100 — so the ranking reflects broad quality of life, not a
// single stretched axis dominated by a handful of countries.
//
// This module is pure (no React, no imports) so it can be unit-tested directly.

// Percentile of an ascending-sorted array. p in [0,1].
// index = p*(n-1), with linear interpolation between neighbors.
export function percentile(sortedAsc, p) {
  const n = sortedAsc.length;
  if (n === 0) return NaN;
  if (n === 1) return sortedAsc[0];
  const idx = p * (n - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo];
  return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (idx - lo);
}

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

// Normalize one indicator's values to 0..100:
//   1. (monetary) replace each value with Math.log(value), skipping value <= 0
//   2. compute p5 and p95 of the (possibly logged) values
//   3. winsorize: clip every value to [p5, p95]
//   4. min-max: norm = (v - p5) / (p95 - p5) * 100, clamped to [0, 100]
//   5. (higherIsBetter === false) invert: norm → 100 - norm, so a LOW raw value
//      (e.g. low unemployment, low homicide rate) maps to a HIGH 0..100 score.
// valueMap: Map<code, rawValue>. Returns Map<code, norm>.
export function normalizeIndicator(valueMap, monetary, higherIsBetter = true) {
  const transformed = new Map(); // code -> (possibly logged) value
  for (const [code, raw] of valueMap) {
    if (raw == null || Number.isNaN(raw)) continue;
    if (monetary) {
      if (raw <= 0) continue; // log undefined for non-positive money → treat as missing
      transformed.set(code, Math.log(raw));
    } else {
      transformed.set(code, raw);
    }
  }

  const sorted = [...transformed.values()].sort((a, b) => a - b);
  const p5 = percentile(sorted, 0.05);
  const p95 = percentile(sorted, 0.95);
  const range = p95 - p5;

  const norm = new Map();
  for (const [code, v] of transformed) {
    let score;
    if (range <= 0) {
      score = 50; // degenerate spread → neutral score
    } else {
      const clipped = clamp(v, p5, p95);
      score = clamp(((clipped - p5) / range) * 100, 0, 100);
    }
    // Direction: for "lower is better" criteria, flip so low raw → high score.
    norm.set(code, higherIsBetter ? score : 100 - score);
  }
  return norm;
}

// Country index = Σ(norm_i * weight_i) / Σ(weight_i), over active indicators.
// activeIndicators: [{ key, monetary, higherIsBetter }]; weights: { [key]: number };
// valueMaps: { [key]: Map<code, rawValue> }.
// Only countries with data for ALL selected criteria are ranked. Sorted descending.
export function computeRanking(activeIndicators, weights, valueMaps) {
  if (activeIndicators.length === 0) return [];
  const totalWeight = activeIndicators.reduce((s, ind) => s + (weights[ind.key] ?? 0), 0);
  if (totalWeight <= 0) return [];

  const norms = activeIndicators.map((ind) => ({
    weight: weights[ind.key] ?? 0,
    norm: normalizeIndicator(valueMaps[ind.key] ?? new Map(), ind.monetary, ind.higherIsBetter ?? true),
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
