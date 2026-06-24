import { describe, it, expect } from "vitest";
import { parseWalletAddresses } from "./wallet";

describe("parseWalletAddresses btcPublicKey", () => {
  it("extracts the BTC entry's publicKey", () => {
    const out = parseWalletAddresses([
      { address: "SP3FGQ8Z7JY9BWYZ5WM53E0M9NK7WHJF0691NZ159", symbol: "STX" },
      { address: "bc1qexampleaddr", symbol: "BTC", publicKey: "02abc" },
    ]);
    expect(out.btcAddress).toBe("bc1qexampleaddr");
    expect(out.btcPublicKey).toBe("02abc");
  });

  it("returns empty string when no BTC publicKey present", () => {
    const out = parseWalletAddresses([
      { address: "SP3FGQ8Z7JY9BWYZ5WM53E0M9NK7WHJF0691NZ159", symbol: "STX" },
    ]);
    expect(out.btcPublicKey).toBe("");
  });
});
