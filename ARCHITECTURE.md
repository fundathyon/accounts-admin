# Architecture

Short, load-bearing map. If a section is missing, it doesn't exist here — don't guess it does.

## 1. One-line summary

Next.js admin panel that renders **client** pages, each of which calls a **BFF proxy** route colocated in the same Next app, which forwards to the Go **accounts** backend at `INTERNAL_API_URL`. Auth is a signed cookie checked in Edge middleware. No database, no queues, no server actions, no tests.

## 2. Request flow

```
                           ┌─────────────────────────────────┐
                           │  browser                        │
                           │  https://admin.example.com/…    │
                           └─────────────┬───────────────────┘
                                         │  cookie: admin_session=…
                                         ▼
                    ┌──────────────────────────────────────────┐
                    │  Edge middleware (src/middleware.ts)     │
                    │  - allowlist: /login, /api/admin/*,      │
                    │    /api/oauth-configs/migration/*,       │
                    │    /_next/*, static assets               │
                    │  - else: verifySession(cookie)           │
                    │  - invalid → 302 /login?from=…           │
                    └─────────────┬────────────────────────────┘
                                  │ (session ok)
                                  ▼
     ┌─────────────────────────────┴─────────────────────────────┐
     │                                                           │
     ▼                                                           ▼
┌──────────────────────────┐                    ┌──────────────────────────┐
│ App Router page          │                    │ Route Handler            │
│ src/app/(admin)/**/page  │                    │ src/app/api/**/route.ts  │
│ "use client"             │                    │ - requireSecretKey /     │
│                          │                    │   requirePublishableKey/ │
│ fetch('/api/…') ─────────┼────────────────────►   requireAdminKey       │
│  headers:                │  same-origin       │ - proxyToAccounts(path)  │
│   X-Secret-API-Key       │                    │   OR fetchAccountsJson   │
│   X-Publishable-API-Key  │                    └────────────┬─────────────┘
└──────────────────────────┘                                 │
                                                             │
                                            fetch INTERNAL_API_URL + path
                                            server-to-server, cache: no-store
                                                             │
                                                             ▼
                                              ┌──────────────────────────────┐
                                              │  Go accounts backend         │
                                              │  http://localhost:8000/…     │
                                              │  (or mock @ 8099 in mock env)│
                                              │  authoritative for RBAC,     │
                                              │  users, keys, oauth, etc.    │
                                              └──────────────────────────────┘
```

There is **no direct browser → accounts-backend** call. Everything routes through the local `/api/*` proxy so keys never leave the server. There is **no direct page → accounts-backend** call from server components either — pages are `"use client"` and hit their own `/api/*` route.

## 3. Layers, by folder

| Layer | Folder | Responsibility |
|---|---|---|
| Edge gate | [`src/middleware.ts`](src/middleware.ts) | session check; login redirect; sub-path (`BASE_PATH`) stripping |
| Root providers | [`src/app/layout.tsx`](src/app/layout.tsx) | `ThemeProvider`, `DesignSystemProvider`, `I18nProvider`, `TooltipProvider`, `Toaster` |
| Admin shell | [`src/app/(admin)/layout.tsx`](src/app/(admin)/layout.tsx) | `AdminProvider`, `OAuthLegacyMigrationNotifier`, `AdminSessionGuard`, `OnboardingGuard`, `SidebarProvider`, `AdminCommandPaletteProvider`; renders sidebar + topbar + `<main>` |
| Pages | [`src/app/(admin)/<route>/page.tsx`](src/app/(admin)) | one client page per admin section (17 total incl. login); fetches its own `/api/*` |
| BFF proxies | [`src/app/api/<resource>/route.ts`](src/app/api) | forward to `INTERNAL_API_URL`; use helpers in [`src/lib/accounts-api.ts`](src/lib/accounts-api.ts) |
| Admin auth (local) | [`src/app/api/admin/{login,logout,session}/route.ts`](src/app/api/admin) | mint / clear / verify `admin_session` |
| Shared server lib | [`src/lib/`](src/lib) | `accounts-api.ts`, `auth/session.ts`, `admin-types.ts`, `utils.ts`, `brand.ts`, `i18n/` |
| Contexts | [`src/context/`](src/context) | `AdminProvider` (keys, current app, notifications), `I18nProvider` (locale, `t()`) |
| Local components | [`src/components/`](src/components) | wrappers around `@foundathyon/community-ui` primitives; local shadcn primitives under `ui/` |
| DS boundary | `@foundathyon/community-ui` | provides `DataTable`, `FoundathyonProvider`, `OnboardingScreen`, `CommandPalette`, etc. Do not fork; extend upstream. |
| Design tokens | [`src/app/globals.css`](src/app/globals.css) | Tailwind v4 + tw-animate-css; theme is `FoundathyonProvider` + `next-themes` |
| Mock backend | [`mock-server/`](mock-server) | Bun HTTP server; 67 routes mirroring the Go API on port 8099 |

## 4. Auth

Two independent auth mechanisms — they don't share state.

