# Reverse Routes + USDCx Exit — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every directed pair across STX / sBTC / USDCx a real user swap on the Trade tab — fixing the broken `router`-method user swaps and adding the missing USDCx-exit and STX↔USDCx routes.

**Architecture:** Phase 0 re-wires the single-pool `STX→sBTC` route to a direct `xyk-core` call (no deploy). Phase 1 deploys one new `stacksport-swap-router` contract whose 4 functions pull the input token from `tx-sender`, run the Bitflow hops via `as-contract`, and forward the output to the recipient. Phase 2 wires those into the data-driven `ROUTE_TABLE` plus the USDCx post-condition branch.

**Tech Stack:** Next.js / TypeScript, `@stacks/transactions`, Clarity 3 (`clarinet`), Vitest.

## Global Constraints

- StacksPort contract address (deployer): `SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV`
- Bitflow core/pool/token principals live on `SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR` (cores, pools, wSTX), `SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token`, `SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-aeusdc`, `SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx`.
- Pool token ordering (x, y): `xyk-pool-sbtc-stx-v-1-1` = (sBTC, wSTX); `xyk-pool-stx-aeusdc-v-1-2` = (wSTX, aeUSDC); `stableswap-pool-aeusdc-usdcx-v-1-1` = (aeUSDC, USDCx).
- FT asset names (for post-conditions): sBTC = `sbtc-token`, USDCx = `usdcx-token`, aeUSDC = `aeUSDC`.
- `token-stx-v-1-2` is a native-STX SIP-010 façade (`get-balance` = `stx-get-balance`, `transfer` = `stx-transfer?`) — "wSTX" output is native STX; forward with `stx-transfer?`.
- All Clarity contracts: `clarity_version = 3`, `epoch = '3.3'`.
- Post-conditions always `PostConditionMode.Deny` with an exact `willSendEq` on the input token.
- Git: commit directly on `main`, no feature branch, fine-grained commits each green, **no `Co-Authored-By` trailer**.
- Verify every on-chain id against Hiro before relying on it; never guess.

---

## File Structure

- `src/lib/domain/swap/routes.ts` — `ROUTE_TABLE`; Phase-0 edit + 4 new `RouteSpec` entries.
- `src/lib/domain/swap/contracts.ts` — add `ROUTER_STACKSPORT` principal.
- `src/lib/domain/swap/clarity.ts` — add `usdcx` branch to `senderSpendPostCondition`.
- `src/lib/direct-swap.test.ts` — update STX→sBTC characterization; add new-route characterization + post-condition cases.
- `contracts/stacksport-swap-router.clar` — new user-callable multi-hop router (4 fns).
- `contracts/Clarinet.toml` — register the new contract.
- `contracts/deployments/default.mainnet-plan.yaml` — hand-trimmed single-contract deploy plan.

---

## Task 1: Phase 0 — re-wire STX→sBTC to a direct single-pool swap

**Files:**
- Modify: `src/lib/domain/swap/routes.ts` (the `stx → sbtc` entry in `ROUTE_TABLE`)
- Test: `src/lib/direct-swap.test.ts`

**Interfaces:**
- Consumes: `XYK_CORE`, `XYK_CORE_ADDRESS`, `XYK_CORE_NAME`, `POOL_SBTC_STX`, `SBTC`, `WSTX` from `contracts.ts`.
- Produces: `ROUTE_TABLE` entry `stx→sbtc` with `method: "direct"`, `exec.fn: "swap-y-for-x"`.

- [ ] **Step 1: Update the STX→sBTC characterization test to the direct wiring (failing first)**

In `src/lib/direct-swap.test.ts`, replace the `it("STX → sBTC: bitflow-sbtc-swap-router.swap-stx-for-token", …)` block with:

