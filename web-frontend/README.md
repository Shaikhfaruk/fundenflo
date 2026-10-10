# FundenFlo web

One Next.js app for every FundenFlo user — borrowers, partners (CAs and DSAs), lenders, ops, admin, finance and compliance. It runs as a website, installs as a PWA, and can be loaded by a native WebView wrapper.

Plan: [`../docs/FRONTEND_ARCHITECTURE_PLAN.md`](../docs/FRONTEND_ARCHITECTURE_PLAN.md) · Screens and backend routes: [`../docs/inventory/web-frontend.md`](../docs/inventory/web-frontend.md)

## Run locally

1. Start the backend API (`backend/`, port 3000). Its `.env` needs `CORS_ORIGINS=http://localhost:3100` for realtime and `AUTH_OTP_STATIC_CODE` for local sign-in.
2. Copy `.env.example` to `.env.local` and adjust `API_ORIGIN` if the API runs elsewhere.
3. `pnpm install`, then `pnpm dev` and open http://localhost:3100.

Staff and lender users sign in with an invitation: run `node dist/scripts/invite-staff.js --email <address> --role ops_lead` in `backend/`, open `/staff/invite/<code>`, then sign in and scan the authenticator QR code.

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm start` | Develop, build and serve on port 3100 |
| `pnpm verify` | Typecheck, lint, spacing rule, unused code (knip), unit tests, API coverage and build |
| `pnpm test:e2e` | Playwright flows on desktop and phone against the running app and backend |
| `pnpm api:routes` | Regenerate `src/lib/api/backend-routes.ts` from `docs/inventory/api-routes.md` |
| `pnpm api:coverage` | Show how many backend routes the app calls (`-- --list` lists the rest, `-- --strict` fails on any) |
| `pnpm i18n:translate` | Translate new or changed strings in `src/messages/en.json` with the Google Cloud Translation API (`GOOGLE_TRANSLATE_API_KEY`) |
| `pnpm icons` | Render the PWA icons from `public/icons/favicon.svg` |

## How it fits together

- Sessions live in httpOnly cookies set by the Next.js server (`src/app/api/session/*`); every API call goes through `/api/v1/*` on the same origin (`src/app/api/v1/[...path]/route.ts`), which adds the bearer token.
- Screens are client components that fetch with TanStack Query through the typed client in `src/lib/api/`; each call names a backend route such as `'GET /applications/:id'`, checked against the generated route list.
- Text comes from `src/messages/<locale>.json`; `/hi/...` and other language prefixes appear once their catalogues exist.
- `public/sw.js` caches the app shell and static assets and shows `/offline` when there is no network; API responses are never cached.
