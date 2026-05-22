// Quick smoke test: run with `node --loader ts-node/esm src/circuit-breaker.test.ts`
import { CircuitBreaker, CircuitOpenError } from "./circuit-breaker.js";

async function assert(cond: boolean, msg: string): Promise<void> {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
  console.log("OK:", msg);
}

async function main(): Promise<void> {
  // Stays closed while only ok outcomes recorded
  const okBreaker = new CircuitBreaker("ok");
  for (let i = 0; i < 12; i++) {
    await okBreaker.exec(async () => "ok");
  }
  await assert(!okBreaker.isOpen(), "closed after 12 successes");

  // Opens after 5 fails in last 10 calls (5/5 = open immediately at window fill)
  const failBreaker = new CircuitBreaker("fail");
  let openErr = 0;
  for (let i = 0; i < 12; i++) {
    try {
      await failBreaker.exec(async () => {
        throw new Error("boom");
      });
    } catch (e) {
      if (e instanceof CircuitOpenError) openErr++;
    }
  }
  await assert(failBreaker.isOpen(), "opens on sustained failures");
  await assert(openErr >= 2, "subsequent calls short-circuit");

  // Mixed (4 fails out of 10) stays closed
  const mixBreaker = new CircuitBreaker("mix");
  for (let i = 0; i < 10; i++) {
    try {
      await mixBreaker.exec(async () => {
        if (i < 4) throw new Error("boom");
        return "ok";
      });
    } catch {}
  }
  await assert(!mixBreaker.isOpen(), "stays closed at 4/10 fails (threshold is 5)");

  console.log("all passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
