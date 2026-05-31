import { describe, it, expect } from "vitest";
import { shouldBypassOptimizer } from "./TokenImage";

describe("shouldBypassOptimizer", () => {
  it("bypasses local SVG token icons (the optimizer 400s on SVG)", () => {
    expect(shouldBypassOptimizer("/tokens/stx.svg")).toBe(true);
    expect(shouldBypassOptimizer("/tokens/sbtc.SVG")).toBe(true);
    expect(shouldBypassOptimizer("https://cdn.example.com/logo.svg?v=2")).toBe(true);
  });

  it("bypasses data URLs", () => {
    expect(shouldBypassOptimizer("data:image/png;base64,AAAA")).toBe(true);
  });

  it("optimizes ordinary raster logos (the actual perf win)", () => {
    expect(shouldBypassOptimizer("https://coingecko.com/coin.png")).toBe(false);
    expect(shouldBypassOptimizer("https://hiro.so/token/logo.jpg")).toBe(false);
    expect(shouldBypassOptimizer("/tokens/usdcx.webp")).toBe(false);
  });

  it("is not fooled by 'svg' appearing mid-path", () => {
    expect(shouldBypassOptimizer("https://svg.example.com/logo.png")).toBe(false);
  });
});