```ts
  // Phase 0 fix: STX→sBTC is a single pool (xyk-pool-sbtc-stx) and never
  // needed a router. Re-pointed from the DCA router (which can't pull user
  // funds) to a direct xyk-core swap-y-for-x. This intentionally changes the
  // signed call — see spec 2026-06-20-reverse-routes-usdcx-exit-design.md.
  it("STX → sBTC: xyk-core.swap-y-for-x (direct, pool+token args)", () => {
    const p = buildSwapParams("stx", "sbtc", 1, MIN_OUT, SENDER);
    expect(p.contractAddress).toBe(XYK_CORE_ADDR);
    expect(p.contractName).toBe(XYK_CORE);
    expect(p.functionName).toBe("swap-y-for-x");
    expect(ser(p.functionArgs)).toEqual(
      ser([
        contractPrincipalCV(POOL_SBTC_STX_ADDR, POOL_SBTC_STX_NAME),
        contractPrincipalCV(SBTC_ADDR, "sbtc-token"),
        contractPrincipalCV(WSTX_ADDR, "token-stx-v-1-2"),
        uintCV(1_000_000n),
        uintCV(MIN_OUT),
      ])
    );
    expect(p.postConditionMode).toBe(PostConditionMode.Deny);
  });
```

The STX→sBTC post-condition test (`"STX → sBTC: Deny mode + exact uSTX outgoing post-condition from sender"`) stays unchanged — STX is still the input.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/direct-swap.test.ts -t "STX → sBTC: xyk-core"`
Expected: FAIL — current `functionName` is `swap-stx-for-token`, not `swap-y-for-x`.

- [ ] **Step 3: Re-wire the ROUTE_TABLE entry**

In `src/lib/domain/swap/routes.ts`, replace the `stx → sbtc` entry (currently `method: "router"`) with:

```ts
  {
    from: "stx",
    to: "sbtc",
    method: "direct",
    hops: ["STX", "sBTC"],
    quote: [
      {
        coreAddress: XYK_CORE_ADDRESS,
        coreName: XYK_CORE_NAME,
        fn: "get-dx", // y-amount (STX) in → x (sBTC) out
        pool: POOL_SBTC_STX,
        xToken: SBTC,
        yToken: WSTX,
      },
    ],
    exec: {
      kind: "direct",
      contract: XYK_CORE,
      fn: "swap-y-for-x",
      pool: POOL_SBTC_STX,
      xToken: SBTC,
      yToken: WSTX,
    },
  },
```

`ROUTER_STX_SBTC` may now be unused in this file; leave the import in `contracts.ts` (it still documents the DCA router). If ESLint flags the `ROUTER_STX_SBTC` import as unused in `routes.ts`, remove only that import specifier.

- [ ] **Step 4: Run the swap tests to verify they pass**

Run: `npx vitest run src/lib/direct-swap.test.ts`
Expected: PASS (all characterization + post-condition cases).

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/lib/domain/swap/routes.ts src/lib/direct-swap.test.ts
git commit -m "fix(trade): route STX→sBTC through xyk-core directly so user swaps work"
```

---

## Task 2: Phase 1 — write the user-callable multi-hop router contract

**Files:**
- Create: `contracts/stacksport-swap-router.clar`
- Modify: `contracts/Clarinet.toml`

**Interfaces:**
- Produces 4 public functions, each `(amount-in uint) (min-amount-out uint) (recipient principal) → (response uint uint)`: `swap-stx-for-usdcx`, `swap-usdcx-for-stx`, `swap-usdcx-for-sbtc`, `swap-sbtc-for-usdcx`.

- [ ] **Step 1: Write the contract**

Create `contracts/stacksport-swap-router.clar`:

