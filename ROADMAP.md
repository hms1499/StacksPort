

## DCA Vault — Roadmap to Mainnet & Production

### Trạng thái hiện tại
- Contract `dca-vault-v5` đã deploy trên **Stacks Testnet**
- Frontend hoạt động với testnet
- Swap chỉ dùng `mock-swap-router-v2` (không swap thật)

---

### Phase 1 — Dọn dẹp & Hoàn thiện Testnet

#### 1.1 Xóa file không cần thiết
- [ ] Xóa `contracts/dca-vault.clar` (v4 cũ)
- [ ] Xóa `contracts/mock-swap-router.clar` (router v4)
- [ ] Xóa `contracts/traits/dca-swap-trait.clar` (trait đã nằm trong v5)
- [ ] Cập nhật `Clarinet.toml` sau khi xóa

#### 1.2 Sửa lỗi UI còn sót
- [ ] `DCAPageContent.tsx` line 37: sửa contract hiển thị từ `dca-vault-v3` → `dca-vault-v5`
- [ ] Cập nhật `TARGET_TOKENS` trong `dca.ts` sang địa chỉ mainnet khi sẵn sàng

#### 1.3 Test đầy đủ trên Testnet
- [ ] Test create plan với từng token (ALEX, Welsh, sBTC)
- [ ] Test deposit thêm STX
- [ ] Test pause → resume
- [ ] Test cancel & refund (bao gồm plan đang paused — bug vừa fix)
- [ ] Test execute với `mock-swap-router-v2`
- [ ] Test auto-deactivate khi hết balance

---

### Phase 2 — Smart Contract Mainnet

#### 2.1 Tích hợp DEX Router thật
- [ ] Nghiên cứu contract của **ALEX DEX** hoặc **Velar** trên mainnet
- [ ] Viết `alex-swap-router.clar` implement `dca-swap-trait` từ v5
  - Nhận STX → gọi ALEX swap → gửi token về recipient
- [ ] Test router thật trên testnet trước khi lên mainnet

#### 2.2 Security Audit
- [ ] Review toàn bộ `dca-vault-v5.clar` — đặc biệt:
  - `execute-dca`: kiểm tra reentrancy
  - `cancel-plan`: đảm bảo refund đúng owner
  - `stx-transfer?` flows
- [ ] Viết unit test với Clarinet (`clarinet test`)
- [ ] (Tùy chọn) Thuê audit bên thứ 3 nếu TVL lớn

#### 2.3 Deploy lên Mainnet
- [ ] Chuẩn bị ví mainnet có đủ STX để trả phí deploy (~0.1 STX)
- [ ] Cập nhật `Clarinet.toml` với mainnet config
- [ ] Deploy `dca-vault-v5.clar` lên mainnet
- [ ] Deploy `alex-swap-router.clar` (hoặc router thật) lên mainnet
- [ ] Ghi lại địa chỉ contract mainnet

---

### Phase 3 — Frontend Mainnet

#### 3.1 Cập nhật config
- [ ] Cập nhật `DCA_CONTRACT_ADDRESS` trong `src/lib/dca.ts` → địa chỉ mainnet
- [ ] Cập nhật `DEFAULT_SWAP_ROUTER` → địa chỉ router mainnet thật
- [ ] Cập nhật `HIRO_TESTNET` → `https://api.hiro.so` (mainnet)
- [ ] Cập nhật `TARGET_TOKENS` → địa chỉ mainnet của ALEX, Welsh, sBTC
- [ ] Đổi `network: "testnet"` → `network: "mainnet"` trong tất cả `openContractCall`
- [ ] Cập nhật `getTestnetSTXBalance` → dùng mainnet API endpoint
- [ ] Xóa banner "Testnet only" trong `DCAPageContent.tsx`

#### 3.2 Cải thiện UX
- [ ] Hiển thị link transaction lên Hiro Explorer sau khi submit
- [ ] Thêm loading skeleton khi fetch plans
- [ ] Thêm toast notification thay vì `confirm()` cho cancel plan
- [ ] Hiển thị estimated token nhận được dựa trên giá thị trường

---

### Phase 4 — Keeper Bot (Tự động Execute)

> Vì Stacks không có cronjob, cần bot bên ngoài trigger execute

- [ ] Viết script Node.js/TypeScript:
  - Quét tất cả plan IDs từ contract
  - Kiểm tra `can-execute` cho từng plan
  - Tự động gọi `execute-dca` khi đến hạn
- [ ] Deploy bot lên server (VPS, Railway, Render...)
- [ ] Thêm monitoring & alerting nếu bot down

---

### Phase 5 — Production Infrastructure

#### 5.1 Deploy Frontend
- [ ] Cấu hình biến môi trường production (`.env.production`)
- [ ] Deploy lên **Vercel** hoặc **Netlify**
- [ ] Cấu hình custom domain

#### 5.2 Monitoring
- [ ] Theo dõi contract activity trên Hiro Explorer
- [ ] Set up alert khi có lỗi bất thường

---

### Checklist nhanh trước khi Mainnet

```
[ ] Tất cả test testnet pass
[ ] Security audit hoàn thành
[ ] Router thật đã test
[ ] Contract address mainnet đã cập nhật trong frontend
[ ] Keeper bot đã chạy
[ ] Frontend đã deploy production
[ ] Banner testnet đã xóa
```
