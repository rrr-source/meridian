// Shareable URL state — encode the ACTIVE tab and its settings as readable query
// params, so copying the address bar shares the current view and reload restores it.
//
// The URL is UNTRUSTED input. Every decoder validates and falls back to a sensible
// default; nothing here throws on malformed/unknown/missing params. No router
// dependency — plain URLSearchParams is enough.
//
// Param shapes (only the active tab's are present at any time):
//   ?tab=compare&countries=USA,CHN&charts=gdppc,pop&scales=pop
//   ?tab=relocate&region=Europe%20%26%20Central%20Asia&recency=5&criteria=income:2,safety:1
//   ?tab=map&indicator=gdppc

import { INDICATORS, INDICATOR_LIST, DEFAULT_COUNTRIES, DEFAULT_COMPARE, MAX_COUNTRIES } from "./constants";

export const VALID_TABS = ["compare", "relocate", "map"];
export const DEFAULT_TAB = "map";

const ISO3 = /^[A-Z]{3}$/;
const CODE = /^[A-Za-z0-9._-]{2,40}$/; // a plausible WB indicator code
// Two-level priority: 1 = Important, 2 = Very important. A criterion that isn't
// wanted is simply absent from the param — there is no "0"/"not important" level.
// (An old URL's `:0` token has a level outside this set, so it's dropped on decode →
// the criterion is treated as deselected. See decodeRelocate.)
const PRIORITY_LEVELS = [1, 2];

// Readable URLs use preset KEYS (gdppc) where possible; searched indicators fall
// back to their raw WB code (NY.GDP.PCAP.CD). These maps bridge the two.
const KEY_TO_CODE = new Map(INDICATOR_LIST.map((i) => [i.key, i.code]));
const CODE_TO_KEY = new Map(INDICATOR_LIST.map((i) => [i.code, i.key]));

const DEFAULT_COMPARE_CODES = DEFAULT_COMPARE.map((k) => INDICATORS[k].code);
export const DEFAULT_MAP_CODE = INDICATORS.gdppc.code;

// --- URL plumbing ---------------------------------------------------------

// Parse a search string into URLSearchParams, tolerating anything (never throws).
export function readSearchParams(search) {
  try {
    return new URLSearchParams(search ?? (typeof window !== "undefined" ? window.location.search : ""));
  } catch {
    return new URLSearchParams("");
  }
}

// The active tab named in the URL, or the default when absent/unknown.
export function readTab(search) {
  const tab = readSearchParams(search).get("tab");
  return VALID_TABS.includes(tab) ? tab : DEFAULT_TAB;
}

// REPLACE (never push) the address bar with ?tab=<tab>&<params>. replaceState keeps
// the back button clean — settings tweaks shouldn't pile up as history entries.
// Empty/nullish values are dropped so the URL stays tidy.
export function writeUrl(tab, params) {
  if (typeof window === "undefined") return;
  const sp = new URLSearchParams();
  sp.set("tab", VALID_TABS.includes(tab) ? tab : DEFAULT_TAB);
  for (const [k, v] of Object.entries(params || {})) {
    if (v != null && v !== "") sp.set(k, String(v));
  }
  const { pathname, hash } = window.location;
  window.history.replaceState(null, "", `${pathname}?${sp.toString()}${hash}`);
}

// --- indicator token (shared by Compare charts + World map) ---------------

export function encodeIndicatorCode(code) {
  return CODE_TO_KEY.get(code) ?? code;
}

// token (preset key OR raw code) -> WB code, or null if unusable.
export function decodeIndicatorCode(token) {
  const tok = (token ?? "").trim();
  if (!tok) return null;
  if (KEY_TO_CODE.has(tok)) return KEY_TO_CODE.get(tok);
  return CODE.test(tok) ? tok : null;
}

