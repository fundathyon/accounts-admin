# Documentation index

Purpose-organized entry points. If you land here from an AI agent, start with the root [AGENTS.md](../AGENTS.md) instead.

## Contributor-facing (root)

- [AGENTS.md](../AGENTS.md) — operational manual for AI agents (and any new contributor).
- [ARCHITECTURE.md](../ARCHITECTURE.md) — request flow, layers, boundaries.
- [DEVELOPMENT.md](../DEVELOPMENT.md) — local setup, environments, dev loop.
- [CONTRIBUTING.md](../CONTRIBUTING.md) — commit style, PR checklist, review conventions.

## Guides

- [guides/admin-panel.md](guides/admin-panel.md) — end-user tour of every admin route (Spanish).

## Backend API reference

Prose references for the accounts backend endpoints that this admin proxies. The authoritative machine-readable contract lives in the accounts repo at `apis/accounts/docs/swagger.yaml` — use it when generating types or double-checking payload shapes.

- [backend/apps-image-update.md](backend/apps-image-update.md) — `PATCH /api/v1/apps` (image field).
- [backend/email-auth-behavior.md](backend/email-auth-behavior.md) — `email_auth` behavior config schema.
- [backend/oauth-configs.md](backend/oauth-configs.md) — OAuth config CRUD.
- [backend/roles.md](backend/roles.md) — roles CRUD.
- [backend/tokens.md](backend/tokens.md) — validate/refresh JWT endpoints.
- [backend/webhooks.md](backend/webhooks.md) — webhooks CRUD + `GET /events`.

## Decisions

Add architectural decision records under `docs/decisions/` only when a real trade-off is made and future readers would otherwise re-litigate it. Keep them short: context, decision, consequences.
