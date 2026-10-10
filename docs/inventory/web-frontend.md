# Inventory — Web frontend

> App: `web-frontend/` (Next.js 16.4). Plan: [`../FRONTEND_ARCHITECTURE_PLAN.md`](../FRONTEND_ARCHITECTURE_PLAN.md). Last updated: 2026-10-10 (W0 built, W0.5 native design rework).
> Every backend route meant for people appears below at least once (367 of 387). Excluded: `/v0/*` (17, compat for the old app), `/health/*` (2, infrastructure), `POST /public/leads` (1, server-to-server with an API key). `pnpm api:coverage` in `web-frontend/` counts the routes the code calls (40 of 367 after W0).
> Status: `useful` when the screen is built, calls every route listed and is covered by a Playwright flow (`web-frontend/tests/e2e/`); otherwise `planned`.

## Public

| Path | Screen | Who | Backend routes | Milestone | Status |
|---|---|---|---|---|---|
| `/` | Intro as in the native app: navy splash once per browser session, then three onboarding slides on the first visit; returning visitors go to sign-in, signed-in people to their home (W0.5 replaced the W0 landing page and `components/public/segment-list.tsx`) | everyone | — | W0.5 | `useful` |
| `/login` | OTP sign-in in the native layout: navy hero, "Login As" picker (borrower, DSA, CA, lender → team sign-in), India mobile field or email, referral expander, 6-digit code step with shake and resend timer | borrower, partner | `POST /auth/otp/request` · `POST /auth/otp/verify` | W0 | `useful` |
| `/staff/login` | Staff and lender sign-in (email + password) then authenticator code | staff, lender | `POST /auth/staff/login` · `POST /auth/staff/mfa/verify` | W0 | `useful` |
| `/staff/invite/[token]` | Accept a staff or lender invitation: set password, enrol authenticator | staff, lender | `POST /auth/staff/invitations/accept` | W0 | `useful` |
| `/c/[token]` | Consent link from SMS: read the purposes, confirm with OTP | lead (not signed in) | `GET /public/consent-requests/:token` · `POST /public/consent-requests/:token` · `GET /catalog/consent-templates` | W2 | `planned` |
| `/offline` | Offline page served by the service worker | everyone | — | W0 | `useful` |
| `(session)` | Session handling in the BFF: refresh, logout, context switch | everyone | `POST /auth/token/refresh` · `POST /auth/logout` · `POST /auth/switch-context` | W0 | `useful` |

## Account

| Path | Screen | Who | Backend routes | Milestone | Status |
|---|---|---|---|---|---|
| `/account` | Profile: name, language, email; who am I and my roles | every context | `GET /me` · `PATCH /me/profile` | W0 | `useful` |
| `/account/security` | Devices (sessions) and sign out others; linked logins; mobile change with OTP | every context | `GET /me/sessions` · `DELETE /me/sessions/:id` · `DELETE /me/sessions` · `GET /me/logins` · `POST /me/logins` · `POST /me/logins/verify` · `DELETE /me/logins/:id` · `POST /me/mobile-change` · `POST /me/mobile-change/verify` | W0 | `useful` |
| `/account/consents` | Consent centre: what I agreed to, give WhatsApp and marketing opt-ins, withdraw | every context | `GET /me/consents` · `POST /me/consents` · `POST /me/consents/:purpose/withdraw` | W0 | `useful` |
| `/account/notifications` | Update channels: SMS, email, push | every context | `GET /me/notification-preferences` · `PUT /me/notification-preferences` | W0 | `useful` |
| `/account/privacy` | My data requests: download a copy, ask for a correction or erasure | every context | `GET /me/data-requests` · `POST /me/data-requests` · `GET /me/data-requests/:id/export-url` | W0 | `useful` |
| `/account/switch` | Switch role: borrower, partner firm, lender, staff | every context | `POST /auth/switch-context` | W0 | `useful` |
| `(shell)` | Realtime catch-up after reconnect; native wrapper push token | every context | `GET /sync/changes` · `PUT /me/sessions/current/push-token` | W0 | `planned` |

