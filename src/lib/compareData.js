// Compare's shared country set + multi-country series merge. Pure (no React) so it
// can be unit-tested directly.
//
// Each selected country holds a `slot` = its index into SERIES_PALETTE. Slots are
// assigned on add (lowest free slot) and kept until that country is removed, so a
// country's color is stable across every chart and chip — and removing one from the
// middle never recolors the others. A freed slot is reused by the next country added.

import { SERIES_PALETTE, MAX_COUNTRIES } from "./constants";

// Color for a palette slot (wraps defensively, though slots stay within range).
export function colorForSlot(slot) {
  return SERIES_PALETTE[slot % SERIES_PALETTE.length];
}

// Add a country (ISO-3 code). No-op if already present or the set is full (max 5).
// Returns a new array: [{ code, slot }, ...].
export function addCountry(set, code) {
  if (set.length >= MAX_COUNTRIES) return set;
  if (set.some((e) => e.code === code)) return set;
  const used = new Set(set.map((e) => e.slot));
  let slot = 0;
  while (used.has(slot)) slot++;
  return [...set, { code, slot }];
}

// Remove a country. No-op if it would drop below the minimum of 1.
export function removeCountry(set, code) {
  if (set.length <= 1) return set;
  return set.filter((e) => e.code !== code);
}

// Build the initial set from a list of codes (assigns slots 0,1,2,…).
export function initCountrySet(codes) {
  return codes.reduce((set, code) => addCountry(set, code), []);
}

// Series are cached per (indicator, country) PAIR — independent of the country set
// composition. That is what makes removing a country free: the remaining pairs are
// already cached, so charts redraw from cache with no network request; and adding a
// country only fetches that one country's pair, not the whole set.
export function pairKey(indicatorCode, countryCode) {
  return `${indicatorCode}|${countryCode}`;
}

// Normalize the rows for ONE country out of a (possibly multi-country) WB response
// into a sorted [{ year, value }] list.
export function normalizeSeriesFor(rows, code) {
  const out = [];
  for (const r of rows ?? []) {
    if (r.countryiso3code !== code) continue;
    const year = Number(r.date);
    if (!Number.isFinite(year)) continue;
    out.push({ year, value: r.value });
  }
  out.sort((a, b) => a.year - b.year);
  return out;
}

// Merge the cached per-country series for the current set into recharts rows:
// [{ year, USA: 1.2, CHN: 3.4, … }, …]. `cache` maps pairKey → [{ year, value }].
// Countries with no cached data yet are simply absent (their line appears once it
// loads); `connectNulls` bridges gaps within a series.
export function buildRows(countrySet, cache, indicatorCode) {
  const byYear = new Map();
  for (const entry of countrySet) {
    const points = cache[pairKey(indicatorCode, entry.code)];
    if (!points) continue;
    for (const { year, value } of points) {
      if (value == null) continue;
      if (!byYear.has(year)) byYear.set(year, { year });
      byYear.get(year)[entry.code] = value;
    }
  }
  return [...byYear.values()].sort((a, b) => a.year - b.year);
}

// Most recent non-null point for a country code in merged recharts rows.
export function latestFor(data, code) {
  for (let i = data.length - 1; i >= 0; i--) {
    if (data[i][code] != null) return { year: data[i].year, value: data[i][code] };
  }
  return null;
}
