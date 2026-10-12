# FundenFlo API

NestJS 12 modular monolith: one build, two processes (`dist/main.js` API, `dist/worker.js` worker). Design: [`../docs/BACKEND_ARCHITECTURE_PLAN.md`](../docs/BACKEND_ARCHITECTURE_PLAN.md) · System map: [`../docs/inventory.md`](../docs/inventory.md) · Diagrams: [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) · API reference: [`../postman`](../postman).

## Local setup

```bash
pnpm install
docker compose up -d postgres valkey azurite mailpit
pnpm build
pnpm keys:generate          # creates .env from .env.example and fills empty secrets
pnpm db:migrate
pnpm db:seed
pnpm start                  # API on http://localhost:3000/v1
pnpm start:worker           # queues, outbox relay, maintenance
```

For local sign-in without an SMS provider, keep `SMS_DRIVER=log` (codes appear in the worker log) or set `AUTH_OTP_STATIC_CODE` in `.env`. Both are rejected when `NODE_ENV=production`.

First staff user: `pnpm staff:invite --email <address> --role super_admin`, then accept with `POST /v1/auth/staff/invitations/accept` and sign in with password + authenticator app.

Demo data (after `pnpm db:seed` and a super admin exists): `pnpm demo:seed --admin-email <super admin email> --lender-email <lender user email>` prints the demo staff passwords, lenders and live products. On a Mac against a Docker-hosted Redis, prefix it with `REDIS_URL=redis://localhost:6380`.

## Checks

| Command | Checks |
|---|---|
| `pnpm typecheck` | TypeScript |
| `pnpm lint` / `pnpm lint:boundaries` | oxlint / module boundary rules |
| `pnpm test` | Unit tests |
| `pnpm test:integration` | Integration tests on Testcontainers (Postgres 18, Valkey, Azurite); needs Docker |
| `pnpm inventory:check` | Routes in code ↔ `docs/inventory/api-routes.md` (after `pnpm build`) |
| `pnpm postman:coverage` | Routes in code ↔ Postman request files (after `pnpm build`) |
| `pnpm postman:flows` | End-to-end Newman flows against the running API and worker |

## Runtime configuration

All configuration is environment variables validated at startup by `src/config/env.schema.ts`; the full list for infrastructure is in plan §16. Production requires `CRYPTO_DRIVER=azure_key_vault`, a real SMS provider, a real email provider and an empty `AUTH_OTP_STATIC_CODE`.