## Borrower

| Path | Screen | Who | Backend routes | Milestone | Status |
|---|---|---|---|---|---|
| `/app` | Home: my applications with stage, status, amount and next step | borrower | `GET /applications` | W0 | `useful` |
| `/app/profile` | Borrower profile (individual or business), PAN verification | borrower | `GET /borrower-profiles` · `POST /borrower-profiles` · `GET /borrower-profiles/:id` · `PATCH /borrower-profiles/:id` · `POST /borrower-profiles/:id/kyc/pan` · `GET /catalog/geo/states` · `GET /catalog/geo/cities` · `GET /catalog/geo/pincodes/:pincode` | W1 | `planned` |
| `/app/applications/new` | Start: segment, sub-segment, loan category with availability, business name | borrower | `POST /applications` · `GET /catalog/segments` · `GET /catalog/loan-categories` | W0 | `useful` |
| `/app/applications/[id]` | Case overview: journey stepper, current step and blockers, requirement summary | borrower | `GET /applications/:id` · `GET /applications/:id/next-step` | W0 | `useful` |
| `/app/applications/[id]/requirement` | Requirement: amount, tenure, purpose, urgency | borrower | `PATCH /applications/:id/requirement` | W1 | `planned` |
| `/app/applications/[id]/questions` | Pre-check and lender questions (progressive profiling) | borrower | `GET /applications/:id/questions` · `PUT /applications/:id/answers` · `GET /catalog/questions` | W1 | `planned` |
| `/app/applications/[id]/people` | Co-applicants and directors, consent by OTP | borrower | `GET /applications/:id/parties` · `POST /applications/:id/parties` · `DELETE /applications/:id/parties/:pid` · `POST /applications/:id/parties/:pid/consent-otp` · `POST /applications/:id/parties/:pid/consent-otp/verify` | W1 | `planned` |
| `/app/applications/[id]/consents` | Consents for this case: sharing with chosen lenders, AI document reading, bureau | borrower | `POST /applications/:id/consents` · `GET /catalog/consent-templates` | W1 | `planned` |
| `/app/applications/[id]/documents` | Document checklist, upload with progress, lender document requests | borrower | `GET /applications/:id/document-checklist` · `GET /applications/:id/document-requests` · `POST /documents` · `GET /documents` · `GET /documents/:id` · `GET /documents/:id/download-url` · `DELETE /documents/:id` · `GET /catalog/document-checklist` | W2 | `planned` |
| `/app/applications/[id]/assessment` | Run analysis, readiness score, what to improve | borrower | `POST /applications/:id/analyses` · `GET /analyses/:id` · `GET /applications/:id/assessment` · `POST /notifications/subscriptions` | W2 | `planned` |
| `/app/applications/[id]/matches` | Matching lenders with reasons; choose where to apply | borrower | `POST /applications/:id/matches` · `GET /applications/:id/matches/latest` | W2 | `planned` |
| `/app/applications/[id]/submissions` | Applications sent to lenders, status, withdraw | borrower | `GET /applications/:id/submissions` · `POST /applications/:id/submissions` · `GET /applications/:id/submissions/:submissionId` · `POST /applications/:id/submissions/:submissionId/withdraw` | W2 | `planned` |
| `/app/applications/[id]/timeline` | Timeline of everything that happened; withdraw the case | borrower | `GET /applications/:id/timeline` · `POST /applications/:id/withdraw` | W2 | `planned` |

## Partner