```clarity
;; stacksport-swap-router.clar
;; User-callable multi-hop swap router for the Trade tab.
;;
;; Unlike the DCA routers (bitflow-*-swap-router), which assume a vault has
;; already transferred funds in, each function here FIRST pulls the input
;; token from tx-sender into this contract, then runs the Bitflow hops via
;; as-contract (swapping this contract's balance), then forwards the output
;; token to `recipient`. Intermediate hops use min-out u1; the final hop
;; enforces `min-amount-out`. token-stx-v-1-2 is a native-STX SIP-010 facade,
;; so "wSTX" output is native STX (forwarded with stx-transfer?).

(use-trait sip-010-trait 'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.sip-010-trait-ft-standard-v-1-1.sip-010-trait)
(use-trait xyk-pool-trait 'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-pool-trait-v-1-2.xyk-pool-trait)
(use-trait ss-pool-trait  'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.stableswap-pool-trait-v-1-4.stableswap-pool-trait)

;; STX -> aeUSDC -> USDCx
(define-public (swap-stx-for-usdcx
    (amount-in uint) (min-amount-out uint) (recipient principal))
  (begin
    (try! (stx-transfer? amount-in tx-sender (as-contract tx-sender)))
    (let (
      (dy-aeusdc (try! (as-contract (contract-call?
        'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-core-v-1-2 swap-x-for-y
        'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-pool-stx-aeusdc-v-1-2
        'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.token-stx-v-1-2
        'SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-aeusdc
        amount-in u1))))
      (dy-usdcx (try! (as-contract (contract-call?
        'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.stableswap-core-v-1-4 swap-x-for-y
        'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.stableswap-pool-aeusdc-usdcx-v-1-1
        'SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-aeusdc
        'SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx
        dy-aeusdc min-amount-out))))
    )
      (try! (as-contract (contract-call?
        'SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx
        transfer dy-usdcx tx-sender recipient none)))
      (ok dy-usdcx))))

;; USDCx -> aeUSDC -> STX
(define-public (swap-usdcx-for-stx
    (amount-in uint) (min-amount-out uint) (recipient principal))
  (begin
    (try! (contract-call?
      'SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx
      transfer amount-in tx-sender (as-contract tx-sender) none))
    (let (
      (dx-aeusdc (try! (as-contract (contract-call?
        'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.stableswap-core-v-1-4 swap-y-for-x
        'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.stableswap-pool-aeusdc-usdcx-v-1-1
        'SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-aeusdc
        'SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx
        amount-in u1))))
      (dx-stx (try! (as-contract (contract-call?
        'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-core-v-1-2 swap-y-for-x
        'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-pool-stx-aeusdc-v-1-2
        'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.token-stx-v-1-2
        'SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-aeusdc
        dx-aeusdc min-amount-out))))
    )
      (try! (as-contract (stx-transfer? dx-stx tx-sender recipient)))
      (ok dx-stx))))

;; USDCx -> aeUSDC -> STX -> sBTC
(define-public (swap-usdcx-for-sbtc
    (amount-in uint) (min-amount-out uint) (recipient principal))
  (begin
    (try! (contract-call?
      'SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx
      transfer amount-in tx-sender (as-contract tx-sender) none))
    (let (
      (dx-aeusdc (try! (as-contract (contract-call?
        'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.stableswap-core-v-1-4 swap-y-for-x
        'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.stableswap-pool-aeusdc-usdcx-v-1-1
        'SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-aeusdc
        'SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx
        amount-in u1))))
      (dx-stx (try! (as-contract (contract-call?
        'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-core-v-1-2 swap-y-for-x
        'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-pool-stx-aeusdc-v-1-2
        'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.token-stx-v-1-2
        'SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-aeusdc
        dx-aeusdc u1))))
      (dx-sbtc (try! (as-contract (contract-call?
        'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-core-v-1-2 swap-y-for-x
        'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-pool-sbtc-stx-v-1-1
        'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token
        'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.token-stx-v-1-2
        dx-stx min-amount-out))))
    )
      (try! (as-contract (contract-call?
        'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token
        transfer dx-sbtc tx-sender recipient none)))
      (ok dx-sbtc))))

;; sBTC -> STX -> aeUSDC -> USDCx
(define-public (swap-sbtc-for-usdcx
    (amount-in uint) (min-amount-out uint) (recipient principal))
  (begin
    (try! (contract-call?
      'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token
      transfer amount-in tx-sender (as-contract tx-sender) none))
    (let (
      (dy-stx (try! (as-contract (contract-call?
        'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-core-v-1-2 swap-x-for-y
        'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-pool-sbtc-stx-v-1-1
        'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token
        'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.token-stx-v-1-2
        amount-in u1))))
      (dy-aeusdc (try! (as-contract (contract-call?
        'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-core-v-1-2 swap-x-for-y
        'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-pool-stx-aeusdc-v-1-2
        'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.token-stx-v-1-2
        'SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-aeusdc
        dy-stx u1))))
      (dy-usdcx (try! (as-contract (contract-call?
        'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.stableswap-core-v-1-4 swap-x-for-y
        'SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.stableswap-pool-aeusdc-usdcx-v-1-1
        'SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-aeusdc
        'SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx
        dy-aeusdc min-amount-out))))
    )
      (try! (as-contract (contract-call?
        'SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx
        transfer dy-usdcx tx-sender recipient none)))
      (ok dy-usdcx))))
```

- [ ] **Step 2: Register the contract in Clarinet.toml**

Append to `contracts/Clarinet.toml` (all required core/pool/token contracts are already in `[[project.requirements]]`):

