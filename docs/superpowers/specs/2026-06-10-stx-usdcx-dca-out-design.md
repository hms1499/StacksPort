# STX → USDCx DCA-out ("Bán STX định kỳ") — Design Spec

**Date:** 2026-06-10
**Status:** Approved — ready for implementation plan
**Author:** brainstormed with Claude Code

## 1. Mục tiêu & bối cảnh

Cho phép user lên lịch **bán STX nhàn rỗi vào USDCx** đều đặn để chốt lời — một
DCA-out (recurring sell), **không phụ thuộc giá**. Đây là bản đối xứng của DCA-in
(STX→sBTC) và là bản song sinh của DCA-out sBTC→USDCx **đã ship**.

Mô hình **non-custodial** giữ nguyên: vault giữ STX, mỗi kỳ swap qua một router và
gửi USDCx thẳng về ví owner — không tích lũy token trong vault.

### Phát hiện nền tảng (đã khảo sát codebase)

- **DCA-out sBTC→USDCx đã hoàn chỉnh và đang chạy**: UI `src/components/dca-out/`
  (`CreateOutPlanForm`, `MyOutPlans`, `OutPlanCard`, `OutPlanHistory`) + performance
  `DCAOutPanel`, wired vào tab `"out"` của `DCAPageContent` (toggle `in`/`out`);
  on-chain `dca-vault-sbtc-v2` + `bitflow-usdcx-swap-router`, keeper `vault-type 1`.
  → Phần việc **mới duy nhất** là **STX→USDCx**.
- **DCA vault là generic** over `target-token` + router truyền lúc execute. Nhưng
  `batch-dca-executor` **gắn router theo `vault-type`** (không đọc target token của
  plan): `0` → STX vault + router STX→sBTC; `1` → sBTC vault + router sBTC→USDCx.
  Contract immutable ⇒ thêm hướng mới buộc phải có router mới + batch-executor mới.
- **Route STX→USDCx = 2 hop cuối của route sBTC→USDCx** đã tồn tại:
  `STX → xyk-pool-stx-aeusdc-v-1-2 → aeUSDC → stableswap-pool-aeusdc-usdcx-v-1-1 → USDCx`.

### Quyết định kiến trúc (Hướng A — vault riêng)

Deploy một vault STX→USDCx **riêng** (code giống hệt `dca-vault-v2`, đổi tên) để giữ
mapping 1:1 `vault-type 2 = (vault mới, router mới)`. Sạch sẽ, tách bạch buy/sell,
giới hạn 10 plan độc lập, sao chép gần như từng lớp từ stack sBTC.
*(Hướng B — nhồi plan STX→USDCx vào STX vault hiện có rồi định tuyến theo target token
— đã cân nhắc và loại: keeper/UI phải phân loại theo target token, chia sẻ giới hạn
10 plan, batch-executor phức tạp hơn.)*

## 2. Smart contracts (3 contract mới, deploy mainnet)

| Contract | Vai trò | Sao chép từ |
|---|---|---|
| `bitflow-usdcx-from-stx-router` | `swap-stx-for-token(amt uint, min-out uint, recipient principal)`: STX→aeUSDC (xyk-core) → aeUSDC→USDCx (stableswap-core), gửi USDCx cho `recipient` | `bitflow-usdcx-swap-router` (bỏ hop sBTC→STX) |
| `dca-vault-stx-usdcx` | Vault giữ STX, target = USDCx. Code **giống hệt** `dca-vault-v2` (generic, đã có sẵn) | `dca-vault-v2.clar` |
| `batch-dca-executor-v2` | Thêm `vault-type 2` → (`dca-vault-stx-usdcx`, router mới); giữ nguyên 0 và 1 | `batch-dca-executor.clar` |

Hằng số tái dùng từ `dca-vault-v2`: min swap **1 STX** (`MSA u1000000`), min deposit
**2 STX** (`MID u2000000`), protocol fee **30 bps** về `TREASURY`, **max 10 plan/user**
(độc lập cho vault này).

**Pool/asset thật (Hiro-verified IDs từ `src/lib/domain/swap/contracts.ts`):**
- `POOL_STX_AEUSDC` = `SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-pool-stx-aeusdc-v-1-2`
- `POOL_AEUSDC_USDCX` = `SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.stableswap-pool-aeusdc-usdcx-v-1-1`
- `AEUSDC` = `SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-aeusdc`
- `USDCX` = `SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx`
- xyk core / stableswap core: như `XYK_CORE` / `SS_CORE` trong `contracts.ts`.

