import { useEffect, useMemo, useRef, useState } from "react";
import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps";
import { geoMiller } from "d3-geo-projection";
import { Search, Maximize2, Minimize2, X } from "lucide-react";
import { t } from "../lib/i18n";
import { countryLabel } from "../lib/countries";
import { fetchLatestAll } from "../lib/api";
import { INDICATORS, INDICATOR_LIST } from "../lib/constants";
import { describeIndicator, searchIndicators, indicatorLabel } from "../lib/indicators";
import { decodeMap, encodeMap, writeUrl } from "../lib/urlState";
import { MAP_COLORS } from "../lib/theme";
import { formatValue } from "../lib/format";
import { GEO_URL, GEO_ISO3_SET, RAMP_FROM, RAMP_TO, iso3ForGeo, buildValueMap, makeColorScale } from "../lib/worldMap";

const SEARCH_DEBOUNCE_MS = 400;
const DEFAULT_INDICATOR = describeIndicator(INDICATORS.gdppc.code); // GDP per capita

// Antarctica (world-atlas numeric id) — dropped from the map: no data here and it
// wastes a tall empty band at the bottom.
const ANTARCTICA_ID = "010";

// Miller cylindrical projection — straight vertical edges (no globe-wrap look).
// Pre-fitted to the remaining land AFTER dropping Antarctica. The horizontal scale is
// kept at the full-width sphere value (W / 2π ≈ 127.32), so countries keep their exact
// size and the map keeps full width; only the box gets shorter. translateY pans the
// land into the cropped box; MAP_H is its vertical extent (+8px padding top/bottom),
// derived from the vendored basemap's no-Antarctica land bounds ([[0,8],[800,399]]).
// The SVG then scales to the container width via CSS, preserving the 800×408 ratio.
const MAP_W = 800;
const MAP_H = 408; // was 587 — the freed polar/Antarctic space is removed
const projection = geoMiller()
  .scale(MAP_W / (2 * Math.PI))
  .translate([MAP_W / 2, 260.83]);

// Touch-only zoom limits. min 1× = the full world (can't zoom out past it); max 8×
// lets a phone user reach tiny countries. The default, reset view.
const MIN_ZOOM = 1;
const MAX_ZOOM = 8;
const DEFAULT_VIEW = { center: [0, 0], zoom: 1 };

// d3-zoom event filter (passed to ZoomableGroup.filterZoomEvent). It runs BEFORE
// d3-zoom calls preventDefault, so anything we reject is left entirely to the browser.
//   - Only a TWO-finger touch starts a zoom/pan gesture (event.touches.length >= 2).
//     A one-finger touch is rejected → not prevented → the page scrolls normally.
//   - Wheel and mouse drags are rejected, so there is no desktop-style wheel/drag zoom
//     even on a touch laptop; the gesture is exclusively two-finger touch.
// (d3-zoom's touchstarted reads event.touches — all active touches — so when the 2nd
// finger lands the gesture starts with BOTH points registered, i.e. a real pinch.)
function twoFingerOnly(event) {
  if (!event) return false;
  if (event.type && event.type.startsWith("touch")) {
    return !!event.touches && event.touches.length >= 2;
  }
  return false; // wheel, mousedown, dblclick, etc. → no zoom
}

// Fullscreen has no page scroll to protect (body is locked), so a single finger may
// pan and two fingers pinch. Still touch-only — wheel/mouse are rejected.
function anyTouch(event) {
  if (!event) return false;
  if (event.type && event.type.startsWith("touch")) {
    return !!event.touches && event.touches.length >= 1;
  }
  return false;
}

// Enable zoom only on touch / small screens; keep the desktop map exactly static.
// Reactive to viewport + input changes via matchMedia. Matches a coarse pointer
// (phones/tablets) OR a narrow (mobile-breakpoint) viewport.
function useTouchMode() {
  const [touch, setTouch] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(pointer: coarse), (max-width: 639px)");
    const update = () => setTouch(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);
  return touch;
}