```toml
[contracts.stacksport-swap-router]
path = 'stacksport-swap-router.clar'
clarity_version = 3
epoch = '3.3'
```

- [ ] **Step 3: Type-check the contract**

Run: `cd contracts && clarinet check`
Expected: `stacksport-swap-router` compiles. The only errors are the 3 pre-existing known unresolved-contract errors (deployed-source fidelity baseline); there must be **no new** errors mentioning `stacksport-swap-router` (no unknown function, arg-count, or trait mismatch). If a `swap-x-for-y` / `swap-y-for-x` arg or token ordering is wrong, fix it here before moving on.

- [ ] **Step 4: Run the contract test suite (guard against regressions)**

Run: `cd contracts && npm test`
Expected: existing suites still PASS (no behavior change to DCA contracts).

- [ ] **Step 5: Commit**

```bash
git add contracts/stacksport-swap-router.clar contracts/Clarinet.toml
git commit -m "feat(contracts): add user-callable stacksport-swap-router (USDCx in/out + sBTC↔USDCx)"
```

---

## Task 3: Phase 1 — deploy stacksport-swap-router to mainnet (CHECKPOINT)

> **This task spends real STX and publishes a contract that handles user funds. Do NOT run it without explicit user confirmation.** Pause here and confirm before broadcasting.

**Files:**
- Modify: `contracts/deployments/default.mainnet-plan.yaml` (hand-trimmed to the single new contract)

- [ ] **Step 1: Generate / hand-trim the mainnet deployment plan**

Generate the plan, then **hand-trim it to contain only `stacksport-swap-router`** (per the limit-order-vault deploy gotcha — a full plan re-publishes existing contracts):

```bash
cd contracts
clarinet deployments generate --mainnet --medium-cost
```

Edit `contracts/deployments/default.mainnet-plan.yaml` so the only `contract-publish` entry is `stacksport-swap-router` (path `stacksport-swap-router.clar`, clarity-version 3). Remove every other publish/requirement transaction.

- [ ] **Step 2: Confirm deployer + balance**

Verify the deployer is `SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV` and it holds enough STX for the publish fee.

- [ ] **Step 3: Apply the deployment (CONFIRM FIRST)**

Run: `clarinet deployments apply -d --mainnet`
Expected: one `contract-publish` for `stacksport-swap-router`. Record the resulting txid and the deployed contract id `SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV.stacksport-swap-router`.

- [ ] **Step 4: Confirm on-chain**

Verify the contract is anchored:

```bash
curl -s "https://api.hiro.so/v2/contracts/interface/SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV/stacksport-swap-router" | python3 -c "import sys,json; print([f['name'] for f in json.load(sys.stdin)['functions'] if f['access']=='public'])"
```

Expected: `['swap-stx-for-usdcx', 'swap-usdcx-for-stx', 'swap-usdcx-for-sbtc', 'swap-sbtc-for-usdcx']`.

- [ ] **Step 5: Commit the trimmed plan**

```bash
git add contracts/deployments/default.mainnet-plan.yaml
git commit -m "chore(contracts): mainnet deploy plan for stacksport-swap-router"
```

---

## Task 4: Phase 2 — add the router principal + USDCx post-condition branch

**Files:**
- Modify: `src/lib/domain/swap/contracts.ts`
- Modify: `src/lib/domain/swap/clarity.ts`
- Test: `src/lib/direct-swap.test.ts`

**Interfaces:**
- Produces: `ROUTER_STACKSPORT: TokenRef` and a `usdcx` case in `senderSpendPostCondition`.

- [ ] **Step 1: Add the router principal**

In `src/lib/domain/swap/contracts.ts`, under `// Routers`, add:

```ts
export const ROUTER_STACKSPORT: TokenRef = { address: "SP2CMK69QNY60HBG8BJ4X5TD7XX2ZT4XB62V13SV", name: "stacksport-swap-router" };
```

- [ ] **Step 2: Write the failing USDCx post-condition test**

In `src/lib/direct-swap.test.ts`, add a `usdcx` asset constant near `SBTC_ASSET`:

```ts
const USDCX_ASSET = "SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx::usdcx-token";
```

and add inside `describe("buildSwapParams post-conditions", …)`:

