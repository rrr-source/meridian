import { describe, it, expect } from "vitest";
import { normalizeIndicator, computeRanking } from "../src/lib/ranking.js";

const m = (obj) => new Map(Object.entries(obj));

describe("normalizeIndicator — percentile rank within the set", () => {
  it("maps lowest→0, highest→100, evenly across the set", () => {
    const r = normalizeIndicator(m({ a: 10, b: 20, c: 30 }));
    expect(r.get("a")).toBe(0);
    expect(r.get("b")).toBe(50);
    expect(r.get("c")).toBe(100);
  });

  it("inverts when higherIsBetter is false (low raw → high score)", () => {
    // The unemployment case: a low rate should score HIGH.
    const r = normalizeIndicator(m({ QAT: 0.5, USA: 5, ZAF: 30 }), false);
    expect(r.get("QAT")).toBe(100); // lowest unemployment → best score
    expect(r.get("USA")).toBe(50);
    expect(r.get("ZAF")).toBe(0); // highest unemployment → worst score
  });

  it("gives tied raw values the same (averaged) rank", () => {
    const r = normalizeIndicator(m({ a: 10, b: 10, c: 30 }));
    expect(r.get("a")).toBe(25); // tie group at indices 0,1 → avg 0.5 / 2 * 100
    expect(r.get("b")).toBe(25);
    expect(r.get("c")).toBe(100);
  });

  it("drops null / NaN values from the ranked set", () => {
    const r = normalizeIndicator(m({ a: 10, b: null, c: NaN, d: 30 }));
    expect(r.size).toBe(2);
    expect(r.get("a")).toBe(0);
    expect(r.get("d")).toBe(100);
    expect(r.has("b")).toBe(false);
  });

  it("returns a neutral 50 for a single-country set, and empty for none", () => {
    expect(normalizeIndicator(m({ a: 7 })).get("a")).toBe(50);
    expect(normalizeIndicator(new Map()).size).toBe(0);
  });

  it("is relative to the passed set — same country scores differently in a different set", () => {
    const small = normalizeIndicator(m({ a: 10, b: 30 }));
    const big = normalizeIndicator(m({ a: 10, b: 20, c: 30 }));
    expect(small.get("b")).toBe(100); // top of {a,b}
    expect(big.get("b")).toBe(50); // middle of {a,b,c}
  });
});

describe("computeRanking — priority-weighted average, sorted descending", () => {
  const A = { key: "A", higherIsBetter: true };
  const B = { key: "B", higherIsBetter: true };

  it("combines criteria as a weighted average — Very important (2) pulls twice as hard", () => {
    // normA: x0 y50 z100 ; normB: x100 y50 z0 ; A is Very important (2), B Important (1)
    const valueMaps = { A: m({ x: 10, y: 20, z: 30 }), B: m({ x: 30, y: 20, z: 10 }) };
    const res = computeRanking([A, B], { A: 2, B: 1 }, valueMaps);
    const byCode = Object.fromEntries(res.map((r) => [r.code, r.index]));
    expect(byCode.x).toBeCloseTo(100 / 3, 6); // (0*2 + 100*1)/3
    expect(byCode.y).toBeCloseTo(50, 6); // (50*2 + 50*1)/3
    expect(byCode.z).toBeCloseTo(200 / 3, 6); // (100*2 + 0*1)/3
    expect(res.map((r) => r.code)).toEqual(["z", "y", "x"]); // sorted descending
  });

  it("weighs two Important (1) criteria equally — a plain average", () => {
    // normA: x0 y50 z100 ; normB: x100 y50 z0 ; both Important (1) → equal average
    const valueMaps = { A: m({ x: 10, y: 20, z: 30 }), B: m({ x: 30, y: 20, z: 10 }) };
    const res = computeRanking([A, B], { A: 1, B: 1 }, valueMaps);
    const byCode = Object.fromEntries(res.map((r) => [r.code, r.index]));
    expect(byCode.x).toBe(50);
    expect(byCode.y).toBe(50);
    expect(byCode.z).toBe(50);
  });

  it("inverts a lower-is-better criterion end to end (unemployment alone)", () => {
    const U = { key: "U", higherIsBetter: false };
    const res = computeRanking([U], { U: 1 }, { U: m({ QAT: 0.5, USA: 5, ZAF: 30 }) });
    expect(res[0].code).toBe("QAT"); // lowest unemployment ranks first
    expect(res[res.length - 1].code).toBe("ZAF");
  });

  it("ranks only countries present in ALL selected criteria", () => {
    const valueMaps = { A: m({ x: 10, y: 20, z: 30 }), B: m({ x: 1, y: 2 }) }; // z missing in B
    const res = computeRanking([A, B], { A: 1, B: 1 }, valueMaps);
    expect(res.map((r) => r.code).sort()).toEqual(["x", "y"]);
  });

  it("gives tied countries equal index", () => {
    const res = computeRanking([A], { A: 1 }, { A: m({ x: 10, y: 10, z: 30 }) });
    const byCode = Object.fromEntries(res.map((r) => [r.code, r.index]));
    expect(byCode.x).toBe(25);
    expect(byCode.y).toBe(25);
    expect(byCode.z).toBe(100);
  });

  it("returns [] for no criteria or zero total weight", () => {
    expect(computeRanking([], {}, {})).toEqual([]);
    expect(computeRanking([A], { A: 0 }, { A: m({ x: 1, y: 2 }) })).toEqual([]);
  });
});