export default function WorldMap({ countries, active = false, initialParams = null, theme = "light" }) {
  const mapColors = MAP_COLORS[theme] ?? MAP_COLORS.light;
  // Chosen indicator survives tab switches (this panel stays mounted — see App.jsx),
  // and is restored from the URL when the World map was the active tab on load.
  const [indicator, setIndicator] = useState(() =>
    initialParams ? describeIndicator(decodeMap(initialParams).code) : DEFAULT_INDICATOR
  );
  const [cache, setCache] = useState({}); // indicator code -> mrnev rows
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Touch/mobile only: pinch-zoom + pan (see MapStage). On desktop the map stays
  // static. `fullscreen` opens the map in an inset-0 overlay for a much bigger canvas.
  const touchMode = useTouchMode();
  const [fullscreen, setFullscreen] = useState(false);

  // Lock body scroll while the fullscreen overlay is open; Esc closes it. Both are
  // fully reverted on close so the page is exactly restored.
  useEffect(() => {
    if (!fullscreen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => e.key === "Escape" && setFullscreen(false);
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [fullscreen]);

  // A touch user who shrinks to desktop width shouldn't be stuck in the overlay.
  useEffect(() => {
    if (!touchMode) setFullscreen(false);
  }, [touchMode]);

  const byId = useMemo(() => new Map(countries.map((c) => [c.id, c])), [countries]);
  const validCodes = useMemo(() => new Set(countries.map((c) => c.id)), [countries]);

  // Fetch latest-per-country (mrnev=1) for the chosen indicator, once per indicator.
  useEffect(() => {
    if (cache[indicator.code]) return;
    let alive = true;
    setLoading(true);
    setError(null);
    fetchLatestAll(indicator.code)
      .then((rows) => {
        if (!alive) return;
        setCache((prev) => ({ ...prev, [indicator.code]: rows }));
        setLoading(false);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e.message);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [indicator.code]); // eslint-disable-line react-hooks/exhaustive-deps

  // While this is the active tab, mirror the chosen indicator into the URL.
  useEffect(() => {
    if (active) writeUrl("map", encodeMap({ code: indicator.code }));
  }, [active, indicator.code]);

  const rows = cache[indicator.code];
  const valueMap = useMemo(() => (rows ? buildValueMap(rows, validCodes) : new Map()), [rows, validCodes]);
  const scale = useMemo(() => makeColorScale(valueMap, indicator.monetary), [valueMap, indicator.monetary]);

  // Coverage: countries with data that actually land on a drawn polygon.
  const coverage = useMemo(() => {
    let matched = 0;
    for (const code of valueMap.keys()) if (GEO_ISO3_SET.has(code)) matched++;
    return { matched, total: valueMap.size };
  }, [valueMap]);

  // Highest / Lowest 5 by the indicator's raw value (neutral, no good/bad direction).
  // Built from the already-fetched map data — no extra request.
  const topLists = useMemo(() => {
    const arr = [...valueMap.entries()].map(([code, d]) => ({ code, value: d.value }));
    arr.sort((a, b) => b.value - a.value);
    return { highest: arr.slice(0, 5), lowest: arr.slice(-5).reverse() };
  }, [valueMap]);

  const ready = rows != null && !loading;

  return (
    <div className="space-y-6">
      {/* Indicator picker */}
      <section className="rounded-xl border border-slate-200 bg-surface p-5 shadow-sm">
        <IndicatorPicker value={indicator} onChange={setIndicator} />
      </section>

      {/* Map */}
      <section className="rounded-xl border border-slate-200 bg-surface p-5 shadow-sm">
        {error ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
            {t("state.error")} {error}
          </p>
        ) : (
          <>
            {/* Legend */}
            <LegendRow scale={scale} unit={indicator.unit} ready={ready} noDataColor={mapColors.noData} />

            <MapStage
              indicator={indicator}
              valueMap={valueMap}
              scale={scale}
              mapColors={mapColors}
              byId={byId}
              loading={loading}
              touchMode={touchMode}
              onOpenFullscreen={() => setFullscreen(true)}
            />

            {ready && (
              <p className="mt-3 text-xs text-slate-500">
                {t("map.coverage", { matched: coverage.matched, total: coverage.total })}
              </p>
            )}
          </>
        )}

        <p className="mt-4 border-t border-slate-100 pt-4 text-xs text-slate-500">{t("map.note")}</p>
      </section>

      {/* Fullscreen overlay (touch only): a much bigger canvas to pinch-zoom and pan.
          Body scroll is locked while open (see effect above); the X fully restores. */}
      {fullscreen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-surface">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
            <LegendRow scale={scale} unit={indicator.unit} ready={ready} noDataColor={mapColors.noData} />
            <button
              type="button"
              onClick={() => setFullscreen(false)}
              aria-label={t("map.close")}
              title={t("map.close")}
              className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-md border border-slate-200 bg-surface px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <X size={18} aria-hidden="true" />
              {t("map.close")}
            </button>
          </div>
          <div className="relative flex-1 p-3">
            <MapStage
              fullscreen
              indicator={indicator}
              valueMap={valueMap}
              scale={scale}
              mapColors={mapColors}
              byId={byId}
              loading={loading}
              touchMode={touchMode}
            />
          </div>
        </div>
      )}

      {/* Highest / Lowest top-lists — full width below the map; two columns that stack
          on mobile. Reuse the map's already-fetched values; update with the indicator. */}
      {ready && topLists.highest.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-surface p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2">
            <TopList title={t("map.highest")} rows={topLists.highest} byId={byId} unit={indicator.unit} />
            <TopList title={t("map.lowest")} rows={topLists.lowest} byId={byId} unit={indicator.unit} />
          </div>
        </section>
      )}
    </div>
  );
}

// Legend + "no data" swatch row. Shared by the inline panel and the fullscreen header.
function LegendRow({ scale, unit, ready, noDataColor }) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <Legend min={scale.min} max={scale.max} unit={unit} ready={ready} />
      <span className="inline-flex items-center gap-2 text-xs text-slate-500">
        <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: noDataColor }} aria-hidden="true" />
        {t("map.noData")}
      </span>
    </div>
  );
}

