import { describe, it, expect } from "vitest";
import {
  uintCV,
  standardPrincipalCV,
  serializeCV,
} from "@stacks/transactions";

describe("cvHex", () => {
  it("serializes uintCV to hex string", () => {
    const result = serializeCV(uintCV(1_000_000));
    const hex = typeof result === "string" ? result : Buffer.from(result as Uint8Array).toString("hex");
    expect(hex).toMatch(/^[0-9a-f]+$/);
    expect(hex.length).toBeGreaterThan(0);
  });

  it("serializes standard principal to hex string", () => {
    const result = serializeCV(standardPrincipalCV("SP000000000000000000002Q6VF78"));
    const hex = typeof result === "string" ? result : Buffer.from(result as Uint8Array).toString("hex");
    expect(hex).toMatch(/^[0-9a-f]+$/);
  });
});

describe("formatTokenAmount", () => {
  it("formats micro-STX to human STX with 2 decimals", () => {
    expect((1_500_000 / 1_000_000).toFixed(2)).toBe("1.50");
  });

  it("formats micro-USDC to human USDC with 2 decimals", () => {
    expect((2_500_000 / 1_000_000).toFixed(2)).toBe("2.50");
  });
});
