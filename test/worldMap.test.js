import { describe, it, expect } from "vitest";
import { isTapGesture, TAP_MOVE_PX } from "../src/lib/worldMap";

// isTapGesture decides whether a one-finger touch on the fullscreen map was a TAP
// (show the country's value) or a PAN (move the map). It must be lenient enough that
// a normal tap registers, strict enough that a deliberate drag never shows a tooltip.
describe("isTapGesture", () => {
  it("treats a near-stationary touch as a tap", () => {
    expect(isTapGesture({ x: 100, y: 100 }, { x: 100, y: 100 })).toBe(true);
    expect(isTapGesture({ x: 100, y: 100 }, { x: 103, y: 104 })).toBe(true); // 5px < 10
  });

  it("treats movement past the threshold as a pan (not a tap)", () => {
    expect(isTapGesture({ x: 100, y: 100 }, { x: 100, y: 140 })).toBe(false); // 40px
    expect(isTapGesture({ x: 0, y: 0 }, { x: 30, y: 40 })).toBe(false); // 50px
  });

  it("includes the exact threshold distance as a tap", () => {
    expect(isTapGesture({ x: 0, y: 0 }, { x: TAP_MOVE_PX, y: 0 })).toBe(true);
  });

  it("respects a custom threshold", () => {
    expect(isTapGesture({ x: 0, y: 0 }, { x: 15, y: 0 }, 20)).toBe(true);
    expect(isTapGesture({ x: 0, y: 0 }, { x: 15, y: 0 }, 5)).toBe(false);
  });

  it("is never a tap when a point is missing (can't tell → don't fire)", () => {
    expect(isTapGesture(null, { x: 0, y: 0 })).toBe(false);
    expect(isTapGesture({ x: 0, y: 0 }, null)).toBe(false);
    expect(isTapGesture(null, null)).toBe(false);
  });
});