// The interactive map canvas: choropleth + (touch) pinch-zoom/pan + tap-to-tooltip.
// Used twice — inline (tall on mobile, static 2:1 on desktop) and inside the
// fullscreen overlay — each with its own independent zoom/tooltip state.
//   - filled (touch): the SVG fills a taller box and slice-crops so countries are
//     noticeably bigger; desktop keeps the natural 2:1 "meet" letterbox, unchanged.
//   - inline touch uses twoFingerOnly + touch-action pan-y so one-finger swipes still
//     scroll the page; fullscreen has no page scroll to protect, so one finger pans.
function MapStage({ indicator, valueMap, scale, mapColors, byId, loading, touchMode, fullscreen = false, onOpenFullscreen }) {
  const [view, setView] = useState(DEFAULT_VIEW);
  const [tip, setTip] = useState(null); // { name, value, year, x, y }
  const wrapRef = useRef(null);
  const zoomed = view.zoom > 1.01;
  const resetZoom = () => {
    setView(DEFAULT_VIEW);
    setTip(null);
  };

  const showTip = (geo, e) => {
    const code = iso3ForGeo(geo);
    const datum = code ? valueMap.get(code) : null;
    const name = (code && byId.get(code) && countryLabel(byId.get(code))) || geo.properties?.name || code || "—";
    const rect = wrapRef.current?.getBoundingClientRect();
    setTip({
      name,
      value: datum ? formatValue(datum.value, indicator.unit) : t("map.noData"),
      year: datum?.year ?? null,
      x: rect ? e.clientX - rect.left : 0,
      y: rect ? e.clientY - rect.top : 0,
    });
  };

  // Identical whether rendered directly (desktop) or inside ZoomableGroup (touch) —
  // so zoom never changes fills, taps, or tooltips.
  const mapGeographies = (
    <Geographies geography={GEO_URL}>
      {({ geographies }) =>
        geographies
          .filter((geo) => geo.id !== ANTARCTICA_ID)
          .map((geo) => {
            const code = iso3ForGeo(geo);
            const datum = code ? valueMap.get(code) : null;
            const fill = datum ? scale.colorFor(datum.value) : mapColors.noData;
            return (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill={fill}
                stroke={mapColors.border}
                strokeWidth={0.4}
                onMouseEnter={(e) => showTip(geo, e)}
                onMouseMove={(e) => showTip(geo, e)}
                onMouseLeave={() => setTip(null)}
                style={{
                  default: { outline: "none" },
                  hover: { outline: "none", fillOpacity: 0.82, cursor: "pointer" },
                  pressed: { outline: "none" },
                }}
              />
            );
          })
      }
    </Geographies>
  );

  const filled = touchMode; // taller, slice-cropped fill on touch (inline + fullscreen)
  const svgStyle = filled ? { width: "100%", height: "100%" } : { width: "100%", height: "auto" };
  const preserve = filled ? "xMidYMid slice" : "xMidYMid meet";
  const wrapClass = fullscreen
    ? "relative h-full w-full"
    : touchMode
      ? "relative mt-4 h-[60vh] min-h-[20rem] max-h-[34rem]"
      : "relative mt-4";

  return (
    <>
      <div
        ref={wrapRef}
        className={wrapClass}
        style={touchMode ? { touchAction: fullscreen ? "none" : "pan-y" } : undefined}
      >
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-surface/70 text-sm text-slate-500">
            {t("state.loading")}
          </div>
        )}
        <ComposableMap
          projection={projection}
          width={MAP_W}
          height={MAP_H}
          preserveAspectRatio={preserve}
          style={svgStyle}
          aria-label={indicatorLabel(indicator)}
        >
          {touchMode ? (
            <ZoomableGroup
              center={view.center}
              zoom={view.zoom}
              minZoom={MIN_ZOOM}
              maxZoom={MAX_ZOOM}
              translateExtent={[[0, 0], [MAP_W, MAP_H]]}
              filterZoomEvent={fullscreen ? anyTouch : twoFingerOnly}
              onMoveEnd={({ coordinates, zoom }) => setView({ center: coordinates, zoom })}
            >
              {mapGeographies}
            </ZoomableGroup>
          ) : (
            mapGeographies
          )}
        </ComposableMap>

        {/* Controls (touch only). Reset appears once zoomed; the fullscreen button is
            inline-only and is kept SEPARATE from country taps (it sits above the map). */}
        {touchMode && (
          <div className="absolute right-2 top-2 z-20 flex gap-2">
            {zoomed && (
              <button
                type="button"
                onClick={resetZoom}
                aria-label={t("map.resetZoom")}
                title={t("map.resetZoom")}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-slate-200 bg-surface/95 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm backdrop-blur focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <Minimize2 size={14} aria-hidden="true" />
                {t("map.resetZoom")}
              </button>
            )}
            {!fullscreen && onOpenFullscreen && (
              <button
                type="button"
                onClick={onOpenFullscreen}
                aria-label={t("map.fullscreen")}
                title={t("map.fullscreen")}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-slate-200 bg-surface/95 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm backdrop-blur focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <Maximize2 size={14} aria-hidden="true" />
                {t("map.fullscreen")}
              </button>
            )}
          </div>
        )}

        {tip && (
          <div
            className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full rounded-md border border-slate-200 bg-surface px-2.5 py-1.5 text-xs shadow-md"
            style={{ left: tip.x, top: tip.y - 8 }}
          >
            <div className="font-medium text-slate-900">{tip.name}</div>
            <div className="num text-slate-600">
              {tip.value}
              {tip.year != null && <span className="ml-1.5 text-slate-400">{tip.year}</span>}
            </div>
          </div>
        )}
      </div>

      {/* Touch-only discoverability hint for the pinch gesture (inline only). */}
      {touchMode && !fullscreen && !zoomed && (
        <p className="mt-3 text-xs text-slate-400">{t("map.pinchHint")}</p>
      )}
    </>
  );
}

