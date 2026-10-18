# Design System Master: Notas Quickss

- **Style:** Glassmorphism-Minimalism (Dark Violet Edition)
- **Skills Applied:** `ui-ux-pro-max`, `frontend-design`, `web-design-guidelines`
- **Typography:** `Plus Jakarta Sans` (UI & Display) + `tabular-nums` for metrics
- **Iconography:** Lucide SVG Icons (`stroke-width="1.8"`, zero emojis)

## Color & Glass Tokens
- `--bg-canvas`: `#09070f`
- `--glass-surface`: `rgba(22, 17, 36, 0.62)` (`backdrop-filter: blur(16px)`)
- `--glass-elevated`: `rgba(30, 22, 49, 0.84)` (`backdrop-filter: blur(22px)`)
- `--glass-subtle`: `rgba(255, 255, 255, 0.03)`
- `--glass-border`: `rgba(167, 139, 250, 0.16)`
- `--glass-border-strong`: `rgba(167, 139, 250, 0.36)`
- `--accent-primary`: `#7c3aed`
- `--accent-bright`: `#8b5cf6`
- `--accent-soft`: `rgba(124, 58, 237, 0.18)`
- `--text-primary`: `#f5f3ff`
- `--text-secondary`: `#c4b5fd`
- `--text-muted`: `#9f94b8`

## Component & Interaction Standards
1. **Top Header:** Sticky glass bar with personalized Welcome Message + Burger Menu button (`44x44px` touch target) that opens the Slide-Over Glass Drawer.
2. **Bottom Navigation Dock:** Floating glassmorphic dock fixed at the bottom (`z-40`) with 5 clear SVG icons (`layout-grid`, `compass`, `sun`, `check-square`, `shield-alert`), labels, and tabular badge counters.
3. **Zero Browser Native Controls:** All `<select>`, `<input type="checkbox">`, `<input type="number">` spinners, and `window.prompt()` calls are replaced by custom Tailwind Glass Dropdowns, Segmented Controls, Custom SVG Checkboxes, and Inline Drawer Forms.
4. **Accessibility & Motion:** Explicit CSS property transitions (never `transition: all`), `:focus-visible` rings, `aria-label` on icon buttons, `aria-live="polite"` on toasts, and `@media (prefers-reduced-motion: reduce)` compliance.