| Path | Screen | Who | Backend routes | Milestone | Status |
|---|---|---|---|---|---|
| `/partner/signup` | Register a firm: kind, name, ICAI number, segments, languages, states and pincodes; registration received state | signed-in user | `POST /partner/signup` | W0 | `useful` |
| `/partner` | Dashboard: offers, active leads, due follow-ups, conversions, referrals; verification banner | partner | `GET /partner/dashboard` · `GET /partner/profile` | W0 | `useful` |
| `/partner/leads` | Lead inbox: offers to accept or decline, my leads | partner | `GET /partner/leads` | W3 | `planned` |
| `/partner/leads/new` | Add my own lead (with consent request) | partner | `POST /partner/leads` | W3 | `planned` |
| `/partner/leads/[id]` | Lead: accept, decline, return, reveal contact, edit, lost, sub-assign, activities, follow-ups, offline conversion, convert to application | partner | `GET /partner/leads/:id` · `POST /partner/leads/:id/accept` · `POST /partner/leads/:id/decline` · `POST /partner/leads/:id/return` · `POST /partner/leads/:id/reveal-contact` · `POST /partner/leads/:id/sub-assign` · `POST /partner/leads/:id/lost` · `GET /partner/leads/:id/activities` · `POST /partner/leads/:id/activities` · `POST /partner/leads/:id/follow-ups` · `PATCH /partner/leads/:id` · `POST /partner/leads/:id/offline-conversion` · `POST /partner/leads/:id/convert` | W3 | `planned` |
| `/partner/follow-ups` | Follow-ups due today, overdue, done | partner | `GET /partner/follow-ups` · `PATCH /partner/follow-ups/:id` | W3 | `planned` |
| `/partner/clients/new` | Add a client borrower and file an application for them | partner | `POST /partner/borrowers` · `POST /partner/applications` | W4 | `planned` |
| `/partner/applications/[id]/*` | Filed application: the borrower journey screens in partner mode, plus borrower consent by OTP | partner | `POST /partner/applications/:id/borrower-consent/send` · `POST /partner/applications/:id/borrower-consent/verify` | W4 | `planned` |
| `/partner/referrals` | Referral codes to share; referred borrowers and protection | partner | `GET /partner/referral-codes` · `GET /partner/referrals` | W4 | `planned` |
| `/partner/disputes/new` | Claim a borrower another firm holds | partner | `POST /partner/attribution-disputes` | W4 | `planned` |
| `/partner/commissions` | Commission summary, ledger and monthly statement | partner (statement: owner) | `GET /partner/commissions/summary` · `GET /partner/commissions/ledger` · `GET /partner/commissions/statement` | W4 | `planned` |
| `/partner/team` | Members and invitations; roles and status | partner owner | `GET /partner/members` · `POST /partner/members` · `PATCH /partner/members/:id` | W4 | `planned` |
| `/partner/profile` | Firm profile and KYC: PAN, GSTIN, bank account, membership number | partner (edit: owner) | `PATCH /partner/profile` | W4 | `planned` |
| `/partner/settings` | Capacity and service areas | partner (edit: owner) | `GET /partner/capacity` · `PUT /partner/capacity` · `GET /partner/service-areas` · `PUT /partner/service-areas` | W4 | `planned` |

## Lender

| Path | Screen | Who | Backend routes | Milestone | Status |
|---|---|---|---|---|---|
| `/lender` | Submissions inbox with status tabs | lender | `GET /lender/submissions` | W0 | `useful` |
| `/lender/submissions/[id]` | Submission: borrower packet, documents, acknowledge, query, sanction, disburse, reject, ask for documents | lender | `GET /lender/submissions/:id` · `POST /lender/submissions/:id/events` · `POST /lender/submissions/:id/document-requests` · `GET /lender/submissions/:id/documents/:documentId/download-url` | W5 | `planned` |
| `/lender/products` | Our products on FundenFlo and their live criteria | lender | `GET /lender/products` | W5 | `planned` |
| `/lender/products/[id]` | Ask for a product change (goes to FundenFlo for approval) | lender | `POST /lender/products/:id/change-requests` | W5 | `planned` |

## Ops

