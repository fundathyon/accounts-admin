# `src/app/(admin)` — Admin pages

Everything under this route group is behind the `admin_session` cookie (see [`../../middleware.ts`](../../middleware.ts)). The `(admin)` group is a Next.js route-group — the `(admin)` segment does not appear in URLs.

## Layout hierarchy

1. [`../layout.tsx`](../layout.tsx) — root: theme, DS, i18n, tooltip, toaster providers.
2. [`layout.tsx`](layout.tsx) — adds admin providers (`AdminProvider`, `AdminSessionGuard`, `OnboardingGuard`, `SidebarProvider`, `AdminCommandPaletteProvider`) and renders the sidebar / topbar shell.
3. No nested layouts — each page renders straight into the `<main>` scroll container.

## Adding a new admin page

1. Create `src/app/(admin)/<slug>/page.tsx` (kebab-case). Start with `'use client'` — every existing page is client. `export default function <Name>Page()`.
2. Add a nav entry in [`admin-sidebar.tsx`](admin-sidebar.tsx) `navItems` array. Pick a `lucide-react` icon, give it a stable `id`, and set `labelKey` to a new key you add in both `src/lib/i18n/locales/{es,en}.json` under `sidebar.<yourKey>`.
3. If the page needs a new backend resource, add the proxy in `src/app/api/<slug>/route.ts` first — see [`../api/AGENTS.md`](../api/AGENTS.md).
4. Fetch from your own `/api/*` route using bare `fetch()` inside `useEffect` / handlers. Do NOT introduce SWR or React Query for one page.
5. Wire keys via `useAdmin()`:
   ```ts
   const { savedSecretKey, apiUrl } = useAdmin();
   const res = await fetch(apiUrl('/api/<resource>'), {
     headers: { 'X-Secret-API-Key': savedSecretKey ?? '' },
   });
   ```
   `apiUrl()` prepends `NEXT_PUBLIC_BASE_PATH` — always use it.

## Rules specific to this folder

- **Use `AdminDataTable`** ([`@/components/admin-data-table`](../../components/admin-data-table.tsx)) for every list view. Don't build raw `<table>` markup or use the DS `DataTable` directly — this repo's framed variant is what the design system §14 figure specifies.
- **User-visible copy → i18n.** No inline Spanish or English strings in a page. Use `t('…')` from `useI18n()`.
- **Toasts** via `useAdmin().showNotification(...)`. Fall back to bare `toast()` from `sonner` only when outside an admin context.
- **No `page.tsx` above 2,000 lines.** If you're adding to `users/page.tsx` (already ~1,900) and would push it past that, extract a colocated component (`users/_components/foo.tsx`, `_` prefix keeps it out of routing).
- **The pages `users/page.tsx` and `oauth-providers/page.tsx` are large and untested.** Do not refactor them mechanically. Change only what the ticket requires.

## Which routes exist today

Read [`../admin-sidebar.tsx`](admin-sidebar.tsx) `navItems` — it's the single source of truth for the visible nav. Additional routes not in the sidebar: `/notifications`, `/release-notes`, `/users/[id]`, `/webhooks/[id]/test`, `/behaviors/[id]`.
