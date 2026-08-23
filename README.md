# Foundathyon Accounts Admin

Admin panel para el servicio **Accounts** de Foundathyon. **Next.js 16** (App Router) · React 19 · TypeScript · Tailwind v4 · **Bun**.

## Cómo empezar

```bash
make install
cp .envs/.env.example .envs/.env.mock
make dev-mock          # Next.js (:3000) + backend mock (:8099) en paralelo
```

Abre <http://localhost:3000>. Credenciales por defecto: `admin` / `changeme`.

Para correr contra el backend Go real:

```bash
cp .envs/.env.example .envs/.env.local  # ajusta INTERNAL_API_URL
make dev
```

## Antes de un PR

```bash
make validate          # lint + typecheck + build
```

Sin tests automatizados. Verifica cambios de UI manualmente contra `make dev-mock`.

## Documentación

| Archivo | Para qué |
|---|---|
| [AGENTS.md](AGENTS.md) | Manual operativo para agentes de IA y nuevos contribuidores. **Empieza aquí.** |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Flujo de request, capas, límites de seguridad. |
| [DEVELOPMENT.md](DEVELOPMENT.md) | Setup local, envs, modos de desarrollo, gotchas. |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Estilo de commits, checklist de PR. |
| [docs/](docs/README.md) | Guías de usuario y referencias del backend. |

## Comandos frecuentes

| Acción | Make | bun |
|---|---|---|
| Instalar | `make install` | `bun install` |
| Dev (backend real) | `make dev` | `bun run dev` |
| Dev + mock | `make dev-mock` | — |
| Solo mock | `make mock` | `bun run mock` |
| Lint | `make lint` | `bun run lint` |
| Typecheck | `make typecheck` | `bun run typecheck` |
| Build | `make build` | `bun run build` |
| **Validar antes del PR** | `make validate` | `bun run validate` |
| Docker | `make docker-{build,up,down}` | — |

## Variables de entorno

Todas documentadas en [`.envs/.env.example`](.envs/.env.example). `load-envs.ts` selecciona el archivo por `ENVIRONMENT`:

| `ENVIRONMENT` | Archivo |
|---|---|
| `local` (default) | `.envs/.env.local` |
| `mock` | `.envs/.env.mock` |
| `development` / `production` / `staging` | `.envs/.env.dev` / `.env.prod` / `.env.staging` |

Solo `.envs/.env.example` está versionado; el resto está en `.gitignore`.
