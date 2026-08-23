# Contributing

Short list. If you're an AI agent, read [AGENTS.md](AGENTS.md) first.

## Before you open a PR

1. Read the folder-scoped `AGENTS.md` closest to what you're changing.
2. Make the smallest change that solves the problem.
3. Run `make validate` — it must pass (`lint` → `typecheck` → `build`).
4. If your change is UI-visible, exercise it locally via `make dev-mock` and describe what you saw in the PR body. There is no test suite (see [AGENTS.md §11](AGENTS.md#11-known-constraints)).

## Commit style — Conventional Commits

Follow the [Conventional Commits](https://www.conventionalcommits.org/) spec, in English, one concern per commit. Prefer `type(scope): summary` when a scope adds signal.

Common types used in this repo:

- `feat` — new user-visible feature.
- `fix` — bug fix.
- `refactor` — internal restructuring, no behavior change.
- `docs` — docs, comments, AGENTS files.
- `test` — tests (no suite yet; will apply once one exists).
- `build` — build tooling (Docker, package.json scripts, Next config).
- `chore` — everything else (dep bumps, housekeeping).

Examples pulled from recent history:

```
docs: add admin panel user guide
feat(tables): add client-side pagination to AdminDataTable
refactor(users): replace email login icon with lucide Mail
fix(theme): correct text-muted class to use the muted-foreground token
fix(theme): port the full design-token set into the Tailwind theme
```

Rules:

- Present tense, no trailing period.
- Under 72 chars for the summary.
- Wrap the body at 100 chars if you add one.
- Do NOT stuff multiple unrelated changes into one commit. Use `/auto-commits` (the skill) to split messy staging.

## Branch naming

`<type>/<slug>` — same types as commits, kebab-case slug. Examples:

- `feat/user-metadata-admin`
- `fix/session-cookie-basepath`
- `refactor/proxy-helpers`

Base branch: `main`. Feature branches merge into `main` via PR.

## PR checklist

Copy this into the PR description and check it off:

- [ ] `make validate` passes locally.
- [ ] For UI changes: exercised via `make dev-mock` (screenshot or short description of the result).
- [ ] No new user-visible strings inlined — added to both `es.json` and `en.json`.
- [ ] No secret committed (grep the diff for `sk_`, `pk_`, `password`, `Bearer `).
- [ ] No new dependency added without a written reason in the PR body.
- [ ] `AGENTS.md` / folder-scoped `AGENTS.md` / `.envs/.env.example` updated if the change makes any of them stale.
- [ ] If middleware allowlist changed: justified in the PR body (auth-adjacent change).

## What we prefer NOT to see

- Big cosmetic renames unrelated to the diff.
- New abstractions that only have one caller.
- Server actions (`"use server"`) — the project deliberately uses only client components + BFF routes.
- A separate `format` step — ESLint handles the checks we care about. If you want a formatter, propose it as its own PR.
- `npm install` output (see [AGENTS.md §10](AGENTS.md#10-things-not-to-do)).

## Reviewer notes

- The pages under `src/app/(admin)/{users,oauth-providers}/` are large (~1,900 lines). A refactor PR touching one of them should focus on one concern and explain the boundary chosen — don't rewrite the whole page.
- The API-key helpers in [`src/lib/accounts-api.ts`](src/lib/accounts-api.ts) are the *only* correct way to forward keys. Any PR that inlines its own header handling is a red flag.
- Design-system-shaped changes belong in `@foundathyon/community-ui` — don't fork primitives locally.
