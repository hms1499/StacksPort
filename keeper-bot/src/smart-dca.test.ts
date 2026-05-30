// Run with: node --loader ts-node/esm src/smart-dca.test.ts
import {
  computeSatsPerStxSeries,
  sma,
  evaluateDipCondition,
  decideBatch,
  type SmartDcaConfig,
} from "./smart-dca.js";
import type { BatchPlan } from "./batch-executor.js";

let failures = 0;
function assert(cond: boolean, msg: string): void {
  if (cond) {
    console.log("OK:", msg);
  } else {
    console.error("FAIL:", msg);
    failures++;
  }
}
function close(a: number, b: number, eps = 1e-6): boolean {
  return Math.abs(a - b) < eps;
}

// computeSatsPerStxSeries
{
  const s = computeSatsPerStxSeries([2, 2.5], [50000, 40000]);
  assert(close(s[0], (2 / 50000) * 1e8), "sats/STX[0] = 4000");
  assert(close(s[1], (2.5 / 40000) * 1e8), "sats/STX[1] = 6250");
  assert(
    computeSatsPerStxSeries([2, 2], [0, 50000]).length === 1,
    "skips index with btc=0"
  );
  assert(
    computeSatsPerStxSeries([2, 2, 2], [50000, 50000]).length === 2,
    "truncates to shorter length"
  );
}

// sma
{
  assert(close(sma([10, 20, 30], 3), 20), "sma full window");
  assert(close(sma([10, 20, 30, 40], 2), 35), "sma last 2");
  assert(close(sma([10, 20], 7), 15), "sma window > length averages all");
  assert(sma([], 7) === 0, "sma empty = 0");
}

// evaluateDipCondition
{
  const base = { thresholdBps: 500, deferCount: 0, maxDeferIntervals: 2 };
  assert(
    evaluateDipCondition({ ...base, current: 106, avg: 100 }).action === "execute",
    "premium 6% >= 5% → execute (dip-hit)"
  );
  const skip = evaluateDipCondition({ ...base, current: 102, avg: 100 });
  assert(skip.action === "skip" && skip.nextDefer === 1, "premium 2% → skip, defer=1");
  const cap = evaluateDipCondition({ ...base, current: 102, avg: 100, deferCount: 2 });
  assert(
    cap.action === "execute" && cap.reason === "defer-cap-market-buy" && cap.nextDefer === 0,
    "defer cap exceeded → market buy, reset"
  );
  const open = evaluateDipCondition({ ...base, current: 100, avg: 0 });
  assert(open.action === "execute" && open.reason === "no-signal-fail-open", "no signal → fail-open");
}

// decideBatch
{
  const plans: BatchPlan[] = [
    { planId: 1, vaultType: 0 },
    { planId: 2, vaultType: 0 },
    { planId: 3, vaultType: 1 },
  ];
  const cfg: SmartDcaConfig = {
    owner: "SP1", thresholdBps: 500, windowDays: 7, maxDeferIntervals: 2, createdAt: 0,
  };
  const configs = new Map<number, SmartDcaConfig>([[1, cfg], [2, cfg]]);
  const deferByPlan = new Map<number, number>();
  const signal = { current: 102, series: [100, 100, 100] }; // premium 2% < 5%
  const r = decideBatch({ plans, configs, deferByPlan, signal });
  assert(
    r.toExecute.length === 1 && r.toExecute[0].planId === 3,
    "configless vault-1 plan passes; gated vault-0 plans skipped"
  );
  assert(r.deferWrites.get(1) === 1 && r.deferWrites.get(2) === 1, "defer incremented for skipped");

  const r2 = decideBatch({ plans, configs, deferByPlan, signal: null });
  assert(r2.toExecute.length === 3, "null signal → fail-open, all execute");
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
