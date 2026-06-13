// Light/dark theme: persisted in localStorage, applied via <html data-theme>.
//
// An inline script in index.html sets data-theme from storage BEFORE React renders
// (no flash of the wrong theme); React then reads that as its initial state and owns
// toggling from there. Most surfaces re-theme through CSS-variable overrides
// (src/index.css) — but recharts and the SVG map set colors as element attributes,
// which can't read CSS vars, so they pull concrete hex values from the tables below.

const STORAGE_KEY = "meridian-theme";

const VALID = new Set(["light", "dark"]);
const normalize = (t) => (VALID.has(t) ? t : "light");

// The theme already on <html> (set by the index.html inline script), defaulting light.
export function getInitialTheme() {
  if (typeof document !== "undefined") {
    const t = document.documentElement.dataset.theme;
    if (VALID.has(t)) return t;
  }
  return "light";
}

// Set <html data-theme>, persist, and return the applied theme.
export function applyTheme(theme) {
  const t = normalize(theme);
  if (typeof document !== "undefined") document.documentElement.dataset.theme = t;
  try {
    localStorage.setItem(STORAGE_KEY, t);
  } catch {
    /* storage unavailable (private mode, etc.) — theme still applies for this session */
  }
  return t;
}

// Concrete colors for recharts (grid/axis/tooltip) — element attributes, not CSS vars.
export const CHART_COLORS = {
  light: { grid: "#e2e8f0", axis: "#64748b", tooltipBg: "#ffffff", tooltipBorder: "#e2e8f0", tooltipText: "#0f172a" },
  dark: { grid: "#1e293b", axis: "#94a3b8", tooltipBg: "#0f172a", tooltipBorder: "#334155", tooltipText: "#f1f5f9" },
};

// Concrete colors for the SVG choropleth: no-data country fill + country borders.
export const MAP_COLORS = {
  light: { noData: "#e2e8f0", border: "#ffffff" },
  dark: { noData: "#334155", border: "#0f172a" },
};
