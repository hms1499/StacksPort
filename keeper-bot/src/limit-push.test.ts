// Plain-Node assert test (keeper convention — no vitest). Run via:
//   node --loader ts-node/esm src/limit-push.test.ts
import { shouldFill, computeMinOut } from "./limit-push.js";

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
  console.log("OK:", msg);
}

// shouldFill: fill at or below target
assert(shouldFill({ targetUsdMicro: 60_000_000_000 }, 59_000) === true, "fills when price below target");
assert(shouldFill({ targetUsdMicro: 60_000_000_000 }, 60_000) === true, "fills when price equals target");
assert(shouldFill({ targetUsdMicro: 60_000_000_000 }, 61_000) === false, "skips when price above target");

// computeMinOut: 1,000,000 uSTX * 0.000004 = 4, minus 1% = 3.96 -> floor 3
assert(computeMinOut(1_000_000, 0.000004, 100) === 3, "applies slippage to the quote");
assert(computeMinOut(1_000_000, 0, 100) === 0, "returns 0 for a zero quote");

console.log("all passed");
