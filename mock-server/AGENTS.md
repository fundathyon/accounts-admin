# `mock-server` — In-memory backend

Bun HTTP server that mirrors the Go accounts API. Runs on `http://localhost:8099` by default (`MOCK_PORT` overrides). Exactly what `.envs/.env.mock` points `INTERNAL_API_URL` at.

## Layout

- [`server.ts`](server.ts) — request router (uses `URLPattern`), 67 registered routes.
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
