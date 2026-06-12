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

// Fold WB rows for N countries into recharts data: one row per year, keyed by
// country code. [{ year, USA: 1.2, CHN: 3.4, … }, …]. Missing values stay absent
// (recharts `connectNulls` bridges the gaps). Only `codes` of interest are kept.
export function mergeSeries(rows, codes) {
  const wanted = new Set(codes);
  const byYear = new Map();
  for (const r of rows ?? []) {
    const year = Number(r.date);
    if (!Number.isFinite(year)) continue;
    if (!wanted.has(r.countryiso3code)) continue;
    if (!byYear.has(year)) byYear.set(year, { year });
    byYear.get(year)[r.countryiso3code] = r.value;
  }
  return [...byYear.values()].sort((a, b) => a.year - b.year);
}

// Most recent non-null point for a country code in merged data.
export function latestFor(data, code) {
  for (let i = data.length - 1; i >= 0; i--) {
    if (data[i][code] != null) return { year: data[i].year, value: data[i][code] };
  }
  return null;
}
