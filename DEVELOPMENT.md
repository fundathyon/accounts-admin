# Development

Everything you need to go from `git clone` to a running admin panel — real backend or mocked.

## 1. Prerequisites

- **Bun ≥ 1.4** — package manager and mock-server runtime. Install: <https://bun.sh>.
- **Node ≥ 20** — Next.js still shells out to Node during build. Bun handles the rest.
- **Docker** (optional) — only needed for the containerized prod bundle (`make docker-*`).
- **The Go accounts backend** — only if you want to run against real data. Otherwise use mock mode.

## 2. First-time setup

```bash
git clone <repo>
cd accounts-admin
make install
cp .envs/.env.example .envs/.env.local     # or .env.mock — see below
```

Edit `.envs/.env.local` to point at your running accounts backend (default `http://localhost:8001/accounts`) and to seed your admin API keys. Nothing else needs changing to start.

## 3. Two dev modes

### 3a. Mocked backend (fastest, zero-dependency)

```bash
cp .envs/.env.example .envs/.env.mock
make dev-mock
```

Starts the Bun mock at `http://localhost:8099` and Next.js at `http://localhost:3000` with `ENVIRONMENT=mock`. The mock has 67 in-memory routes mirroring the real API (source: [`mock-server/server.ts`](mock-server/server.ts)). Data resets when the mock restarts.

- `MOCK_NO_APPS=1 make dev-mock` — start with zero apps so you can walk through onboarding.
- `MOCK_PORT=9099 make mock` — override the port.

### 3b. Real backend

Bring up the Go accounts service separately, then:

```bash
make dev
```

Next.js starts at `http://localhost:3000` and talks to whatever `INTERNAL_API_URL` says (default `http://localhost:8001/accounts` from the example env).

## 4. Log in as admin without typing a password

Default creds in every non-prod env file are `admin` / `changeme` — just paste them on the login page.

For scripts/tests, mint the `admin_session` cookie directly using the known secret. In mock mode:

```
secret       = "mock-session-secret"          # ADMIN_SESSION_SECRET in .env.mock
timestamp    = "<Date.now() as string>"
signature    = base64( HMAC-SHA256(secret, timestamp) )
cookieValue  = base64url("<timestamp>.<signature>")
Cookie:      admin_session=<cookieValue>
```

Reference implementation: `createSessionCookie()` in [`src/lib/auth/session.ts`](src/lib/auth/session.ts).

## 5. Environment files

Loading order (see [`load-envs.ts`](load-envs.ts)):

1. `.envs/.env.base` — sets `ENVIRONMENT` (default `local`).
2. `.envs/.env.<environment>` — real values, overrides base.

`ENVIRONMENT` → file mapping:

| ENVIRONMENT | File |
|---|---|
| `local` | `.envs/.env.local` |
| `mock` | `.envs/.env.mock` |
| `development` | `.envs/.env.dev` |
| `production` | `.envs/.env.prod` |
| `staging` | `.envs/.env.staging` |

Every real value file is `.gitignore`d. Only [`.envs/.env.example`](.envs/.env.example) is tracked. Full variable reference: [AGENTS.md §8](AGENTS.md#8-environment-variables--full-inventory).

## 6. Daily commands

| I want to… | Command |
|---|---|
| Start dev (real backend) | `make dev` |
| Start dev + mock together | `make dev-mock` |
| Just the mock | `make mock` |
| Lint | `make lint` |
| Autofix lint issues | `make lint-fix` |
| Typecheck | `make typecheck` |
| Full check before a PR | `make validate` |
| Production build | `make build` |
| Run the built bundle | `make start` |
| Wipe .next & tsbuildinfo | `make clean` |
| Wipe .next + node_modules & reinstall | `make reset` |

Behind each: `bun run <script>` — see `package.json`. There is no `npm run`. There is no `test` script (no test suite; see [AGENTS.md §11](AGENTS.md#11-known-constraints)).

## 7. Live-editing the design system alongside this repo

`@foundathyon/community-ui` is installed from a git tag. To iterate on both at once, see the memory note in [`~/.claude/projects/…/memory/community-ui-local-checkout.md`](memory): the workflow is `packages/community-ui` → `dist` on tags → `rsync` into `node_modules` to verify.

Quick local override (temporary):

```bash
cd /path/to/community-ui
bun run build
rsync -av --delete dist/ /path/to/accounts-admin/node_modules/@foundathyon/community-ui/dist/
```

## 8. Docker (prod bundle only)

`docker-compose.yml` builds from the root `Dockerfile` — a 3-stage build (Bun deps → Bun builder → Node 22 runner as non-root user `nextjs:1001`, exposes port 3000, mapped to host 3001). This is for validating the containerized artifact locally, not for development.

```bash
make docker-build   # docker compose build
make docker-up      # docker compose up -d      (localhost:3001)
make docker-down    # docker compose down
```

CI (`.github/workflows/dev.yaml`) builds a byte-for-byte duplicate at [`docker_images/app/Dockerfile.app`](docker_images/app/Dockerfile.app) — if you edit one, mirror the change in the other.

## 9. Common gotchas

- **`BASE_PATH` placeholder**: Docker builds bake `BASE_PATH=/__NEXT_BASE_PATH_PLACEHOLDER__` and [`entrypoint.sh`](entrypoint.sh) `sed`s it to the runtime value. [`next.config.ts`](next.config.ts) skips `basePath` when it sees the placeholder to avoid generating invalid regex for `_next/data` routes. Do not remove that guard.
- **Cookie missing after login**: `admin_session` is HttpOnly + `SameSite=Lax`. In a non-standard host header setup (custom reverse proxy), the cookie may be dropped — check `Set-Cookie` in the login response.
- **401 on every API call**: the admin UI attaches Secret/Publishable keys from `localStorage`. If you cleared browser storage, either paste them again in Settings, or set `NEXT_PUBLIC_DEV_SECRET_KEY` / `NEXT_PUBLIC_DEV_PUBLISHABLE_KEY` and reload.
- **`bun install` warns about `@foundathyon/community-ui`**: it's a GitHub tag dep — a network hiccup can leave a partial install. `make reset` fixes it.
- **Mock resets on every restart**: the mock is in-memory (`mock-server/data.ts`). If you're mid-test, don't restart the mock.

## 10. Debugging tips for agents

- Every proxy route is a thin `fetch` — inspect Network in DevTools to see both request → `/api/*` and downstream `INTERNAL_API_URL/...` (server-side only; enable `console.log` in the route handler if needed).
- `next.config.ts` uses `output: "standalone"` — production builds land in `.next/standalone/`.
- No source maps in production by default. Keep dev mode open for real debugging.
- Middleware runs at the Edge — imports must be Edge-compatible. Web Crypto only, no Node built-ins in `src/middleware.ts` or `src/lib/auth/session.ts`.