```ts
  it("USDCx → STX: Deny mode + exact USDCx FT outgoing post-condition from sender", () => {
    const p = buildSwapParams("usdcx", "stx", 5, 1000000, SENDER);

    expect(p.postConditionMode).toBe(PostConditionMode.Deny);
    expect(p.postConditions).toHaveLength(1);
    expect(p.postConditions[0]).toMatchObject({
      type: "ft-postcondition",
      address: SENDER,
      condition: "eq",
      amount: "5000000", // 5 USDCx, 6 decimals
      asset: USDCX_ASSET,
    });
  });
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run src/lib/direct-swap.test.ts -t "USDCx → STX: Deny"`
Expected: FAIL — `buildSwapParams("usdcx", …)` throws (no `usdcx` post-condition rule, and no route yet).

- [ ] **Step 4: Add the usdcx branch**

In `src/lib/domain/swap/clarity.ts`, add a USDCx asset constant next to `SBTC_ASSET`:

```ts
import { SBTC, USDCX } from "./contracts";
// ...
const SBTC_ASSET = `${SBTC.address}.${SBTC.name}` as const;
const USDCX_ASSET = `${USDCX.address}.${USDCX.name}` as const;
const USDCX_TOKEN_NAME = "usdcx-token";
```

and extend `senderSpendPostCondition`, before the final `throw`:

```ts
  if (fromId === "usdcx") {
    return Pc.principal(senderAddress)
      .willSendEq(amountInRaw)
      .ft(USDCX_ASSET, USDCX_TOKEN_NAME);
  }
```

(Note: the FT asset *name* is `usdcx-token`, distinct from the contract name `usdcx`.) This test alone still fails because no `usdcx→stx` route exists yet — that is added in Task 5; the post-condition branch is correct now.

- [ ] **Step 5: Build (route still missing — full pass comes in Task 5)**

Run: `npm run build`
Expected: build succeeds (type-level only). Leave the `USDCx → STX` test temporarily failing; it goes green in Task 5.

- [ ] **Step 6: Commit**

```bash
git add src/lib/domain/swap/contracts.ts src/lib/domain/swap/clarity.ts src/lib/direct-swap.test.ts
git commit -m "feat(trade): add USDCx post-condition branch + stacksport router principal"
```

---

## Task 5: Phase 2 — wire the 4 new routes into ROUTE_TABLE

**Files:**
- Modify: `src/lib/domain/swap/routes.ts`
- Test: `src/lib/direct-swap.test.ts`

**Interfaces:**
- Consumes: `ROUTER_STACKSPORT`, `XYK_CORE_ADDRESS/NAME`, `SS_CORE_ADDRESS/NAME`, pools, tokens from `contracts.ts`; `usdcx` post-condition branch from Task 4.
- Produces: `ROUTE_TABLE` entries for `stx→usdcx`, `usdcx→stx`, `usdcx→sbtc`, `sbtc→usdcx`.

- [ ] **Step 1: Add characterization tests for the 4 routes (failing first)**

In `src/lib/direct-swap.test.ts`, add to `describe("buildSwapParams characterization (current wiring)", …)` a constant and 4 cases:

```ts
const STACKSPORT_ROUTER = "stacksport-swap-router";

  it("STX → USDCx: stacksport-swap-router.swap-stx-for-usdcx", () => {
    const p = buildSwapParams("stx", "usdcx", 1, MIN_OUT, SENDER);
    expect(p.contractAddress).toBe(ROUTER);
    expect(p.contractName).toBe(STACKSPORT_ROUTER);
    expect(p.functionName).toBe("swap-stx-for-usdcx");
    expect(ser(p.functionArgs)).toEqual(
      ser([uintCV(1_000_000n), uintCV(MIN_OUT), standardPrincipalCV(SENDER)])
    );
    expect(p.postConditionMode).toBe(PostConditionMode.Deny);
  });

  it("USDCx → STX: stacksport-swap-router.swap-usdcx-for-stx", () => {
    const p = buildSwapParams("usdcx", "stx", 5, MIN_OUT, SENDER);
    expect(p.contractName).toBe(STACKSPORT_ROUTER);
    expect(p.functionName).toBe("swap-usdcx-for-stx");
    expect(ser(p.functionArgs)).toEqual(
      ser([uintCV(5_000_000n), uintCV(MIN_OUT), standardPrincipalCV(SENDER)])
    );
  });

  it("USDCx → sBTC: stacksport-swap-router.swap-usdcx-for-sbtc", () => {
    const p = buildSwapParams("usdcx", "sbtc", 5, MIN_OUT, SENDER);
    expect(p.contractName).toBe(STACKSPORT_ROUTER);
    expect(p.functionName).toBe("swap-usdcx-for-sbtc");
    expect(ser(p.functionArgs)).toEqual(
      ser([uintCV(5_000_000n), uintCV(MIN_OUT), standardPrincipalCV(SENDER)])
    );
  });

  it("sBTC → USDCx: stacksport-swap-router.swap-sbtc-for-usdcx (user router, replaces DCA router)", () => {
    const p = buildSwapParams("sbtc", "usdcx", 0.01, MIN_OUT, SENDER);
    expect(p.contractName).toBe(STACKSPORT_ROUTER);
    expect(p.functionName).toBe("swap-sbtc-for-usdcx");
    expect(ser(p.functionArgs)).toEqual(
      ser([uintCV(1_000_000n), uintCV(MIN_OUT), standardPrincipalCV(SENDER)])
    );
  });
```

