// src/lib/server/groq-client.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  withModelFallback,
  GROQ_MODEL,
  GROQ_FALLBACK_MODEL,
} from "./groq-client";

describe("withModelFallback", () => {
  // The fallback path logs an expected warning; keep test output pristine.
  beforeEach(() => vi.spyOn(console, "warn").mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it("returns the primary model's result without calling the fallback", async () => {
    const call = vi.fn(async (model: string) => `ok:${model}`);

    const out = await withModelFallback(call, { label: "Test" });

    expect(out).toBe(`ok:${GROQ_MODEL}`);
    expect(call).toHaveBeenCalledTimes(1);
    expect(call).toHaveBeenCalledWith(GROQ_MODEL);
  });

  it("falls back to the fallback model when the primary throws", async () => {
    const call = vi.fn(async (model: string) => {
      if (model === GROQ_MODEL) throw new Error("primary overloaded");
      return `ok:${model}`;
    });

    const out = await withModelFallback(call, { label: "Test" });

    expect(out).toBe(`ok:${GROQ_FALLBACK_MODEL}`);
    expect(call).toHaveBeenCalledTimes(2);
    expect(call).toHaveBeenNthCalledWith(1, GROQ_MODEL);
    expect(call).toHaveBeenNthCalledWith(2, GROQ_FALLBACK_MODEL);
  });

  it("propagates the error when both primary and fallback fail", async () => {
    const call = vi.fn(async () => {
      throw new Error("both down");
    });

    await expect(withModelFallback(call, { label: "Test" })).rejects.toThrow("both down");
    expect(call).toHaveBeenCalledTimes(2);
  });

  it("honours caller-supplied primary/fallback model overrides", async () => {
    const call = vi.fn(async (model: string) => `ok:${model}`);

    const out = await withModelFallback(call, {
      label: "Test",
      primary: "custom-primary",
      fallback: "custom-fallback",
    });

    expect(out).toBe("ok:custom-primary");
    expect(call).toHaveBeenCalledWith("custom-primary");
  });
});
