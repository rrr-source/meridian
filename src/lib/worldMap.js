// World map (choropleth) helpers — pure logic, no React.
//
// The basemap is the world-atlas countries-110m topojson (vendored to
// public/world-110m.json). Its geographies are keyed by ISO 3166-1 NUMERIC ids,
// while the World Bank API speaks ISO-3, so geo→WB goes through GEO_NUMERIC_TO_ISO3
// (see src/lib/geoLookup.js, generated). A handful of microstates have no polygon
// in the low-res basemap and simply never match → they render in NO_DATA_COLOR.

import { GEO_NUMERIC_TO_ISO3 } from "./geoLookup";

export const GEO_URL = `${import.meta.env.BASE_URL}world-110m.json`;

// Every WB ISO-3 code that has a polygon in the basemap — used to report how many
// data-bearing countries actually land on the map (microstates won't).
export const GEO_ISO3_SET = new Set(Object.values(GEO_NUMERIC_TO_ISO3));

// Countries with no value (or no polygon mapping) get this muted gray (slate-200).
export const NO_DATA_COLOR = "#e2e8f0";

// Sequential ramp: light teal → dark teal. The dark end is deeper than the accent
// (#0d9488) so high values read clearly; the legend uses these two as its gradient.
export const RAMP_FROM = "#d4f3ec";
export const RAMP_TO = "#0b5e57";
const FROM = { r: 0xd4, g: 0xf3, b: 0xec };
const TO = { r: 0x0b, g: 0x5e, b: 0x57 };

const clamp01 = (t) => Math.min(1, Math.max(0, t));

function lerpColor(t) {
  const r = Math.round(FROM.r + (TO.r - FROM.r) * t);
  const g = Math.round(FROM.g + (TO.g - FROM.g) * t);
  const b = Math.round(FROM.b + (TO.b - FROM.b) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

// A touch counts as a TAP (vs. a pan/drag) when the finger moved less than this many
// CSS pixels between touchstart and touchend. Used in the fullscreen map, where a
// single finger pans the canvas, to tell a country tap apart from a panning gesture.
export const TAP_MOVE_PX = 10;

// True when the finger barely moved → treat as a tap (show the country's value),
// false when it travelled past the threshold → it was a pan. `start`/`end` are
// {x, y} client points; a missing point is never a tap (can't tell → don't fire).
export function isTapGesture(start, end, threshold = TAP_MOVE_PX) {
  if (!start || !end) return false;
  return Math.hypot(end.x - start.x, end.y - start.y) <= threshold;
}

// Pan bounds (d3-zoom translateExtent) for a width×height map at the current zoom.
// d3-zoom's viewport extent is the FULL viewBox (0,0)-(width,height), but the touch
// map is drawn with preserveAspectRatio "slice", so the screen shows only a centered
// sub-window of it. With a tight [[0,0],[w,h]] extent the user can never CENTER the
// outer margin of width/(2·zoom) on each side, so the extreme corners (e.g. New
// Zealand) stay unreachable. We pad the world box by exactly that half-viewport,
// which shrinks as 1/zoom: the deeper you zoom, the more on-screen drag the same
// world padding buys, so every edge stays centerable at any zoom without letting the
// map drift off into unbounded blank space.
export function panExtent(zoom, width, height) {
  const k = Math.max(Number(zoom) || 1, 1); // never tighter than the zoom=1 box
  const px = width / (2 * k);
  const py = height / (2 * k);
  return [[-px, -py], [width + px, height + py]];
}

// The WB ISO-3 code for a geography feature, or null if the basemap id isn't mapped.
export function iso3ForGeo(geo) {
  return GEO_NUMERIC_TO_ISO3[geo.id] ?? null;
}

// Reduce mrnev rows to Map<iso3, { value, year }>, keeping only real countries
// (codes in `validCodes`) with a numeric value. mrnev returns one row per country.
export function buildValueMap(rows, validCodes) {
  const m = new Map();
  for (const r of rows ?? []) {
    const code = r.countryiso3code;
    if (r.value == null || Number.isNaN(r.value) || !validCodes.has(code)) continue;
    const year = Number(r.date);
    m.set(code, { value: r.value, year: Number.isFinite(year) ? year : null });
  }
  return m;
}

// Build a color scale over the value map. Monetary series are heavy-tailed across
// countries, so we position color on a LOG axis (when all values are positive) to
// keep the ramp readable; everything else is linear. Returns { colorFor, min, max }.
export function makeColorScale(valueMap, monetary) {
  const values = [...valueMap.values()].map((d) => d.value);
  if (values.length === 0) return { colorFor: () => NO_DATA_COLOR, min: null, max: null };

  const min = Math.min(...values);
  const max = Math.max(...values);
  const useLog = monetary && min > 0 && max > min;
  const lo = useLog ? Math.log(min) : min;
  const hi = useLog ? Math.log(max) : max;

  const colorFor = (v) => {
    if (v == null || Number.isNaN(v)) return NO_DATA_COLOR;
    if (hi === lo) return lerpColor(0.5); // degenerate spread → mid ramp
    const pos = ((useLog ? Math.log(v) : v) - lo) / (hi - lo);
    return lerpColor(clamp01(pos));
  };
  return { colorFor, min, max };
}
