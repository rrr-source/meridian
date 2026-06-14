import { describe, it, expect } from "vitest";
import {
  readTab,
  readSearchParams,
  encodeIndicatorCode,
  decodeIndicatorCode,
  encodeCompare,
  decodeCompare,
  encodeRelocate,
  decodeRelocate,
  encodeMap,
  decodeMap,
  DEFAULT_MAP_CODE,
} from "../src/lib/urlState.js";

const sp = (s) => new URLSearchParams(s);

// Real WB codes used as defaults (gdppc / pop / internet).
const GDPPC = "NY.GDP.PCAP.CD";
const POP = "SP.POP.TOTL";
const INTERNET = "IT.NET.USER.ZS";
const DEFAULT_COMPARE_CODES = [GDPPC, POP, INTERNET];
const DEFAULT_COUNTRIES = ["USA", "CHN"];

const RELO_CTX = {
  critKeys: ["income", "safety", "unemployment", "co2"],
  recencyKeys: ["3", "5", "10", "all"],
  regions: ["Europe & Central Asia", "Sub-Saharan Africa"],
  defaults: { selected: ["income"], priority: 1, recency: "5" },
};

describe("readTab", () => {
  it("returns the named tab when valid", () => {
    expect(readTab("?tab=compare")).toBe("compare");
    expect(readTab("?tab=relocate")).toBe("relocate");
    expect(readTab("?tab=map")).toBe("map");
  });
  it("falls back to the default tab (map) for unknown/missing", () => {
    expect(readTab("?tab=bogus")).toBe("map");
    expect(readTab("")).toBe("map");
    expect(readTab(null)).toBe("map");
    expect(readTab(undefined)).toBe("map");
  });
});

describe("indicator token encode/decode", () => {
  it("encodes preset codes to readable keys, leaves searched codes raw", () => {
    expect(encodeIndicatorCode(GDPPC)).toBe("gdppc");
    expect(encodeIndicatorCode("ZZ.UNKNOWN.CODE")).toBe("ZZ.UNKNOWN.CODE");
  });
  it("decodes a key or a raw code, rejecting junk", () => {
    expect(decodeIndicatorCode("gdppc")).toBe(GDPPC);
    expect(decodeIndicatorCode(GDPPC)).toBe(GDPPC);
    expect(decodeIndicatorCode("  gdppc  ")).toBe(GDPPC); // trimmed
    expect(decodeIndicatorCode("")).toBeNull();
    expect(decodeIndicatorCode(null)).toBeNull();
    expect(decodeIndicatorCode("a b")).toBeNull(); // space → not a code
    expect(decodeIndicatorCode("!!!")).toBeNull();
  });
});

describe("Compare round-trip + robustness", () => {
  it("round-trips countries, chart order, and log scales", () => {
    const params = encodeCompare({
      codes: ["USA", "CHN"],
      indicatorCodes: [GDPPC, POP],
      logCodes: [POP],
    });
    const d = decodeCompare(new URLSearchParams(params));
    expect(d.codes).toEqual(["USA", "CHN"]);
    expect(d.charts).toEqual([GDPPC, POP]);
    expect(d.logCodes).toEqual([POP]);
  });

  it("uppercases, dedupes, drops bad ISO codes, and caps at 5", () => {
    const d = decodeCompare(sp("countries=usa,123,TOOLONG,FRA,CHN,DEU,ESP,ITA,JPN,USA"));
    expect(d.codes).toEqual(["USA", "FRA", "CHN", "DEU", "ESP"]); // 7 valid → first 5
  });

  it("validates country codes against a provided set when given", () => {
    const d = decodeCompare(sp("countries=USA,XXX,FRA"), new Set(["USA", "FRA"]));
    expect(d.codes).toEqual(["USA", "FRA"]); // XXX is ISO-shaped but not a real code
  });

  it("falls back to defaults for empty/garbage params", () => {
    const empty = decodeCompare(sp(""));
    expect(empty.codes).toEqual(DEFAULT_COUNTRIES);
    expect(empty.charts).toEqual(DEFAULT_COMPARE_CODES);
    expect(empty.logCodes).toEqual([]);

    const junk = decodeCompare(sp("countries=&charts=not a code,###&scales=garbage"));
    expect(junk.codes).toEqual(DEFAULT_COUNTRIES);
    expect(junk.charts).toEqual(DEFAULT_COMPARE_CODES);
    expect(junk.logCodes).toEqual([]);
  });

  it("ignores a scales token that isn't a current chart", () => {
    const d = decodeCompare(sp("charts=gdppc,pop&scales=gdp")); // gdp not among charts
    expect(d.logCodes).toEqual([]);
  });
});