### 4.1 Admin session cookie (protects the admin panel itself)

- Set by `POST /api/admin/login` after matching `body.user` / `body.password` against `ADMIN_USER` / `ADMIN_PASSWORD`.
- Cookie value: `base64url("<timestamp>.<HMAC-SHA256(secret, timestamp)>")`, HttpOnly, SameSite=Lax, `Max-Age = SESSION_TTL` (default 86400 s).
- Secret: `ADMIN_SESSION_SECRET` → fallback `ADMIN_PASSWORD` → fallback `'change-me-in-production'`.
- Web Crypto (`crypto.subtle`) — required so it runs in Edge middleware.
- Verified on every request by [`src/middleware.ts`](src/middleware.ts) → [`verifySession`](src/lib/auth/session.ts).
- **No role model.** Anyone holding the cookie has full admin power. Role/permission logic lives in the backend.

### 4.2 API keys (protect the accounts backend)

Three flavors, each corresponding to a helper in [`src/lib/accounts-api.ts`](src/lib/accounts-api.ts):

| Kind | Where it originates | How the admin stores it | Backend header sent |
|---|---|---|---|
| **Secret** (`sk_…`) | operator pastes in Settings → stored in `localStorage.authify_secret_key` | `AdminContext.savedSecretKey` | `X-API-KEY` |
| **Publishable** (`pk_…`) | operator pastes in Settings → stored in `localStorage.authify_publishable_key` | `AdminContext.savedPublishableKey` | `X-API-Key` |
| **Admin** | server env `ADMIN_API_KEY` | never leaves the server | `X-Admin-API-Key` |

Pages attach the client-held keys to `/api/*` requests as `X-Secret-API-Key` / `X-Publishable-API-Key`, and the proxy re-emits them under the backend's expected header names. The `Admin` key never round-trips through the browser.

## 5. Data flow example — `PATCH /api/users/[id]/role`

1. `src/app/(admin)/users/[id]/page.tsx` (client) triggers `fetch('/api/users/<id>/role', { method: 'PATCH', headers: { 'X-Secret-API-Key': savedSecretKey }, body })`.
2. Middleware sees the `admin_session` cookie is valid → passes through.
3. `src/app/api/users/[id]/role/route.ts` runs `requireSecretKey(req)` → gets `key`, or 401.
4. Calls `proxyToAccounts('/api/v1/users/<id>/role', { method: 'PUT', headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' }, body, cache: 'no-store' })`.
5. `proxyToAccounts` returns `NextResponse.json(data, { status: backendStatus })`.
6. Page renders success/error from the returned envelope.

## 6. Configuration & envs

- Loading order: [`load-envs.ts`](load-envs.ts) → `.envs/.env.base` (sets `ENVIRONMENT`) → `.envs/.env.<environment>` (override).
- Loader is imported for its side effects by [`next.config.ts`](next.config.ts).
- Full var inventory: [AGENTS.md §8](AGENTS.md#8-environment-variables--full-inventory) and [`.envs/.env.example`](.envs/.env.example).
- `NEXT_PUBLIC_ENVIRONMENT` is intentionally re-exposed via `next.config.ts` `env:` so the client bundle can badge non-prod builds.

## 7. Design system boundary

- The DS is `@foundathyon/community-ui`, pinned to a git tag in `package.json`.
- Local adapter: [`src/components/design-system-provider.tsx`](src/components/design-system-provider.tsx) wraps `FoundathyonProvider` with `BRAND_ACCENT`.
- The DS `DataTable` is not used directly — [`src/components/admin-data-table.tsx`](src/components/admin-data-table.tsx) is the framed variant used everywhere. Missing table pieces should be added to the DS repo, not reinvented locally (see memory `tables-follow-ds-figure`).
- Design tokens live in [`src/app/globals.css`](src/app/globals.css). Some utility classes (`h-control-*`, `text-body`, etc.) that appear in DS docs are NOT ported into this app's Tailwind theme (see memory `admin-globals-css-theme-gap`) — use the tokens that exist here or add them intentionally.

## 8. Observability

- **Logs**: `console.error` inside route handlers on network failures; no structured logger.
- **Toasts**: user-facing feedback via `sonner` (`useAdmin().showNotification` / bare `toast()`).
- **Metrics / tracing**: none in the admin. The backend handles its own observability.

## 9. What lives outside this repo

- **Backend (`INTERNAL_API_URL`)**: Go + Gin. Repo `/Users/rafa/work/foundathyon/apis/accounts/`. Route handlers under `internal/context/v1/`. OpenAPI spec: `apis/accounts/docs/swagger.yaml` (authoritative for payload shapes).
- **Design system**: `@foundathyon/community-ui` (see [DEVELOPMENT.md §7](DEVELOPMENT.md#7-live-editing-the-design-system-alongside-this-repo) for the local-dist workflow).
- **Mock backend**: [`mock-server/`](mock-server) in this repo — 67 routes, in-memory, no persistence. Reset by restarting the process.
