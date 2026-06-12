// Indicator resolution + search for Compare mode.
//
// The curated presets (constants.js) cover the well-known series with clean units.
// The search box lets users reach the long tail of the World Bank catalog. Since
// the WB API has no usable server-side indicator search, we fetch the curated WDI
// catalog (~1,500 indicators) ONCE, cache it, and substring-filter it client-side.
// Per-query results are memoized so repeat keystrokes are free.

import { fetchIndicatorCatalog } from "./api";
import { INDICATOR_LIST } from "./constants";

let catalogPromise = null; // de-dupes concurrent loads; retried on failure
const queryCache = new Map(); // normalized query -> descriptor[]

// Preset code -> rich descriptor (label, unit, monetary). Searched indicators that
// happen to match a preset code inherit the nicer preset metadata.
const PRESET_BY_CODE = new Map(INDICATOR_LIST.map((i) => [i.code, i]));

// Fetch (once) and cache the catalog. Concurrent callers share one request; a
// failed load clears the cache so a later search can retry.
export function loadCatalog() {
  if (!catalogPromise) {
    catalogPromise = fetchIndicatorCatalog().catch((e) => {
      catalogPromise = null;
      throw e;
    });
  }
  return catalogPromise;
}

const normalize = (s) => s.trim().toLowerCase();

// Turn a code (+ optional catalog label) into the descriptor Compare charts use.
// Preset codes get full metadata; everything else is a searched indicator with an
// unknown unit (null → compact formatting in src/lib/format.js).
export function describeIndicator(code, label) {
  const preset = PRESET_BY_CODE.get(code);
  if (preset) return { ...preset, preset: true };
  return { key: code, code, label: label ?? code, unit: null, monetary: false, preset: false };
}

// Substring search over the cached catalog. All space-separated terms must match
// the label or code. Returns up to `limit` descriptors; empty query → [].
export async function searchIndicators(query, limit = 40) {
  const q = normalize(query);
  if (!q) return [];
  if (queryCache.has(q)) return queryCache.get(q);

  const rows = await loadCatalog();
  const terms = q.split(/\s+/);

  // Collect matches with a small relevance score, then sort: earlier first-term
  // position and shorter labels (the well-known headline series) bubble up over
  // long, qualified variants.
  const scored = [];
  for (const r of rows) {
    const label = r.label.toLowerCase();
    const haystack = `${label} ${r.code.toLowerCase()}`;
    if (!terms.every((term) => haystack.includes(term))) continue;
    const pos = label.indexOf(terms[0]);
    scored.push({ r, pos: pos === -1 ? Infinity : pos, len: r.label.length });
  }
  scored.sort((a, b) => a.pos - b.pos || a.len - b.len);

  const hits = scored.slice(0, limit).map(({ r }) => describeIndicator(r.code, r.label));
  queryCache.set(q, hits);
  return hits;
}