describe("Relocate round-trip + robustness", () => {
  it("round-trips region, recency, and criteria+priorities (levels 1 and 2)", () => {
    const params = encodeRelocate({
      region: "Europe & Central Asia",
      recency: "10",
      selectedKeys: ["income", "safety"],
      weights: { income: 2, safety: 1 },
    });
    expect(params.criteria).toBe("income:2,safety:1");
    const d = decodeRelocate(new URLSearchParams(params), RELO_CTX);
    expect(d.selected).toEqual(["income", "safety"]);
    expect(d.weights).toEqual({ income: 2, safety: 1 });
    expect(d.recency).toBe("10");
    expect(d.region).toBe("Europe & Central Asia");
  });

  it("encodes only selected criteria; a missing/odd weight defaults to Important (1)", () => {
    // income has no weight entry, safety has an out-of-range one → both clamp to 1.
    const params = encodeRelocate({ region: "all", recency: "5", selectedKeys: ["income", "safety"], weights: { safety: 9 } });
    expect(params.criteria).toBe("income:1,safety:1");
  });

  it("treats an old `:0` token as deselected (criterion absent), keeping the rest", () => {
    const d = decodeRelocate(sp("criteria=income:2,safety:0"), RELO_CTX);
    expect(d.selected).toEqual(["income"]); // safety:0 dropped, not crashed on
    expect(d.weights).toEqual({ income: 2 });
  });

  it("drops the region param when it is 'all' and restores 'all' on decode", () => {
    const params = encodeRelocate({ region: "all", recency: "5", selectedKeys: ["income"], weights: { income: 1 } });
    expect(params.region).toBe("");
    expect(decodeRelocate(new URLSearchParams(params), RELO_CTX).region).toBe("all");
  });

  it("falls back to defaults for garbage criteria / recency / region", () => {
    const d = decodeRelocate(sp("criteria=income:5,fake:1,:::,co2&recency=99&region=Atlantis"), RELO_CTX);
    expect(d.selected).toEqual(["income"]); // all criteria tokens invalid → defaults
    expect(d.weights).toEqual({ income: 1 });
    expect(d.recency).toBe("5"); // 99 out of range
    expect(d.region).toBe("all"); // unknown region
  });

  it("empty params → defaults", () => {
    const d = decodeRelocate(sp(""), RELO_CTX);
    expect(d.selected).toEqual(["income"]);
    expect(d.recency).toBe("5");
    expect(d.region).toBe("all");
  });
});

describe("World map round-trip + robustness", () => {
  it("round-trips the indicator (preset key form)", () => {
    expect(decodeMap(new URLSearchParams(encodeMap({ code: INTERNET }))).code).toBe(INTERNET);
  });
  it("round-trips a searched (non-preset) code raw", () => {
    expect(decodeMap(new URLSearchParams(encodeMap({ code: "FX.OWN.TOTL.ZS" }))).code).toBe("FX.OWN.TOTL.ZS");
  });
  it("falls back to the default indicator for junk/missing", () => {
    expect(decodeMap(sp("indicator=%%%bad%%%")).code).toBe(DEFAULT_MAP_CODE);
    expect(decodeMap(sp("")).code).toBe(DEFAULT_MAP_CODE);
  });
});

describe("never throws on hostile / missing input", () => {
  const hostile = [
    () => readSearchParams(undefined),
    () => readSearchParams(null),
    () => readSearchParams("%%%not a query%%%"),
    () => readTab(null),
    () => decodeCompare(null),
    () => decodeCompare(sp("countries=💀,&charts=💀&scales=💀")),
    () => decodeRelocate(null, RELO_CTX),
    () => decodeRelocate(sp("criteria=💀:💀"), RELO_CTX),
    () => decodeMap(null),
    () => decodeMap(sp("indicator=💀")),
  ];
  it.each(hostile.map((fn, i) => [i, fn]))("case %i does not throw", (_i, fn) => {
    expect(fn).not.toThrow();
  });

  it("null sp still yields valid defaults", () => {
    expect(decodeCompare(null).codes).toEqual(DEFAULT_COUNTRIES);
    expect(decodeMap(null).code).toBe(DEFAULT_MAP_CODE);
    expect(decodeRelocate(null, RELO_CTX).selected).toEqual(["income"]);
  });
});