| Path | Screen | Who | Backend routes | Milestone | Status |
|---|---|---|---|---|---|
| `/ops/leads` | Lead queue: search, status and consent filters, load more | ops | `GET /ops/leads` | W0 | `useful` |
| `/ops/leads (actions)` | Create a lead, bulk assign and route, merge duplicates | ops | `POST /ops/leads` · `POST /ops/leads/bulk-assign` · `POST /ops/leads/bulk-route` · `POST /ops/leads/merge` | W6 | `planned` |
| `/ops/leads/[id]` | Lead: edit, qualify, disqualify, hold, reopen, recycle, lose, reveal contact, consent request, route, assign, revoke, activities, follow-ups | ops | `GET /ops/leads/:id` · `PATCH /ops/leads/:id` · `POST /ops/leads/:id/qualify` · `POST /ops/leads/:id/disqualify` · `POST /ops/leads/:id/hold` · `POST /ops/leads/:id/reopen` · `POST /ops/leads/:id/recycle` · `POST /ops/leads/:id/lose` · `POST /ops/leads/:id/reveal-contact` · `POST /ops/leads/:id/consent-request` · `POST /ops/leads/:id/route` · `POST /ops/leads/:id/assign` · `POST /ops/leads/assignments/:assignmentId/revoke` · `GET /ops/leads/:id/activities` · `POST /ops/leads/:id/activities` · `POST /ops/leads/:id/follow-ups` | W6 | `planned` |
| `/ops/follow-ups` | Team follow-ups | ops | `GET /ops/follow-ups` · `PATCH /ops/follow-ups/:id` | W6 | `planned` |
| `/ops/conversions` | Offline conversions reported by partners: verify or reject | ops | `GET /ops/offline-conversions` · `POST /ops/offline-conversions/:id/decide` | W6 | `planned` |
| `/ops/reports` | Lead funnel and partner performance | ops | `GET /ops/reports/leads/funnel` · `GET /ops/reports/partners/performance` | W6 | `planned` |
| `/ops/cases` | Case queue | ops, credit | `GET /ops/cases` | W6 | `planned` |
| `/ops/cases/[id]` | Case: facts with verify, assessment recompute, assignment, document requests, timeline | ops, credit | `GET /ops/cases/:id` · `POST /ops/cases/:id/facts/:attribute/verify` · `POST /ops/cases/:id/assign` · `POST /ops/cases/:id/document-requests` · `POST /ops/assessments/:id/recompute` | W6 | `planned` |
| `/ops/documents/[id]` | Document review: extracted values, verify or reject | ops | `GET /ops/documents/:id/extractions` · `POST /ops/documents/:id/review` | W6 | `planned` |
| `/ops/signals` | Consistency signals between declared and observed facts | ops, credit | `GET /ops/consistency-signals` · `POST /ops/consistency-signals/:id/resolve` | W6 | `planned` |
| `/ops/submissions` | Submissions waiting for approval and in progress | ops | `GET /ops/submissions` | W6 | `planned` |
| `/ops/submissions/[id]` | Submission: approve, record lender events | ops | `GET /ops/submissions/:id` · `POST /ops/submissions/:id/approve` · `POST /ops/submissions/:id/events` | W6 | `planned` |
| `/ops/parties/match-reviews` | Possible duplicate people and businesses: resolve or merge | ops | `GET /ops/party-match-reviews` · `GET /ops/party-match-reviews/:id` · `POST /ops/party-match-reviews/:id/resolve` · `POST /ops/parties/merge` | W6 | `planned` |
| `/ops/parties/merges` | Merge history with undo | ops | `GET /ops/party-merges` · `POST /ops/party-merges/:id/revert` | W6 | `planned` |
| `/ops/parties/[partyId]` | Party: facts and history, consents and history, answers | ops | `GET /ops/parties/:partyId/facts` · `POST /ops/parties/:partyId/facts` · `GET /ops/parties/:partyId/facts/history` · `GET /ops/parties/:partyId/consents` · `POST /ops/parties/:partyId/consents` · `GET /ops/parties/:partyId/consents/history` · `GET /ops/parties/:partyId/answers` · `POST /ops/parties/:partyId/answers` | W6 | `planned` |
| `/ops/disputes` | Attribution disputes between partner firms | ops | `GET /ops/attribution-disputes` · `POST /ops/attribution-disputes/:id/resolve` | W6 | `planned` |
| `/ops/risk` | Risk signals and fraud reviews: clear or confirm | ops, credit, compliance | `GET /ops/risk-signals` · `GET /ops/fraud-reviews` · `GET /ops/fraud-reviews/:id` · `POST /ops/fraud-reviews/:id/decision` | W6 | `planned` |
| `/ops/data-requests` | DPDP requests: holds, complete, reject | compliance, ops lead | `GET /ops/data-requests` · `GET /ops/data-requests/:id` · `POST /ops/data-requests/:id/complete` · `POST /ops/data-requests/:id/reject` | W6 | `planned` |

