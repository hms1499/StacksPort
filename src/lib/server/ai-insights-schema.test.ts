import { describe, it, expect } from "vitest";
import { parseInsights } from "./ai-insights-schema";

const valid = {
  sentiment: {
    summary: "STX is consolidating.",
    score: 42,
    fearGreedValue: 55,
    signals: [{ label: "Volume up", type: "bullish" }],
  },
  kolSignals: {
    summary: "STX gaining social traction.",
    coins: [
      { symbol: "STX", name: "Stacks", galaxyScore: 72, socialVolume: 12400, sentiment: "bullish", insight: "Trending." },
    ],
  },
  alerts: {
    items: [{ title: "Dip", description: "Buy zone", type: "opportunity", priority: "high" }],
  },
  // The model only returns a summary + per-item insight strings now; the
  // factual headline/url/source come from our own data, not the LLM.
  newsDigest: {
    summary: "Quiet week.",
    insights: ["Relevant to Stacks.", "Bitcoin tailwind."],
  },
};

describe("parseInsights", () => {
  it("accepts a fully valid object", () => {
    const out = parseInsights(valid);
    expect(out.sentiment.score).toBe(42);
    expect(out.kolSignals.coins).toHaveLength(1);
    expect(out.alerts.items[0].type).toBe("opportunity");
    expect(out.newsDigest.insights).toEqual(["Relevant to Stacks.", "Bitcoin tailwind."]);
  });

  it("drops non-string news insights instead of failing the parse", () => {
    const out = parseInsights({
      ...valid,
      newsDigest: { summary: "s", insights: ["ok", 123, null, "fine"] },
    });
    expect(out.newsDigest.insights).toEqual(["ok", "fine"]);
  });

  it("defaults kolSignals to empty when absent", () => {
    const { kolSignals, ...rest } = valid;
    void kolSignals;
    const out = parseInsights(rest);
    expect(out.kolSignals).toEqual({ summary: "", coins: [] });
  });

  it("coerces numeric strings the model sometimes returns", () => {
    const out = parseInsights({
      ...valid,
      sentiment: { ...valid.sentiment, score: "42", fearGreedValue: "55" },
    });
    expect(out.sentiment.score).toBe(42);
    expect(out.sentiment.fearGreedValue).toBe(55);
  });

  it("clamps sentiment score into [-100, 100]", () => {
    expect(parseInsights({ ...valid, sentiment: { ...valid.sentiment, score: 9999 } }).sentiment.score).toBe(100);
    expect(parseInsights({ ...valid, sentiment: { ...valid.sentiment, score: -9999 } }).sentiment.score).toBe(-100);
  });

  it("drops signals/coins with an invalid enum instead of crashing the whole parse", () => {
    const out = parseInsights({
      ...valid,
      sentiment: {
        ...valid.sentiment,
        signals: [
          { label: "good", type: "bullish" },
          { label: "bad", type: "explosive" }, // invalid enum
        ],
      },
    });
    expect(out.sentiment.signals).toHaveLength(1);
    expect(out.sentiment.signals[0].label).toBe("good");
  });

  it("throws when sentiment is missing entirely", () => {
    const { sentiment, ...rest } = valid;
    void sentiment;
    expect(() => parseInsights(rest)).toThrow();
  });

  it("throws when score is non-numeric garbage", () => {
    expect(() => parseInsights({ ...valid, sentiment: { ...valid.sentiment, score: "abc" } })).toThrow();
  });

  it("ignores unknown extra keys", () => {
    const out = parseInsights({ ...valid, somethingElse: 123 });
    expect(out.sentiment.score).toBe(42);
  });
});
