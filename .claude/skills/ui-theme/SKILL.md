---
name: ui-theme
description: Apply the project's brand color palette and design system when creating or modifying UI components. Use this whenever building new components, updating styles, or reviewing UI consistency.
---

# StacksPort Design System — Brand Palette

## Color Palette

Use these brand colors instead of default Tailwind colors for primary/accent elements:

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| **Deep Forest** | `#091413` | `rgb(9, 20, 19)` | Dark backgrounds, dark mode base, text on light |
| **Forest** | `#285A48` | `rgb(40, 90, 72)` | Secondary elements, borders, hover states |
| **Emerald** | `#408A71` | `rgb(64, 138, 113)` | Primary buttons, active states, links |
| **Mint** | `#B0E4CC` | `rgb(176, 228, 204)` | Highlights, badges, light accents, subtle backgrounds |

## Tailwind Custom Classes

Use these custom color classes throughout the project:

```
/* Primary actions (buttons, links, active indicators) */
bg-brand-emerald     → bg-[#408A71]
text-brand-emerald   → text-[#408A71]
border-brand-emerald → border-[#408A71]
hover:bg-brand-forest → hover:bg-[#285A48]

/* Dark mode backgrounds */
bg-brand-deep        → bg-[#091413]
text-brand-deep      → text-[#091413]

/* Accents, badges, subtle highlights */
bg-brand-mint        → bg-[#B0E4CC]
text-brand-mint      → text-[#B0E4CC]

/* Secondary / borders / hover */
bg-brand-forest      → bg-[#285A48]
text-brand-forest    → text-[#285A48]
```

## Application Rules

### Buttons
- **Primary button**: `bg-[#408A71] hover:bg-[#285A48] text-white`
- **Secondary button**: `bg-[#B0E4CC]/10 hover:bg-[#B0E4CC]/20 text-[#408A71]`
- **Ghost button**: `border border-[#285A48] text-[#408A71] hover:bg-[#408A71]/10`

### Cards & Surfaces
- **Light mode card**: `bg-white border-[#B0E4CC]/30`
- **Dark mode card**: `dark:bg-[#091413] dark:border-[#285A48]/30`
- **Highlighted card**: `bg-[#B0E4CC]/10 border-[#408A71]/20`

### Text
- **Heading (light)**: `text-[#091413]`
- **Heading (dark)**: `dark:text-[#B0E4CC]`
- **Body (light)**: `text-[#285A48]`
- **Body (dark)**: `dark:text-[#B0E4CC]/70`
- **Muted**: `text-[#408A71]/60`

### Status Indicators
- **Bullish / Success**: `text-[#408A71] bg-[#B0E4CC]/20`
- **Bearish / Error**: Keep existing red (`text-red-600 bg-red-50`)
- **Neutral / Info**: `text-[#285A48] bg-[#B0E4CC]/10`
- **Warning**: Keep existing amber (`text-amber-600 bg-amber-50`)

### Navigation
- **Active nav item**: `bg-[#408A71]/10 text-[#408A71] dark:bg-[#285A48]/30 dark:text-[#B0E4CC]`
- **Inactive nav item**: `text-[#285A48]/60 hover:text-[#408A71] dark:text-[#B0E4CC]/50`
- **Active indicator bar**: `border-[#408A71]`

### Charts & Data Visualization
- **Primary line/bar**: `#408A71`
- **Secondary line/bar**: `#285A48`
- **Area fill**: `#B0E4CC` with opacity
- **Grid lines**: `#B0E4CC/20`

### Gradients
- **Hero gradient**: `from-[#091413] to-[#285A48]`
- **Card accent gradient**: `from-[#408A71]/10 to-[#B0E4CC]/10`
- **Button gradient**: `from-[#408A71] to-[#285A48]`

## Migration Notes

When modifying existing components, replace:
- `teal-500` → `[#408A71]` (Emerald)
- `teal-600` → `[#285A48]` (Forest)
- `teal-400` → `[#B0E4CC]` (Mint)
- `gray-900` dark backgrounds → `[#091413]` (Deep Forest)

Do NOT replace grays used for neutral UI elements (borders, disabled states, etc.) — only replace teal/accent colors with brand colors.
