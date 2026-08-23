# `src/components` — Local React components

## Conventions

- **kebab-case file names**, one component per file (e.g. `admin-data-table.tsx`).
- **Named exports only.** No `export default` from any component file (pages are the sole exception because Next.js requires it).
- **No barrel files.** Do not add `src/components/index.ts` — direct imports are faster to trace.
- **Path alias**: `import { Foo } from '@/components/foo'`.

## Folder shape

- `src/components/` — feature-level components composed for a specific admin flow (data tables, brand panel, provider logos, migration notifier, session/onboarding guards).
- `src/components/ui/` — local shadcn-style primitives that don't yet live in `@foundathyon/community-ui` (`collapsible`, `field-hint`, `sonner`, `tooltip`). If the DS gets one of these, delete the local copy.
- `src/components/behaviors/` — the behavior-configuration forms (`email-auth-config-form.tsx` — 813 lines; `email-auth-config-view.tsx` — 363 lines). Don't split them mechanically; if you touch them, keep the change scoped to the field(s) at stake.

## Design-system boundary

The design system is `@foundathyon/community-ui`, pinned in `package.json`. Use it directly for primitives:

```ts
import { DataTable, Button, FoundathyonProvider, OnboardingScreen } from '@foundathyon/community-ui';
```

- `DataTable` is exposed via the **framed wrapper** [`admin-data-table.tsx`](admin-data-table.tsx) (a.k.a. `AdminDataTable`) — always use this wrapper in pages, not the raw DS `DataTable`. See memory `tables-follow-ds-figure` for the reasoning.
- `FoundathyonProvider` is wrapped by [`design-system-provider.tsx`](design-system-provider.tsx) with the app's `BRAND_ACCENT`. Do not re-mount it.
- Some DS-suggested Tailwind utilities (`h-control-*`, `text-body`, etc.) are not present in this app's tokens (see memory `admin-globals-css-theme-gap`). If you need one, either use an existing token or add it to [`src/app/globals.css`](../app/globals.css) intentionally.

If a needed primitive is missing, **extend the DS repo**, not this folder. That keeps other Foundathyon apps aligned.

## Icons and toasts

- Icons: `lucide-react` (locked by `components.json` → `iconLibrary: lucide`).
- Toasts: `useAdmin().showNotification(...)` inside admin pages, or bare `toast()` from `sonner` in DS-adjacent code.

## What NOT to do

- Do not use `React.memo`, `useMemo`, or `useCallback` prophylactically. Add them only after a real re-render problem is observed.
- Do not introduce a CSS-in-JS library. Tailwind v4 + `globals.css` + the DS is the surface.
- Do not add a component to render behind a feature flag "for later". Delete unused code paths.
