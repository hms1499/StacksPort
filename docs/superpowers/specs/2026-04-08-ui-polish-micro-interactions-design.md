# UI Polish & Subtle Micro-interactions — Design Spec

**Date:** 2026-04-08
**Approach:** Polish-in-place (Option A)
**Scope:** Toàn bộ app (trừ Premium page — bỏ)

## Summary

Giữ nguyên Deep Cosmos theme, sidebar layout, và cấu trúc component hiện tại. Thêm subtle micro-interactions nhất quán trên toàn app, lấy cảm hứng từ sự mượt mà của Uniswap. Không thay đổi layout, colors, hay features.

---

## 1. Shared Animation Utilities

Tạo `src/lib/animations.ts` chứa Framer Motion variants dùng chung:

- **fadeIn**: opacity 0→1, translateY 8px→0, duration 0.3s
- **staggerContainer**: stagger children 0.05s
- **hoverScale**: scale 1.015 on hover, 0.985 on tap
- **hoverGlow**: subtle box-shadow accent color on hover
- **pageTransition**: fade + slide nhẹ, duration 0.25s
- **Shared easing**: `[0.22, 1, 0.36, 1]`

Mục tiêu: 1 source of truth cho tất cả animations, thay thế các inline definitions rải rác.

---

## 2. Sidebar

- **Active indicator**: `layoutId` animate slide giữa items, width 2px→3px + glow nhẹ
- **Hover state**: background fade in 0.2s, opacity 0→0.08
- **Collapse/expand**: spring transition (stiffness 300, damping 30)
- **Icon hover**: color transition 0.2s muted → accent
- **Tooltip on collapsed**: fade in 0.15s

---

## 3. Cards & Containers

- **Hover**: border-color fade 0.2s `var(--border-subtle)` → `var(--border-default)`, subtle shadow lift
- **Mount**: fadeIn + stagger 0.05s giữa cards
- **Nhất quán hóa**: thay hardcoded `bg-white dark:bg-gray-800` → CSS variables
- **Loading skeleton**: đổi `animate-pulse` → shimmer gradient slide (đã có trong globals.css)

---

## 4. Buttons & Interactive Elements

- **Scale**: hover 1.01, tap 0.98 (giảm từ 1.02)
- **Background**: `transition-colors duration-200` cho tất cả buttons
- **Focus ring**: animate opacity 0→1 trong 0.15s
- **Token selector**: hover background fade 0.2s + border highlight
- **Quick actions** (25%/50%/MAX): hover scale 1.02 + color transition 0.15s
- **Disabled**: opacity transition 0.2s

---

## 5. Page Transitions

- **Tất cả pages** dùng `pageTransition` variant từ shared utilities
- **Transition**: fade + translateY 6px→0, duration 0.25s, exit opacity→0
- **Layout level**: `AnimatePresence` mode="wait"
- **Bỏ Premium page** khỏi navigation

---

## 6. Data & Numbers

- **Number change**: opacity flash 0.3s khi giá trị thay đổi
- **Price flash**: text flash xanh (#00E5A0) hoặc đỏ (#FF5B6E), fade về bình thường trong 0.5s
- **Chart tooltip**: fade in 0.15s
- **Sparkline**: draw animation trái→phải (strokeDasharray), duration 0.6s

---

## 7. Modals & Overlays

- **Backdrop**: fade in opacity 0→0.5, duration 0.2s
- **Modal content**: scale 0.96→1 + fade in 0.2s, exit ngược lại
- **Token selector search**: auto-focus delay 0.1s sau modal mở
- **Token list items**: stagger fade in 0.03s/item
- **Dropdowns**: translateY -4px→0 + fade in 0.15s

---

## Constraints

- Không thay đổi layout, spacing, hay visual hierarchy
- Không thay đổi color scheme (giữ Deep Cosmos)
- Không thay đổi font hay typography
- Không thêm dependencies mới (chỉ dùng Framer Motion + CSS)
- Giữ nguyên tất cả features hiện tại (trừ bỏ Premium)