Also update the existing **`sBTC → USDCx` characterization** case (`"sBTC → USDCx: bitflow-usdcx-swap-router.swap-sbtc-for-token"`) — it now points at the new user router. Replace its body's `contractName`/`functionName` expectations with `STACKSPORT_ROUTER` / `swap-sbtc-for-usdcx` (or delete it in favor of the new case above to avoid duplication). And update the **"throws for an unsupported pair"** test, which currently uses `usdcx → stx` (now supported) — change it to a genuinely unsupported pair:

```ts
  it("throws for an unsupported pair", () => {
    expect(() => buildSwapParams("usdcx", "usdcx", 1, MIN_OUT, SENDER)).toThrow();
  });
```

- [ ] **Step 2: Run to verify the new route tests fail**

Run: `npx vitest run src/lib/direct-swap.test.ts -t "stacksport-swap-router"`
Expected: FAIL — `No swap builder for stx → usdcx` (routes not in table yet).

- [ ] **Step 3: Add the 4 RouteSpec entries**

In `src/lib/domain/swap/routes.ts`, import `ROUTER_STACKSPORT` (add to the existing `./contracts` import) and append these entries to `ROUTE_TABLE`:

```ts
  {
    from: "stx",
    to: "usdcx",
    method: "router",
    hops: ["STX", "aeUSDC", "USDCx"],
    quote: [
      { coreAddress: XYK_CORE_ADDRESS, coreName: XYK_CORE_NAME, fn: "get-dy", pool: POOL_STX_AEUSDC, xToken: WSTX, yToken: AEUSDC },
      { coreAddress: SS_CORE_ADDRESS, coreName: SS_CORE_NAME, fn: "get-dy", pool: POOL_AEUSDC_USDCX, xToken: AEUSDC, yToken: USDCX },
    ],
    exec: { kind: "router", contract: ROUTER_STACKSPORT, fn: "swap-stx-for-usdcx" },
  },
  {
    from: "usdcx",
    to: "stx",
    method: "router",
    hops: ["USDCx", "aeUSDC", "STX"],
    quote: [
      { coreAddress: SS_CORE_ADDRESS, coreName: SS_CORE_NAME, fn: "get-dx", pool: POOL_AEUSDC_USDCX, xToken: AEUSDC, yToken: USDCX },
      { coreAddress: XYK_CORE_ADDRESS, coreName: XYK_CORE_NAME, fn: "get-dx", pool: POOL_STX_AEUSDC, xToken: WSTX, yToken: AEUSDC },
    ],
    exec: { kind: "router", contract: ROUTER_STACKSPORT, fn: "swap-usdcx-for-stx" },
  },
  {
    from: "usdcx",
    to: "sbtc",
    method: "router",
    hops: ["USDCx", "aeUSDC", "STX", "sBTC"],
    quote: [
      { coreAddress: SS_CORE_ADDRESS, coreName: SS_CORE_NAME, fn: "get-dx", pool: POOL_AEUSDC_USDCX, xToken: AEUSDC, yToken: USDCX },
      { coreAddress: XYK_CORE_ADDRESS, coreName: XYK_CORE_NAME, fn: "get-dx", pool: POOL_STX_AEUSDC, xToken: WSTX, yToken: AEUSDC },
      { coreAddress: XYK_CORE_ADDRESS, coreName: XYK_CORE_NAME, fn: "get-dx", pool: POOL_SBTC_STX, xToken: SBTC, yToken: WSTX },
    ],
    exec: { kind: "router", contract: ROUTER_STACKSPORT, fn: "swap-usdcx-for-sbtc" },
  },
```

