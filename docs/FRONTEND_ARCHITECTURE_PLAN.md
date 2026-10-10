# FundenFlo Web Frontend — Architecture and Build Plan

> Written 2026-10-10; W0 built the same day. App folder: `web-frontend/`. Screen-by-screen map with the backend routes each screen calls: [`inventory/web-frontend.md`](inventory/web-frontend.md).
> The old Expo app in `frontend/` is not used or changed.

## 1. Goal

One web app that serves every FundenFlo user from the same URL:

- as a **website** on desktop and mobile browsers,
- as an **installable PWA** (home-screen icon, full screen, offline fallback),
- inside a **native wrapper app** later, which only loads the URL in a WebView (no second frontend to build).

It covers all seven areas: public pages, borrower, partner (CA/DSA), lender, ops, admin, finance and compliance. Every backend route meant for people is called by a screen; a coverage check fails the build if one is missed (section 7).

## 2. Stack

| Concern | Choice | Version (2026-10-10) |
|---|---|---|
| Framework | Next.js App Router, React Server Components, Turbopack | `next` 16.4.0, `react` 19.3.0 |
| Language | TypeScript, strict | 5.x |
| Styling | Tailwind CSS with design tokens in CSS variables, compiled by `@tailwindcss/postcss` (the Turbopack loader served stale CSS from its cache); light theme only, matching the native app (owner, 2026-10-10) | `tailwindcss` 4.3.3 |
| Components | shadcn/ui source copied into `src/components/ui` (Base UI primitives, `base-nova` style), restyled to the native app's Sovereign Advisory system with 44 px touch targets on phones; Material Symbols icons through `@iconify-icons/material-symbols` (offline modules, same names as the native app); motion with `motion` | shadcn 4.21.4, `@base-ui/react` 1.9.0 |
| Data | TanStack Query on the client; server components for first paint | 5.104.1 |
| Forms | React Hook Form + Zod (same Zod major as the backend) | 7.89.0 / `zod` 4.6.5 |
| Text | `next-intl`; English catalogue is the source; other languages generated (section 6) | 4.14.9 |
| Toasts | `sonner` (never `alert`) | 2.0.8 |
| PWA | Web app manifest (`app/manifest.ts`) + hand-written `public/sw.js` (Serwist's Turbopack route needs Cache Components off) | — |
| Realtime | Socket.IO client to the API gateway | 4.8.4 (server 4.8.3) |
| Tests | Vitest + Testing Library (units), Playwright (end to end, desktop and phone viewports) | 5.0.3 / 1.64.0 |
| Lint and checks | oxlint with React, a11y and Next plugins, `tsc --noEmit`, knip (unused code), spacing check | oxlint 1.87.0, knip |

Project rules that apply to every screen: no code comments; Tailwind margins and paddings stay at `*-4` or below (larger gaps come from layout, e.g. `gap-*`, `space-*` and grid); enums and constants live in constants files; messages go through toasts or inline errors.

## 3. Architecture

```mermaid
flowchart LR
  subgraph Device["Browser · installed PWA · native WebView"]
    UI[React screens<br/>TanStack Query cache]
    SW[Service worker<br/>app shell + offline page]
  end
  subgraph Next["web-frontend (Next.js server)"]
    RSC[Server components<br/>first paint per role]
    BFF["/api/* route handlers<br/>session cookies · proxy · refresh"]
  end
  API[(NestJS API /v1)]
  GW[(Socket.IO gateway)]
  UI -->|same-origin fetch| BFF
  RSC -->|Bearer from cookie| API
  BFF -->|Bearer from cookie| API
  UI -->|short-lived access token| GW
  SW -.->|precache shell only| UI
```

### 3.1 Sessions (backend-for-frontend)

- The browser never stores tokens in JavaScript storage. Sign-in calls go to `web-frontend` route handlers, which call the API and keep the access and refresh tokens in `httpOnly`, `Secure`, `SameSite=Lax` cookies.
- Every client request goes to `/api/v1/...` on the same origin; the handler adds `Authorization: Bearer`, forwards `If-Match`, `Idempotency-Key` and `X-Request-Id`, streams uploads, and passes the JSON error body through unchanged.
- On `TOKEN_EXPIRED` the handler refreshes once (refresh rotation with reuse detection stays on the backend) and retries; on `REFRESH_TOKEN_REUSED`, `SESSION_REVOKED` or `USER_SUSPENDED` it clears the cookies and sends the user to sign-in.
- Mutating requests are checked for a same-origin `Origin` header (CSRF), on top of `SameSite`.
- Socket.IO needs a token in the browser: `/api/session/socket-token` returns the current access token (15 minutes), only to the same origin.
- One device can hold several contexts (borrower, partner firm, lender, staff). `/me` lists the memberships; the context switcher calls `POST /auth/switch-context` and reloads the shell for the new role.

### 3.2 Folder structure

```
web-frontend/
  src/app/
    (public)/            landing, sign-in, staff sign-in + MFA, invitation, consent link, offline
    (borrower)/app/      borrower home and the application journey
    (partner)/partner/   CA/DSA portal
    (lender)/lender/     lender portal
    (staff)/ops|admin|finance/  staff console (one shell, menu by role)
    account/             profile, security, consents, notifications, privacy (every context)
    api/                 session and proxy route handlers
    manifest.ts  sw.ts  layout.tsx
  src/components/ui/     design system primitives
  src/components/<area>/ shared building blocks per area (journey steps, lead card, versioned config editor …)
  src/lib/api/           typed client per backend module + endpoint registry
  src/lib/session/       cookie names, refresh, context
  src/lib/constants/     enums mirrored from the backend, nav per role, query keys, limits
  src/messages/          en.json (source) + generated languages
  tests/e2e/             Playwright specs per role
```

### 3.3 Data, errors and forms

- **Typed client**: one file per backend module (`lib/api/applications.ts` …). Each function names its endpoint from the registry (`endpoint('GET /applications/:id')`), so the coverage check can see it. Response types mirror the backend view shapes.
- **Errors**: the backend returns `{ code, message, details, requestId }`. Field errors (`VALIDATION_FAILED` with `details[].path`) land on the form fields; everything else shows a toast with the message and the request id for support. `VERSION_CONFLICT` offers "reload"; `403` shows a "no access" page; `RATE_LIMITED` / `OTP_COOLDOWN` show the wait time.
- **Concurrency**: edits send `If-Match: "<version>"`; creates that support it send an `Idempotency-Key`.
- **Lists**: cursor pagination (`items`, `nextCursor`) with "load more" on phones and paged tables on desktop.
- **Realtime**: socket events invalidate the matching queries (documents scanned, submission status, lead offers …) and raise a toast; `GET /sync/changes` catches up after the socket reconnects.
- **Uploads**: multipart through the proxy with progress; downloads open the backend's 5-minute signed URL.

### 3.4 Navigation and roles

- Contexts: `borrower`, `partner` (owner, agent), `lender` (admin, manager, user), `staff` (super admin, ops lead, ops reviewer, credit analyst, finance, compliance officer, support).
- The menu per role is a constants map that mirrors `backend/src/modules/access/domain/permissions.ts`; the backend still decides every request, so a hidden link is convenience, not security.
- Phones: bottom tab bar (4–5 primary items) + "more" sheet; tablets and desktops: collapsible sidebar. Tables become cards below `md`.

### 3.5 Responsive, PWA and native wrapper

- Mobile-first layouts, 44 px touch targets, `env(safe-area-inset-*)` padding for notches and the WebView, no hover-only actions.
- Manifest: name, icons cropped from the real logo (192, 512, maskable), navy theme colour, `display: standalone`, start URL `/` (the intro sends returning visitors to sign-in or home).
- Service worker: precaches the app shell, fonts and icons; pages are network-first with the offline page as fallback; **API responses are never cached** (personal and financial data). An "update available" toast reloads into the new version; the first worker taking control of a page never reloads it (a mid-flow reload would drop the OTP step).
- Native wrapper bridge (for later): if `window.ReactNativeWebView` exists, the app asks the wrapper for its Expo push token and registers it with `PUT /me/sessions/current/push-token`; file inputs and downloads use standard browser behaviour that WebViews support.

## 4. Design system

- Same theme and UI as the native app in `frontend/` (read-only reference; owner, 2026-10-10): navy `#0A192F`, gold `#FDB901`, canvas `#F8FBFF`, semantic success, warning (gold), danger and info; light theme only. Full spec: `.claude/context/web/2026-10-10_native-app-design-system-reference.md`.
- Poppins for headings and Inter for text (Devanagari and other Indian scripts fall back to Noto Sans), tabular numbers for money. Title Case for headings, buttons and labels; sentence case for longer text, hints and errors.
- Layouts: sign-in is a navy hero with a white sheet (split screen on desktop); borrower screens use the native header ("Namaste"), bottom tabs on phones and a 560 px column (two columns on desktop); partner, lender and staff use the Stitch portal layout (navy sidebar with a gold active marker, white top bar).
- Motion: entrance fades and staggers, zoom-in checks, sliding tab and nav markers, animated counters and progress bars; `MotionConfig reducedMotion="user"` respects the device setting.
- Components: button, input, OTP input, select, combobox, date picker, checkbox, radio, switch, textarea, file drop zone, card, table, data list, tabs, dialog, sheet, drawer, toast, badge, status pill, progress steps, empty state, skeleton, avatar, breadcrumb, pagination, money and date formatters (₹ with Indian digit grouping, IST).
- Building blocks reused across roles: journey stepper, document checklist, status timeline, versioned config editor (draft → submit → approve → publish → retire), conditions builder, JSON diff viewer, audit trail, assignment card.
- The first screens (sign-in, borrower home, application start, partner dashboard, ops leads) are reviewed by the owner before the rest are built.

## 5. Screens

Full table: [`inventory/web-frontend.md`](inventory/web-frontend.md). Summary:

| Area | Screens | Backend routes |
|---|---|---|
| Public (landing, OTP sign-in, staff sign-in + MFA, invitation, consent link, offline, session handling) | 7 | 13 |
| Account (profile, security and logins, consents, notifications, privacy, switch role, realtime catch-up and push bridge) | 7 | 22 |
| Borrower (home, profile + PAN, application journey: start, requirement, questions, people, consents, documents, assessment, matches, submissions, timeline) | 13 | 45 |
| Partner (sign-up, dashboard, leads inbox and detail, follow-ups, own leads, clients and filed applications, referrals, disputes, commissions, team, profile and KYC, settings) | 14 | 38 |
| Lender (submissions inbox and detail, products, change requests) | 4 | 7 |
| Ops (leads, follow-ups, conversions, reports, cases, document review, signals, submissions, parties, disputes, risk, data requests) | 18 | 65 |
| Admin (users, invitations, audit, catalog, attributes and conditions, questionnaires, change requests, consents, notification templates, imports, lead sources and API clients, routing, partners, lenders and products, documents, scoring, commission schemes) | 24 | 170 |
| Finance (receivables, payouts, reconciliation, trial balance) | 4 | 11 |
| **Total** (some catalog routes are shared by several screens) | **91** | **367** |

## 6. Languages

- All interface text lives in `src/messages/en.json`; screens never hard-code strings. Pages sit under a `[locale]` root segment read with `next/root-params`, so every language prerenders; English has no prefix (`/app`), other languages do (`/hi/app`) once their catalogue exists (`src/messages/available-locales.ts`).
- `pnpm i18n:translate` sends new or changed English strings to the Google Cloud Translation API and writes `hi`, `bn`, `mr`, `gu`, `ta`, `te`, `kn`, `ml`, `pa`, `or` catalogues (key `GOOGLE_TRANSLATE_API_KEY`, never committed). Generated files are reviewed like code; a hand-corrected string is kept on the next run.
- The account screen has two choices: screen language (URL prefix, any generated language) and SMS and push language (`PATCH /me/profile` `preferredLanguage`, which the backend accepts as `en` or `hi`).
- Consent texts, document names and other backend content are shown in the backend's own locale and marked `translate="no"`: the backend records the exact consent text shown (template version and text hash), so it must not be rewritten in the browser.
- The in-page Google Translate widget is not used: it rewrites the page's DOM, which breaks React updates, and it would alter recorded consent text.

## 7. Connecting every API

- `src/lib/api/endpoints.ts` is the registry: `METHOD /path` for every backend route the app uses.
- `pnpm api:coverage` reads the backend route list (`docs/inventory/api-routes.md`, itself checked against the code by `pnpm inventory:check`) and fails when a route is neither in the registry nor in the exclusion list.
- Exclusions, each with a reason: `/v0/*` (compat for the old app), `/health/*` (infrastructure), `POST /public/leads` (server-to-server with an API key), planned webhooks and direct-upload routes (not built).
- Playwright flows per role call the real local backend (seeded), on a desktop and a phone viewport.

## 8. Milestones

| # | Slice | Done when |
|---|---|---|
| W0 | Foundation: app, tokens and components, BFF sessions, proxy and errors, endpoint registry and coverage check, PWA (manifest, service worker, offline, install and update prompts), text catalogue and translate script, shells per role, OTP and staff sign-in with MFA, invitation, context switch, account screens | Sign-in for every role works on phone and desktop; Lighthouse PWA installable; owner reviews the look |
| W0.5 | Native design rework (owner, 2026-10-10): native theme, logo and icons, motion layer, intro splash and slides, sign-in with Login As, borrower, portal and auth shells, every W0 screen rebuilt | Owner signs off the side-by-side review against the native and Stitch screens |
| W1 | Borrower journey I: home, application start, requirement, pre-check questions, people and co-applicant OTP, consents, borrower profile and PAN; realtime bridge, sync catch-up, native push-token bridge (built 2026-10-11) | A borrower reaches "documents" from a fresh sign-up (Playwright `journey.spec.ts`, desktop and phone) |
| W2 | Borrower journey II: documents (upload, checklist, requests), analysis and assessment, matches, submissions, timeline, withdraw, subscriptions, public consent link (built 2026-10-11; consent link at `/consent?token=` because the backend builds `CONSENT_LINK_URL?token=`) | A borrower submits to a lender end to end (Playwright `borrower-loop.spec.ts`, desktop and phone) |
| W3 | Partner I (built 2026-10-11): sign-up, dashboard, leads inbox and detail, activities, follow-ups, own leads, offline conversion, convert to application | A CA accepts a lead and converts it (Playwright `partner-work.spec.ts`, desktop and phone) |
| W4 | Partner II (built 2026-10-11): clients and filed applications (journey in partner mode at `/partner/applications/*`, borrower consent and lender-scoped sharing by SMS code), referrals and codes, commissions, team, profile, KYC, capacity, service areas, disputes | A CA files a case to a lender and ops approves it (Playwright `partner-work.spec.ts`); commission with real payouts waits for W8 finance |
| W5 | Lender portal (built 2026-10-11): inbox, submission decisions, packet and documents, document requests, products and change requests | A lender acknowledges, queries, sanctions and disburses a submission (Playwright `borrower-loop.spec.ts`, desktop and phone) |
| W6 | Ops console (built 2026-10-11) | Ops can work leads, cases, document review, submissions, parties, risk and data requests (Playwright `ops.spec.ts` and the ops approval in `borrower-loop.spec.ts`, desktop and phone) |
| W7 | Admin (built 2026-10-11): users, access, audit, catalog, attributes and condition playground, questionnaires, consents, notifications, imports, lead sources and API keys, routing, partners, lenders, products, documents, scoring, commission schemes, change requests | Every admin and versioned config route is used from a screen (354 of 367 connected; the rest are W8 finance plus `GET /catalog/questions` and `POST /borrower-profiles`, which no web flow needs yet) |
| W8 | Finance, polish and gates (built 2026-10-11): receivables, payouts with two people, reconciliation, trial balance; role-aware staff home; contrast tokens; accessibility gate | `pnpm api:coverage --strict` passes (365 of 365; 22 routes excluded with reasons in `scripts/backend-routes.mjs`); all Playwright flows pass on both viewports (52 runs); `accessibility.spec.ts` (axe, WCAG 2.1 A/AA, serious and critical) passes for public, borrower, partner, staff, admin and finance pages; Lighthouse not yet run (needs a production build and Chrome, see morning notes) |

## 9. Backend notes found while planning

- Push notifications are Expo-only; a website or PWA gets realtime toasts and in-app badges. Browser web push would need a backend channel (VAPID keys and a `webpush` sender) and is not planned.
- The web origin must be allowed by the API's CORS settings only for the Socket.IO connection; other calls are server to server through the BFF.
- The direct-upload routes (`/documents/upload-url`, `/documents/:id/complete`) are still planned; uploads go through the proxy.
- Behind the web server the API must run with `TRUST_PROXY=true` so the client IP forwarded in `X-Forwarded-For` reaches consent evidence and session records.
- Only the `journey` consent template is seeded. WhatsApp and marketing opt-ins appear on the account screen once compliance publishes a `communications` consent template (the consent wording needs legal review).
- Local development: the backend `.env` needs `CORS_ORIGINS=http://localhost:3100` for the realtime socket.