## Admin

| Path | Screen | Who | Backend routes | Milestone | Status |
|---|---|---|---|---|---|
| `/admin/users` | Users, roles and status; memberships | super admin, ops lead | `GET /admin/users` · `GET /admin/users/:id` · `PATCH /admin/users/:id` · `POST /admin/memberships` · `PATCH /admin/memberships/:id` | W7 | `planned` |
| `/admin/invitations` | Invite staff, lender and partner users; revoke | super admin, ops lead | `GET /admin/invitations` · `POST /admin/invitations` · `POST /admin/invitations/:id/revoke` | W7 | `planned` |
| `/admin/audit` | Audit trail with filters; verify the hash chain | super admin, compliance | `GET /admin/audit-events` · `GET /admin/audit-events/verify` | W7 | `planned` |
| `/admin/catalog/segments` | Segments and sub-segments | ops lead | `GET /admin/segments` · `POST /admin/segments` · `PATCH /admin/segments/:id` · `POST /admin/segments/:id/sub-segments` · `PATCH /admin/sub-segments/:id` | W7 | `planned` |
| `/admin/catalog/categories` | Loan categories and purposes | ops lead | `GET /admin/loan-categories` · `POST /admin/loan-categories` · `GET /admin/loan-categories/:id` · `PATCH /admin/loan-categories/:id` · `POST /admin/loan-categories/:id/purposes` · `PATCH /admin/loan-categories/:id/purposes/:purposeId` | W7 | `planned` |
| `/admin/catalog/geo` | Cities, pincodes and look-up aliases | ops lead | `GET /admin/geo/cities` · `POST /admin/geo/cities` · `PATCH /admin/geo/cities/:id` · `GET /admin/geo/pincodes` · `POST /admin/geo/pincodes` · `GET /admin/lookup-aliases` · `POST /admin/lookup-aliases` · `DELETE /admin/lookup-aliases/:id` | W7 | `planned` |
| `/admin/attributes` | Attribute dictionary; condition builder playground | ops lead, credit | `GET /admin/attributes` · `POST /admin/attributes` · `GET /admin/attributes/:id` · `PATCH /admin/attributes/:id` · `POST /admin/conditions/validate` · `POST /admin/conditions/evaluate` | W7 | `planned` |
| `/admin/questions` | Question bank | ops lead | `GET /admin/questions` · `POST /admin/questions` · `GET /admin/questions/:id` · `PATCH /admin/questions/:id` | W7 | `planned` |
| `/admin/question-sets` | Question sets with versions and preview | ops lead | `GET /admin/question-sets` · `POST /admin/question-sets` · `GET /admin/question-sets/:id` · `PATCH /admin/question-sets/:id` · `POST /admin/question-sets/:id/versions` · `GET /admin/question-sets/:id/versions/:number` · `PATCH /admin/question-sets/:id/versions/:number` · `POST /admin/question-sets/:id/versions/:number/submit` · `POST /admin/question-sets/:id/versions/:number/publish` · `POST /admin/question-sets/:id/versions/:number/retire` · `POST /admin/question-sets/:id/versions/:number/preview` | W7 | `planned` |
| `/admin/change-requests` | Approve or reject submitted config versions (maker-checker) | approvers | `GET /admin/change-requests` · `GET /admin/change-requests/:id` · `POST /admin/change-requests/:id/approve` · `POST /admin/change-requests/:id/reject` | W7 | `planned` |
| `/admin/consents/purposes` | Consent purposes | compliance | `GET /admin/consent-purposes` · `POST /admin/consent-purposes` · `GET /admin/consent-purposes/:id` · `PATCH /admin/consent-purposes/:id` | W7 | `planned` |
| `/admin/consents/templates` | Consent templates per context and language, versioned | compliance | `GET /admin/consent-templates` · `POST /admin/consent-templates` · `GET /admin/consent-templates/:id` · `PATCH /admin/consent-templates/:id` · `POST /admin/consent-templates/:id/versions` · `GET /admin/consent-templates/:id/versions/:number` · `PATCH /admin/consent-templates/:id/versions/:number` · `POST /admin/consent-templates/:id/versions/:number/submit` · `POST /admin/consent-templates/:id/versions/:number/publish` · `POST /admin/consent-templates/:id/versions/:number/retire` | W7 | `planned` |
| `/admin/notification-templates` | Message templates: text, placeholders, DLT ids | compliance | `GET /admin/notification-templates` · `POST /admin/notification-templates` · `PATCH /admin/notification-templates/:id` | W7 | `planned` |
| `/admin/imports` | Lead imports: upload, map columns, validate, commit, undo, errors | ops lead | `GET /admin/imports/fields/:kind` · `GET /admin/imports` · `POST /admin/imports` · `GET /admin/imports/:id` · `POST /admin/imports/:id/inspect` · `PUT /admin/imports/:id/mapping` · `POST /admin/imports/:id/validate` · `POST /admin/imports/:id/commit` · `POST /admin/imports/:id/undo` · `GET /admin/imports/:id/errors` | W7 | `planned` |
| `/admin/lead-sources` | Lead sources and API clients (keys) | ops lead | `GET /admin/lead-sources` · `POST /admin/lead-sources` · `GET /admin/lead-sources/:id` · `PATCH /admin/lead-sources/:id` · `GET /admin/api-clients` · `POST /admin/api-clients` · `DELETE /admin/api-clients/:id` | W7 | `planned` |
| `/admin/routing-rules` | Lead routing rules, versioned, with simulation | ops lead | `GET /admin/routing-rules` · `POST /admin/routing-rules` · `GET /admin/routing-rules/:id` · `PATCH /admin/routing-rules/:id` · `POST /admin/routing-rules/:id/versions` · `GET /admin/routing-rules/:id/versions/:number` · `PATCH /admin/routing-rules/:id/versions/:number` · `POST /admin/routing-rules/:id/versions/:number/submit` · `POST /admin/routing-rules/:id/versions/:number/publish` · `POST /admin/routing-rules/:id/versions/:number/retire` · `POST /admin/routing-rules/simulate` | W7 | `planned` |
| `/admin/partners` | Partner firms: verify, level, suspend, reinstate | ops lead, partner manager | `GET /admin/partners` · `GET /admin/partners/:id` · `POST /admin/partners/:id/verify` · `POST /admin/partners/:id/level` · `POST /admin/partners/:id/suspend` · `POST /admin/partners/:id/reinstate` | W7 | `planned` |
| `/admin/lenders` | Lenders, agreements and contacts | ops lead, lender manager | `GET /admin/lenders` · `POST /admin/lenders` · `GET /admin/lenders/:id` · `PATCH /admin/lenders/:id` · `GET /admin/lenders/:id/agreements` · `POST /admin/lenders/:id/agreements` · `PATCH /admin/lenders/:id/agreements/:aid` · `GET /admin/lenders/:id/contacts` · `POST /admin/lenders/:id/contacts` · `PATCH /admin/lenders/:id/contacts/:cid` | W7 | `planned` |
| `/admin/lender-products` | Lender products: criteria, versions, simulation | lender manager, credit | `GET /admin/lender-products` · `POST /admin/lender-products` · `GET /admin/lender-products/:id` · `PATCH /admin/lender-products/:id` · `POST /admin/lender-products/:id/versions` · `GET /admin/lender-products/:id/versions/:number` · `PATCH /admin/lender-products/:id/versions/:number` · `POST /admin/lender-products/:id/versions/:number/submit` · `POST /admin/lender-products/:id/versions/:number/publish` · `POST /admin/lender-products/:id/versions/:number/retire` · `POST /admin/lender-products/:id/versions/:number/simulate` | W7 | `planned` |
| `/admin/documents/types` | Document types | ops lead | `GET /admin/document-types` · `POST /admin/document-types` · `GET /admin/document-types/:id` · `PATCH /admin/document-types/:id` | W7 | `planned` |
| `/admin/documents/requirements` | Document requirements, versioned | ops lead | `GET /admin/document-requirements` · `POST /admin/document-requirements` · `GET /admin/document-requirements/:id` · `PATCH /admin/document-requirements/:id` · `POST /admin/document-requirements/:id/versions` · `GET /admin/document-requirements/:id/versions/:number` · `PATCH /admin/document-requirements/:id/versions/:number` · `POST /admin/document-requirements/:id/versions/:number/submit` · `POST /admin/document-requirements/:id/versions/:number/publish` · `POST /admin/document-requirements/:id/versions/:number/retire` | W7 | `planned` |
| `/admin/scoring-models` | Scoring models, versioned | credit | `GET /admin/scoring-models` · `POST /admin/scoring-models` · `GET /admin/scoring-models/:id` · `PATCH /admin/scoring-models/:id` · `POST /admin/scoring-models/:id/versions` · `GET /admin/scoring-models/:id/versions/:number` · `PATCH /admin/scoring-models/:id/versions/:number` · `POST /admin/scoring-models/:id/versions/:number/submit` · `POST /admin/scoring-models/:id/versions/:number/publish` · `POST /admin/scoring-models/:id/versions/:number/retire` | W7 | `planned` |
| `/admin/improvement-rules` | Improvement rules, versioned | credit | `GET /admin/improvement-rules` · `POST /admin/improvement-rules` · `GET /admin/improvement-rules/:id` · `PATCH /admin/improvement-rules/:id` · `POST /admin/improvement-rules/:id/versions` · `GET /admin/improvement-rules/:id/versions/:number` · `PATCH /admin/improvement-rules/:id/versions/:number` · `POST /admin/improvement-rules/:id/versions/:number/submit` · `POST /admin/improvement-rules/:id/versions/:number/publish` · `POST /admin/improvement-rules/:id/versions/:number/retire` | W7 | `planned` |
| `/admin/commission-schemes` | Commission schemes, versioned | finance | `GET /admin/commission-schemes` · `POST /admin/commission-schemes` · `GET /admin/commission-schemes/:id` · `PATCH /admin/commission-schemes/:id` · `POST /admin/commission-schemes/:id/versions` · `GET /admin/commission-schemes/:id/versions/:number` · `PATCH /admin/commission-schemes/:id/versions/:number` · `POST /admin/commission-schemes/:id/versions/:number/submit` · `POST /admin/commission-schemes/:id/versions/:number/publish` · `POST /admin/commission-schemes/:id/versions/:number/retire` | W8 | `planned` |

