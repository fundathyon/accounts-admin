# AGENTS.md

Operational manual for AI coding agents (Claude Code, Codex, Cursor, OpenCode, Copilot, etc.) working in this repository. Read this first — it is deliberately short and load-bearing.

Companion docs: [ARCHITECTURE.md](ARCHITECTURE.md), [DEVELOPMENT.md](DEVELOPMENT.md), [CONTRIBUTING.md](CONTRIBUTING.md), and folder-scoped [`AGENTS.md`](#nested-agentsmd) files under `src/`.

---

## 1. What this project is

`foundathyon/accounts-admin` — a single-page-app-style **admin panel** for the Foundathyon **Accounts** service. It's a thin BFF (Backend-for-Frontend): every UI page fetches its own `/api/*` route, which proxies to the Go accounts backend defined by `INTERNAL_API_URL`.

- **Stack**: Next.js 16 (App Router) · React 19 · TypeScript 5 (strict) · Tailwind CSS v4 · shadcn primitives · `@foundathyon/community-ui` design system · **Bun** as package manager and runtime for the mock server.
- **Language of the UI**: Spanish. New user-facing copy goes through the i18n dictionaries at [`src/lib/i18n/locales/{es,en}.json`](src/lib/i18n/locales/es.json), never inline.
- **Auth model**: single admin operator; HMAC-signed `admin_session` cookie. There is **no role model inside the admin** — anyone with the cookie has full power. Role management endpoints act on *target users* in the backend, not on the operator.

---

## 2. The one command you need before opening a PR

```bash
make validate
```

That runs, in order: `lint` → `typecheck` → `build`. Equivalent: `bun run validate`. If any step fails, the change is not ready.

---

## 3. Real commands (verified — do not invent others)

Every daily action already has a `make` target and a `bun run` script. Both work; the `make` names are what CI and docs reference.

| Task | Make | bun |
|---|---|---|
| Install deps | `make install` | `bun install` |
| Dev server (real backend) | `make dev` | `bun run dev` |
| Mock backend only (port 8099) | `make mock` | `bun run mock` |
| Next + mock together | `make dev-mock` | (use `make`; wraps `trap 'kill 0'`) |
| Lint | `make lint` | `bun run lint` |
| Lint + autofix | `make lint-fix` | `bun run lint:fix` |
| Typecheck | `make typecheck` | `bun run typecheck` |
| Build | `make build` | `bun run build` |
| **Validate (lint + tc + build)** | `make validate` | `bun run validate` |
| Prod start (after build) | `make start` | `bun run start` |
| Clean build artifacts | `make clean` | — |
| Wipe & reinstall | `make reset` | — |
| Docker build / up / down | `make docker-build` / `docker-up` / `docker-down` | — |

**Do not run `npm ci` or `npm install` in this repo.** Package manager is Bun; `bun.lock` is the truth. There is no `package-lock.json` (an old one was removed for exactly this reason).

**There are no automated tests.** No `test` script, no test files, no CI test job. Do not fabricate a fake `bun test` command. If a change is risky, verify it by exercising the UI locally against `make dev-mock` and paste the observed result into the PR.

---

## 4. Folder map — where to add what

```
accounts-admin/
├── AGENTS.md · ARCHITECTURE.md · DEVELOPMENT.md · CONTRIBUTING.md
├── README.md                          ← short human landing page
├── Makefile · docker-compose.yml · Dockerfile · entrypoint.sh
├── next.config.ts · tsconfig.json · eslint.config.mjs · postcss.config.mjs
├── components.json                    ← shadcn config (style: new-york, iconLib: lucide)
├── load-envs.ts                       ← imported by next.config.ts (side-effect)
├── package.json (bun) · bun.lock
│
├── .envs/                             ← env files; only .env.example is committed
│   ├── .env.example                   ← template, safe to read
│   ├── .env.base                      ← sets ENVIRONMENT
│   ├── .env.local · .env.mock         ← per-env values (git-ignored)
│   └── .env.{dev,prod,staging}        ← optional, per-deploy (also ignored)
│
├── .github/workflows/                 ← CI (build+push Docker image only, no tests)
├── docker_images/app/Dockerfile.app   ← the Dockerfile CI actually uses
│
├── mock-server/                       ← Bun HTTP server, 67 routes, port 8099
│   ├── server.ts · data.ts
│   └── AGENTS.md                      ← how to add/edit a mocked endpoint
│
├── docs/                              ← reference docs (see docs/README.md)
│   ├── guides/admin-panel.md
│   └── backend/*.md                   ← backend API prose refs (Spanish)
│
├── public/                            ← static assets (logos, favicons)
│
└── src/
    ├── middleware.ts                  ← Edge middleware: admin_session check
    │
    ├── app/                           ← Next.js App Router
    │   ├── layout.tsx                 ← root: providers (theme, i18n, DS, toaster)
    │   ├── globals.css                ← Tailwind v4 tokens (design system)
    │   ├── login/page.tsx             ← public login page
    │   │
    │   ├── (admin)/                   ← every protected page lives here
    │   │   ├── AGENTS.md              ← how to add a new admin page
    │   │   ├── layout.tsx             ← sidebar + topbar shell + admin providers
    │   │   ├── admin-sidebar.tsx      ← NAV_ITEMS: edit here when adding a page
    │   │   ├── admin-topbar.tsx
    │   │   ├── page.tsx               ← dashboard
    │   │   ├── users/ · users/[id]/
    │   │   ├── roles-policies/
    │   │   ├── webhooks/ · webhooks/[id]/test/
    │   │   ├── api-keys/
    │   │   ├── oauth-providers/
    │   │   ├── behaviors/ · behaviors/[id]/
    │   │   ├── email-templates/ · email-access/
    │   │   ├── tokens/ · notifications/ · release-notes/
    │   │   └── settings/
    │   │
    │   └── api/                       ← Route Handlers (BFF proxies)
    │       ├── AGENTS.md              ← how to add a new proxy route
    │       ├── admin/{login,logout,session}/route.ts   ← only local routes
    │       └── <resource>/route.ts    ← everything else forwards to backend
    │
    ├── components/                    ← local React components (all named exports)
    │   ├── AGENTS.md
    │   ├── admin-data-table.tsx       ← wrapper around community-ui DataTable
    │   ├── behaviors/                 ← behavior-config forms
    │   └── ui/                        ← shadcn-style local primitives
    │
    ├── context/                       ← React contexts
    │   ├── admin-context.tsx          ← API keys, current app, notifications
    │   └── i18n-context.tsx           ← locale + t()
    │
    ├── hooks/use-mobile.ts
    │
    ├── lib/
    │   ├── AGENTS.md
    │   ├── accounts-api.ts            ← shared proxy helpers (server-side)
    │   ├── admin-types.ts             ← shared TS types (App, LoginMethodDetails, …)
    │   ├── auth/session.ts            ← HMAC-signed admin_session cookie
    │   ├── brand.ts · utils.ts
    │   └── i18n/                      ← messages + Locale type
    │
    └── styles/auth-shell.module.css   ← login split-panel CSS module
```

### "Where do I put X?" cheatsheet

| Change | Location | Also edit |
|---|---|---|
| New admin page | [`src/app/(admin)/<slug>/page.tsx`](src/app/(admin)) | [`admin-sidebar.tsx`](src/app/(admin)/admin-sidebar.tsx) `navItems` |
| New proxy endpoint | [`src/app/api/<slug>/route.ts`](src/app/api) | use `proxyToAccounts` / `fetchAccountsJson` from [`src/lib/accounts-api.ts`](src/lib/accounts-api.ts) |
| New shared UI component | [`src/components/<name>.tsx`](src/components) — named export, kebab-case | — |
| New shadcn-style primitive | [`src/components/ui/<name>.tsx`](src/components/ui) | — |
| New shared TS type | [`src/lib/admin-types.ts`](src/lib/admin-types.ts) | — |
| New React context | [`src/context/<name>-context.tsx`](src/context) | wire provider in [`src/app/layout.tsx`](src/app/layout.tsx) or [`(admin)/layout.tsx`](src/app/(admin)/layout.tsx) |
| New user-visible copy | Both [`src/lib/i18n/locales/es.json`](src/lib/i18n/locales/es.json) and [`en.json`](src/lib/i18n/locales/en.json) | consume via `t('…')` from `useI18n()` |
| New env var | [`.envs/.env.example`](.envs/.env.example) (documented) + code that reads it | — |
| New middleware allowlist path | [`src/middleware.ts`](src/middleware.ts) lines 19–32 | keep list minimal |
| New mocked endpoint | [`mock-server/server.ts`](mock-server/server.ts) + [`data.ts`](mock-server/data.ts) | mirror real backend path |

---

## 5. The auth boundary you must understand

1. Every request except `/login`, `/api/admin/{login,logout,session}`, `/api/oauth-configs/migration/*`, `_next/*` and static assets is intercepted by [`src/middleware.ts`](src/middleware.ts).
2. Middleware calls `verifySession(cookie)` from [`src/lib/auth/session.ts`](src/lib/auth/session.ts). Invalid → 302 to `/login`.
3. `admin_session` is `base64url("<timestamp>.<HMAC-SHA256(secret, timestamp)>")`, HttpOnly, SameSite=Lax, `Max-Age = SESSION_TTL` (default 86400 s).
4. HMAC secret = `ADMIN_SESSION_SECRET` (fallback: `ADMIN_PASSWORD`, then `'change-me-in-production'`).
5. Web Crypto is used everywhere (must run in the Edge runtime for middleware).

### Mock-mode admin cookie (do not type passwords in tests)

When running with `ENVIRONMENT=mock`, `ADMIN_SESSION_SECRET=mock-session-secret`. Any script or test that needs to hit an admin route can mint a cookie directly by HMAC-SHA256-signing `Date.now().toString()` with `mock-session-secret`, encoding as `base64url("<ts>.<b64(sig)>")`, and sending it as the `admin_session` cookie. See `createSessionCookie()` in [`src/lib/auth/session.ts`](src/lib/auth/session.ts) for the exact format.

---

## 6. The API-key boundary (proxy routes)

Every route under `src/app/api/**` that forwards to the backend uses one of three helpers from [`src/lib/accounts-api.ts`](src/lib/accounts-api.ts):

| Helper | Reads from | Forwards as | When to use |
|---|---|---|---|
| `requireSecretKey(req)` | client header `X-Secret-API-Key` | `X-API-KEY` | most admin resource CRUD |
| `requirePublishableKey(req, msg?, fallbackHeader?)` | client header `X-Publishable-API-Key` | `X-API-Key` | anonymous end-user flows (email signup/signin, oauths/link) |
| `requireAdminKey()` | server env `ADMIN_API_KEY` | `X-Admin-API-Key` | admin-scoped endpoints: `/api/apps` GET/POST, `/api/system/*` |

Each returns `{ key }` or `{ error }` (a 401/500 `NextResponse`). Then call `proxyToAccounts(path, init)` (returns a `NextResponse`) or `fetchAccountsJson(path, init)` (returns parsed body — for routes that make several backend calls, e.g. paginated aggregation).

Never bypass these helpers. Never `fetch(INTERNAL_API_URL, …)` directly from a route file.

---

## 7. Conventions — follow them, don't rediscover

- **File names**: kebab-case (`admin-data-table.tsx`, `use-mobile.ts`, `admin-context.tsx`).
- **Exports**: named exports everywhere in `components/`, `hooks/`, `lib/`, `context/`. No `export default` for components. Pages export `default function Page()` because Next.js requires it.
- **Client vs server**: only two files in `src/app` are server components — `app/layout.tsx` and `app/(admin)/layout.tsx`. Every page and shell chrome is `'use client'`. Middleware is Edge runtime.
- **No server actions.** No `"use server"` anywhere. Do not introduce them without a written reason.
- **Data fetching**: pages call their own `/api/…` route via bare `fetch()` in `useEffect` / handlers. No SWR, no React Query, no Server Component fetching. Follow the same pattern in new code — don't introduce a new fetch abstraction for one page.
- **Path alias**: `@/*` → `./src/*` (tsconfig). Prefer `@/lib/foo` over deep relative imports.
- **Design system**: use `@foundathyon/community-ui` primitives (see `DesignSystemProvider` in [`src/components/design-system-provider.tsx`](src/components/design-system-provider.tsx)). If a needed primitive is missing, add it to the DS repo rather than reinventing it locally (see memory: "Tables follow the DS §14 figure").
- **Tables**: use [`AdminDataTable`](src/components/admin-data-table.tsx) — do not build a raw `<table>`.
- **Icons**: `lucide-react`. `components.json` pins it.
- **Toasts**: `sonner` via `useAdmin().showNotification` when in an admin context; otherwise `toast()` from `sonner`.
- **i18n**: never inline user copy. Use `t('key')` and add to both `es.json` and `en.json`. `DEFAULT_LOCALE = 'es'`.
- **No barrels** (`index.ts` re-exports) inside `components/`. Only `src/lib/i18n/index.ts` exists.

---

## 8. Environment variables — full inventory

Full documentation lives in [`.envs/.env.example`](.envs/.env.example). Summary:

| Var | Server / Client | Default | Purpose |
|---|---|---|---|
| `ENVIRONMENT` | server | `local` | picks which `.envs/.env.<x>` file to load (via [`load-envs.ts`](load-envs.ts)) |
| `INTERNAL_API_URL` | server | `http://localhost:8000/accounts` | accounts backend base URL |
| `ADMIN_API_KEY` | server | `secret` | forwarded as `X-Admin-API-Key` |
| `ADMIN_USER` / `ADMIN_PASSWORD` | server | `admin` / `changeme` | login credentials |
| `ADMIN_SESSION_SECRET` | server | falls back to `ADMIN_PASSWORD` | HMAC secret for `admin_session` |
| `SESSION_TTL` | server | `86400` (seconds) | cookie lifetime |
| `BASE_PATH` / `NEXT_PUBLIC_BASE_PATH` | both | `""` | for hosting under a sub-path |
| `NEXT_PUBLIC_ENVIRONMENT` | client | mirrors `ENVIRONMENT` | UI-side environment badge |
| `NEXT_PUBLIC_DEV_SECRET_KEY` | client | unset | seeds `authify_secret_key` in localStorage — dev convenience |
| `NEXT_PUBLIC_DEV_PUBLISHABLE_KEY` | client | unset | seeds `authify_publishable_key` |
| `MOCK_NO_APPS` | mock only | unset | when set, mock starts with no apps (to test onboarding) |
| `MOCK_PORT` | mock only | `8099` | override mock port |

`NEXT_PUBLIC_*` values are inlined into the client bundle at build time. **Never put a real production secret in one.**

---

## 9. Feedback loop for agent-friendly work

1. Read the folder-scoped `AGENTS.md` closest to the code you'll touch.
2. Make the smallest change that solves the problem.
3. Run only what's relevant first: `make lint` or `make typecheck` on its own is much faster than `make validate`.
4. Before considering it done: `make validate`.
5. If the change touches UI, exercise it against `make dev-mock` in a browser and describe the result in the PR.
6. Commit with [Conventional Commits](CONTRIBUTING.md).

---

## 10. Things NOT to do

- **Do not** run `npm install`, `npm ci`, or add a `package-lock.json`. Bun is the truth.
- **Do not** introduce a new package unless the change genuinely needs it. This app is already close to the community-UI baseline; every new dependency widens the surface an agent must reason about.
- **Do not** add a server action (`"use server"`) — the whole app is client + BFF proxies. Server actions would fork the data-fetching pattern.
- **Do not** call the accounts backend directly from a page or from a route handler without `proxyToAccounts` / `fetchAccountsJson`. The helpers standardize error envelopes and header handling.
- **Do not** bypass the API-key helpers (`requireSecretKey`, `requirePublishableKey`, `requireAdminKey`). Backend authorization depends on exactly one header being set.
- **Do not** hard-code user-visible strings. Add to both `es.json` and `en.json`.
- **Do not** widen `middleware.ts` allowlist unless a route legitimately must be public — an accidental allowlist is an auth bypass.
- **Do not** add a role-check inside the admin. There is no role model here; the backend is the authority.
- **Do not** mechanically split the large pages (`users/page.tsx`, `oauth-providers/page.tsx`, `email-auth-config-form.tsx`) without a specific bug to fix. There are no tests to catch regressions, and the community-ui integration constrains structure.
- **Do not** commit to `.envs/` anything other than `.env.example`. Real env files are `.gitignore`d for a reason.
- **Do not** add a testing framework as a side effect of another change. If the project needs one, propose it as its own PR.

---

## 11. Known constraints

- **No test suite.** Every change is validated by `lint + typecheck + build` and manual verification.
- **Large pages.** Several admin pages exceed 800 lines (some ~1,900). Refactor only when a bug or feature makes it necessary; otherwise inherit the existing pattern.
- **CI is minimal.** Only `.github/workflows/dev.yaml` builds and pushes a Docker image on push to `dev`. No PR checks. `make validate` locally is the effective gate.
- **`GET /webhooks/events` is public** on the backend (no key required). Middleware handles the corresponding admin route normally — only the backend call is unauthenticated. Do not "add" auth on the admin side.
- **`docker_images/app/Dockerfile.app`** is what CI builds — a byte-for-byte duplicate of root `Dockerfile`. If you change one, mirror the change in the other.
- **BASE_PATH placeholder trick.** Docker builds bake `BASE_PATH=/__NEXT_BASE_PATH_PLACEHOLDER__` and `entrypoint.sh` `sed`s it to the runtime value. `next.config.ts` explicitly ignores the placeholder to avoid invalid regex generation. Don't remove the guard.

---

## <a id="nested-agentsmd"></a>12. Nested AGENTS.md files

Folder-scoped guides live next to the code they describe. Read the one closest to where you're editing — it overrides broader guidance where they conflict.

- [`src/app/(admin)/AGENTS.md`](src/app/(admin)/AGENTS.md) — pages, sidebar, layout.
- [`src/app/api/AGENTS.md`](src/app/api/AGENTS.md) — proxy routes and auth helpers.
- [`src/components/AGENTS.md`](src/components/AGENTS.md) — component conventions and DS boundary.
- [`src/lib/AGENTS.md`](src/lib/AGENTS.md) — shared libs (auth, i18n, types, utils).
- [`mock-server/AGENTS.md`](mock-server/AGENTS.md) — how to add or edit a mocked endpoint.
