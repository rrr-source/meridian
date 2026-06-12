// World Bank Open Data — no key, CORS open, fetched straight from the browser.
// https://api.worldbank.org/v2
const BASE = "https://api.worldbank.org/v2";

// Every WB response is an array [meta, data], or [{message:[...]}] on error.
// The records live in the SECOND element; this helper parses that shape.
async function wbFetch(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`World Bank API error: ${res.status}`);

  const json = await res.json();
  if (!Array.isArray(json)) throw new Error("Unexpected World Bank response shape");

  const [meta, data] = json;
  // Error envelope: [{ message: [{ value, key }] }]
  if (meta && Array.isArray(meta.message)) {
    throw new Error(meta.message[0]?.value ?? "World Bank API error");
  }
  return data ?? [];
}

// Country list, real countries only (drops aggregates like "World", "Euro area").
// Returns { id: ISO-3, name, region }.
export async function fetchCountries() {
  const rows = await wbFetch("/country?format=json&per_page=400");
  return rows
    .filter((c) => c.region?.value !== "Aggregates")
    .map((c) => ({ id: c.id, name: c.name, region: c.region?.value }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Time series for one or more countries (ISO-3 codes) and one indicator.
// Multiple countries go in a single request, separated by ";".
export async function fetchSeries(codes, indicatorCode, start = "", end = "") {
  const list = Array.isArray(codes) ? codes.join(";") : codes;
  const date = start && end ? `&date=${start}:${end}` : "";
  return wbFetch(`/country/${list}/indicator/${indicatorCode}?format=json${date}&per_page=700`);
}

// Most recent non-empty value for an indicator across ALL countries (mrnev=1).
export async function fetchLatestAll(indicatorCode) {
  return wbFetch(`/country/all/indicator/${indicatorCode}?format=json&mrnev=1&per_page=400`);
}
