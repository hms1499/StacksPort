# StacksPort — Roadmap

## Phase 1 — MVP (In Progress)

### ✅ Feature 1: Wallet Connection
- Connect Leather wallet
- Connect Xverse wallet
- Disconnect + dropdown hiển thị địa chỉ ví
- Persist wallet state (Zustand + localStorage)

### ✅ Feature 2: Portfolio Overview
- Hiển thị STX balance (real-time từ Hiro API)
- Biểu đồ giá STX theo thời gian (1D / 1W / 1M) — CoinGecko
- Danh sách SIP-010 fungible tokens trong ví
- Greed Index (Fear & Greed) với gauge bán nguyệt — alternative.me API
- Sidebar navigation (collapsible)
- Banner kêu gọi connect wallet khi chưa kết nối

---

## Phase 2 — Core Features

### 🔲 Feature 3: Transaction History
- Lịch sử giao dịch STX của ví
- Phân loại: Send / Receive / Contract Call / Stacking
- Trạng thái: Completed / Pending / Failed
- Link đến Hiro Explorer

### 🔲 Feature 4: STX Stacking Info
- Trạng thái stacking hiện tại (đang stack hay không)
- Cycle hiện tại + block còn lại
- BTC rewards ước tính
- APY ước tính

---

## Phase 3 — DeFi & NFT

### 🔲 Feature 5: NFT Gallery
- Hiển thị NFT SIP-009 trong ví
- Lọc theo collection
- Link đến Gamma.io / Byzantion

### 🔲 Feature 6: DeFi Positions
- LP positions trên ALEX DEX
- LP positions trên Velar
- Hiển thị value + APR

### 🔲 Feature 7: sBTC Tracking
- Theo dõi số dư sBTC (Bitcoin on Stacks)
- Lịch sử bridge BTC ↔ sBTC

---

## Phase 4 — Advanced

### 🔲 Feature 8: AI Insights (Stacks AI)
- Phân tích portfolio bằng AI
- Gợi ý rebalancing
- Tóm tắt thị trường Stacks

### 🔲 Feature 9: Multi-wallet
- Quản lý nhiều ví cùng lúc
- So sánh portfolio giữa các ví
- Watch-only mode (nhập địa chỉ không cần connect)

### 🔲 Feature 10: Trending Tokens
- Top tokens đang trending trên ALEX / Velar
- Mini chart 24h cho mỗi token
- Filter theo chain / category

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 14 (App Router) + TypeScript |
| Styling | TailwindCSS |
| Wallet | @stacks/connect |
| Blockchain API | Hiro API (api.hiro.so) |
| Price Data | CoinGecko API |
| Fear & Greed | alternative.me API |
| Charts | Recharts |
| State | Zustand + persist |
