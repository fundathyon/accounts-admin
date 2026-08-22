# Mock accounts backend

A standalone Bun HTTP server that stands in for the real `apis/accounts` Go
backend during local frontend development. No Go service, database, or real
API keys required.

## Usage

```bash
make dev-mock   # mock backend + Next.js dev server together
make mock       # just the mock backend, on its own (http://localhost:8099)
```

`dev-mock` runs with `ENVIRONMENT=mock`, which points `INTERNAL_API_URL` at
the mock server via `.envs/.env.mock` (see `load-envs.ts`). Auth headers
(`X-API-KEY`, `X-Admin-API-Key`) are accepted but never validated — any value,
including none reaching the mock at all, succeeds. The Next.js proxy layer
still enforces "header must be present" before a request ever reaches here.

State lives in memory (`data.ts`) and resets on restart. Create/update/delete
calls mutate the in-memory arrays, so clicking around the admin UI behaves
like a real backend within one server run.

## API keys in mock mode

The admin UI reads its Secret/Publishable key from `localStorage`, which is
populated by onboarding. That's a dead end for a mock: onboarding only runs
while zero apps exist, so once *any* browser completes it, every other browser
sees "app exists" but has no key and no way to get one — every page then renders
zeros.

So `.envs/.env.mock` sets `NEXT_PUBLIC_DEV_SECRET_KEY` / `NEXT_PUBLIC_DEV_PUBLISHABLE_KEY`,
which `admin-context.tsx` falls back to when `localStorage` is empty. Those vars
exist only in `.env.mock`; in local/dev/staging/prod they're undefined and the
fallback is inert, so non-mock behavior is unchanged.

To exercise the onboarding screen itself, start with no apps:

```bash
MOCK_NO_APPS=1 make mock    # in one shell
ENVIRONMENT=mock bun run dev # in another
```

Clear `localStorage` too, otherwise the seeded key is already present.

## What's accurate vs. approximated

Response envelope (`{success, status_code, data, error, meta}`), pagination
shape, and the field shapes for **roles, users (list), apps, api-keys,
webhooks, oauth-configs, policies, app-behaviors, and dashboard-stats** are
modeled directly on the real Go structs (`RoleEntity`, `UserEntity`,
`AppEntity`/`CreateAppResponse`, `APIKeyEntity`/`APIKeyListItem`,
`WebhookEntity`, `OAuthConfigListItem`, `PolicyEntity`,
`AppBehaviorBasicDTO`/`AppBehaviorDetailDTO`, dashboard `StatsResponse`) —
including quirks like `/v1/apps` (GET/POST) vs `/api/v1/apps` (PATCH) using
different path prefixes, and webhooks/oauth-configs *not* being paginated
upstream even though roles/users/policies/api-keys/apps are.

Endpoints under **email-access, emails/\*, system/\*, revoke-refresh,
role_policies, tokens/\* (validate-access, validate-refresh, refresh-jwt),
and oauths/link** return reasonable envelope-shaped responses inferred from
how accounts-admin's own API routes consume them, not verified against the
Go source — good enough to exercise the UI, but don't treat their exact
field names as authoritative.

`POST /api/v1/users` was found to return a broken, inconsistent shape on the
real backend (`{status:200, data:"Nuevo role"}`, no created user) — but
accounts-admin never calls it (only `GET /api/v1/users`), so the mock doesn't
implement it.

## Adding a route

Add a `route(method, path, handler)` call in `server.ts` — `path` is exactly
what the corresponding Next.js API route in `src/app/api/` appends after
`INTERNAL_API_URL` (check `src/lib/accounts-api.ts` call sites). Return
`ok(data, status?, meta?)` or `fail(status, message, scope?)`. An unmatched
route responds `404 {success:false, error:{message:"No mock route for..."}}`
instead of hanging or crashing, so a gap here is easy to spot.
