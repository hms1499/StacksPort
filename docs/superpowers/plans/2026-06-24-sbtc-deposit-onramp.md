# BTC → sBTC Deposit On-Ramp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user mint sBTC from BTC fully in-app, non-custodially, with server-side tracking and a web push when sBTC lands.

**Architecture:** A reusable client-side "Get sBTC" modal builds an sBTC deposit address and has the user's own wallet broadcast a BTC tx (`request('sendTransfer')`). The deposit is persisted to Redis; a `CRON_SECRET`-protected reconcile route (called by the existing external scheduler) notifies the sBTC signers once the tx hits the mempool, polls Emily for mint completion, then sends a web push and busts the portfolio cache.

**Tech Stack:** Next.js 15 App Router, `sbtc` npm package, `@stacks/connect@8.2.5`, `@upstash/redis`, `web-push`, Vitest, Playwright.

## Global Constraints

- Commit style: **no `Co-Authored-By` trailer**; commit at fine granularity (RED/GREEN, helper vs wiring separate); every commit stays green. (User convention.)
- Commit directly on `main` — no feature branches. (User convention.)
- Non-custodial only: never handle a raw BTC private key. The user's wallet signs `sendTransfer`.
- `notifySbtc` runs **server-side** (in the reconcile route), never on the client.
- Network-gated behind `SBTC_NETWORK` env (`testnet` | `mainnet`, default `mainnet`). Build & test on testnet first.
- All user-facing strings go through `next-intl`; mirror new keys to **all 7 locales** (en, vi, zh, ja, ko, es, pt).
- Amounts are in **sats** (integer) end-to-end; only format to BTC at the view layer.

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/sbtc-deposit.ts` (new) | Network-aware `sbtc` client factory; `validateDepositAmount`; `buildDepositParams`; shared types |
| `src/lib/sbtc-deposit.test.ts` (new) | Unit tests for the above |
| `src/lib/wallet.ts` (modify) | Also capture BTC public key from `connect()` |
| `src/store/walletStore.ts` (modify) | Store `btcPublicKey` |
| `src/hooks/useWalletSync.ts` (modify) | Pass `btcPublicKey` through |
| `src/lib/server/sbtc-pending.ts` (new) | Redis CRUD for pending deposits (`sbtc:pending:<addr>`) |
| `src/lib/server/sbtc-pending.test.ts` (new) | Unit tests (mock redis) |
| `src/lib/server/emily-status.ts` (new) | `EmilyStatusClient` interface + concrete REST impl |
| `src/lib/server/emily-status.test.ts` (new) | Unit tests (mock fetch) |
| `src/lib/server/sbtc-reconcile.ts` (new) | Pure `decideNext()` state machine |
| `src/lib/server/sbtc-reconcile.test.ts` (new) | Unit tests |
| `src/lib/server/push-send.ts` (new) | Send a web push to one address |
| `src/app/api/sbtc/deposit/route.ts` (new) | `POST` persist a broadcast deposit |
| `src/app/api/sbtc/deposits/route.ts` (new) | `GET` deposits for an address |
| `src/app/api/cron/sbtc-reconcile/route.ts` (new) | `GET` reconcile loop (CRON_SECRET + lock) |
| `src/hooks/useSbtcDeposits.ts` (new) | SWR hook for live tracking |
| `src/components/sbtc/GetSbtcModal.tsx` (new) | 3-step deposit modal |
| `src/components/assets/SBTCMonitor.tsx` (modify) | Replace out-link with modal trigger |
| `src/i18n/messages/*/sbtc.json` (new ×7) | i18n keys |

---

### Task 1: sBTC client factory + types

**Files:**
- Create: `src/lib/sbtc-deposit.ts`
- Test: `src/lib/sbtc-deposit.test.ts`
- Modify: `package.json` (add `sbtc`)

**Interfaces:**
- Produces:
  - `type SbtcNetwork = "mainnet" | "testnet"`
  - `function getSbtcNetwork(): SbtcNetwork` — reads `process.env.SBTC_NETWORK`, defaults `"mainnet"`
  - `function makeSbtcClient(network?: SbtcNetwork): SbtcApiClient` — returns `SbtcApiClientMainnet` or `SbtcApiClientTestnet`

- [ ] **Step 1: Install dependency**

```bash
npm install sbtc
```

- [ ] **Step 2: Write the failing test**

```ts
// src/lib/sbtc-deposit.test.ts
import { describe, it, expect, afterEach } from "vitest";
import { getSbtcNetwork } from "./sbtc-deposit";

describe("getSbtcNetwork", () => {
  const orig = process.env.SBTC_NETWORK;
  afterEach(() => { process.env.SBTC_NETWORK = orig; });

  it("defaults to mainnet", () => {
    delete process.env.SBTC_NETWORK;
    expect(getSbtcNetwork()).toBe("mainnet");
  });

  it("honors testnet", () => {
    process.env.SBTC_NETWORK = "testnet";
    expect(getSbtcNetwork()).toBe("testnet");
  });

  it("ignores garbage and falls back to mainnet", () => {
    process.env.SBTC_NETWORK = "wat";
    expect(getSbtcNetwork()).toBe("mainnet");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/sbtc-deposit.test.ts`
Expected: FAIL — cannot find module `./sbtc-deposit` / `getSbtcNetwork` is not a function.

- [ ] **Step 4: Write minimal implementation**

```ts
// src/lib/sbtc-deposit.ts
import {
  SbtcApiClientMainnet,
  SbtcApiClientTestnet,
  type SbtcApiClient,
} from "sbtc";

export type SbtcNetwork = "mainnet" | "testnet";

export function getSbtcNetwork(): SbtcNetwork {
  return process.env.SBTC_NETWORK === "testnet" ? "testnet" : "mainnet";
}

export function makeSbtcClient(network: SbtcNetwork = getSbtcNetwork()): SbtcApiClient {
  return network === "testnet"
    ? new SbtcApiClientTestnet()
    : new SbtcApiClientMainnet();
}
```

> **Risk to confirm at this step:** that `sbtc` exports `SbtcApiClientTestnet` and a `SbtcApiClient` type. If the type name differs, import the correct one; if there is no shared interface type, use `ReturnType<typeof makeSbtcClient>` aliases. Do not invent methods — only `fetchSignersPublicKey`, `fetchTxHex`, `notifySbtc`, `fetchSbtcBalance`, `fetchFeeRate` are used by this plan.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/sbtc-deposit.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/sbtc-deposit.ts src/lib/sbtc-deposit.test.ts
git commit -m "feat(sbtc): network-aware sbtc client factory"
```

---

### Task 2: `validateDepositAmount` pure function

**Files:**
- Modify: `src/lib/sbtc-deposit.ts`
- Test: `src/lib/sbtc-deposit.test.ts`

**Interfaces:**
- Produces:
  - `const SBTC_DUST_SATS = 10_000` (minimum economical deposit)
  - `const DEFAULT_MAX_SIGNER_FEE_SATS = 80_000`
  - `interface AmountCheck { ok: boolean; reason?: "below_min" | "non_integer" | "not_positive"; minSats: number }`
  - `function validateDepositAmount(amountSats: number, maxSignerFee?: number): AmountCheck`

- [ ] **Step 1: Write the failing test**

```ts
// append to src/lib/sbtc-deposit.test.ts
import { validateDepositAmount, SBTC_DUST_SATS, DEFAULT_MAX_SIGNER_FEE_SATS } from "./sbtc-deposit";

describe("validateDepositAmount", () => {
  const min = SBTC_DUST_SATS + DEFAULT_MAX_SIGNER_FEE_SATS;

  it("rejects amounts below dust + signer fee", () => {
    expect(validateDepositAmount(min - 1)).toEqual({ ok: false, reason: "below_min", minSats: min });
  });

  it("accepts amounts at the minimum", () => {
    expect(validateDepositAmount(min)).toEqual({ ok: true, minSats: min });
  });

  it("rejects non-integer sats", () => {
    expect(validateDepositAmount(min + 0.5).reason).toBe("non_integer");
  });

  it("rejects zero / negative", () => {
    expect(validateDepositAmount(0).reason).toBe("not_positive");
  });

  it("uses a custom signer fee in the minimum", () => {
    expect(validateDepositAmount(SBTC_DUST_SATS + 5_000, 5_000).ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/sbtc-deposit.test.ts`
Expected: FAIL — `validateDepositAmount` is not exported.

- [ ] **Step 3: Write minimal implementation**

```ts
// append to src/lib/sbtc-deposit.ts
export const SBTC_DUST_SATS = 10_000;
export const DEFAULT_MAX_SIGNER_FEE_SATS = 80_000;

export interface AmountCheck {
  ok: boolean;
  reason?: "below_min" | "non_integer" | "not_positive";
  minSats: number;
}

export function validateDepositAmount(
  amountSats: number,
  maxSignerFee: number = DEFAULT_MAX_SIGNER_FEE_SATS,
): AmountCheck {
  const minSats = SBTC_DUST_SATS + maxSignerFee;
  if (amountSats <= 0) return { ok: false, reason: "not_positive", minSats };
  if (!Number.isInteger(amountSats)) return { ok: false, reason: "non_integer", minSats };
  if (amountSats < minSats) return { ok: false, reason: "below_min", minSats };
  return { ok: true, minSats };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/sbtc-deposit.test.ts`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add src/lib/sbtc-deposit.ts src/lib/sbtc-deposit.test.ts
git commit -m "feat(sbtc): validateDepositAmount with dust + signer-fee floor"
```

---

### Task 3: `buildDepositParams` wrapper

**Files:**
- Modify: `src/lib/sbtc-deposit.ts`
- Test: `src/lib/sbtc-deposit.test.ts`

**Interfaces:**
- Consumes: `makeSbtcClient` (Task 1)
- Produces:
  - `interface DepositInput { stacksAddress: string; reclaimPublicKey: string; maxSignerFee?: number; reclaimLockTime?: number; client?: { fetchSignersPublicKey(): Promise<string> }; network?: SbtcNetwork }`
  - `interface DepositParams { address: string; depositScript: string; reclaimScript: string }`
  - `async function buildDepositParams(input: DepositInput): Promise<DepositParams>`

The `client` field is injectable so the test can pass a fake. In production it defaults to `makeSbtcClient(network)`.

- [ ] **Step 1: Write the failing test**

```ts
// append to src/lib/sbtc-deposit.test.ts
import { buildDepositParams } from "./sbtc-deposit";

describe("buildDepositParams", () => {
  it("builds a deposit address using the signers key", async () => {
    const fakeClient = { fetchSignersPublicKey: async () => "02".padEnd(66, "a") };
    const out = await buildDepositParams({
      stacksAddress: "SP3FGQ8Z7JY9BWYZ5WM53E0M9NK7WHJF0691NZ159",
      reclaimPublicKey: "03".padEnd(66, "b"),
      client: fakeClient,
    });
    expect(out.address).toMatch(/^(bc1|tb1)/);
    expect(typeof out.depositScript).toBe("string");
    expect(typeof out.reclaimScript).toBe("string");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/sbtc-deposit.test.ts -t buildDepositParams`
Expected: FAIL — `buildDepositParams` is not exported.

- [ ] **Step 3: Write minimal implementation**

```ts
// append to src/lib/sbtc-deposit.ts
import { buildSbtcDepositAddress, MAINNET, TESTNET } from "sbtc";

export interface DepositInput {
  stacksAddress: string;
  reclaimPublicKey: string;
  maxSignerFee?: number;
  reclaimLockTime?: number;
  client?: { fetchSignersPublicKey(): Promise<string> };
  network?: SbtcNetwork;
}

export interface DepositParams {
  address: string;
  depositScript: string;
  reclaimScript: string;
}

export async function buildDepositParams(input: DepositInput): Promise<DepositParams> {
  const network = input.network ?? getSbtcNetwork();
  const client = input.client ?? makeSbtcClient(network);
  const signersPublicKey = await client.fetchSignersPublicKey();
  const deposit = buildSbtcDepositAddress({
    stacksAddress: input.stacksAddress,
    signersPublicKey,
    reclaimPublicKey: input.reclaimPublicKey,
    reclaimLockTime: input.reclaimLockTime ?? 950,
    maxSignerFee: input.maxSignerFee ?? DEFAULT_MAX_SIGNER_FEE_SATS,
    network: network === "testnet" ? TESTNET : MAINNET,
  });
  return {
    address: deposit.address,
    depositScript: deposit.depositScript,
    reclaimScript: deposit.reclaimScript,
  };
}
```

> **Risk to confirm:** `buildSbtcDepositAddress` import + `MAINNET`/`TESTNET` constant names, and that the returned object has `.address`, `.depositScript`, `.reclaimScript`. If the test fails on the address regex, log `out` and adjust — do not weaken the assertion away to nothing; assert a real prefix.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/sbtc-deposit.test.ts`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add src/lib/sbtc-deposit.ts src/lib/sbtc-deposit.test.ts
git commit -m "feat(sbtc): buildDepositParams wraps buildSbtcDepositAddress"
```

---

### Task 4: Capture BTC public key on wallet connect

**Files:**
- Modify: `src/lib/wallet.ts`
- Modify: `src/store/walletStore.ts`
- Modify: `src/hooks/useWalletSync.ts`
- Test: `src/lib/wallet.test.ts` (create if absent)

**Interfaces:**
- Produces: `parseWalletAddresses` now returns `{ stxAddress, btcAddress, btcPublicKey }`; `walletStore` exposes `btcPublicKey: string | null`; `connect(stx, btc, btcPublicKey)`.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/wallet.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/wallet.test.ts`
Expected: FAIL — `btcPublicKey` is `undefined`.

- [ ] **Step 3: Implement — `wallet.ts`**

```ts
// src/lib/wallet.ts — update AddressEntry, parseWalletAddresses, connectWallet
interface AddressEntry {
  address: string;
  symbol?: string;
  publicKey?: string;
}

export function parseWalletAddresses(addresses: AddressEntry[]) {
  const stxEntry = addresses.find(
    (a) => a.symbol === "STX" || a.address.startsWith("SP") || a.address.startsWith("ST")
  );
  const btcEntry = addresses.find(
    (a) => a.symbol === "BTC" || (!a.address.startsWith("SP") && !a.address.startsWith("ST"))
  );
  return {
    stxAddress: stxEntry?.address ?? addresses[0]?.address ?? "",
    btcAddress: btcEntry?.address ?? "",
    btcPublicKey: btcEntry?.publicKey ?? "",
  };
}

export async function connectWallet(
  connect: (stxAddress: string, btcAddress: string, btcPublicKey: string) => void
) {
  const result = await stacksConnect();
  const { stxAddress, btcAddress, btcPublicKey } = parseWalletAddresses(result.addresses);
  connect(stxAddress, btcAddress, btcPublicKey);
  track("wallet_connected");
  return { stxAddress, btcAddress, btcPublicKey };
}
```

- [ ] **Step 4: Implement — `walletStore.ts`**

```ts
// add to the store interface + state + connect action
  btcPublicKey: string | null;
  // initial state:
  btcPublicKey: null,
  // connect action signature:
  connect: (stxAddress: string, btcAddress: string, btcPublicKey: string) =>
    set({ isConnected: true, stxAddress, btcAddress, btcPublicKey }),
  // disconnect: add btcPublicKey: null to the reset
```

- [ ] **Step 5: Implement — `useWalletSync.ts`**

```ts
// where it reads parseWalletAddresses, also pass btcPublicKey:
const { stxAddress: newStx, btcAddress: newBtc, btcPublicKey: newPub } =
  parseWalletAddresses(/* ... */);