// One ranked list (Highest or Lowest): rank + country name + formatted value.
function TopList({ title, rows, byId, unit }) {
  return (
    <div>
      <h3 className="text-sm font-medium text-slate-500">{title}</h3>
      <ol className="mt-3 space-y-2">
        {rows.map((r, i) => {
          const country = byId.get(r.code);
          return (
            <li key={r.code} className="flex items-baseline justify-between gap-3">
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="num w-4 shrink-0 text-right text-xs text-slate-400">{i + 1}</span>
                <span className="truncate text-sm text-slate-900">{country ? countryLabel(country) : r.code}</span>
              </span>
              <span className="num shrink-0 text-sm font-semibold text-slate-900">{formatValue(r.value, unit)}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// Horizontal ramp legend with min/max readouts (formatted in the indicator's unit).
function Legend({ min, max, unit, ready }) {
  return (
    <div className="flex items-center gap-2">
      <span className="num text-xs text-slate-500">{ready && min != null ? formatValue(min, unit) : t("map.legendLow")}</span>
      <span
        className="h-3 w-32 rounded-sm border border-slate-200"
        style={{ background: `linear-gradient(to right, ${RAMP_FROM}, ${RAMP_TO})` }}
        aria-hidden="true"
      />
      <span className="num text-xs text-slate-500">{ready && max != null ? formatValue(max, unit) : t("map.legendHigh")}</span>
    </div>
  );
}

// Preset dropdown + debounced WDI catalog search — reuses the Compare indicators
// module (describeIndicator / searchIndicators) so the two share one catalog/cache.
function IndicatorPicker({ value, onChange }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    let alive = true;
    const handle = setTimeout(() => {
      searchIndicators(q)
        .then((rows) => alive && (setResults(rows), setSearching(false)))
        .catch(() => alive && (setResults([]), setSearching(false)));
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      alive = false;
      clearTimeout(handle);
    };
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => boxRef.current && !boxRef.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const choose = (indicator) => {
    onChange(indicator);
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  const selectValue = value.preset ? value.code : "__custom";

  return (
    <div ref={boxRef} className="relative">
      <span className="text-sm font-medium text-slate-500">{t("map.indicator")}</span>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <select
          aria-label={t("map.indicator")}
          value={selectValue}
          onChange={(e) => choose(describeIndicator(e.target.value))}
          className="min-w-0 flex-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-2 text-sm font-medium text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <optgroup label={t("map.presetGroup")}>
            {INDICATOR_LIST.map((i) => (
              <option key={i.code} value={i.code}>
                {indicatorLabel(i)}
              </option>
            ))}
          </optgroup>
          {!value.preset && <option value="__custom">{t("map.customOption", { label: value.label })}</option>}
        </select>

        <div className="relative sm:w-56">
          <Search size={15} aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder={t("map.searchPlaceholder")}
            aria-label={t("map.searchLabel")}
            className="w-full rounded-md border border-slate-200 bg-surface py-2 pl-8 pr-2 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
        </div>
      </div>

      {open && query.trim() && (
        <ul className="absolute right-0 z-30 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-slate-200 bg-surface py-1 text-sm shadow-lg sm:w-72">
          {searching ? (
            <li className="px-3 py-2 text-slate-500">{t("map.searching")}</li>
          ) : results.length === 0 ? (
            <li className="px-3 py-2 text-slate-500">{t("map.noResults")}</li>
          ) : (
            results.map((r) => (
              <li key={r.code}>
                <button
                  type="button"
                  onClick={() => choose(r)}
                  className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none"
                >
                  <span className="text-slate-900">{r.label}</span>
                  <span className="num text-xs text-slate-400">{r.code}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