const splitList = (raw) =>
  (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

// --- Compare --------------------------------------------------------------

// `logCodes` = the indicator codes whose chart is on a LOG y-axis. They ride in a
// separate `scales` param (a list of log charts); linear is the default, so absence
// means linear and existing URLs without it keep working.
export function encodeCompare({ codes, indicatorCodes, logCodes }) {
  return {
    countries: (codes || []).join(","),
    charts: (indicatorCodes || []).map(encodeIndicatorCode).join(","),
    scales: (logCodes || []).map(encodeIndicatorCode).join(","),
  };
}

// Returns { codes: ISO-3[], charts: WB-code[], logCodes: WB-code[] }. `validCodes`
// (Set of loaded country ids) is optional: when provided, country codes are validated
// against it; otherwise only ISO-3 shape is checked (the live list isn't ready yet at
// first mount). `logCodes` is the subset of `charts` flagged log; anything in `scales`
// that isn't a current chart (or is malformed) is ignored → that chart stays linear.
export function decodeCompare(sp, validCodes) {
  let codes = splitList(sp && sp.get("countries")).map((s) => s.toUpperCase()).filter((s) => ISO3.test(s));
  if (validCodes && validCodes.size) codes = codes.filter((c) => validCodes.has(c));
  codes = [...new Set(codes)].slice(0, MAX_COUNTRIES);
  if (codes.length === 0) codes = [...DEFAULT_COUNTRIES];

  let charts = [...new Set(splitList(sp && sp.get("charts")).map(decodeIndicatorCode).filter(Boolean))];
  if (charts.length === 0) charts = [...DEFAULT_COMPARE_CODES];

  const chartSet = new Set(charts);
  const logCodes = [...new Set(splitList(sp && sp.get("scales")).map(decodeIndicatorCode).filter(Boolean))].filter((c) =>
    chartSet.has(c)
  );

  return { codes, charts, logCodes };
}

// --- Relocate -------------------------------------------------------------

// state: { region, recency, selectedKeys: string[], weights: { key: level } }
// Only SELECTED criteria are encoded, each as `key:level` with level 1 (Important)
// or 2 (Very important). A deselected criterion is simply absent.
export function encodeRelocate({ region, recency, selectedKeys, weights }) {
  return {
    region: region && region !== "all" ? region : "",
    recency,
    criteria: (selectedKeys || []).map((k) => `${k}:${(weights || {})[k] === 2 ? 2 : 1}`).join(","),
  };
}

// ctx: { critKeys: string[], recencyKeys: string[], regions: string[] (may be empty),
//        defaults: { selected: string[], priority: number, recency: string } }
// Returns { selected: string[], weights: { key: level }, recency, region }.
export function decodeRelocate(sp, ctx) {
  const critSet = new Set(ctx.critKeys);
  const selected = [];
  const weights = {};
  for (const tok of splitList(sp && sp.get("criteria"))) {
    const i = tok.indexOf(":");
    const key = (i === -1 ? tok : tok.slice(0, i)).trim();
    const level = Number(tok.slice(i + 1));
    // Drop unknown keys, dupes, and any level outside {1,2}. An old `:0` token lands
    // here too: 0 isn't a valid level, so the criterion is treated as deselected.
    if (!critSet.has(key) || !PRIORITY_LEVELS.includes(level) || key in weights) continue;
    selected.push(key);
    weights[key] = level;
  }
  let sel = selected;
  let w = weights;
  if (sel.length === 0) {
    sel = [...ctx.defaults.selected];
    w = Object.fromEntries(sel.map((k) => [k, ctx.defaults.priority]));
  }

  let recency = sp && sp.get("recency");
  if (!ctx.recencyKeys.includes(recency)) recency = ctx.defaults.recency;

  let region = (sp && sp.get("region")) || "all";
  // Validate against the loaded region list when available; "all" is always valid.
  if (region !== "all" && ctx.regions && ctx.regions.length && !ctx.regions.includes(region)) region = "all";

  return { selected: sel, weights: w, recency, region };
}

// --- World map ------------------------------------------------------------

export function encodeMap({ code }) {
  return { indicator: encodeIndicatorCode(code) };
}

export function decodeMap(sp) {
  return { code: decodeIndicatorCode(sp && sp.get("indicator")) ?? DEFAULT_MAP_CODE };
}
