# `mock-server` — In-memory backend

Bun HTTP server that mirrors the Go accounts API. Runs on `http://localhost:8099` by default (`MOCK_PORT` overrides). Exactly what `.envs/.env.mock` points `INTERNAL_API_URL` at.

## Layout

- [`server.ts`](server.ts) — request router (uses `URLPattern`), 71 registered routes (some only in Pro, see below).
- [`data.ts`](data.ts) — in-memory arrays (`APP_ID`, users, roles, webhooks, oauth-configs, etc.) and helpers (`nextId`, `paginate`). **State resets on restart.**
- [`urlpattern.d.ts`](urlpattern.d.ts) — ambient types for `URLPattern`.
- [`tsconfig.json`](tsconfig.json) — Bun-typed, separate from root (`../tsconfig.json` excludes this folder on purpose).

## Adding or changing a mocked endpoint

1. Find the equivalent handler in the real backend (`apis/accounts/internal/context/v1/...`) or in the OpenAPI spec (`apis/accounts/docs/swagger.yaml`) to confirm the exact path, method, headers, and payload shape.
2. Add a route in [`server.ts`](server.ts) using `URLPattern` — mirror the real path exactly (`/api/v1/<resource>`, `/v1/apps` for the legacy path, etc.).
3. If it reads/writes state, extend [`data.ts`](data.ts) with a new array or field. Keep it in-memory — do NOT introduce a database or JSON file.
4. Return `Response.json(payload, { status })` — match the backend's `{ success, data }` envelope where it uses one.

## Rules

- **Auth headers are accepted but never validated.** `X-API-KEY`, `X-Publishable-API-Key`, `X-Admin-API-Key` all pass through. That's on purpose — mock mode is for iterating on UI, not for testing auth. Don't add validation "for realism".
- **Do NOT drift from the backend.** If the real endpoint changes shape, mirror that change here. The mock is a contract, not a fiction.
- **Do NOT add features that don't exist in the real API.** No "helpful" endpoints. The mock's job is fidelity, not utility.
- **Handle 204s explicitly.** Some backend endpoints return 204; return the same status here so the admin's `parse: 'empty-ok'` behavior stays consistent.

## Running

- `make mock` — mock only.
- `make dev-mock` — mock + Next.js together, `ENVIRONMENT=mock` set for Next. Kill both with Ctrl-C (the Makefile traps the signal).
- `MOCK_NO_APPS=1 make dev-mock` — start with zero apps to walk through onboarding.
- `MOCK_EDITION=community make dev-mock` — `GET /health` reports `community`; the Pro-only routes (`/api/v1/app-behaviors/embedded-auth`, `/ui/v1/*`) are not registered, so the admin looks exactly like a Community install. Default: `pro`.
- `MOCK_UI_DIR=../accounts/internal/ui/static make dev-mock` — also serves the built Embedded Auth bundle at `/ui/v1/*`, so the Embedded Auth preview renders the real `<accounts-sign-in>` instead of the static approximation.

## Edition and Embedded Auth

- `GET /health` mirrors the backend's public health envelope; the admin reads only `data.edition`.
- Embedded Auth (`GET`/`PUT /api/v1/app-behaviors/embedded-auth`) is registered BEFORE the generic `/api/v1/app-behaviors/:id` routes (first match wins). It validates with the admin's own mirror of the backend contract (`src/lib/embedded-auth.ts`, imported by relative path) and answers `422 app_behaviors.embedded_auth.invalid_config` with `"field: msg; field: msg"`, like the Go use case. Availability comes from the seeds: `email_auth` active → password; its `email_code` / `magic_link` nodes → those strategies (magic link also when the mock's own `magic_link` row is active, which is what its magic-link toggle flips); enabled oauth configs → providers. Like the backend, there is no `embedded_auth` row until the first PUT creates it (GET answers the defaults), so the seeded lists are unchanged.
- In Pro the generic `PUT /api/v1/app-behaviors/:id` refuses the `embedded_auth` row (`app_behaviors.update.use_embedded_auth_endpoint`), as the backend does.
