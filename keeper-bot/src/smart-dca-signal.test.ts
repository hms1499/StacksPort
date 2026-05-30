// Run with: node --loader ts-node/esm src/smart-dca-signal.test.ts
import { fetchSatsPerStxSignal } from "./smart-dca-signal.js";

let failures = 0;
function assert(cond: boolean, msg: string): void {
  if (cond) console.log("OK:", msg);
  else { console.error("FAIL:", msg); failures++; }
}

const realFetch = globalThis.fetch;
function mockFetch(map: Record<string, unknown>): void {
  globalThis.fetch = (async (url: string | URL) => {
    const u = String(url);
    const key = u.includes("/coins/bitcoin/") ? "btc" : "stx";
    const body = map[key];
    if (body === undefined) return { ok: false, status: 500 } as Response;
    return { ok: true, status: 200, json: async () => body } as Response;
  }) as typeof fetch;
}

async function main(): Promise<void> {
  // happy path: STX 2 USD, BTC 50000 USD → 4000 sats/STX
  mockFetch({
    stx: { prices: [[1, 2], [2, 2]] },
    btc: { prices: [[1, 50000], [2, 50000]] },
  });
  const sig = await fetchSatsPerStxSignal(7);
  assert(sig !== null && Math.abs(sig.current - 4000) < 1e-6, "builds current 4000 sats/STX");
  assert(sig !== null && sig.series.length === 2, "series length 2");

  // error path → null (fail-open)
  mockFetch({}); // every fetch returns 500
  const sig2 = await fetchSatsPerStxSignal(7);
  assert(sig2 === null, "fetch error → null");

  globalThis.fetch = realFetch;
  console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
  process.exit(failures === 0 ? 0 : 1);
}
main();
