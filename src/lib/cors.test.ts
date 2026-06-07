import { describe, it, expect } from "vitest";
import { isAllowedOrigin } from "./cors";

describe("isAllowedOrigin", () => {
  it("allows chrome extension origins (the StacksPort extension)", () => {
    expect(isAllowedOrigin("chrome-extension://abcdefghijklmnopabcdefghijklmnop")).toBe(true);
  });

  it("rejects arbitrary websites — the whole point of dropping wildcard CORS", () => {
    expect(isAllowedOrigin("https://evil.com")).toBe(false);
    expect(isAllowedOrigin("http://attacker.example")).toBe(false);
    expect(isAllowedOrigin("https://stack-sport.vercel.app.evil.com")).toBe(false);
  });

  it("rejects missing origin (same-origin requests need no ACAO)", () => {
    expect(isAllowedOrigin(null)).toBe(false);
    expect(isAllowedOrigin("")).toBe(false);
  });

  it("does not allow a spoofed scheme prefix", () => {
    expect(isAllowedOrigin("https://chrome-extension://x")).toBe(false);
    expect(isAllowedOrigin("chrome-extension-evil://x")).toBe(false);
  });
});
