# Landing Page & Dashboard Layout Cleanup — Design

**Date:** 2026-07-04
**Scope:** CSS/markup only, no data/logic changes.

## Problem

`.container` (custom class centering all page content) was deleted in a prior cleanup commit (`2c67383`), leaving Tailwind v4's built-in `container` utility active. Unlike Tailwind v3, v4's `container` utility does not auto-center or pad — it only sets fixed max-widths per breakpoint. Result: every section using `className="container"` (landing page header, hero, events grid, footer, registration modal) renders flush-left with dead whitespace on the right, confirmed live at 961px viewport (container pinned to 768px width, x=0).

Secondary issues found during audit:
- Landing page has leftover literal `text-blue-200`/`text-blue-100` classes from the pre-rebrand navy theme — low/odd contrast against the current mint palette.
- Admin dashboard `--color-border: #E8ECEF` is near-invisible against white surfaces (fails visible-border best practice).

## Fix

1. **`src/index.css`** — add a Tailwind v4 `@utility container` override:
   ```css
   @utility container {
     margin-inline: auto;
     padding-inline: 1.5rem;
     max-width: 80rem; /* 1280px */
   }
   ```
   This is the Tailwind v4-documented way to customize a built-in utility; every existing `className="container"` usage picks it up automatically — no per-file changes needed.

2. **`src/pages/Home.tsx`** — replace `text-blue-200` and `text-blue-100` with `text-white/80` (badge pill, hero subtext), matching the opacity-based pattern already used elsewhere in the mint-themed admin panel.

3. **`src/index.css`** — bump `--color-border` from `#E8ECEF` to `#D8DEE3` (both `@theme` and `:root` declarations) — still subtle, but passes visible-border contrast against white.

## Out of scope

No changes to `AdminLayout.tsx`, dashboard page components, or any data/auth logic. No changes to files Antigravity is actively iterating on beyond this narrow, additive `index.css` block plus two literal-class swaps in `Home.tsx`.

## Testing

Manual: reload landing page at 961px and 1440px viewport widths, confirm header/hero/events/footer all center with equal side padding. Reload admin login, confirm input borders visibly outline the field. `npm run build` must succeed.
