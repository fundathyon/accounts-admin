# `src/app/api` — BFF proxy routes

Every route here except `admin/{login,logout,session}` is a **thin proxy** to the Go accounts backend at `INTERNAL_API_URL`. If a route in this folder starts talking to a database, disk, or a third service, something is wrong.

## The one pattern

```ts
// src/app/api/<resource>/route.ts
import { proxyToAccounts, requireSecretKey } from '@/lib/accounts-api';

export async function GET(request: Request) {
  const auth = requireSecretKey(request);
  if (auth.error) return auth.error;

  return proxyToAccounts('/api/v1/<resource>', {
    method: 'GET',
    headers: { 'X-API-KEY': auth.key },
    cache: 'no-store',
  });
}
```

That's the entire template. Copy it, swap the resource name, and you're done.

## Auth helpers (from [`@/lib/accounts-api`](../../lib/accounts-api.ts))

| Helper | Source of key | Forwarded header | Use for |
|---|---|---|---|
| `requireSecretKey(req)` | client `X-Secret-API-Key` | `X-API-KEY` | most admin resource CRUD (users, roles, webhooks, keys, oauth-configs, behaviors, email-access, dashboard-stats, revoke, etc.) |
| `requirePublishableKey(req, msg?, fallbackHeader?)` | client `X-Publishable-API-Key` (with optional fallback) | `X-API-Key` | anonymous end-user flows (`/emails/signup`, `/emails/signin`, `/emails/activate`, `/oauths/link`) |
| `requireAdminKey()` | server env `ADMIN_API_KEY` | `X-Admin-API-Key` | admin-scoped: `/apps` (GET/POST), everything under `/system/*` |

**Pick exactly one.** The backend disambiguates by header name.

## Body-parsing choices in `proxyToAccounts`

`init.parse` accepts:

- `'json'` (default) — `res.json()` unconditionally.
- `'json-safe'` — text first, `JSON.parse` only if non-empty (use for endpoints that may return an empty 200).
- `'empty-ok'` — 204 → empty body; otherwise `res.json().catch(() => ({}))` (use for DELETE/PUT that may 204).

## When you need more than one backend call

Use `fetchAccountsJson(path, init)` instead — it returns `{ status, ok, data }`. Compose them and build your own `NextResponse`. Example: [`src/app/api/users/route.ts`](users/route.ts) loops pages of `/api/v1/users?page=` to aggregate.

## Do NOT

- Do NOT call `INTERNAL_API_URL` directly. Route it through the helpers so error envelopes stay consistent (`{ success: false, error: { message } }`).
- Do NOT introduce a new auth scheme. Three helpers cover every case; the backend does not accept a fourth header.
- Do NOT cache. Every proxy call sets `cache: 'no-store'`. Never introduce ISR here.
- Do NOT read cookies here — session verification already happened in [`src/middleware.ts`](../../middleware.ts). The cookie is not forwarded to the backend.
- Do NOT add server actions or turn a proxy into a server component.
- Do NOT put business logic here beyond pagination aggregation. The backend is the source of truth.

## Extending

New resource → new folder here with `route.ts` (and dynamic segments as `[id]/route.ts`). Grep for `proxyToAccounts` in a sibling resource to see the exact shape. Then mock it in [`../../../mock-server/server.ts`](../../../mock-server/server.ts) so `make dev-mock` still works end-to-end.