### RỦI RO #1 — bắt buộc xử lý TRƯỚC khi viết router

Trước khi code router, **verify lại** pool contract id + SIP-010 asset name của
`xyk-pool-stx-aeusdc-v-1-2` và `stableswap-pool-aeusdc-usdcx-v-1-1` qua Hiro API
(rule ROUTE_TABLE + memory "verify-external-ids"). Router phải có clarinet test
chứng minh swap path + min-amount-out + post-condition đúng trước khi deploy.

## 3. Keeper bot

- `config.ts`: thêm `stxUsdcxVaultContract` (env `STX_USDCX_VAULT_CONTRACT`, default =
  địa chỉ vault mới sau khi deploy); trỏ `batchExecutorContract` → `batch-dca-executor-v2`.
- `batch-executor.ts`: mở rộng `BatchPlan.vaultType` thành `0 | 1 | 2`.
- `index.ts`: scan vault thứ 3, đẩy plan due vào batch với `vaultType: 2`.
  Smart-DCA gating **KHÔNG** áp (chỉ gate vault-0). Reconcile / heartbeat
  (`keeper:last-run`) / lock / circuit-breaker kế thừa nguyên trạng.
- `dca-push.ts`: thêm copy push "Sold X STX → Y USDCx".

## 4. Frontend

- **lib**: `src/lib/dca-stx-usdcx.ts` — mirror `dca-sbtc.ts`
  (createPlan / getUserPlanIds / getPlan / getUserPlans / stats / performance),
  đổi đơn vị sang STX (uSTX, helpers `stxToMicro`/`microToSTX` đã có ở `dca.ts`),
  contract = `dca-vault-stx-usdcx`, target cố định = USDCx.
- **UI**: tab `"out"` hiện chỉ bán sBTC → thêm **bộ chọn tài sản nguồn (sBTC / STX)**
  ở đầu tab. Chọn STX → render biến thể STX của form/list/card/history (copy từ
  `src/components/dca-out/`, đổi đơn vị + lib). USDCx là target cố định, không cho đổi.
- **Performance**: `DCAOutPanel` mở rộng để hiển thị cả 2 nguồn (sBTC-out + STX-out),
  hoặc panel song song — tái dùng `CostBasisOutChart`.
- **i18n**: thêm key vào namespace `dca` cho EN + VI; **parity test phải xanh**.

## 5. Data flow (mỗi kỳ thực thi)

```
keeper scan dca-vault-stx-usdcx
  → plan due (can-execute = active && bal>=amt && interval-passed)
  → batch-dca-executor-v2.batch-execute-dca([{ plan-id, vault-type: u2 }])
  → vault: 0.3% fee → TREASURY, net STX → router
  → router: STX→aeUSDC (xyk) → aeUSDC→USDCx (stableswap), USDCx → ví owner
  → print event "dca-executed"
  → keeper: push notification + POST /api/portfolio/invalidate { address }
```

## 6. Testing

- **Clarinet**: unit test router (swap path + min-amount-out + fee), vault
  (mirror test của `dca-vault-v2`), batch-executor-v2 (vault-type 2 happy path +
  1 plan fail không revert cả batch).
- **Frontend**: unit test `dca-stx-usdcx.ts`; e2e thêm case tạo plan STX-out trong
  tab `"out"` (mock wallet fixture).
- **Keeper**: unit cho phân nhánh `vaultType: 2` trong logic chọn batch.

## 7. Thứ tự triển khai (mỗi bước commit riêng, mỗi commit vẫn xanh)

1. **Verify pool IDs qua Hiro API** (gate cứng) — rồi router contract + clarinet test.
2. Vault contract (copy `dca-vault-v2`, đổi tên) + test.
3. `batch-dca-executor-v2` + test (vault-type 2; 0/1 giữ nguyên).
4. Deploy mainnet 3 contract; ghi lại địa chỉ vào config/spec.
5. Keeper: `vaultType: 2` + config + push copy + unit test.
6. lib `dca-stx-usdcx.ts` + unit test.
7. UI: source toggle + form/list/card/history biến thể STX + i18n (EN+VI, parity xanh).
8. Performance panel mở rộng + e2e.
9. `npm run build` + `npm run lint` + full unit/e2e — đọc output trước khi claim done.

## 8. Ngoài phạm vi (YAGNI — để round sau)

- Điều kiện giá / PnL (take-profit theo mức giá), trailing stop, stop-loss.
- Stable khác ngoài USDCx; bán sBTC→STX.
- Gộp vault-type vào batch-executor cũ (đã chọn deploy v2 thay thế).
