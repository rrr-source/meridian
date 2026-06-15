import { describe, it, expect } from "vitest";
import { isTapGesture, TAP_MOVE_PX, panExtent } from "../src/lib/worldMap";

// panExtent is the d3-zoom translateExtent: how far the canvas may be dragged. It must
// let the user CENTER any edge/corner of a width×height map at the current zoom, which
// needs half a viewport (width/2, height/2) of padding scaled by 1/zoom on each side.
describe("panExtent", () => {
  const W = 800;
  const H = 408;

  it("pads by half the viewport at zoom 1", () => {
    expect(panExtent(1, W, H)).toEqual([
      [-W / 2, -H / 2],
      [W + W / 2, H + H / 2],
    ]);
  });

  it("tightens the padding as 1/zoom (room still grows on screen)", () => {
    const [[x0, y0], [x1, y1]] = panExtent(4, W, H);
    expect(x0).toBe(-W / 8); // width/(2*4)
    expect(y0).toBe(-H / 8);
    expect(x1).toBe(W + W / 8);
    expect(y1).toBe(H + H / 8);
  });

  it("lets the extreme corner be centered (padding >= half-viewport/zoom)", () => {
    // To center world point x=W at zoom k, translateExtent's right edge must reach
    // W + W/(2k). panExtent provides exactly that, so the corner is reachable.
    for (const k of [1, 2, 8]) {
      const [, [x1, y1]] = panExtent(k, W, H);
      expect(x1).toBeGreaterThanOrEqual(W + W / (2 * k));
      expect(y1).toBeGreaterThanOrEqual(H + H / (2 * k));
    }
  });

  it("never tighter than the zoom=1 box for out-of-range zoom", () => {
    expect(panExtent(0.5, W, H)).toEqual(panExtent(1, W, H));
    expect(panExtent(NaN, W, H)).toEqual(panExtent(1, W, H));
    expect(panExtent(undefined, W, H)).toEqual(panExtent(1, W, H));
  });
});

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
