# `src/lib` — Shared libs

Small, purpose-clear modules. If a new file here would need more than a paragraph to explain, split it before adding.

## Inventory

| File | Runs on | Purpose |
|---|---|---|
| [`accounts-api.ts`](accounts-api.ts) | server (Node & Edge) | Proxy helpers for `src/app/api/**` — `proxyToAccounts`, `fetchAccountsJson`, `requireSecretKey`, `requirePublishableKey`, `requireAdminKey`, `errorResponse`. |
| [`admin-types.ts`](admin-types.ts) | anywhere | Shared TS types (`App`, `LoginMethodDetails`, …). Add cross-feature types here, not in `page.tsx`. |
| [`auth/session.ts`](auth/session.ts) | Edge (middleware) | HMAC-signed `admin_session` cookie via Web Crypto. Do not import Node-only APIs here. |
| [`brand.ts`](brand.ts) | anywhere | `BRAND_ACCENT` for the DS provider — one constant, kept isolated. |
| [`utils.ts`](utils.ts) | anywhere | `cn()`, `apiUrl()`, `buildAdminHref()`, `BASE_PATH`, `INTERNAL_API_URL`, `ADMIN_API_KEY`, `ENVIRONMENT`, `IS_PRODUCTION`. Do not turn this into a general dumping ground — one purpose per export. |
| [`i18n/index.ts`](i18n/index.ts) | anywhere | Barrel — the only sanctioned barrel in the repo. |
| [`i18n/messages.ts`](i18n/messages.ts) | anywhere | `getMessages(locale)`. |
| [`i18n/types.ts`](i18n/types.ts) | anywhere | `Locale`, `SUPPORTED_LOCALES`, `DEFAULT_LOCALE = 'es'`. |
| [`i18n/locales/es.json`](i18n/locales/es.json) / [`en.json`](i18n/locales/en.json) | anywhere | Translation dictionaries. Every new user string goes in BOTH. |

## Edge-runtime constraints

`auth/session.ts` is imported by [`src/middleware.ts`](../middleware.ts) which runs on the Edge. That means:

- **Web Crypto only** — no `require('crypto')`, no Node `Buffer`, no `fs`, no `path`.
- No side effects on import.
- Keep the file dependency-free — do not import from `utils.ts` or any file that pulls in Node modules.

Verify by grep before adding an import: if the target file (or any transitive import) needs Node APIs, it can't live here.

## Adding a new shared type

Put it in [`admin-types.ts`](admin-types.ts) if it's used across `>1` feature. Keep feature-only types in the feature file. Do NOT create `src/types/` — the flat layout is intentional.

## Adding a new env var

1. Add the accessor to [`utils.ts`](utils.ts) with the correct default (`process.env.FOO ?? '<default>'`).
2. Document it in [`.envs/.env.example`](../../.envs/.env.example) with purpose, whether it's server or client, and a safe example.
3. Update [AGENTS.md §8](../../AGENTS.md#8-environment-variables--full-inventory) if it's operator-facing.

## i18n

- Look up: `const { t } = useI18n(); t('sidebar.users')`.
- Nested keys use dot notation, resolved by `getNested()` in [`src/context/i18n-context.tsx`](../context/i18n-context.tsx).
- Missing key → returns the key literal — visible in the UI, that's the point.
- To add a locale: update `SUPPORTED_LOCALES` in [`i18n/types.ts`](i18n/types.ts), add `<locale>.json`, wire it in [`messages.ts`](i18n/messages.ts).