## Finance

| Path | Screen | Who | Backend routes | Milestone | Status |
|---|---|---|---|---|---|
| `/finance/receivables` | Receivables: invoice, receive, reconcile, write off | finance | `GET /admin/finance/receivables` · `GET /admin/finance/receivables/:id` · `PATCH /admin/finance/receivables/:id` | W8 | `planned` |
| `/finance/payouts` | Partner payouts: approve, mark paid (second person), reverse | finance | `GET /admin/finance/payouts` · `GET /admin/finance/payouts/:id` · `POST /admin/finance/payouts/:id/approve` · `POST /admin/finance/payouts/:id/mark-paid` · `POST /admin/finance/payouts/:id/reverse` | W8 | `planned` |
| `/finance/reconciliation` | Bank or lender statement reconciliation runs | finance | `GET /admin/finance/reconciliation` · `POST /admin/finance/reconciliation` | W8 | `planned` |
| `/finance/ledger` | Trial balance | finance | `GET /admin/finance/ledger/trial-balance` | W8 | `planned` |

## Building blocks

| Item | Path | What it does | Status |
|---|---|---|---|
| Session BFF | `src/app/api/session/*/route.ts`, `src/lib/server/*` | OTP and MFA verify, switch context, refresh (per-token de-duplication for 10 s), logout, socket token; httpOnly cookies `ff_at` / `ff_rt` (path `/api/session`) plus readable `ff_exp` / `ff_ctx`; same-origin check on writes | `useful` |
| API proxy | `src/app/api/v1/[...path]/route.ts` | Forwards to the backend `/v1` with the bearer token, `If-Match`, `Idempotency-Key`, `X-Request-Id`, `X-Forwarded-For`; streams bodies; refuses token-issuing paths; synthetic `TOKEN_EXPIRED` when the access cookie has lapsed | `useful` |
| Typed client | `src/lib/api/*.ts`, `src/lib/api/backend-routes.ts` (generated) | `apiRequest(route, options)`: proactive refresh, one retry after `TOKEN_EXPIRED`, `ApiError` with field issues; one module per backend area with TanStack `queryOptions` | `useful` |
| Client session | `src/lib/session/*` | Web Locks single-flight refresh across tabs, BroadcastChannel session signals, destination after sign-in, `useMe` | `useful` |
| Proxy (route guard) | `src/proxy.ts` | next-intl locale routing; protected areas redirect to `/login` or `/staff/login` with `next` | `useful` |
| App shell | `src/components/shell/*` | `app-shell.tsx` picks the layout per context: `borrower-shell.tsx` (native "Namaste" header, bottom tabs with a sliding gold dot on phones, nav pills on desktop) or `portal-shell.tsx` (Stitch navy sidebar with a gold marker, top bar, drawer on phones); `auth-shell.tsx` (navy hero + sheet, split screen on desktop) with `language-toggle.tsx`; menu per role (`src/lib/constants/navigation.constants.ts`, Material Symbols names); area guard; user menu (account, switch role, sign out). W0.5 removed `nav-icon.tsx` and the theme switch | `useful` |
| Design system | `src/app/globals.css`, `src/components/ui/*`, `src/components/data/*`, `src/components/brand/logo.tsx` | Native app tokens (navy, gold, canvas, onboarding palette), Poppins + Inter, real logo and mark from `frontend/assets/brand`; shadcn (Base UI) components restyled to the native specs (52 px buttons, 54 px fields with navy focus, OTP boxes with shake, navy switches and checks); native building blocks `icon.tsx` (Material Symbols), `icon-tile.tsx`, `eyebrow.tsx`, `step-header.tsx` (segmented gold bar), `choice.tsx` (row, tile, chip), `mobile-input.tsx` (India flag and +91), `icon-input.tsx`, `secure-note.tsx`; status badges in the Stitch colour map (`StatusTone` now in `status.constants.ts`), responsive list (Stitch table on desktop, cards on phones), stat card with icon square and coloured underline, empty state, search input, confirm dialog | `useful` |
| PWA | `src/app/manifest.ts`, `public/sw.js`, `src/components/pwa/*`, `public/icons/*` | Manifest with maskable icons, versioned service worker (static cache-first, pages network-first with `/offline`, never `/api`), update prompt, install button | `useful` |
| Text and languages | `src/messages/en.json`, `src/i18n/*`, `scripts/translate-messages.mjs` | next-intl with `[locale]` root segment (`as-needed` prefix); Google Cloud Translation script for 10 Indian languages | `useful` (English only until translated) |
| Motion | `src/components/motion/*`, `src/lib/constants/motion.constants.ts` | `MotionProvider` (respects reduced motion), `FadeIn`, `Stagger`, `ZoomIn`, `AnimatedNumber`; durations and easing as in the native app | `useful` |
| Intro | `src/components/intro/*`, `src/lib/constants/intro.constants.ts` | Splash and onboarding slides with illustrations, swipe and arrow keys; seen flags in session and local storage | `useful` |
| Checks | `scripts/api-coverage.mjs`, `scripts/check-spacing.mjs`, `knip.json`, `.oxlintrc.json`, `vitest.config.mts`, `playwright.config.ts` | Route coverage, spacing rule (≤ `*-4`), unused code, lint with React and a11y rules, unit tests, end-to-end on desktop and phone | `useful` |
| Realtime | — | Socket.IO bridge that invalidates queries on backend events | `planned` (W1) |
