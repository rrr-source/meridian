import { describe, it, expect, afterEach } from "vitest";
import { setStoredLocale } from "../src/lib/i18n.js";
import { formatValue, formatAxis, formatCompact } from "../src/lib/format.js";

// format.js reads the current (global) locale; reset to the default after each test.
afterEach(() => setStoredLocale("en"));

describe("formatValue — English (default)", () => {
  it("handles unit symbols and compact magnitudes", () => {
    expect(formatValue(1234567, "$")).toBe("$1.2M");
    expect(formatValue(84.2, "%")).toBe("84.2%");
    expect(formatValue(331000000, "ppl")).toBe("331M");
  });

  it("falls back to compact K/M/B for empty/unknown unit (searched indicators)", () => {
    expect(formatValue(1234, "")).toBe("1.2K");
    expect(formatValue(1234, null)).toBe("1.2K");
  });

  it("suffixes word units, decimals for small magnitudes and compact for large", () => {
    expect(formatValue(23.3, "yrs")).toBe("23.3 yrs");
    expect(formatValue(23.3, "per 1,000")).toBe("23.3 per 1,000");
    expect(formatValue(95, "per 100")).toBe("95 per 100");
    expect(formatValue(50000, "yrs")).toBe("50K yrs"); // >= 10000 → compact
  });

  it("handles edge values: missing, zero, negative", () => {
    expect(formatValue(null, "$")).toBe("—");
    expect(formatValue(undefined, "$")).toBe("—");
    expect(formatValue(NaN, "%")).toBe("—");
    expect(formatValue(0, "$")).toBe("$0");
    expect(formatValue(-5, "%")).toBe("-5%");
  });
});

describe("formatValue — Russian (ru-RU grouping + localized units)", () => {
  it("formats numbers per ru-RU and keeps $/% symbols", () => {
    setStoredLocale("ru");
    expect(formatValue(1234567, "$")).toBe("$1,2 млн"); // NBSP before млн
    expect(formatValue(84.2, "%")).toBe("84,2%");
    expect(formatValue(331000000, "ppl")).toBe("331 млн");
  });

  it("localizes the per-1,000 / per-100 unit suffixes", () => {
    setStoredLocale("ru");
    expect(formatValue(23.3, "per 1,000")).toBe("23,3 на 1000");
    expect(formatValue(95, "per 100")).toBe("95 на 100");
  });
});

describe("formatCompact & formatAxis", () => {
  it("formatCompact: bare compact number, em dash for missing", () => {
    expect(formatCompact(1234567)).toBe("1.2M");
    expect(formatCompact(null)).toBe("—");
    expect(formatCompact(NaN)).toBe("—");
  });

  it("formatAxis: compact, symbol-only units, empty string for missing", () => {
    expect(formatAxis(1234567, "$")).toBe("$1.2M");
    expect(formatAxis(84.2, "%")).toBe("84.2%");
    expect(formatAxis(23.3, "per 1,000")).toBe("23.3"); // no suffix on axis ticks
    expect(formatAxis(null, "$")).toBe("");
  });
});
