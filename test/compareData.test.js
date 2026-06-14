import { describe, it, expect } from "vitest";
import {
  buildRows,
  logYDomain,
  normalizeSeriesFor,
  latestFor,
  pairKey,
  addCountry,
  removeCountry,
  initCountrySet,
  colorForSlot,
} from "../src/lib/compareData.js";
import { SERIES_PALETTE } from "../src/lib/constants.js";

describe("buildRows — multi-country merge by year", () => {
  const set = [
    { code: "USA", slot: 0 },
    { code: "CHN", slot: 1 },
  ];
  const cache = {
    [pairKey("X", "USA")]: [
      { year: 2000, value: 1 },
      { year: 2001, value: 2 },
    ],
    [pairKey("X", "CHN")]: [
      { year: 2001, value: 3 },
      { year: 2002, value: 4 },
    ],
  };

  it("merges per-country series into year rows, sorted ascending", () => {
    expect(buildRows(set, cache, "X")).toEqual([
      { year: 2000, USA: 1 },
      { year: 2001, USA: 2, CHN: 3 },
      { year: 2002, CHN: 4 },
    ]);
  });

  it("skips null points and countries with no cached series", () => {
    const c2 = {
      [pairKey("X", "USA")]: [
        { year: 2000, value: null },
        { year: 2001, value: 9 },
      ],
      // CHN absent from cache entirely
    };
    expect(buildRows(set, c2, "X")).toEqual([{ year: 2001, USA: 9 }]);
  });
});

describe("logYDomain — positive-only domain for the log axis", () => {
  it("excludes <= 0 values and spans the positive range", () => {
    const rows = [
      { year: 1, USA: -5, CHN: 10 },
      { year: 2, USA: 0, CHN: 20 },
    ];
    expect(logYDomain(rows, ["USA", "CHN"])).toEqual([10, 20]); // -5 and 0 excluded
  });

  it("returns null when there are no positive values (axis falls back to auto)", () => {
    expect(logYDomain([{ year: 1, USA: -3, CHN: 0 }], ["USA", "CHN"])).toBeNull();
    expect(logYDomain([], ["USA"])).toBeNull();
    expect(logYDomain(null, ["USA"])).toBeNull();
  });

  it("pads a single positive value to a decade so the axis isn't degenerate", () => {
    expect(logYDomain([{ year: 1, USA: 50 }], ["USA"])).toEqual([25, 100]);
  });

  it("only considers the requested codes and never leaks NaN", () => {
    const d = logYDomain([{ year: 1, USA: 10, CHN: 9999 }], ["USA"]); // CHN ignored
    expect(d).toEqual([5, 20]);
    expect(d.every(Number.isFinite)).toBe(true);
  });
});

describe("normalizeSeriesFor — extract one country's sorted series", () => {
  it("keeps only the matching country, drops non-finite years, sorts ascending", () => {
    const rows = [
      { countryiso3code: "USA", date: "2002", value: 3 },
      { countryiso3code: "CHN", date: "2000", value: 99 },
      { countryiso3code: "USA", date: "2000", value: 1 },
      { countryiso3code: "USA", date: "n/a", value: 7 },
    ];
    expect(normalizeSeriesFor(rows, "USA")).toEqual([
      { year: 2000, value: 1 },
      { year: 2002, value: 3 },
    ]);
    expect(normalizeSeriesFor(null, "USA")).toEqual([]);
  });
});

describe("latestFor — most recent non-null point", () => {
  it("returns the latest defined value, or null when none", () => {
    const data = [
      { year: 2000, USA: 1 },
      { year: 2001, USA: 2 },
      { year: 2002, CHN: 5 },
    ];
    expect(latestFor(data, "USA")).toEqual({ year: 2001, value: 2 });
    expect(latestFor(data, "DEU")).toBeNull();
  });
});

describe("country set + palette slots", () => {
  it("assigns the lowest free slot and keeps colors stable", () => {
    const set = initCountrySet(["USA", "CHN", "DEU"]);
    expect(set).toEqual([
      { code: "USA", slot: 0 },
      { code: "CHN", slot: 1 },
      { code: "DEU", slot: 2 },
    ]);
    // Removing the middle frees slot 1; the next add reuses it without recoloring others.
    const removed = removeCountry(set, "CHN");
    expect(removed.map((e) => e.slot)).toEqual([0, 2]);
    const readded = addCountry(removed, "FRA");
    expect(readded.find((e) => e.code === "FRA").slot).toBe(1);
  });

  it("is a no-op on duplicate add, full set, and dropping the last country", () => {
    const set = initCountrySet(["USA", "CHN", "DEU", "FRA", "GBR"]); // full (max 5)
    expect(addCountry(set, "JPN")).toBe(set); // full → unchanged reference
    expect(addCountry(set, "USA")).toBe(set); // duplicate → unchanged
    expect(removeCountry([{ code: "USA", slot: 0 }], "USA")).toEqual([{ code: "USA", slot: 0 }]);
  });

  it("colorForSlot maps to the palette (wrapping defensively)", () => {
    expect(colorForSlot(0)).toBe(SERIES_PALETTE[0]);
    expect(colorForSlot(SERIES_PALETTE.length)).toBe(SERIES_PALETTE[0]); // wraps
  });
});