And **replace** the existing `sbtc → usdcx` entry's `exec` so it uses the new user router (keep its `quote` hops — they are unchanged, all `get-dy`):

```ts
    exec: { kind: "router", contract: ROUTER_STACKSPORT, fn: "swap-sbtc-for-usdcx" },
```

- [ ] **Step 4: Run the full swap test suite to verify pass**

Run: `npx vitest run src/lib/direct-swap.test.ts`
Expected: PASS — all characterization, post-condition (incl. `USDCx → STX` from Task 4), and unsupported-pair cases green.

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/lib/domain/swap/routes.ts src/lib/direct-swap.test.ts
git commit -m "feat(trade): add STX↔USDCx and USDCx→sBTC user swap routes"
```

---

## Task 6: Phase 2 — verify UI flip/destinations + e2e + mainnet smoke

**Files:**
- Read/verify: `src/components/trade/SwapWidget.tsx`, `src/components/trade/swap/TokenSelector.tsx`
- Test: `e2e/*` (existing swap specs)

- [ ] **Step 1: Confirm destinations + flip are data-driven (no code change expected)**

Manual check: `getValidDestinations("usdcx")` now returns `[STX, sBTC]`; `getValidDestinations("stx")` returns `[sBTC, USDCx]`. `flipTokens` enables whenever the reverse route exists — every pair is now bidirectional, so flip should be enabled for all selections. If any UI guard hardcodes a token list (it should not — `SimpleTokenSelector` reads `getValidDestinations`), note it; otherwise no change.

- [ ] **Step 2: Run the dev server and smoke-test the new pairs (mock wallet)**

Run: `npm run dev`, open `http://localhost:3000/trade`, connect the mock/dev wallet, and confirm the UI now offers `USDCx → STX`, `USDCx → sBTC`, `STX → USDCx`, and that a quote renders for each (read-only path hits the real cores). Then stop the server (free port 3000).

- [ ] **Step 3: Run e2e**

Run: `npm run test:e2e`
Expected: swap specs still pass on desktop + mobile profiles (baseline ~84 desktop / ~78 mobile). Fix any selector/flip assertions that assumed the old route set.

- [ ] **Step 4: Mainnet smoke (CHECKPOINT — real funds, requires deployed Task 3)**

With a real wallet on mainnet, execute one minimal swap in each new direction and confirm on the explorer:
- `STX → USDCx`, `USDCx → STX` (**confirm the wallet receives native STX**), `USDCx → sBTC`, `sBTC → USDCx`.
Each tx should show exactly the input token leaving the user (post-condition) and the output token arriving. If `USDCx → STX` delivers anything other than native STX, stop and revisit the wSTX-façade assumption.

- [ ] **Step 5: Commit any e2e/UI fixes**

```bash
git add e2e src/components/trade
git commit -m "test(trade): cover USDCx-exit and STX↔USDCx swap pairs"
```

---

## Self-Review

**Spec coverage:**
- Phase 0 (STX→sBTC direct) → Task 1. ✓
- Phase 1 contract (4 fns, input-pull, hops, forward, wSTX façade) → Task 2; deploy → Task 3. ✓
- Phase 2 (`ROUTER_STACKSPORT`, `usdcx` post-condition, 4 ROUTE_TABLE entries, sBTC→USDCx re-point, UI/e2e) → Tasks 4–6. ✓
- Testing (clarinet check, characterization, post-conditions, e2e, mainnet verify) → distributed across tasks. ✓
- Risks (STX-output façade, pool ordering, mainnet-funds) → addressed in Tasks 2/3/6 checkpoints. ✓

**Placeholder scan:** No TBD/TODO; all code blocks complete; deployed contract id is concrete.

**Type consistency:** Router fn names identical across Clarity (Task 2), characterization tests (Task 5), and ROUTE_TABLE `exec.fn` (Task 5): `swap-stx-for-usdcx`, `swap-usdcx-for-stx`, `swap-usdcx-for-sbtc`, `swap-sbtc-for-usdcx`. Post-condition asset name `usdcx-token` consistent between Task 4 test and `clarity.ts` constant. Pool orderings consistent between Global Constraints, Clarity hops, and quote hops.