connect(newStx, newBtc, newPub);
```

- [ ] **Step 6: Run test + typecheck**

Run: `npx vitest run src/lib/wallet.test.ts && npx tsc --noEmit`
Expected: tests PASS; no type errors (all `connect(` call sites updated).

- [ ] **Step 7: Commit**

```bash
git add src/lib/wallet.ts src/lib/wallet.test.ts src/store/walletStore.ts src/hooks/useWalletSync.ts
git commit -m "feat(wallet): capture BTC public key on connect"
```

---

### Task 5: Redis pending-deposit store

**Files:**
- Create: `src/lib/server/sbtc-pending.ts`
- Test: `src/lib/server/sbtc-pending.test.ts`

**Interfaces:**
- Produces:
  - `type DepositStatus = "broadcast" | "notified" | "minted" | "expired"`
  - `interface PendingDeposit { txid: string; stacksAddress: string; amountSats: number; status: DepositStatus; createdAt: number; depositScript: string; reclaimScript: string }`
  - `async function addPending(d: PendingDeposit): Promise<void>` — `hset` into `sbtc:pending:<addr>` keyed by `txid`, set 7-day expiry
  - `async function listForAddress(addr: string): Promise<PendingDeposit[]>`
  - `async function listAllAddresses(): Promise<string[]>` — `scan` keys `sbtc:pending:*`
  - `async function updateStatus(addr: string, txid: string, status: DepositStatus): Promise<void>`
  - `async function removeDeposit(addr: string, txid: string): Promise<void>`

Inject the redis client via a module-level `getRedis()` mirroring `src/lib/push-redis.ts` (returns `null` when env missing — callers no-op).

- [ ] **Step 1: Write the failing test** (in-memory fake redis)

```ts
// src/lib/server/sbtc-pending.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const store = new Map<string, Record<string, string>>();
vi.mock("@upstash/redis", () => ({
  Redis: {
    fromEnv: () => ({
      hset: async (k: string, v: Record<string, string>) => {
        store.set(k, { ...(store.get(k) ?? {}), ...v });
      },
      hgetall: async (k: string) => store.get(k) ?? null,
      hdel: async (k: string, f: string) => { delete store.get(k)?.[f]; },
      expire: async () => 1,
      keys: async (pat: string) =>
        [...store.keys()].filter((k) => k.startsWith(pat.replace("*", ""))),
    }),
  },
}));

beforeEach(() => { store.clear(); process.env.UPSTASH_REDIS_REST_URL = "x"; process.env.UPSTASH_REDIS_REST_TOKEN = "y"; });

import { addPending, listForAddress, updateStatus, listAllAddresses, removeDeposit } from "./sbtc-pending";

const base = {
  txid: "abc", stacksAddress: "SP1", amountSats: 100000,
  status: "broadcast" as const, createdAt: 1, depositScript: "ds", reclaimScript: "rs",
};

describe("sbtc-pending", () => {
  it("adds and lists by address", async () => {
    await addPending(base);
    expect(await listForAddress("SP1")).toEqual([base]);
  });
  it("updates status in place", async () => {
    await addPending(base);
    await updateStatus("SP1", "abc", "notified");
    expect((await listForAddress("SP1"))[0].status).toBe("notified");
  });
  it("lists all addresses with pending deposits", async () => {
    await addPending(base);
    await addPending({ ...base, stacksAddress: "SP2", txid: "def" });
    expect((await listAllAddresses()).sort()).toEqual(["SP1", "SP2"]);
  });
  it("removes a deposit", async () => {
    await addPending(base);
    await removeDeposit("SP1", "abc");
    expect(await listForAddress("SP1")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/server/sbtc-pending.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/server/sbtc-pending.ts
import { Redis } from "@upstash/redis";

export type DepositStatus = "broadcast" | "notified" | "minted" | "expired";

export interface PendingDeposit {
  txid: string;
  stacksAddress: string;
  amountSats: number;
  status: DepositStatus;
  createdAt: number;
  depositScript: string;
  reclaimScript: string;
}

const PREFIX = "sbtc:pending:";
const TTL_SECONDS = 7 * 24 * 60 * 60;

let redis: Redis | null | undefined;
function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
  if (redis !== undefined) return redis;
  try { redis = Redis.fromEnv(); } catch { redis = null; }
  return redis;
}

const keyFor = (addr: string) => `${PREFIX}${addr}`;

export async function addPending(d: PendingDeposit): Promise<void> {
  const r = getRedis(); if (!r) return;
  await r.hset(keyFor(d.stacksAddress), { [d.txid]: JSON.stringify(d) });
  await r.expire(keyFor(d.stacksAddress), TTL_SECONDS);
}

function parse(raw: Record<string, string> | null): PendingDeposit[] {
  if (!raw) return [];
  return Object.values(raw).map((v) => (typeof v === "string" ? JSON.parse(v) : v));
}

export async function listForAddress(addr: string): Promise<PendingDeposit[]> {
  const r = getRedis(); if (!r) return [];
  return parse(await r.hgetall(keyFor(addr)));
}

export async function listAllAddresses(): Promise<string[]> {
  const r = getRedis(); if (!r) return [];
  const keys = await r.keys(`${PREFIX}*`);
  return keys.map((k) => k.slice(PREFIX.length));
}

export async function updateStatus(addr: string, txid: string, status: DepositStatus): Promise<void> {
  const r = getRedis(); if (!r) return;
  const list = await listForAddress(addr);
  const found = list.find((d) => d.txid === txid);
  if (!found) return;
  await r.hset(keyFor(addr), { [txid]: JSON.stringify({ ...found, status }) });
}

export async function removeDeposit(addr: string, txid: string): Promise<void> {
  const r = getRedis(); if (!r) return;
  await r.hdel(keyFor(addr), txid);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/server/sbtc-pending.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/sbtc-pending.ts src/lib/server/sbtc-pending.test.ts
git commit -m "feat(sbtc): redis store for pending deposits"
```

---

### Task 6: Emily status adapter

**Files:**
- Create: `src/lib/server/emily-status.ts`
- Test: `src/lib/server/emily-status.test.ts`

**Interfaces:**
- Produces:
  - `type EmilyDepositStatus = "pending" | "accepted" | "confirmed" | "failed" | "unknown"`
  - `interface EmilyStatusClient { getDepositStatus(txid: string): Promise<EmilyDepositStatus> }`
  - `function makeEmilyStatusClient(baseUrl?: string): EmilyStatusClient` — REST against `SBTC_EMILY_API_URL`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/server/emily-status.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { makeEmilyStatusClient } from "./emily-status";

afterEach(() => vi.restoreAllMocks());

describe("emily-status", () => {
  it("maps confirmed", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ status: "confirmed" }), { status: 200 }));
    expect(await makeEmilyStatusClient("https://e").getDepositStatus("abc")).toBe("confirmed");
  });

  it("maps a 404 to unknown", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(new Response("", { status: 404 }));
    expect(await makeEmilyStatusClient("https://e").getDepositStatus("abc")).toBe("unknown");
  });

  it("maps a network error to unknown", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("boom"));
    expect(await makeEmilyStatusClient("https://e").getDepositStatus("abc")).toBe("unknown");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/server/emily-status.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/server/emily-status.ts
export type EmilyDepositStatus = "pending" | "accepted" | "confirmed" | "failed" | "unknown";

export interface EmilyStatusClient {
  getDepositStatus(txid: string): Promise<EmilyDepositStatus>;
}

const KNOWN: EmilyDepositStatus[] = ["pending", "accepted", "confirmed", "failed"];

export function makeEmilyStatusClient(
  baseUrl: string = process.env.SBTC_EMILY_API_URL ?? "https://sbtc-emily.com",
): EmilyStatusClient {
  return {
    async getDepositStatus(txid: string): Promise<EmilyDepositStatus> {
      try {
        const res = await fetch(`${baseUrl}/deposit/${txid}`, {
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) return "unknown";
        const body = (await res.json()) as { status?: string };
        const s = (body.status ?? "").toLowerCase() as EmilyDepositStatus;
        return KNOWN.includes(s) ? s : "unknown";
      } catch {
        return "unknown";
      }
    },
  };
}
```

> **Risk to confirm:** exact Emily base URL + path shape (`/deposit/{txid}` may require an output index, and the mainnet host may differ). Set `SBTC_EMILY_API_URL` from the verified value; the test stays valid because it injects `baseUrl` and mocks `fetch`. Adjust the path string here once verified.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/server/emily-status.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/emily-status.ts src/lib/server/emily-status.test.ts
git commit -m "feat(sbtc): Emily deposit-status adapter"
```

---

### Task 7: Reconcile state machine (pure)

**Files:**
- Create: `src/lib/server/sbtc-reconcile.ts`
- Test: `src/lib/server/sbtc-reconcile.test.ts`

**Interfaces:**
- Consumes: `PendingDeposit`, `DepositStatus` (Task 5); `EmilyDepositStatus` (Task 6)
- Produces:
  - `type ReconcileAction = "notify" | "mark_minted" | "expire" | "none"`
  - `function decideNext(d: PendingDeposit, opts: { inMempool: boolean; emily: EmilyDepositStatus; now: number }): ReconcileAction`

Rules:
- `broadcast` + `inMempool` → `notify`
- `notified` + emily `confirmed` → `mark_minted`
- any status, `createdAt` older than 14 days → `expire`
- otherwise → `none`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/server/sbtc-reconcile.test.ts
import { describe, it, expect } from "vitest";
import { decideNext } from "./sbtc-reconcile";
import type { PendingDeposit } from "./sbtc-pending";

const d = (over: Partial<PendingDeposit>): PendingDeposit => ({
  txid: "t", stacksAddress: "SP1", amountSats: 100000, status: "broadcast",
  createdAt: 1_000, depositScript: "", reclaimScript: "", ...over,
});

describe("decideNext", () => {
  it("notifies once a broadcast tx is in the mempool", () => {
    expect(decideNext(d({ status: "broadcast" }), { inMempool: true, emily: "unknown", now: 2000 })).toBe("notify");
  });
  it("waits while a broadcast tx is not yet in the mempool", () => {
    expect(decideNext(d({ status: "broadcast" }), { inMempool: false, emily: "unknown", now: 2000 })).toBe("none");
  });
  it("marks minted when Emily confirms a notified deposit", () => {
    expect(decideNext(d({ status: "notified" }), { inMempool: true, emily: "confirmed", now: 2000 })).toBe("mark_minted");
  });
  it("keeps waiting while Emily is still pending", () => {
    expect(decideNext(d({ status: "notified" }), { inMempool: true, emily: "pending", now: 2000 })).toBe("none");
  });
  it("expires anything older than 14 days", () => {
    const old = 1_000;
    const now = old + 15 * 24 * 3600 * 1000;
    expect(decideNext(d({ status: "notified", createdAt: old }), { inMempool: true, emily: "pending", now })).toBe("expire");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/server/sbtc-reconcile.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/server/sbtc-reconcile.ts
import type { PendingDeposit } from "./sbtc-pending";
import type { EmilyDepositStatus } from "./emily-status";

export type ReconcileAction = "notify" | "mark_minted" | "expire" | "none";

const MAX_AGE_MS = 14 * 24 * 3600 * 1000;

export function decideNext(
  d: PendingDeposit,
  opts: { inMempool: boolean; emily: EmilyDepositStatus; now: number },
): ReconcileAction {
  if (opts.now - d.createdAt > MAX_AGE_MS) return "expire";
  if (d.status === "broadcast" && opts.inMempool) return "notify";
  if (d.status === "notified" && opts.emily === "confirmed") return "mark_minted";
  return "none";
}
```

> Note `createdAt` is stored in ms (set via `Date.now()` at persist time — Task 9). The 14-day test encodes that. Keep units consistent.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/server/sbtc-reconcile.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/sbtc-reconcile.ts src/lib/server/sbtc-reconcile.test.ts
git commit -m "feat(sbtc): pure reconcile state machine"
```

---

### Task 8: Server-side push sender

**Files:**
- Create: `src/lib/server/push-send.ts`
- Test: `src/lib/server/push-send.test.ts`
- Modify: `package.json` (add `web-push`, `@types/web-push`)

**Interfaces:**
- Consumes: `getSub` from `src/lib/push-redis.ts`
- Produces: `async function sendPushToAddress(addr: string, payload: { title: string; body: string; url?: string }): Promise<boolean>` — returns `true` if a notification was dispatched.

- [ ] **Step 1: Install dependency**

```bash
npm install web-push && npm install -D @types/web-push
```

- [ ] **Step 2: Write the failing test**

```ts
// src/lib/server/push-send.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const sendNotification = vi.fn().mockResolvedValue(undefined);
vi.mock("web-push", () => ({ default: { setVapidDetails: vi.fn(), sendNotification } }));
const getSub = vi.fn();
vi.mock("../push-redis", () => ({ getSub }));

beforeEach(() => {
  vi.clearAllMocks();
  process.env.VAPID_SUBJECT = "mailto:a@b.c";
  process.env.VAPID_PUBLIC_KEY = "pub";
  process.env.VAPID_PRIVATE_KEY = "priv";
});

import { sendPushToAddress } from "./push-send";

describe("sendPushToAddress", () => {
  it("sends when a subscription exists", async () => {
    getSub.mockResolvedValue({ subscription: { endpoint: "e", keys: { auth: "a", p256dh: "p" } } });
    const ok = await sendPushToAddress("SP1", { title: "t", body: "b" });
    expect(ok).toBe(true);
    expect(sendNotification).toHaveBeenCalledOnce();
  });
  it("no-ops when no subscription", async () => {
    getSub.mockResolvedValue(null);
    expect(await sendPushToAddress("SP1", { title: "t", body: "b" })).toBe(false);
    expect(sendNotification).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/server/push-send.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Write minimal implementation**

```ts
// src/lib/server/push-send.ts
import webpush from "web-push";
import { getSub } from "../push-redis";

let configured = false;
function ensureVapid(): boolean {
  if (configured) return true;
  const { VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
  if (!VAPID_SUBJECT || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  configured = true;
  return true;
}

export async function sendPushToAddress(
  addr: string,
  payload: { title: string; body: string; url?: string },
): Promise<boolean> {
  if (!ensureVapid()) return false;
  const sub = await getSub(addr);
  if (!sub?.subscription?.endpoint) return false;
  try {
    await webpush.sendNotification(sub.subscription, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}
```

> **Note:** `getSub` must be exported from `src/lib/push-redis.ts` — it already is (line 51). Confirm the SubEntry shape matches `{ subscription: { endpoint, keys } }`.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/server/push-send.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/lib/server/push-send.ts src/lib/server/push-send.test.ts
git commit -m "feat(sbtc): server-side web push sender"
```

---

### Task 9: `POST /api/sbtc/deposit` — persist a broadcast deposit

**Files:**
- Create: `src/app/api/sbtc/deposit/route.ts`
- Test: `src/app/api/sbtc/deposit/route.test.ts`

**Interfaces:**
- Consumes: `addPending` (Task 5)
- Produces: `POST` accepting `{ txid, stacksAddress, amountSats, depositScript, reclaimScript }`, returns `{ ok: true }` (201) or `{ error }` (400).

- [ ] **Step 1: Write the failing test**

```ts
// src/app/api/sbtc/deposit/route.test.ts
import { describe, it, expect, vi } from "vitest";
const addPending = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/server/sbtc-pending", () => ({ addPending }));
import { POST } from "./route";

function req(body: unknown) {
  return new Request("http://x/api/sbtc/deposit", { method: "POST", body: JSON.stringify(body) });
}

describe("POST /api/sbtc/deposit", () => {
  it("persists a valid deposit", async () => {
    const res = await POST(req({ txid: "a", stacksAddress: "SP1", amountSats: 100000, depositScript: "d", reclaimScript: "r" }));
    expect(res.status).toBe(201);
    expect(addPending).toHaveBeenCalledOnce();
    expect(addPending.mock.calls[0][0]).toMatchObject({ txid: "a", status: "broadcast" });
  });
  it("rejects a missing txid", async () => {
    const res = await POST(req({ stacksAddress: "SP1", amountSats: 100000 }));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/sbtc/deposit/route.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/app/api/sbtc/deposit/route.ts
import { NextResponse } from "next/server";
import { addPending } from "@/lib/server/sbtc-pending";

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }

  const { txid, stacksAddress, amountSats, depositScript, reclaimScript } = body as Record<string, string | number>;
  if (typeof txid !== "string" || !txid) return NextResponse.json({ error: "txid required" }, { status: 400 });
  if (typeof stacksAddress !== "string" || !stacksAddress) return NextResponse.json({ error: "stacksAddress required" }, { status: 400 });
  if (typeof amountSats !== "number" || !Number.isInteger(amountSats) || amountSats <= 0)
    return NextResponse.json({ error: "amountSats invalid" }, { status: 400 });

  await addPending({
    txid, stacksAddress, amountSats,
    depositScript: String(depositScript ?? ""),
    reclaimScript: String(reclaimScript ?? ""),
    status: "broadcast",
    createdAt: Date.now(),
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/api/sbtc/deposit/route.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/sbtc/deposit/route.ts src/app/api/sbtc/deposit/route.test.ts
git commit -m "feat(sbtc): POST /api/sbtc/deposit persists broadcast deposits"
```

---

### Task 10: `GET /api/sbtc/deposits?address=` — read deposits

**Files:**
- Create: `src/app/api/sbtc/deposits/route.ts`
- Test: `src/app/api/sbtc/deposits/route.test.ts`

**Interfaces:**
- Consumes: `listForAddress` (Task 5)
- Produces: `GET` returning `{ deposits: PendingDeposit[] }`; 400 if `address` missing.

- [ ] **Step 1: Write the failing test**

```ts
// src/app/api/sbtc/deposits/route.test.ts
import { describe, it, expect, vi } from "vitest";
const listForAddress = vi.fn().mockResolvedValue([{ txid: "a" }]);
vi.mock("@/lib/server/sbtc-pending", () => ({ listForAddress }));
import { GET } from "./route";

describe("GET /api/sbtc/deposits", () => {
  it("returns deposits for an address", async () => {
    const res = await GET(new Request("http://x/api/sbtc/deposits?address=SP1"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deposits: [{ txid: "a" }] });
  });
  it("400s without address", async () => {
    const res = await GET(new Request("http://x/api/sbtc/deposits"));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/sbtc/deposits/route.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/app/api/sbtc/deposits/route.ts
import { NextResponse } from "next/server";
import { listForAddress } from "@/lib/server/sbtc-pending";

export async function GET(req: Request) {
  const address = new URL(req.url).searchParams.get("address");
  if (!address) return NextResponse.json({ error: "address required" }, { status: 400 });
  const deposits = await listForAddress(address);
  return NextResponse.json({ deposits });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/api/sbtc/deposits/route.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/sbtc/deposits/route.ts src/app/api/sbtc/deposits/route.test.ts
git commit -m "feat(sbtc): GET /api/sbtc/deposits reads a user's deposits"
```

---

### Task 11: `GET /api/cron/sbtc-reconcile` — reconcile loop

**Files:**
- Create: `src/app/api/cron/sbtc-reconcile/route.ts`
- Test: `src/app/api/cron/sbtc-reconcile/route.test.ts`

**Interfaces:**
- Consumes: `listAllAddresses`, `listForAddress`, `updateStatus`, `removeDeposit` (Task 5); `decideNext` (Task 7); `makeEmilyStatusClient` (Task 6); `makeSbtcClient` (Task 1); `sendPushToAddress` (Task 8).
- Produces: `GET` guarded by `Authorization: Bearer <CRON_SECRET>`; returns `{ processed, notified, minted, expired }`.

Behaviour per deposit:
- `notify` → `client.fetchTxHex(txid)` then `client.notifySbtc({ transaction, depositScript, reclaimScript })`; on success `updateStatus(..., "notified")`.
- `mark_minted` → `sendPushToAddress(...)`, then `POST` semantics: bust portfolio cache by calling the existing invalidate endpoint, `removeDeposit`.
- `expire` → `removeDeposit`.

For testability, the route body delegates to an exported `runReconcile(deps)` taking injected collaborators; the `GET` wires real deps.

- [ ] **Step 1: Write the failing test**

```ts
// src/app/api/cron/sbtc-reconcile/route.test.ts
import { describe, it, expect, vi } from "vitest";
import { runReconcile } from "./route";

describe("runReconcile", () => {
  it("notifies a mempool-confirmed broadcast and marks minted on Emily confirm", async () => {
    const deposits = [
      { txid: "a", stacksAddress: "SP1", amountSats: 1, status: "broadcast", createdAt: Date.now(), depositScript: "d", reclaimScript: "r" },
      { txid: "b", stacksAddress: "SP2", amountSats: 1, status: "notified", createdAt: Date.now(), depositScript: "d", reclaimScript: "r" },
    ];
    const updateStatus = vi.fn(); const removeDeposit = vi.fn(); const sendPush = vi.fn().mockResolvedValue(true);
    const notifySbtc = vi.fn().mockResolvedValue({});
    const out = await runReconcile({
      listAllAddresses: async () => ["SP1", "SP2"],
      listForAddress: async (a: string) => deposits.filter((d) => d.stacksAddress === a),
      updateStatus, removeDeposit, sendPush,
      sbtcClient: { fetchTxHex: async () => "hex", notifySbtc },
      emily: { getDepositStatus: async (txid: string) => (txid === "b" ? "confirmed" : "unknown") },
      inMempool: async () => true,
      invalidatePortfolio: vi.fn(),
      now: Date.now(),
    });
    expect(notifySbtc).toHaveBeenCalledOnce();
    expect(updateStatus).toHaveBeenCalledWith("SP1", "a", "notified");
    expect(sendPush).toHaveBeenCalledOnce();
    expect(removeDeposit).toHaveBeenCalledWith("SP2", "b");
    expect(out).toMatchObject({ notified: 1, minted: 1 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/cron/sbtc-reconcile/route.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/app/api/cron/sbtc-reconcile/route.ts
import { NextResponse } from "next/server";
import {
  listAllAddresses, listForAddress, updateStatus, removeDeposit, type PendingDeposit,
} from "@/lib/server/sbtc-pending";
import { decideNext } from "@/lib/server/sbtc-reconcile";
import { makeEmilyStatusClient } from "@/lib/server/emily-status";
import { makeSbtcClient } from "@/lib/sbtc-deposit";
import { sendPushToAddress } from "@/lib/server/push-send";

interface Deps {
  listAllAddresses: () => Promise<string[]>;
  listForAddress: (a: string) => Promise<PendingDeposit[]>;
  updateStatus: (a: string, txid: string, s: PendingDeposit["status"]) => Promise<void> | void;
  removeDeposit: (a: string, txid: string) => Promise<void> | void;
  sendPush: (addr: string, p: { title: string; body: string; url?: string }) => Promise<boolean>;
  sbtcClient: { fetchTxHex: (txid: string) => Promise<string>; notifySbtc: (arg: unknown) => Promise<unknown> };
  emily: { getDepositStatus: (txid: string) => Promise<string> };
  inMempool: (txid: string) => Promise<boolean>;
  invalidatePortfolio: (addr: string) => Promise<void> | void;
  now: number;
}

export async function runReconcile(d: Deps) {
  let processed = 0, notified = 0, minted = 0, expired = 0;
  const addresses = await d.listAllAddresses();
  for (const addr of addresses) {
    for (const dep of await d.listForAddress(addr)) {
      processed++;
      const action = decideNext(dep, {
        inMempool: await d.inMempool(dep.txid),
        emily: (await d.emily.getDepositStatus(dep.txid)) as never,
        now: d.now,
      });
      if (action === "notify") {
        const transaction = await d.sbtcClient.fetchTxHex(dep.txid);
        await d.sbtcClient.notifySbtc({ transaction, depositScript: dep.depositScript, reclaimScript: dep.reclaimScript });
        await d.updateStatus(addr, dep.txid, "notified");
        notified++;
      } else if (action === "mark_minted") {
        await d.sendPush(addr, { title: "sBTC received ✓", body: "Your BTC deposit has been minted to sBTC.", url: "/assets" });
        await d.invalidatePortfolio(addr);
        await d.removeDeposit(addr, dep.txid);
        minted++;
      } else if (action === "expire") {
        await d.removeDeposit(addr, dep.txid);
        expired++;
      }
    }
  }
  return { processed, notified, minted, expired };
}

async function inMempoolReal(txid: string): Promise<boolean> {
  // Bitcoin mempool check via mempool.space (network-appropriate base).
  const base = process.env.SBTC_MEMPOOL_API_URL ?? "https://mempool.space/api";
  try {
    const res = await fetch(`${base}/tx/${txid}`, { signal: AbortSignal.timeout(10_000) });
    return res.ok;
  } catch { return false; }
}

async function invalidatePortfolioReal(addr: string): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  try {
    await fetch(`${url}/api/portfolio/invalidate`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address: addr }),
    });
  } catch { /* best-effort */ }
}

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const client = makeSbtcClient();
  const result = await runReconcile({
    listAllAddresses, listForAddress, updateStatus, removeDeposit,
    sendPush: sendPushToAddress,
    sbtcClient: client as never,
    emily: makeEmilyStatusClient(),
    inMempool: inMempoolReal,
    invalidatePortfolio: invalidatePortfolioReal,
    now: Date.now(),
  });
  return NextResponse.json(result);
}
```

> **Note on the Redis lock:** the spec calls for a keeper-style `sbtc-reconcile:run-lock`. Because Upstash `SET NX EX` isn't shown here, fold it in as a guard at the top of `GET` only after the happy path is green — add a follow-up commit. Do not block this task's green bar on it; the reconcile is idempotent (re-`notify` of an already-notified deposit is prevented by the `broadcast`-only guard in `decideNext`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/api/cron/sbtc-reconcile/route.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cron/sbtc-reconcile/route.ts src/app/api/cron/sbtc-reconcile/route.test.ts
git commit -m "feat(sbtc): reconcile cron route (notify, mint-push, expire)"
```

- [ ] **Step 6: Add the Redis run-lock (separate commit)**

Add a `SET sbtc-reconcile:run-lock NX EX 120` guard at the top of `GET` (mirroring `keeper-bot:run-lock`); skip the run if the lock is held. Commit:

```bash
git commit -am "feat(sbtc): redis run-lock for reconcile cron"
```

---

### Task 12: `useSbtcDeposits` SWR hook

**Files:**
- Create: `src/hooks/useSbtcDeposits.ts`

**Interfaces:**
- Consumes: `GET /api/sbtc/deposits` (Task 10)
- Produces: `function useSbtcDeposits(address?: string): { deposits: PendingDeposit[]; isLoading: boolean }` — SWR, `refreshInterval: 30_000`, paused when no address.

- [ ] **Step 1: Implement** (follow the existing SWR hook pattern in `src/hooks/`)

```ts
// src/hooks/useSbtcDeposits.ts
import useSWR from "swr";
import type { PendingDeposit } from "@/lib/server/sbtc-pending";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useSbtcDeposits(address?: string) {
  const { data, isLoading } = useSWR<{ deposits: PendingDeposit[] }>(
    address ? `/api/sbtc/deposits?address=${address}` : null,
    fetcher,
    { refreshInterval: 30_000 },
  );
  return { deposits: data?.deposits ?? [], isLoading };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useSbtcDeposits.ts
git commit -m "feat(sbtc): useSbtcDeposits SWR hook for live tracking"
```

---

### Task 13: `GetSbtcModal` component + EN i18n

**Files:**
- Create: `src/components/sbtc/GetSbtcModal.tsx`
- Create: `src/i18n/messages/en/sbtc.json`
- Modify: i18n namespace registration (follow the existing per-namespace loading pattern)

**Interfaces:**
- Consumes: `buildDepositParams`, `validateDepositAmount`, `getSbtcNetwork` (Tasks 1-3); `useWalletStore` (`stxAddress`, `btcPublicKey`); `useSbtcDeposits` (Task 12); `request` from `@stacks/connect`.
- Produces: `export default function GetSbtcModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void })`.

UX is three steps in one Radix Dialog (the project standardised wallet modals on Radix Dialog):
1. **Amount** — sats input; live `validateDepositAmount`; show "you receive ≈" after signer fee.
2. **Review** — deposit address (built on entering this step), amount, signer fee, ETA copy ("~30+ min, 3 BTC confirmations").
3. **Sign & track** — call `request('sendTransfer')`; on `txid`, `POST /api/sbtc/deposit`; then show tracking list from `useSbtcDeposits`.

- [ ] **Step 1: Create EN i18n keys**

```json
// src/i18n/messages/en/sbtc.json
{
  "modalTitle": "Get sBTC",
  "stepAmount": "Amount",
  "stepReview": "Review",
  "stepTrack": "Track",
  "amountLabel": "Amount to deposit (sats)",
  "youReceive": "You receive ≈",
  "signerFee": "Signer fee",
  "belowMin": "Minimum is {min} sats (dust + signer fee).",
  "depositAddress": "Send BTC to",
  "eta": "Minting takes ~30+ min (3 Bitcoin confirmations).",
  "sign": "Sign & send BTC",
  "broadcasting": "Broadcasting…",
  "tracking": "Tracking your deposit",
  "statusBroadcast": "Broadcast — waiting for the mempool",
  "statusNotified": "Notified signers — awaiting mint",
  "statusMinted": "Minted ✓",
  "noWallet": "Connect a BTC-capable wallet (Leather or Xverse) to deposit.",
  "unsupported": "Your wallet can't send BTC here. Use the bridge instead.",
  "close": "Close"
}
```

- [ ] **Step 2: Implement the component**

```tsx
// src/components/sbtc/GetSbtcModal.tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { request } from "@stacks/connect";
import { useWalletStore } from "@/store/walletStore";
import {
  buildDepositParams, validateDepositAmount, DEFAULT_MAX_SIGNER_FEE_SATS,
} from "@/lib/sbtc-deposit";
import { useSbtcDeposits } from "@/hooks/useSbtcDeposits";

type Step = "amount" | "review" | "track";

export default function GetSbtcModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const t = useTranslations("sbtc");
  const { stxAddress, btcPublicKey } = useWalletStore();
  const [step, setStep] = useState<Step>("amount");
  const [amount, setAmount] = useState<number>(0);
  const [deposit, setDeposit] = useState<{ address: string; depositScript: string; reclaimScript: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const { deposits } = useSbtcDeposits(stxAddress ?? undefined);

  const check = validateDepositAmount(amount);

  async function goReview() {
    if (!stxAddress || !btcPublicKey) return;
    const d = await buildDepositParams({ stacksAddress: stxAddress, reclaimPublicKey: btcPublicKey });
    setDeposit(d);
    setStep("review");
  }

  async function signAndSend() {
    if (!deposit) return;
    setBusy(true);
    try {
      const res = await request("sendTransfer", { recipients: [{ address: deposit.address, amount: amount }] }) as { txid: string };
      await fetch("/api/sbtc/deposit", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ txid: res.txid, stacksAddress: stxAddress, amountSats: amount, depositScript: deposit.depositScript, reclaimScript: deposit.reclaimScript }),
      });
      setStep("track");
    } finally { setBusy(false); }
  }

  if (!open) return null;

  return (
    // Use the project's Radix Dialog wrapper (same as wallet modals). Structure:
    // <Dialog open={open} onOpenChange={onOpenChange}> ... </Dialog>
    <div role="dialog" aria-label={t("modalTitle")}>
      {!stxAddress ? (
        <p>{t("noWallet")}</p>
      ) : step === "amount" ? (
        <div>
          <label>{t("amountLabel")}
            <input type="number" value={amount || ""} onChange={(e) => setAmount(Math.floor(Number(e.target.value)))} />
          </label>
          {!check.ok && check.reason === "below_min" && <p>{t("belowMin", { min: check.minSats })}</p>}
          <p>{t("signerFee")}: {DEFAULT_MAX_SIGNER_FEE_SATS}</p>
          <p>{t("youReceive")} {Math.max(0, amount - DEFAULT_MAX_SIGNER_FEE_SATS)} sats</p>
          <button disabled={!check.ok} onClick={goReview}>{t("stepReview")}</button>
        </div>
      ) : step === "review" ? (
        <div>
          <p>{t("depositAddress")}: <code>{deposit?.address}</code></p>
          <p>{t("eta")}</p>
          <button disabled={busy} onClick={signAndSend}>{busy ? t("broadcasting") : t("sign")}</button>
        </div>
      ) : (
        <div>
          <h3>{t("tracking")}</h3>
          {deposits.map((d) => (
            <p key={d.txid}>
              {d.amountSats} sats — {d.status === "broadcast" ? t("statusBroadcast") : d.status === "notified" ? t("statusNotified") : t("statusMinted")}
            </p>
          ))}
          <button onClick={() => onOpenChange(false)}>{t("close")}</button>
        </div>
      )}
    </div>
  );
}
```

> Replace the placeholder `<div role="dialog">` shell with the project's actual Radix Dialog wrapper component used by the existing wallet modals (match its props and styling). The step logic and data wiring above are the substance; the chrome must match house style.

> **Risk to confirm:** the return shape of `request('sendTransfer')` in `@stacks/connect@8.2.5` (`{ txid }` vs `{ result: { txid } }`). Log it during the testnet smoke and adjust the cast.

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/sbtc/GetSbtcModal.tsx src/i18n/messages/en/sbtc.json
git commit -m "feat(sbtc): GetSbtcModal 3-step deposit flow + EN strings"
```

---

### Task 14: Mirror i18n to the other 6 locales

**Files:**
- Create: `src/i18n/messages/{vi,zh,ja,ko,es,pt}/sbtc.json`

- [ ] **Step 1: Translate** each key from Task 13's EN file into vi, zh, ja, ko, es, pt — same key set, locale-appropriate copy (pt uses decimal comma where numbers are formatted; keep `{min}` placeholder intact in every locale).

- [ ] **Step 2: Run the i18n parity test** (the repo has a namespace parity test)

Run: `npx vitest run -t "i18n"` (or the project's parity test path)
Expected: PASS — all 7 locales have identical key sets for `sbtc`.

- [ ] **Step 3: Commit**

```bash
git add src/i18n/messages/*/sbtc.json
git commit -m "feat(sbtc): i18n keys for Get sBTC modal (6 locales)"
```

---

### Task 15: Wire the modal into entry points

**Files:**
- Modify: `src/components/assets/SBTCMonitor.tsx` (replace the `app.stacks.co` out-link, lines 299-313, with a button that opens `GetSbtcModal`)

**Interfaces:**
- Consumes: `GetSbtcModal` (Task 13)

- [ ] **Step 1: Implement** — add modal state and replace the out-link

```tsx
// in SBTCMonitor.tsx
import { useState } from "react";
import GetSbtcModal from "@/components/sbtc/GetSbtcModal";

// inside component:
const [getOpen, setGetOpen] = useState(false);

// replace the noSbtc out-link block with:
{data.balance === 0 && (
  <div className="text-center py-2">
    <button
      onClick={() => setGetOpen(true)}
      className="text-[#408A71] hover:underline text-xs font-medium"
    >
      {t("noSbtcText")} {t("bridgeLink")}
    </button>
  </div>
)}

// near the end of the returned tree:
<GetSbtcModal open={getOpen} onOpenChange={setGetOpen} />
```

- [ ] **Step 2: Manual smoke (mock wallet)** — open `/assets`, confirm the button opens the modal; the amount step validates the minimum.

Run: `npm run dev` and click through. (Clear stale test-profile localStorage first if the mock wallet misbehaves.)

- [ ] **Step 3: Typecheck + lint + commit**

```bash
npx tsc --noEmit && npm run lint
git add src/components/assets/SBTCMonitor.tsx
git commit -m "feat(sbtc): open Get sBTC modal from SBTCMonitor (replaces out-link)"
```

> A `/trade` "Get sBTC" button and the DCA/earn nudge reuse the same `<GetSbtcModal>` and can be added in a follow-up commit using the identical 3 lines (state + button + modal). Not required for MVP green.

---

### Task 16: E2E test (mock wallet, no real broadcast)

**Files:**
- Create: `e2e/sbtc-deposit.spec.ts`

- [ ] **Step 1: Write the test** — using the mock wallet fixture in `e2e/fixtures/test-utils.ts`

```ts
// e2e/sbtc-deposit.spec.ts
import { test, expect } from "./fixtures/test-utils";

test("Get sBTC modal validates the minimum and reaches review", async ({ page, connectMockWallet }) => {
  await connectMockWallet(page);
  await page.goto("/assets");
  await page.getByRole("button", { name: /get sbtc|bridge/i }).first().click();
  const dialog = page.getByRole("dialog", { name: /get sbtc/i });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel(/amount/i).fill("100");          // below min
  await expect(dialog.getByText(/minimum is/i)).toBeVisible();
  await dialog.getByLabel(/amount/i).fill("100000");        // above min
  // Review button enabled
  await expect(dialog.getByRole("button", { name: /review/i })).toBeEnabled();
});
```

- [ ] **Step 2: Run the test**

Run: `npx playwright test e2e/sbtc-deposit.spec.ts --project=chromium`
Expected: PASS. (If the mock wallet fixture lacks `btcPublicKey`, extend the fixture to provide one — same place STX/BTC addresses are mocked.)

- [ ] **Step 3: Commit**

```bash
git add e2e/sbtc-deposit.spec.ts e2e/fixtures/test-utils.ts
git commit -m "test(sbtc): e2e for Get sBTC modal validation + review"
```

---

### Task 17: Full gate + testnet smoke

- [ ] **Step 1: Run the full unit suite**

Run: `npm test`
Expected: all green (existing + new sBTC tests).

- [ ] **Step 2: Build + lint**

Run: `npm run build && npm run lint`
Expected: clean.

- [ ] **Step 3: Document env vars** — append to `.env.local` example / CLAUDE.md env section:
  - `SBTC_NETWORK=testnet` (then `mainnet` for prod)
  - `SBTC_EMILY_API_URL` (verified Emily base)
  - `SBTC_MEMPOOL_API_URL` (optional override)
  - `CRON_SECRET` (reconcile auth)

- [ ] **Step 4: Testnet smoke** — set `SBTC_NETWORK=testnet`, deposit a small testnet BTC amount through the modal end-to-end; manually `curl` the reconcile route with the `CRON_SECRET` and confirm `notified` → `minted` transitions + push.

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/sbtc-reconcile
```

- [ ] **Step 5: Commit docs**

```bash
git add CLAUDE.md
git commit -m "docs(sbtc): env vars + testnet smoke for deposit on-ramp"
```

- [ ] **Step 6: Mainnet smoke (user-driven, real BTC)** — flip `SBTC_NETWORK=mainnet`, do one small real deposit, confirm mint + push. This is the project's standard "mainnet smoke pending" gate; record the txid.

---

## Self-Review

**Spec coverage:**
- Native non-custodial deposit → Tasks 1-3, 13 (`request('sendTransfer')`). ✓
- Server-side `notifySbtc` → Task 11. ✓
- Redis persistence + statuses → Task 5. ✓
- Cron reconcile + push + portfolio invalidate → Tasks 8, 11. ✓
- BTC pubkey capture (`reclaimPublicKey`) → Task 4. ✓
- Min-deposit/fee validation → Task 2, surfaced in Task 13. ✓
- Entry point replacing out-link → Task 15. ✓
- Testnet-first then mainnet smoke → Task 17. ✓
- 7-locale i18n → Tasks 13-14. ✓
- E2E mock-wallet → Task 16. ✓
- Wallet-lacks-sendTransfer fallback → Task 13 (`unsupported` string; detection refined during smoke). ✓

**Out of scope (per spec):** withdrawal, auto-reclaim, fiat on-ramp — none planned. ✓

**Open risks carried as inline notes (verify during implementation, not blockers to planning):**
1. `sbtc` exact exports (`SbtcApiClientTestnet`, `TESTNET`, `buildSbtcDepositAddress` return shape) — Tasks 1, 3.
2. Emily base URL + deposit-status path — Task 6.
3. `request('sendTransfer')` return shape across Leather/Xverse — Task 13.
4. Mock wallet fixture may need a `btcPublicKey` field — Task 16.

**Type consistency:** `PendingDeposit`/`DepositStatus` defined in Task 5 and consumed unchanged in Tasks 6, 7, 9-12; `DepositParams` from Task 3 consumed in Task 13; `decideNext` signature consistent between Tasks 7 and 11.
