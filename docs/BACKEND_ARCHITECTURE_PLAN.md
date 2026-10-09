# FundenFlo Backend — Architecture & Build Plan

> Status: **proposed plan, pre-scaffold** · Prepared 9 Oct 2026
> Sources: `FundenFlo_Revised_Master_Roadmap_With_App_Versions.docx`, frontend repo `fundenflo-v1-app` @ `7bc9685` (cloned to `./frontend`, reference only), Stitch designs in `frontend/stitch_fundenflo_mobile_login_screen (4)/`.
> Scope: backend + APIs only. The frontend is a demo on mocks and is **not** being changed now.
> Out of scope: deployment and infrastructure. These run on **Azure** and are owned by **Pradeep**. The backend stays cloud-agnostic and gets everything it needs through environment config (§16).
> **First business priority:** collect the existing backlog of leads and hand them to our CAs (§7). The data model is designed so this works now and grows into the full journey without a restructure.
> Living docs: system map in [`inventory.md`](inventory.md), diagrams in [`ARCHITECTURE.md`](ARCHITECTURE.md), known duplicates in [`DUPLICATES.md`](DUPLICATES.md).

---

## Contents

1. [What the frontend tells us](#1-what-the-frontend-tells-us)
2. [Product rules that become engineering rules](#2-product-rules-that-become-engineering-rules)
3. [User types, roles & permissions](#3-user-types-roles--permissions)
4. [Architecture overview](#4-architecture-overview)
5. [Tech stack](#5-tech-stack)
6. [The dynamic core — how any lender can be onboarded](#6-the-dynamic-core--how-any-lender-can-be-onboarded)
7. [Leads & CA distribution (first delivery)](#7-leads--ca-distribution-first-delivery)
8. [Workflows & state machines](#8-workflows--state-machines)
9. [Data model](#9-data-model)
10. [API design](#10-api-design)
11. [Project structure](#11-project-structure)
12. [Postman collection strategy (instead of Swagger)](#12-postman-collection-strategy-instead-of-swagger)
13. [AI architecture](#13-ai-architecture)
14. [Security, privacy & compliance](#14-security-privacy--compliance)
15. [Integrations](#15-integrations)
16. [Local development, CI checks, observability, testing](#16-local-development-ci-checks-observability-testing)
17. [Delivery plan mapped to app versions](#17-delivery-plan-mapped-to-app-versions)
18. [Decisions needed](#18-decisions-needed)

---

## 1. What the frontend tells us

**Stack:** Expo SDK 57, React Native 0.86, Expo Router, React Context + AsyncStorage, fetch client (`src/services/api.ts`). Mock mode is on unless `EXPO_PUBLIC_API_URL` is set.

**Borrower journey built (19 screens):** splash/onboarding → mobile OTP login (with referral code and a "Login as" role picker) → Step 1 entity type → Step 2 category / amount & tenure / purpose → Step 3 pre-check → Step 4 consent → Step 5 documents + analysis → Verify details (name, PAN, DOB) → Step 6 score + improvement plan → matched lenders → apply → application status → home dashboard, notifications, profile.

**Designed but not built (Stitch):** partner portal dashboard, partner "file application" with borrower OTP consent, commissions ledger, ops case queue (with extracted data and confidence, score breakdown, audit trail, flags, SLA timers, assignment).

### 1.1 Hardcoded today → must be served by the backend

| Frontend constant / mock | File | Becomes (backend) |
|---|---|---|
| Entity types `msme` / `individual` | `store/app-store.tsx` | `segments` + `sub_segments` (proprietorship, pvt ltd, LLP, salaried, self-employed…) |
| 8 loan categories with min/max/step/default, tenures, purposes, `assumedRate` | `constants/loan.ts` | `loan_categories`, `category_purposes`, `category_segments` |
| Which categories each segment sees | `CATEGORIES_FOR` | `category_segments` + **computed availability** from live lender products |
| 35 cities | `CITIES` | Geography master (state → city → pincode) used by lender coverage |
| 4 pre-check questions per segment | `PRE_CHECK_QUESTIONS` | **Questionnaire engine** (versioned question sets + progressive profiling) |
| 3 consent items + `CONSENT_VERSION` | `constants/consent.ts` | Versioned **consent templates** + append-only consent records |
| `documentsFor()` checklist logic | `constants/documents.ts` | **Document requirement rules** (segment × category × lender product × answers) |
| 10 MB / PDF·JPG·PNG | `constants/documents.ts` | `document_types` config |
| Analysis step labels | `services/documents.ts` mock | Real pipeline step states |
| Score factors, `bandFor()` thresholds | `services/score.ts` mock | Versioned **scoring models** |
| Improvement items | `services/score.ts` mock | **Improvement rules** |
| Lender A/B/C + reasons | `services/lenders.ts` mock | **Matching engine** over versioned lender product policies |
| Application timeline | `services/application.ts` mock | Projection of `application_events` |
| Referral code format (4–12 alphanumeric) | `(auth)/login.tsx` | `referral_codes` + lead attribution |
| Roles: Borrower / DSA / CA / Lender | `(auth)/login.tsx` | Organizations + memberships + RBAC |

### 1.2 Endpoint contract the app already calls

| Call | Body → Response |
|---|---|
| `POST /auth/otp/request` | `{mobile, countryCode, referralCode?}` → `{resendIn}` |
| `POST /auth/otp/verify` | `{mobile, otp}` → `{token, user}` |
| `PATCH /auth/profile` | `{fullName, pan, dob: "DD/MM/YYYY"}` → profile |
| `GET /loan/categories?entityType=` | → `{categories: [{id, available, reason?}]}` |
| `POST /loan/requirement` | `{entityType, loanCategory, amount, tenureYears, location, purpose, purposeNote?}` → `{id}` |
| `POST /loan/pre-check` | `{entityType, answers}` → `{ok}` |
| `POST /consent` | `{version, submittedAt, items: {aiDocuments, creditBureau, lenderSharing}}` → `{ok}` |
| `POST /documents` | multipart `docType, consentVersion, file` → `{id}` |
| `GET /documents/:id` · `DELETE /documents/:id` | → `{status: processing \| verified{summary?} \| rejected{reason}}` |
| `POST /analysis` · `GET /analysis/:id` | `{documentIds, consentVersion}` → `{id}`; → `{status, steps[], message?}` |
| `POST /score` | `{analysisId}` → `{score{value, band, assessedAt, factors[], basedOn}, improvement[]}` |
| `POST /lenders` | `{analysisId}` → `{lenders: [{id, name, kind, product, verified, indicative?, interest, documentsStillNeeded?, reasons[]}]}` |
| `POST /applications` · `GET /applications/:id` | `{lenderId}` → application with `timeline[]`, `pendingDocument?` |
| `POST /notifications/whatsapp` | `{analysisId \| applicationId, event}` → `{ok}` |

Errors are read as top-level `{message, code}` (`api.ts`), so **the error body stays flat** (see §10.1).

### 1.3 Gaps the backend must close

1. **No case ID is passed between calls.** `/loan/requirement` returns an `id` that the app never sends back. Pre-check, consent, documents, analysis and applications are not linked to it. → The v1 API is explicit (`/v1/applications/:id/...`). A thin compatibility layer resolves the borrower's *active draft application* for the old calls.
2. **No refresh token or logout.** The token sits in AsyncStorage with no expiry. → Short-lived access token, rotating refresh token, `POST /auth/logout`.
3. **The client sends its own consent timestamps.** → The server records authoritative time, IP, device, user agent and a hash of the exact consent text. Client timestamps are informational only.
4. **The "Login as" role is picked in the UI but not sent.** → The OTP request carries `loginAs`. The server checks it against the user's memberships, so one mobile number can sign in as borrower, CA, DSA or lender (§3.4).
5. **Category limits, tenures and purposes live in the app.** → `GET /v1/catalog/loan-categories` returns the full config so the app can delete its constants later.
6. **The app only knows `status: 'under_review'`.** → The backend exposes the full state model (§8).
7. **There is no co-applicant, guarantor or business-director concept.** → Lenders need it, so the model has `application_parties` (§9).

---

## 2. Product rules that become engineering rules

These come from the roadmap and are **enforced in code**, not left to convention:

| Roadmap rule | Engineering enforcement |
|---|---|
| AI recommends; lenders decide | AI never writes lender-outcome states. Sanction, rejection and disbursal need a lender or ops actor plus evidence. |
| No fabricated rates, offers or approval probabilities | The API schema has no `probability` field. `interest` comes only from the product's disclosure text. `indicative` amounts appear only when the lender's published product defines a formula. |
| Score is 0–100, explainable, not a bureau score | A deterministic scoring engine with a versioned model. Each result stores its input snapshot and model version, so it can be reproduced. |
| Missing data → "insufficient information" | The scoring engine has a per-factor missing-data policy. It never invents a value. |
| Show a category only where a verified lender route exists | Category availability is **computed** from active lenders, agreements and published product coverage. |
| Submitted ≠ sanctioned ≠ disbursed ≠ commission collected | Separate state machines for application, lender submission and commission ledger (§8). |
| Every status change records who, when, why and source | Append-only `application_events`, written by the state machine only. |
| Consent is specific, auditable and withdrawable | `ConsentGuard` gates each processing purpose. Records are append-only and versioned. |
| Private documents and access logs | Private blob storage, short-lived signed URLs, every read logged. |
| Lender criteria have owner, date and version | Lender product versions are immutable once published, approved by a second person (maker-checker), and pinned to each application. |
| Human handles fraud and exceptions | AI and rules raise **signals** only. A fraud decision needs a human reviewer. |
| Not hardcoded to Delhi NCR | Geography is data. Coverage belongs to lender products. |

---

## 3. User types, roles & permissions

### 3.1 Actors

| Actor | Organization type | Roles | Logs in via |
|---|---|---|---|
| Individual borrower | — (personal) | `borrower` | Mobile OTP (app) |
| MSME / business borrower | `business` | `business_owner`, `authorised_signatory`, `business_member` | Mobile OTP (app) |
| Co-applicant / guarantor / director | — | none (party on an application) | OTP consent link only |
| Lead / prospect | — | none (a party record with one or more leads) | Nobody logs in. If the person signs up later, the new user links to the same party. |
| DSA / CA / connector | `partner` | `partner_owner`, `partner_agent` | Mobile OTP or email + OTP (partner web) |
| Lender (bank, NBFC, HFC, SFB, co-op) | `lender` | `lender_admin`, `lender_credit_officer`, `lender_viewer` (optional branch/region scope) | Email + password + TOTP (lender web) |
| FundenFlo staff | `fundenflo` | `super_admin`, `ops_lead`, `ops_reviewer`, `credit_analyst`, `lender_manager`, `partner_manager`, `finance`, `compliance_officer`, `support` | Email/SSO + mandatory TOTP |
| System actors | — | `system`, `ai_agent`, `lender_integration` (API client), `webhook` | Service credentials |

One `user` can hold several memberships, for example a CA who is also a borrower. The token carries the **active membership**, and the user switches context explicitly.

### 3.2 Permission model

- **RBAC + attribute conditions** with **CASL** (`@casl/ability`). Each role gets abilities with conditions. Two examples:
  - `partner_agent`: read `Application` where `attribution.partnerOrgId = myOrg`.
  - `lender_credit_officer`: read `Submission` where `lenderId = myLender` **and** an active `lenderSharing` consent covers that lender.
- **Deny by default.** Each route declares `@Can(action, subject)`. Repositories apply the same conditions as query filters, so list endpoints cannot leak data.
- **Field masking by role**, e.g. PAN `ABCDE••••F` everywhere except KYC-verifying roles.
- **Maker-checker (four-eyes)** for publishing lender product versions, scoring models, question sets and consent templates, for partner verification, and for commission payouts.
- Postgres row-level security is a defence-in-depth option for partner/lender tables in v1.1. It is not needed on day one.

### 3.3 Party model — the base that prevents a later restructure

A **party** is a real person or business. It exists **before** anyone logs in (as a lead) and stays the same record through borrowing, co-applying, partnering or lending. Logins, leads, applications and organizations all *point at* parties. None of them keep their own copy of a person.

```
party (kind = person | business)
 ├── party_contacts        mobiles / emails: verified?, primary?, do-not-contact?  (blind-indexed for dedupe)
 ├── party_identifiers     PAN, GSTIN, CIN, Udyam, DIN  (encrypted + blind index)
 ├── party_relationships   person ─ proprietor_of / director_of / partner_of / signatory_of / employee_of ─► business
 ├── borrower_facts        every data point, with provenance (§6.1)
 │
 ├── user                  0..1 per person party — login identity (§3.4)
 ├── organization          0..1 per business party — when it operates on the platform
 │                         (lender, partner firm, FundenFlo, MSME borrower account)
 ├── leads                 0..n — each enquiry from any source (§7)
 └── loan_applications     0..n — borrower role; a converted lead links to the application it became
        ├── application_parties   primary applicant, co-applicants, guarantors, directors (all parties)
        └── lender_submissions    one per lender product applied to
```

- **Lead → borrower needs no migration.** When a lead's person signs up with the same mobile, the new `user` links to the existing party. The lead's answers are already facts on that party, so the journey starts pre-filled.
- **Dedupe** uses blind indexes of mobile, email, PAN and GSTIN. A certain match links automatically. An uncertain match goes to an ops merge queue. Merges are recorded in `party_merges` and can be undone.
- A **borrower profile** is the borrower role on a party. For an individual it is the person party. For an MSME it is the business party plus the person acting for it.

### 3.4 Single user, multiple logins

| Case | Example | Design |
|---|---|---|
| One person, several roles | A CA who is also an MSME borrower; a DSA who is also a CA | One `user`, many `memberships`. `loginAs` on the OTP request picks the context. `POST /auth/switch-context` changes context without a new OTP when the membership exists. |
| One person, several sign-in methods | Mobile OTP in the app; email OTP or Google on the partner web | `user_logins` (method `mobile_otp \| email_otp \| password \| google \| apple`, identifier hash, verified_at). A new method can be linked only while signed in with an existing one, never automatically by matching email. |
| One person, several devices at once | Phone app plus laptop portal | Each sign-in is a `session` (device, IP, user agent, context, last seen). `GET /me/sessions`, revoke one or all. Concurrent-session limits are configurable per role. |
| One organization, many people | CA firm with 5 staff; MSME owner plus accountant; lender branch officers | Each person has their own user and membership. Work is assigned to a member, and every action is recorded per person. There are no shared logins. |

**`loginAs` rules**
- `borrower`: membership is created on the first OTP verify if missing.
- `ca` / `dsa`: requires an approved partner membership. Otherwise sign-in still succeeds, the session opens with context `none` (only `/me`, `/auth/*` and partner signup are allowed), and the response carries `nextAction: { code: "PARTNER_NOT_ONBOARDED" }` so the client can start `POST /partner/signup`. It is still the same user.
- `lender`: invitation only. Without an active lender membership, the session opens with context `none` and `nextAction: { code: "MEMBERSHIP_REQUIRED" }`.
- Pending invitations for the verified mobile or email are accepted automatically at sign-in. Email-only users, such as lender staff, can sign up by email OTP only when such an invitation exists.
- Staff use a separate login with TOTP. Borrower OTP can never open a staff context.
- The access token carries `sub` (user), `mid` (membership), `ctx` (role context) and `sid` (session), and every audit row records all four.

**Edge cases handled now**
- **Mobile number change:** verify the new number by OTP from an existing session. The old login stays in history, and the party keeps the old number as a secondary contact.
- **One person, two accounts** (two numbers, same PAN): ops merge workflow with a full audit trail.
- **Shared family phone:** a mobile number can be the login of only one user. Other family members can still be parties (co-applicant, guarantor) without a login.

---

## 4. Architecture overview

**Style: modular monolith, one codebase with two processes (API and worker).** Module boundaries are strict so a module can be split out later if load requires it. At this stage, microservices would add operational cost without benefit.

```
 Borrower app (Expo)   Partner web   Lender web   Ops/Admin web   Lender APIs / webhooks
          └──────────────┴─────────────┴──────────────┴──────────────┘
                                     │ HTTPS  /v1  (JWT, CASL)
                         ┌───────────▼────────────┐
                         │   API process (NestJS)  │  controllers · guards · validation
                         │   modules + engines     │  writes domain events to OUTBOX
                         └─────┬────────────┬──────┘
                               │            │
                     ┌─────────▼──┐   ┌─────▼─────────┐
                     │ PostgreSQL │   │ Valkey (Redis) │  BullMQ queues · rate limits · cache
                     └─────────▲──┘   └─────▲─────────┘
                               │            │
                         ┌─────┴────────────┴──────┐
                         │ Worker process (NestJS)  │  outbox relay · extraction · analysis
                         │ standalone app           │  matching · notifications · retention
                         └─────┬────────────────────┘    scheduled jobs · webhooks out
                               │ ports & adapters
   Blob storage (private) · Key vault · LLM · Account Aggregator · Bureau · GSTN · PAN/KYC · DigiLocker · SMS · WhatsApp · Email · Push · ClamAV
```

**Core principles**

1. **Configuration is versioned data.** Lenders, products, questions, documents, consent, scoring and commissions are all records with draft → published versions. Adding a lender or product is a data operation, not a deploy.
2. **Fact store with provenance.** Every data point about a borrower is a *fact* tagged with its source: `declared`, `extracted`, `third_party_verified`, `ops_verified` or `derived`. Questions, documents, integrations and formulas all *produce* facts. Rules and scores *consume* them. This decoupling is what makes "any lender, any criteria" possible (§6.1).
3. **Deterministic first, AI second.** AI turns documents into facts and explains results. Rules engines make the eligibility and score calculations.
4. **Pure engines.** Rules, questionnaire resolution, scoring, matching and the state machines are framework-free TypeScript in `src/engines/`, fully unit-tested. They could later ship as an npm package so the app can evaluate question visibility offline.
5. **Event-driven internals through a transactional outbox.** A state change and its event commit in one transaction. The worker relays events to BullMQ, so no event is lost.
6. **Append-only where law or money is involved:** consent records, audit events, application events, ledger entries and facts. Database triggers block `UPDATE`/`DELETE` on these tables.
7. **Pinning.** Each application records the exact versions it used (consent template, question sets, scoring model, lender product versions), so a decision can be reproduced months later.
8. **Build once, reuse everywhere.** Each capability below exists in exactly one place. Before adding anything, check [`inventory.md`](inventory.md) and extend what is already there.

### Reusable building blocks

| Building block | Lives in | Reused by |
|---|---|---|
| Condition DSL evaluator (§6.3) | `engines/conditions` | Eligibility, question visibility, document requirements, improvement triggers, **lead routing**, SLA policies |
| Versioned config + maker-checker | `modules/config-publishing` | Lender products, question sets, consent templates, scoring models, commission schemes, **lead routing rules** |
| State machine runner (typed transitions; writes the event in the same transaction) | `engines/state-machines` | Application, submission, document, receivable, payout, **lead, lead assignment** |
| Assignment engine (manual, round-robin, weighted, capacity, rule-based, pool/claim) | `engines/assignment` | **Leads → CAs**, ops case queue → reviewers, fraud reviews |
| SLA timers (due-at, breach jobs, escalation) | `modules/sla` | Lead accept and first contact, ops case SLA, document requests |
| Activity timeline (polymorphic: entity type + ID) | `modules/activities` | Leads (calls, notes, follow-ups), applications, partners, parties |
| Notes, tags, attachments (polymorphic) | `modules/activities`, `modules/documents` | Leads, applications, parties, partners |
| Bulk import pipeline (upload → map → validate → dedupe → commit → report → undo batch) | `modules/imports` | **Lead backlog**, lender pincode coverage, geography master, partner onboarding |
| Party resolver (normalise → blind index → match → link or queue) | `modules/parties` | Lead capture, OTP signup, partner-filed borrowers, co-applicants, imports |
| Consent guard + records | `modules/consents` | Every processing and sharing purpose, including **sharing a lead with a CA** |
| Notification dispatcher (template × channel × locale, opt-in aware) | `modules/notifications` | Everything that notifies |
| Scoped repository base (CASL conditions → SQL filters) | `infrastructure/database` | Every read and list |
| Cursor pagination, filters, sorting, CSV export | `common/listing` | Lead lists, case queue, ledgers, audit |
| Idempotency keys and optimistic concurrency (`version` + `If-Match`) | `common/http` | Every write endpoint |

### Sync, consistency & scale

- **One source of truth per fact.** Status that is derived is never edited in two places. For example, a converted lead's status follows its application's events (application disbursed → lead `won`).
- **Transactional outbox** feeds projections, notifications, real-time events and outbound webhooks. Delivery is at-least-once and every consumer is idempotent (dedupe by event ID).
- **Optimistic concurrency.** Each mutable row has a `version`. Writes send `If-Match`, and a stale write gets `409 VERSION_CONFLICT`, e.g. when a CA and ops edit the same lead.
- **Real-time.** A WebSocket gateway (Socket.IO with the Redis adapter, so it works across API instances) pushes to user, membership and organization rooms: lead assigned, SLA warning, application status changed, document read. Events carry IDs, never PII, and clients refetch the resource.
- **Delta sync.** `GET /v1/sync/changes?since=<cursor>&types=lead,application` returns changed IDs and versions, so app and portal lists catch up after being offline.
- **Push notifications.** Expo push tokens per app session; web push later.
- **Scale.**
  - API instances are stateless and scale horizontally. Workers scale per queue.
  - Reporting queries use a read replica.
  - Large append-only tables (`audit_events`, `application_events`, `borrower_facts`, `activities`) are partitioned by month.
  - Catalog, availability and routing rules are cached in Redis and invalidated on publish.

---

## 5. Tech stack

Versions checked on npm on 9 Oct 2026. Pin exact versions in `package.json`.

| Concern | Choice | Why |
|---|---|---|
| Runtime | **Node.js 24 LTS** | Current LTS. Move to Node 26 once it is promoted to LTS. |
| Framework | **NestJS 12.x** | Modules, DI, guards and interceptors fit a modular monolith. The same codebase runs as an HTTP app and a standalone worker. |
| Language / build | **TypeScript 6.0** (strict, ESM `nodenext`) + `nest build` | Matches the NestJS 12 project template; NestJS 12 ships as ESM-only. TS 7 is not yet supported by typescript-eslint/oxlint type-aware rules. |
| Database | **PostgreSQL 18** | JSONB for versioned config, native `uuidv7()`, partial and GIN indexes, strong transactions for the ledger. |
| ORM / migrations | **Prisma 7.10** (`prisma-client` generator, `@prisma/adapter-pg`, multi-file schema in `backend/prisma/schema/`) + Prisma Migrate | Decided. Generated client lives in `backend/src/generated/prisma` (git-ignored). Triggers, SQL functions and `NULLS NOT DISTINCT` indexes go in hand-written migrations; `prisma migrate diff` must stay empty. |
| Transactions & request context | `nestjs-cls` + `@nestjs-cls/transactional` (Prisma adapter) | `@Transactional()` on services; repositories use `TransactionHost`, so one transaction spans several repositories without passing a client around. The same context carries request ID and actor into audit and outbox rows. |
| Validation (static DTOs) | **Zod 4** (`nestjs-zod`) | One schema gives runtime validation and types. |
| Validation (dynamic config) | **Ajv 8** (JSON Schema) | Validation rules for questions are stored as data and run on server and client. |
| Formulas | **json-logic-js** | Storable arithmetic for derived attributes and indicative amounts. |
| Conditions | **FF Condition DSL** (in-house, about 300 lines) | Three-valued logic (pass / fail / unknown) over range facts, with an explanation per leaf (§6.3). |
| Authorization | **CASL 7** + `@casl/prisma` | Conditional abilities; `accessibleBy(ability).ofType('Model')` turns them into Prisma `where` filters so list endpoints cannot leak rows. |
| Queues / jobs | **BullMQ 6** on **Valkey 8** | Retries, backoff, delays, cron and rate limiting. |
| File storage | `StoragePort` → Azure Blob adapter (`@azure/storage-blob`); Azurite locally | Private containers, short-lived SAS URLs. The adapter is chosen by config. |
| Key management | `CryptoPort` → Azure Key Vault adapter; local key file in development | Envelope encryption for PII fields (§14) |
| Real-time | `@nestjs/websockets` + Socket.IO + Redis adapter | Pushes lead assignments and status changes across instances |
| Imports | `csv-parse` + `exceljs` (streaming) | Backlog lead import, coverage lists |
| Phone/identity normalisation | `libphonenumber-js` | E.164 before blind indexing, so dedupe is reliable |
| Auth | JWT (ES256) access tokens + rotating refresh tokens; `argon2` for staff passwords; TOTP | |
| Logging / tracing | `nestjs-pino` (PII redaction) + OpenTelemetry + Sentry | |
| Testing | **Vitest 5** (Oxc emits decorator metadata, no SWC plugin needed), Testcontainers (Postgres 18, Valkey, Azurite), supertest, **Newman 6** for Postman flows | |
| Lint / boundaries | **oxlint** (type-aware) + **dependency-cruiser** | oxlint is the NestJS 12 template default; dependency-cruiser enforces the module boundary rules in §11. |
| API documentation | **Postman collection as structured JSON in Git** (§12) | No Swagger decorators. |
| Package manager | pnpm | |
| LLM | Behind an `LlmPort`. Default: Claude (`claude-sonnet-5-5` for extraction, `claude-haiku-5-5` for classification) | Provider can be swapped. Evaluate the direct API vs Microsoft Foundry on Azure for regional and data-processing terms (§13). |

---

## 6. The dynamic core — how any lender can be onboarded

This section is the core of the plan. The goal is that a new lender with new criteria, extra questions or extra documents can be added by **ops through admin APIs, with no code change**, as long as its criteria can be expressed over the attribute dictionary. If a lender needs a data point the system doesn't know yet, ops adds one attribute definition (plus a question or extraction mapping) and it becomes reusable for every lender after that.

```
                ┌──────────────── ATTRIBUTE DICTIONARY ─────────────────┐
                │  business.vintage_months · business.annual_turnover    │
                │  bank.avg_monthly_credits · bureau.score · derived.foir│
                └──▲──────────▲───────────▲────────────▲─────────────▲───┘
       produce     │          │           │            │             │     consume
   ┌───────────────┴┐ ┌───────┴──────┐ ┌──┴─────────┐ ┌┴──────────┐  │
   │ Questions      │ │ Document     │ │Integrations│ │ Derived   │  │
   │ (declared)     │ │ extraction   │ │ AA/GSTN/   │ │ formulas  │  │
   └────────────────┘ │ (extracted)  │ │ bureau/KYC │ │ (derived) │  │
                      └──────────────┘ └────────────┘ └───────────┘  │
                                 ▼  FACT STORE (per party, provenance, confidence)
        ┌────────────────────┬───────────────┬──────────────────┬────────────────┐
        │ Lender product     │ Scoring model │ Document         │ Improvement    │
        │ eligibility rules  │ factors       │ requirement rules│ rules          │
        └────────────────────┴───────────────┴──────────────────┴────────────────┘
```

### 6.1 Attribute dictionary & fact store

**`attribute_definitions`** is the canonical vocabulary.

| Field | Example |
|---|---|
| `key` (namespaced, immutable once published) | `business.annual_turnover_paise` |
| `label` (i18n) | `{en: "Annual turnover", hi: "…"}` |
| `data_type` | `integer \| decimal \| money \| boolean \| enum \| string \| date \| percentage` |
| `unit` | `paise`, `months`, `ratio` |
| `applies_to` | `business`, `individual`, `party` |
| `sensitivity` | `public \| personal \| financial \| special` (drives encryption, masking, access) |
| `allowed_sources` | `declared, document, account_aggregator, gstn, bureau, derived, ops` |
| `derivation` | JSON Logic formula for derived attributes, e.g. `foir = (existing_emi + proposed_emi) / net_monthly_income` |
| `freshness_days` | Bank-derived facts expire after N days |

**`borrower_facts`** (append-only) has these columns: `party_id`, `application_id?`, `attribute_key`, `value` (jsonb), `value_min`/`value_max` (numeric, for bucketed answers like "₹5–25L"), `provenance`, `source_ref` (answer, extraction, integration call or user), `confidence`, `observed_at`, `valid_until`.

**Resolution:** the current value of an attribute is the non-expired fact with the highest trust level (`ops_verified > third_party_verified > extracted > declared`), with recency as tie-break. A rule can require a minimum provenance, e.g. turnover must be at least `extracted`. When sources disagree (declared bucket vs extracted bank inflow), the system raises a **consistency signal** for ops, like the "Inflow deviation vs ITR" flag in the case-queue design. It does not silently overwrite.

### 6.2 Questionnaire engine (dynamic questions)

| Entity | Key fields |
|---|---|
| `questions` | `key`, `attribute_key` (the fact it fills), `type` (`single_select, multi_select, number, money, date, text, boolean, city, pincode`), `label`/`help` (i18n), `options[]` with **option → fact value mapping** (`"1-3 yrs" → {min: 12, max: 36}`), `validation` (JSON Schema), `ui` hints (`{widget: "chips", columns: 2}`), `visible_if` (condition) |
| `question_sets` + `question_set_versions` | `key` (`pre_check.msme`), `stage` (`pre_check \| profile \| lender_specific \| post_sanction`), scope (segments, sub-segments, categories, or one lender product version), ordered items with `required` and `section` |
| `answers` | Raw answer for audit (`question_version`, `value`, `answered_by` = borrower/partner/ops). Each answer **also writes a `declared` fact**. |

**As built (M1.3):** question sets are stored in the generic config tables (`config_documents` / `config_versions`, §6.9) rather than per-resource tables; `visible_if` lives on the set item so the same question can be conditional in one set and not another; `validation` is a typed object (`min`, `max`, `minLength`, `maxLength`, `pattern`, `maxSelections`) from which the API generates the JSON Schema for clients, so no free-form schema is stored; submitting a version compiles a frozen snapshot of every question, so later question edits never change a published set; answers store `question_set_version_id`.

**Runtime resolution** (`GET /v1/applications/:id/questions?stage=pre_check`):

1. Load the base question set for (segment, sub-segment, category, stage).
2. **Progressive profiling.** Compute the attributes still needed by (a) the scoring model and (b) the hard rules of candidate lender products (§6.6, step A). Add the question for each attribute that has no sufficiently trusted fact and has a question defined.
3. **Most-discriminating first.** Order the added questions by how many candidate products depend on them, so knock-out questions come early.
4. Apply `visible_if` against current facts and answers.
5. Return the questions with their JSON Schema so the app renders them generically.

The pre-check screen becomes a generic renderer. When a lender asking "Do you export?" goes live, the question appears only for borrowers whose candidate set includes that lender.

### 6.3 Condition DSL (one language for eligibility, visibility, documents, improvement)

```json
{
  "all": [
    { "attr": "business.vintage_months", "op": "gte", "value": 24 },
    { "any": [
        { "attr": "bureau.score", "op": "gte", "value": 700 },
        { "attr": "bureau.history", "op": "eq", "value": "no_history" }
    ]},
    { "attr": "loan.city_pincode", "op": "in_coverage" }
  ]
}
```

- **Operators:** `eq, neq, in, not_in, gt, gte, lt, lte, between, exists, not_exists, contains, matches, in_coverage`.
- **Party scope** (optional): `"party": "primary" | "any_co_applicant" | "all_directors"`, e.g. "every director's bureau score ≥ 650".
- **Three-valued (Kleene) evaluation:** every leaf returns `PASS`, `FAIL` or `UNKNOWN`. Bucketed answers are ranges. With declared turnover "₹5–25L" and the rule "≥ ₹10L", the result is `UNKNOWN`, which means *ask for evidence* rather than reject.
- **Explainable:** the evaluator returns the result tree. Each leaf can carry `pass`/`fail` message templates, which become the "Why this lender?" reasons.
- **Validated** on save against the attribute dictionary (attribute exists, operator fits the data type, value type is correct).

### 6.4 Lender product policy (versioned)

```
lender ─┬─ lender_agreements (commission terms, validity, signed document)
        ├─ lender_contacts / escalation
        └─ lender_products ── lender_product_versions  (draft → in_review → published → retired)
                               └─ definition (jsonb): coverage, limits, eligibility, documents,
                                  questions, parties, pricing disclosure, packet, commission ref
```

- Published versions are **immutable**. Each version records `source_note` (which policy document or email it came from), `verified_by`, `verified_at`, `approved_by` and `effective_from/to`.
- **Policy freshness:** products not re-verified in N days are flagged on the ops dashboard (roadmap: "policy freshness" metric).
- **Simulation before publishing:** `POST /v1/admin/lender-products/:id/versions/:v/simulate` runs the draft against saved test profiles or real past cases, and returns pass/fail/unknown per rule plus a diff against the currently published version. This covers the roadmap gate "test decisions against real documented lender criteria".
- **Lender-side changes:** lender admins can view their published policy and propose changes, which create a change request for FundenFlo approval.

### 6.5 Document requirements engine

| Entity | Key fields |
|---|---|
| `document_types` | `key` (`bank_statement`, `itr`, `gstr_3b`, `salary_slip`, `property_papers`, `udyam`, `sanction_letter`…), accepted MIME types, max size, `period_rule` (`last_6_months`), `extractor_key`, `produces_attributes[]`, retention, sensitivity |
| `document_requirements` | scope (segment / category / lender product version), `condition`, `required \| optional`, `stage` (`assessment \| submission \| post_sanction`), `min_count`, `freshness` (e.g. statement end within 45 days), **any-of groups** ("ITR **or** 12 months GSTR-3B"), party scope (each director's KYC) |

**Checklist** = union of (scoring model requirements + requirements of candidate or selected lender products for the current stage), de-duplicated by type. Each item is annotated with *needed by*, which gives "Documents still needed: 2" on each lender card. Today's `documentsFor()` logic becomes the seed data.

### 6.6 Scoring engine (0–100, explainable)

`scoring_model_versions.definition`:

```json
{
  "segment": "msme",
  "factors": [
    { "key": "cashflow", "label": {"en": "Cash Flow & Bank Behaviour"}, "max": 25,
      "inputs": ["bank.avg_monthly_credits_paise", "bank.bounce_count_6m", "bank.avg_balance_paise"],
      "method": "bands",
      "bands": [ { "when": {"attr": "bank.bounce_count_6m", "op": "eq", "value": 0}, "points": 25 }, "…" ],
      "missing": "insufficient" },
    { "key": "profitability", "max": 20, "…": "…" },
    { "key": "repayment_capacity", "max": 20 },
    { "key": "gst_itr_consistency", "max": 15 },
    { "key": "vintage", "max": 10 },
    { "key": "credit_history", "max": 10, "requiresConsent": "creditBureau", "missing": "exclude_renormalise" }
  ],
  "attentionBelowPct": 60,
  "bands": [ {"min": 80, "label": "Strong — Ready For Funding"}, {"min": 60, "label": "Good — Ready For Funding"},
             {"min": 40, "label": "Fair — A Few Gaps To Close"}, {"min": 0, "label": "Needs Work Before Matching"} ]
}
```

- **Seed weights from the roadmap.** MSME: cash flow 25 / profitability 20 / debt & repayment 20 / GST-ITR 15 / vintage 10 / credit history 10. Individual: income stability 25 / EMIs & DTI 25 / credit history 20 / bank behaviour 15 / employment stability 10 / documentation 5. Individual models have **variants for salaried and self-employed**.
- **Factor methods:** `bands` (first matching condition), `linear` (value range → points), `formula` (JSON Logic).
- **Missing-data policy** per factor: `insufficient` (the whole result becomes *insufficient information*), `exclude_renormalise`, or `zero`.
- **Each result stores** model version, status, value, band, factors (score, max, attention, evidence fact IDs, explanation), limitations, input snapshot and input hash. A re-assessment creates a **new** result and never overwrites. Ops can recompute to reproduce a past result.

### 6.7 Improvement plan engine

`improvement_rules` (versioned): trigger `condition` over factor results and facts, plus templates for `title / found / why / action / evidence`. Templates can interpolate values, e.g. `{{fact.derived.emi_to_inflow_pct}}%`. Each rule also has a linked evidence document type, a reassessment trigger and a priority. The engine emits a plan only when a rule fires (roadmap: "only where a meaningful gap exists"). In v1.1 an LLM may rephrase the text for tone, but it cannot add claims.

### 6.8 Matching engine

| Step | What happens | Output |
|---|---|---|
| **A. Candidates** (SQL) | Active lender + active agreement + published product version effective now; matches category, segment/sub-segment, geography coverage, amount and tenure range | Candidate product versions |
| **B. Eligibility** | Hard rules, three-valued | `eligible` / `ineligible` / `needs_info` per product, with the result tree |
| **C. Fit ranking** | Soft-rule weights, docs still needed, lender response time and historical outcomes (v2.0). **No approval probability.** | Ordered list |
| **D. Explanation** | Reasons from rule templates ("Your turnover meets their minimum", "They serve Gurugram"). In v1.1, an optional AI summary limited to these reasons | `reasons[]` |

The run is persisted in `match_runs` (input snapshot, product versions considered) and `match_results` (outcome per product, passed/failed/unknown rule IDs, reasons, docs needed, indicative amount **only if** the product defines a formula). Borrowers see `eligible` products, and optionally `needs_info` ones as "could fit if you add X". Ops sees everything with reasons. An empty result is a real empty state (frontend already handles it), with a link to the improvement plan.

### 6.9 Config lifecycle (shared by all dynamic entities)

`draft → in_review → published → retired`, through `config_change_requests` (maker, checker, diff, reason, effective date). **As built (M1.3):** `config_documents` + `config_versions` + `config_change_requests` hold every resource; states are `draft → in_review → approved → published → retired` (reject returns to draft); approval happens in the shared `/admin/change-requests` inbox; `effective_from` on the version schedules publishing; DB triggers freeze submitted content and make decisions final. This applies to question sets, consent templates, document requirements, scoring models, improvement rules, lender product versions, commission schemes and lead routing rules. Publishing invalidates caches, such as category availability in Valkey. In-flight applications keep their pinned versions.

### 6.10 Worked example: onboarding a new lender

*"Lender X Finance Ltd", an NBFC offering unsecured MSME working capital in Delhi NCR.*

1. **Lender record:** `POST /v1/admin/lenders`. Kind `nbfc`, RBI registration number, status `active`, policy owner, contacts and escalation path.
2. **Agreement:** `POST /v1/admin/lenders/:id/agreements`. Signed PDF (private document), validity dates, commission scheme (e.g. 50 bps of disbursed amount, payable after the lender pays).
3. **Product + draft version:** `POST /v1/admin/lender-products` with this draft definition:

```json
{
  "category": "working-capital",
  "segments": ["msme"],
  "subSegments": ["proprietorship", "partnership", "llp", "pvt_ltd"],
  "amountPaise": { "min": 50000000, "max": 500000000 },
  "tenureMonths": { "min": 12, "max": 36 },
  "coverage": { "states": ["DL", "HR", "UP"], "includePincodes": [], "excludePincodes": [] },
  "eligibility": {
    "hard": [
      { "id": "vintage", "when": { "attr": "business.vintage_months", "op": "gte", "value": 24 },
        "minProvenance": "declared",
        "pass": "Business vintage fits their policy", "fail": "They need at least 2 years of business history" },
      { "id": "turnover", "when": { "attr": "business.annual_turnover_paise", "op": "gte", "value": 3000000000 },
        "minProvenance": "extracted",
        "pass": "Your turnover meets their minimum", "fail": "Their minimum annual turnover is ₹30 Lakh" },
      { "id": "gst", "when": { "attr": "business.gst_registered", "op": "eq", "value": true },
        "pass": "You are GST registered", "fail": "They lend only to GST-registered businesses" },
      { "id": "bureau", "party": "all_directors",
        "when": { "attr": "bureau.score", "op": "gte", "value": 680 }, "minProvenance": "third_party_verified" }
    ],
    "soft": [
      { "id": "foir", "weight": 3, "when": { "attr": "derived.foir", "op": "lte", "value": 0.5 },
        "pass": "Your existing EMIs are within their comfort range" }
    ]
  },
  "indicativeAmount": { "formula": { "min": [ { "*": [ { "var": "bank.avg_monthly_credits_paise" }, 2 ] }, { "var": "request.amount_paise" } ] } },
  "documents": [
    { "type": "bank_statement", "period": "last_12_months", "stage": "assessment", "required": true },
    { "anyOf": ["gstr_3b_12m", "itr_latest"], "stage": "assessment", "required": true },
    { "type": "udyam_certificate", "stage": "submission", "required": true },
    { "type": "kyc_pan", "party": "all_directors", "stage": "submission", "required": true }
  ],
  "questionSet": "lender_specific.lenderx_wc",
  "pricingDisclosure": { "en": "As per lender policy" },
  "packet": { "template": "standard_msme_v1", "delivery": "lender_portal" }
}
```

4. **New attribute?** If Lender X needs "Export turnover %", ops adds `business.export_turnover_pct` to the dictionary, a question for it, and optionally an extractor mapping. All of it is reusable later.
5. **Simulate** against test profiles and past cases, then review the pass/fail diff.
6. **Submit → second approver publishes** with `effective_from`.
7. Automatically, without a deploy: Working Capital shows as *available* for MSMEs in DL/HR/UP, the pre-check asks Lender X's knock-out questions only for borrowers who might fit, the checklist adds Udyam and director KYC at submission stage, and matching includes Lender X with explained reasons.

---

## 7. Leads & CA distribution (first delivery)

**Business need now:** we already hold a large number of leads, and the immediate plan is to hand them to our CAs. The first release therefore does four things: collect leads from every source, clean and dedupe them, route them to CAs, and track what each CA does with them. It is built on the same parties, facts, consent, assignment and activity building blocks as the full journey, so none of it is thrown away later.

### 7.1 Lead sources (all go through one `LeadCaptureService`)

| Source | How | Notes |
|---|---|---|
| Backlog spreadsheets | `POST /admin/imports` (CSV/XLSX) → column mapping → validation → dedupe preview → commit | Each lead keeps its batch ID and row number. A whole batch can be undone. |
| Manual entry | Ops or telecaller, `POST /ops/leads` | |
| Website / landing pages | `POST /public/leads` with an API key per source, captcha, rate limit, UTM fields | |
| App users who stop mid-journey | Automatic: an OTP-verified user with no submitted application becomes a lead after N hours (configurable) | |
| Partner referrals (inbound) | DSA/CA submits `POST /partner/leads`, or the borrower uses a referral code | Attribution and lead protection (§8.6) |
| Ad platforms, WhatsApp, missed call | `POST /webhooks/leads/:source`, one adapter per source | v1.1 |

Every lead stores `source`, `campaign`, `utm` (jsonb), `captured_by`, `captured_at`, `import_batch_id` + row number, and `raw_payload` (the original data, encrypted). Nothing from a source is lost, even if the field mapping changes later.

### 7.2 What a lead holds

- **Party link.** The party resolver links the person, and the business if one is given (§3.3). Contact details live on the party, not on the lead.
- **Requirement.** Every field is optional, because leads are often incomplete: segment, category, amount or amount range, tenure, purpose, city/pincode, urgency, preferred language, preferred contact time.
- **Dynamic fields.** Every extra field is an attribute in the dictionary. A source or campaign can have a `lead_capture` question set for its custom fields, using the same questionnaire engine as the journey (§6.2). Answers become `declared` facts on the party, which the borrower journey later reuses.
- **Quality.** A rules-based `quality_score` (completeness, verified mobile, valid pincode, category available) and flags (`duplicate`, `invalid_number`, `do_not_contact`, `test`, `spam`).
- **Consent and lawful basis.** Two consent records come from the consent module: permission to contact and permission to share with a partner. Imported backlog leads also store `lawful_basis` and `consent_evidence`, e.g. "website form checkbox, 2026-08-14".
  - **A lead is never shared with a CA without a valid basis.** The routing engine enforces this.
  - Backlog leads with unknown consent wait in a `consent_pending` queue, to be cleared by a consent SMS/WhatsApp link or a legal decision.

### 7.3 Lead lifecycle (two state machines)

**Lead** (the enquiry):

```
new ─► qualified ─► in_progress ─► converted (application created) ─► won (disbursed) | lost (reason)
 │
 ├─► unqualified (junk | invalid_number | duplicate | not_interested | not_eligible | do_not_contact)
 ├─► on_hold / nurture ─► reopened later
 └─► any open state ─► recycled (back to the pool)
```

After `converted`, the lead's status is **derived** from the linked application's events (§4 sync rule).

**Assignment** (who works the lead). A lead can have many assignments over time, and at most one active at a time unless the routing rule allows parallel offers.

```
offered ─► accepted ─► working ─► completed
   ├─► declined (reason)        ├─► returned (CA gives it back, reason)
   ├─► expired (accept SLA missed)
   └─► revoked (ops)
```

Every transition writes an event with actor, reason and source.

### 7.4 Routing to CAs

- **CA capacity profile** (on the partner profile): service area (states, cities, pincodes), categories and segments handled, languages, maximum open leads, working hours and days, active/paused, performance tier.
- **Routing rules** (versioned config with maker-checker): a condition on lead facts (DSL, §6.3) → strategy + target pool. Example: "MSME + Working Capital + Delhi NCR → round-robin across Tier-A CAs serving the pincode".
- **Strategies** (assignment engine):
  - manual
  - round-robin
  - weighted (by tier or performance)
  - least-loaded (by capacity)
  - pool/claim (CAs see masked leads and claim them)
  - broadcast (offer to N CAs at once; the first to accept wins)
  - sticky (a repeat borrower goes back to the same CA)
- **Exclusivity:** one active CA per lead by default. Parallel offers happen only if the rule allows it.
- **Fallbacks:**
  - No eligible CA → ops queue.
  - Declined or expired → next CA by the same strategy.
  - After the maximum number of reassignments → ops.
- **Inside a CA firm:** the firm owner receives the lead and can sub-assign it to staff, using the same engine one level down.
- **Inbound referrals:** a lead referred by a partner routes back to that partner by default, respecting lead protection (§8.6).

### 7.5 What the CA does (partner portal API)

- **Inbox** of offered and active leads with SLA timers.
  - **PII stays masked until the CA accepts** (e.g. `98•••••321`).
  - Every reveal of full contact details is logged (`contact_reveals`), which protects the lead pool.
- **Accept, decline (reason) or return.**
- **Log activities:** call (connected / no answer / busy / wrong number / call back), meeting, WhatsApp, email, note. Schedule follow-ups, which become SLA reminders and notifications.
- **Update lead details.** These write `declared` facts with the CA as actor.
- **Convert**, in one of two ways:
  - Start a borrower application on the lead's party (partner-filed journey, with borrower OTP consent).
  - Record an **offline conversion** if the CA processed the loan directly with a lender: lender, amount, sanction/disbursal dates, proof. This keeps outcomes captured even when they happen off-platform.
- **Mark lost** using the reason taxonomy.

### 7.6 SLAs and automation (configurable per routing rule)

- Accept within X hours → otherwise expire and reassign.
- First contact within Y hours → otherwise warn the CA, then escalate to ops.
- Follow-up overdue → reminder.
- No activity for N days → ops review or recycle.

All of these are BullMQ delayed jobs on the SLA building block.

### 7.7 Commercials with CAs (configurable; terms not fixed yet)

- **Lead terms** sit on the partner agreement: `none | fee_per_accepted_lead | fee_per_conversion | revenue_share_on_disbursal | payout_to_partner`.
- **Invalid-lead credit:** a refund if the lead is marked invalid with evidence within N days.
- **Accounting:** postings go to the same double-entry ledger (§8.5), with the CA as counterparty. Whether the CA pays FundenFlo or FundenFlo pays the CA, nothing structural changes.

### 7.8 Reporting

- **Lead funnel** by source, campaign, city and category.
- **CA performance:** accept rate, time to first contact, conversion, disbursed value, SLA breaches.
- **Backlog health:** consent status of the backlog, duplicates found.

These run on the read replica with materialised views.

### 7.9 Small possibilities covered from day one

| Possibility | Handled by |
|---|---|
| Same person arrives from three sources | All leads link to one party. Leads stay separate so each source keeps attribution, and ops can merge leads. |
| Lead has only a name and a landline, no mobile | Contacts are a list. Mobile is mandatory for a login, not for a lead. |
| Wrong or invalid number | `invalid_number` after N failed calls. The contact is marked invalid on the party. |
| Person asks not to be contacted | `do_not_contact` on the party contact. Routing and notifications skip it, and it is recorded as consent withdrawal. |
| Business lead with several contacts (owner, accountant) | Business party + several person parties with relationships. One contact is primary. |
| Same person needs an individual loan and a business loan | Two leads (different segment) on related parties |
| Lead later signs up in the app | OTP signup resolves the party and links the user. The lead moves to `in_progress` / `converted` when an application starts. The CA keeps attribution while protection lasts. |
| A CA leaves or is suspended | Bulk revoke and reassign their open leads (ops action, audited) |
| A CA says "this lead was already mine" | Attribution dispute flow (§8.6) |
| Import file has bad rows | Row-level error report. Valid rows commit, and the batch can be undone. |
| Import mapping turns out wrong | The raw row is kept, so the batch can be re-mapped and re-run |
| Amount given as a range or text ("20-25 lakh") | Range fact (min/max), with the raw text kept |
| Unknown category, or city not in the master | Raw text stored and flagged for ops mapping. An alias table learns names, e.g. "Gurgaon" → Gurugram. |
| Lead prefers Hindi or another language | i18n labels. `preferred_language` drives CA routing and message templates. |
| Spam or test leads from public forms | Captcha, rate limits and quality flags. The `test` flag is excluded from reports. |
| Re-enquiry after a lost lead | New lead on the same party, with full history visible to the CA and ops |
| Category not yet available (no lender route) | Lead still captured and routed to a CA or to nurture. It becomes matchable automatically once availability changes. |

---

## 8. Workflows & state machines

State machines are typed transition tables in `src/engines/state-machines`. Each transition declares the allowed actor types, guards and required evidence. Every transition writes an `application_events` row in the same transaction. Statuses are **code, not configuration**, because the roadmap treats them as legally and financially significant. Lender-specific sub-statuses, such as query types, are configurable reason codes.

### 8.1 Application (case) — one borrower request

```
draft ──► pre_screened ──► documents_pending ──► assessed ──► ready_for_submission ──► submitted ──► closed
  │             │                 │                 │                │                    │       (won | lost)
  └─────────────┴─────────────────┴─────────────────┴────────────────┴──► withdrawn / expired
```

- `journey_stage` (category → requirement → pre_check → consent → documents → verify_details → score → matching → apply) is tracked separately for resuming the UX, and is derived from completed steps. `GET /v1/applications/:id/next-step` returns the stage and its blockers, so the app can become server-driven.
- `ready_for_submission` requires ops approval when the case has risk signals or low-confidence facts. Otherwise it can be set automatically by a configurable rule.

### 8.2 Lender submission — one per lender product

```
sent_to_lender ─► under_review ⇄ query_raised
                       │
                       ├─► sanctioned ─► disbursed (partial → full)
                       ├─► rejected
                       └─► withdrawn
```

| Transition | Allowed actors | Required evidence |
|---|---|---|
| → `sent_to_lender` | system after ops approval | Packet generated; **active `lenderSharing` consent scoped to this lender** |
| → `under_review` | lender user, ops on behalf, lender API | Lender reference / acknowledgement |
| → `query_raised` | lender, ops | Query text and requested documents (creates `document_requests` → borrower's "pending task") |
| → `sanctioned` | lender, ops | Sanction letter document + sanctioned amount |
| → `rejected` | lender, ops | Rejection reason code (taxonomy) + note |
| → `disbursed` | lender, ops | Disbursal proof / UTR, amount, date |
| → `withdrawn` | borrower, ops | Reason |

`ai_agent` and `system` can **never** set `sanctioned`, `rejected` or `disbursed`. The borrower timeline (`done | active | pending`) is a projection of these events, which keeps the frontend's `timeline[]` shape.

### 8.3 Document

`uploaded → scanning → (infected → rejected) → classifying → extracting → verified | needs_review | rejected`, then `expired` (freshness) and `purged` (retention or erasure). `needs_review` goes to the ops queue when confidence is low or the type doesn't match.

### 8.4 Analysis job

`queued → running (steps[]) → done | failed`. Steps are emitted per pipeline stage, which the frontend already polls.

### 8.5 Commission (separate from application status)

```
Receivable (lender → FundenFlo):  accrued (on verified disbursal) → invoiced → received → reconciled | written_off
Payout (FundenFlo → partner):     pending (awaiting lender payment) → approved (maker-checker) → paid | reversed (clawback)
```

A partner payout becomes payable **only after the linked receivable is `received`** (design: "Payouts are released only after FundenFlo receives confirmed payment from the lender").

### 8.6 Partner lead attribution

A referral code at OTP signup, or a partner-filed application → `active (protected_until = attributed_at + window)` → `expired | converted | disputed → resolved (ops)`. Duplicates are detected by blind indexes of PAN, mobile and GSTIN. Precedence rules are configurable.

---

## 9. Data model

**Conventions**
- PK `id uuid DEFAULT uuidv7()`. Human-readable refs such as `FF-26-08931` come from a sequence per year.
- `timestamptz` everywhere, stored in UTC.
- **Money is `bigint` paise**, never floats. Rates are basis points (`int`).
- i18n text is `jsonb {en, hi}`, so Hindi is supported from day one.
- Fixed state machines use Postgres enums. Configurable vocabularies use lookup tables.
- Append-only tables are enforced with triggers, and the app role has no `UPDATE`/`DELETE` grant on them.
- Each module owns its tables. Cross-module access goes through the owning module's service, never through another module's repository.

| Module | Tables |
|---|---|
| **parties** | `parties` (kind person/business, display name, status), `party_contacts` (type mobile/email/landline, `value_enc`, `value_hash`, verified_at, primary, do_not_contact, invalid), `party_identifiers` (PAN/GSTIN/CIN/Udyam/DIN, `value_enc`, `value_hash`, verified_at), `party_relationships` (proprietor_of/director_of/partner_of/signatory_of/employee_of, share %), `party_addresses`, `party_merges` (from, to, by, reason, reversible), `party_match_reviews` (uncertain dedupe queue) |
| **identity** | `users` (person party, status), `user_logins` (method mobile_otp/email_otp/password/google/apple, identifier hash, verified_at, last_used_at), `staff_credentials` (argon2 hash, encrypted TOTP secret), `sessions` (user, membership, context, device, IP, UA, push token, last_seen, revoked_at), `refresh_tokens` (session, family, hash, rotated_from, revoked), `otp_challenges` (hashed, purpose, attempts) |
| **access** | `organizations` (party, type fundenflo/lender/partner/business), `memberships` (user, org, role, scope, status), `invitations`, `api_clients` (lender integrations / B2B / lead sources; hashed keys) |
| **borrowers** | `borrower_profiles` (the borrower role on a party: kind, sub_segment, acting person, constitution, incorporation date) |
| **leads** | `leads` (ref `LD-26-…`, party, business party, segment, category, amount range paise, tenure, purpose, location, urgency, preferred language/time, source, campaign, utm, captured_by, import batch + row, `raw_payload_enc`, quality score, flags, status, lost/unqualified reason, converted application, `version`), `lead_assignments` (lead, partner org, assignee member, routing rule version, strategy, status, offered/accepted/expires/closed at, reason), `contact_reveals`, `lead_sources` (key, API client, default question set, default routing), `routing_rules` (versioned config), `offline_conversions` (lender, amounts, dates, proof doc), `lookup_aliases` (raw text → city/category) |
| **imports** | `import_batches` (type leads/coverage/geo/partners, file doc, mapping, status, counts, committed_by, undone_at), `import_rows` (row no, `raw_enc`, normalised, errors, result entity, outcome) |
| **activities & SLA** | `activities` (polymorphic entity, type call/meeting/whatsapp/email/note/status_change/system, outcome, body, actor, at), `follow_ups` (entity, due_at, assignee, done_at), `tags` + `entity_tags`, `sla_timers` (entity, policy, due_at, breached_at, escalated_to) |
| **attributes** | `attribute_definitions`, `borrower_facts` (append-only) |
| **catalog** | `segments`, `sub_segments`, `loan_categories` (limits in paise, `tenure_options_months`, `illustrative_rate_bps`, icon, sort), `category_segments`, `category_purposes`, `geo_states`, `geo_cities`, `geo_pincodes` |
| **questionnaires** | `questions`, `answers` (sets in `config_documents` / `config_versions`) |
| **consents** | `consent_purposes` (`ai_documents`, `credit_bureau`, `lender_sharing`, `whatsapp`, `marketing`), `consent_templates` (versioned text per purpose & language, `text_hash`), `consent_records` (append-only: subject, application, purpose, template version, granted, scope such as lender IDs, captured via app/partner-OTP, actor, IP, UA, device) |
| **documents** | `document_types`, `document_requirements`, `documents` (storage key, sha256, MIME, size, pages, source upload/scan/digilocker/aa, period, retention_until, status), `document_extractions` (extractor/model/prompt version, fields with confidence + page refs), `document_access_logs` |
| **assessments** | `analyses`, `scoring_models`, `scoring_model_versions`, `score_results` (snapshot + hash), `improvement_rules`, `improvement_items` |
| **lenders** | `lenders`, `lender_agreements`, `lender_contacts`, `lender_products`, `lender_product_versions` (definition jsonb, verified/approved by, source note, effective window) |
| **matching** | `match_runs`, `match_results` |
| **applications** | `loan_applications` (ref, profile, channel direct/partner, category, purpose, amount paise, tenure months, location, status, journey_stage, pinned versions, assignee, `sla_due_at`), `application_parties`, `lender_submissions`, `application_events` (append-only), `document_requests`, `case_notes`, `rejection_reasons` |
| **partners** | `partner_profiles` (kind dsa/ca/connector, level new/active/strategic, KYC status, `bank_account_enc`, protection window, lead terms), `partner_capacity` (max open leads, working hours, paused), `partner_service_areas` (state/city/pincode), `partner_capabilities` (segments, categories, languages), `referral_codes`, `lead_attributions`, `attribution_disputes` |
| **commissions** | `commission_schemes` (versioned: lender→FF, FF→partner, partner→FF for lead fees; basis %/slab/flat/per-lead, caps, tax config), `ledger_accounts` (counterparty = any organization), `ledger_entries` (double-entry, append-only), `receivables`, `partner_payouts` (TDS/GST amounts, UTR), `lead_credits` (invalid-lead refunds), `reconciliation_runs` |
| **risk** | `risk_signals` (duplicate_identity, inflow_mismatch, gst_itr_mismatch, doc_tamper, referral_pattern; severity; evidence; source rule/ai), `fraud_reviews` (human decision) |
| **notifications** | `notification_templates` (channel, event, locale, DLT/WhatsApp template ID), `notification_subscriptions`, `notification_outbox`, `delivery_logs` |
| **audit / platform** | `audit_events` (append-only, **hash-chained** for tamper evidence), `outbox_events`, `idempotency_keys`, `config_change_requests`, `data_subject_requests` (DPDP access/correction/erasure), `grievances` |

---

## 10. API design

### 10.1 Conventions

- **Base URL** `https://api.<domain>/v1`. The current app uses `/v0` (compat, §10.3) until it moves to `/v1`.
- **Audience prefixes:** `/auth`, `/me`, `/catalog`, `/borrower-profiles`, `/applications`, `/documents`, `/partner/*`, `/lender/*`, `/ops/*`, `/admin/*`, `/webhooks/*`. Each prefix has its own guard set.
- JSON camelCase. Dates are ISO-8601 UTC; DOB is `YYYY-MM-DD`. Money is **integer paise, with field names ending in `Paise`** (`amountPaise`) so rupees and paise are never confused.
- **Errors (flat, compatible with the app's `api.ts`):** `{ "code": "OTP_INVALID", "message": "Incorrect Code…", "details": [...], "requestId": "…" }`. Codes are a documented enum.
- **Lists:** `{ "items": [...], "nextCursor": "…" }` with cursor pagination.
- **`Idempotency-Key`** header on POSTs that create money or state (`/applications`, `/submissions`, payouts).
- Every response carries `X-Request-Id`. `Accept-Language: en | hi` resolves i18n fields.
- Rate limits use Valkey-backed `@nestjs/throttler`. OTP has stricter per-mobile, per-IP and per-device limits.

### 10.2 Endpoint catalog (v1)

This is the design catalog. The authoritative list of what exists, with status, is [`inventory/api-routes.md`](inventory/api-routes.md), kept in sync with the code by `pnpm inventory:check`.

**Auth & me**

| | |
|---|---|
| `POST /auth/otp/request` · `POST /auth/otp/verify` | `{mobile, loginAs, referralCode?}` → `{accessToken, refreshToken, expiresIn, user{id, mobile, memberships[], activeContext, profileComplete}}` (§3.4) |
| `POST /auth/switch-context` | Switch to another membership the user holds; issues new tokens for the same session |
| `POST /auth/token/refresh` · `POST /auth/logout` | Refresh rotation with reuse detection |
| `GET /me/sessions` · `DELETE /me/sessions/:id` · `DELETE /me/sessions` | List devices; sign out one or all others |
| `GET /me/logins` · `POST /me/logins` · `DELETE /me/logins/:id` · `POST /me/mobile-change` | Linked sign-in methods; verified mobile change |
| `POST /partner/signup` | Existing user applies to become a CA/DSA (same user, new pending membership) |
| `POST /auth/staff/login` · `POST /auth/staff/mfa/verify` | Staff and lender users |
| `GET /me` · `PATCH /me/profile` | Profile |
| `GET /me/consents` · `POST /me/consents/:purpose/withdraw` | Consent centre |
| `PUT /me/notification-preferences` · `POST /me/data-requests` | WhatsApp opt-in; DPDP rights |

**Catalog** (read-only, cached)

`GET /catalog/segments` · `GET /catalog/loan-categories?segment=&subSegment=&pincode=` (full config + computed availability + reason) · `GET /catalog/geo/cities?q=` · `GET /catalog/geo/pincodes/:pin` · `GET /catalog/consent-templates?context=` · `GET /catalog/document-types`

**Borrower journey**

| | |
|---|---|
| `POST /borrower-profiles` · `GET/PATCH /borrower-profiles/:id` · `POST /borrower-profiles/:id/kyc/pan` | Individual or business profile; PAN verification |
| `POST /applications` · `GET /applications` · `GET /applications/:id` | Create a draft (profile + category); details include stage, next actions, timeline |
| `PATCH /applications/:id/requirement` | Amount, tenure, purpose, note, location — validated against category config |
| `GET /applications/:id/next-step` | Server-driven journey: `{stage, blockers[]}` |
| `GET /applications/:id/questions?stage=` · `PUT /applications/:id/answers` | Dynamic questions; answers → facts → returns the next questions |
| `POST /applications/:id/parties` · `POST /applications/:id/parties/:pid/consent-otp` | Co-applicants / directors with OTP consent |
| `POST /applications/:id/consents` | `{items: [{purpose, templateVersion, granted, scope?}]}` |
| `GET /applications/:id/document-checklist` | Dynamic checklist with *needed by* annotations |
| `POST /applications/:id/analyses` · `GET /analyses/:id` | Start / poll analysis |
| `GET /applications/:id/assessment` | Latest score result + improvement plan |
| `POST /applications/:id/matches` · `GET /applications/:id/matches/latest` | Run / read matching |
| `POST /applications/:id/submissions` · `GET /applications/:id/submissions/:sid` | Apply to a matched product (needs lender-scoped sharing consent) |
| `GET /applications/:id/timeline` · `GET /applications/:id/document-requests` · `POST /applications/:id/withdraw` | |
| `POST /notifications/subscriptions` | `{resourceType: analysis\|application, resourceId, channel: whatsapp}` |

**Documents**

`POST /documents` (multipart: `file`, `documentType`, `applicationId?`, `partyId?`; streamed to blob storage) · later `POST /documents/upload-url` + `POST /documents/:id/complete` (direct upload with a short-lived SAS URL) · `GET /documents/:id` (status + masked summary) · `GET /documents/:id/download-url` (≤ 5 min, audited, role-restricted) · `DELETE /documents/:id`

**Leads (ops, admin, public capture)**

| | |
|---|---|
| `POST /public/leads` | Website or landing-page capture (source API key, captcha, rate limit) |
| `POST /ops/leads` · `GET /ops/leads?status=&source=&city=&category=&assigned=&consent=&q=` · `GET /ops/leads/:id` · `PATCH /ops/leads/:id` | Manual entry; queue; detail (party, facts, assignments, activities); edit with `If-Match` |
| `POST /ops/leads/:id/assign` · `POST /ops/leads/:id/route` · `POST /ops/leads/bulk-assign` · `POST /ops/leads/bulk-route` | Manual or rule-based assignment, single or bulk |
| `POST /ops/leads/:id/qualify` · `/disqualify` · `/hold` · `/recycle` · `POST /ops/leads/merge` | Lifecycle actions |
| `GET /ops/leads/consent-pending` · `POST /ops/leads/:id/consent-request` | Backlog consent queue; send a consent link |
| `GET /ops/party-match-reviews` · `POST /ops/party-match-reviews/:id/resolve` | Uncertain dedupe matches |
| `POST /admin/imports` · `GET /admin/imports/:id` · `PUT /admin/imports/:id/mapping` · `POST /admin/imports/:id/validate` · `POST /admin/imports/:id/commit` · `POST /admin/imports/:id/undo` · `GET /admin/imports/:id/errors` | Backlog import pipeline |
| `/admin/lead-sources` · `/admin/routing-rules` (+ versions, `simulate`) | Lead source and routing configuration |
| `GET /ops/reports/leads/funnel` · `GET /ops/reports/partners/performance` | Reporting |

**Partner portal (CA / DSA)**

`GET /partner/dashboard` (submitted / sanctioned / disbursed / commission pending / open leads / SLA due) · `GET /partner/leads?scope=assigned|referred&status=&q=` (SLA and protection days left) · `GET /partner/leads/:id` (masked until accepted) · `POST /partner/leads` (refer a lead) · `POST /partner/leads/:id/accept` · `/decline` · `/return` · `POST /partner/leads/:id/reveal-contact` (logged) · `POST /partner/leads/:id/activities` · `POST /partner/leads/:id/follow-ups` · `PATCH /partner/leads/:id` · `POST /partner/leads/:id/convert` (start application) · `POST /partner/leads/:id/offline-conversion` · `POST /partner/leads/:id/lost` · `POST /partner/leads/:id/sub-assign` (firm owner → staff) · `GET/PUT /partner/capacity` · `GET/PUT /partner/service-areas` · `GET/POST /partner/members` (firm staff) · `POST /partner/borrowers` · `POST /partner/applications` (then the shared application endpoints, scoped to the partner) · `POST /partner/applications/:id/borrower-consent/send` · `…/verify` · `GET /partner/commissions/summary` · `GET /partner/commissions/ledger?state=` · `GET /partner/commissions/statement?from=&to=` · `GET/PATCH /partner/profile` (KYC, bank) · `GET /partner/referral-codes`

**Lender portal**

`GET /lender/submissions?status=` · `GET /lender/submissions/:id` (packet + consented documents) · `POST /lender/submissions/:id/events` (`acknowledged | query_raised | sanctioned | rejected | disbursed` + evidence) · `POST /lender/submissions/:id/document-requests` · `GET /lender/products` · `POST /lender/products/:id/change-requests`

**Ops console**

`GET /ops/cases?status=&category=&city=&flagged=&assignee=` · `GET /ops/cases/:id` (facts with confidence and provenance, score breakdown, signals, audit trail) · `POST /ops/cases/:id/assign` · `POST /ops/cases/:id/document-requests` · `POST /ops/cases/:id/facts/:attribute/verify` (correct or verify, with reason) · `POST /ops/cases/:id/approve-submission` · `POST /ops/submissions/:id/events` (on behalf of a lender, evidence required) · `POST /ops/assessments/:id/recompute` · `GET /ops/risk-signals` · `POST /ops/fraud-reviews/:id/decision` · `GET /ops/attribution-disputes` · `POST /ops/attribution-disputes/:id/resolve`

**Admin (configuration — maker-checker on publish)**

`/admin/lenders` (+ `/agreements`, `/contacts`) · `/admin/lender-products` (+ `/versions`: create, update draft, `submit`, `approve`, `publish`, `retire`, `simulate`) · `/admin/attributes` · `/admin/questions` · `/admin/question-sets` (+ versions, `preview`) · `/admin/document-types` · `/admin/document-requirements` · `/admin/scoring-models` (+ versions, `simulate`) · `/admin/improvement-rules` · `/admin/consent-templates` · `/admin/loan-categories` · `/admin/geo` · `/admin/partners` (verify, level, suspend) · `/admin/commission-schemes` · `/admin/finance/receivables` · `/admin/finance/payouts` · `/admin/finance/reconciliation` · `/admin/users` · `/admin/change-requests` (approve / reject) · `/admin/audit-events` · `/admin/notification-templates`

**Webhooks (signature-verified)**

`POST /webhooks/sms/:provider` · `/webhooks/whatsapp/:provider` · `/webhooks/aa/:provider` · `/webhooks/bureau/:provider` · `/webhooks/lenders/:lenderKey` · `/webhooks/leads/:source`

**Sync & real-time**

`GET /sync/changes?since=&types=` (changed IDs + versions) · WebSocket namespace `/v1/realtime` (rooms per user, membership and organization; events carry IDs only) · `PUT /me/sessions/current/push-token`

### 10.3 Compatibility layer for the current app (v0.1 only)

A small `compat` module serves the app's 17 existing calls under `/v0` with their exact paths and shapes (the app only sets `EXPO_PUBLIC_API_URL=<host>/v0`), delegating to the real v1 services and resolving the borrower's active draft application. This lets the **existing demo app run end to end against the real backend** for the v0.1 internal-testing gate, with no frontend work. It converts rupees ↔ paise, `DD/MM/YYYY` ↔ ISO, `tenureYears` ↔ months, and catalog IDs. It is deleted once the app moves to `/v1`.

---

## 11. Project structure

The repo root is this workspace (`fundenflo/`, git initialised locally). The NestJS app lives in `backend/`; `postman/` and `docs/` sit beside it. `frontend/` is a reference clone of the app repo and is git-ignored. Deployment files (Dockerfiles for Azure, pipelines, IaC) belong to Pradeep's infra work and are not part of this plan.

```
fundenflo/
├── .claude/                             # CLAUDE.md + context/ (machine-readable working context)
├── frontend/                            # reference clone of fundenflo-v1-app — git-ignored, never edited
├── postman/                             # §12
├── docs/                                # plan, ARCHITECTURE.md, inventory, DUPLICATES.md
└── backend/
    ├── prisma/schema/*.prisma           # one schema file per module area
    ├── prisma/migrations/               # Prisma Migrate SQL + hand-written SQL for triggers and functions
    ├── src/
    │   ├── main.ts / worker.ts          # HTTP entrypoint / worker entrypoint (standalone app: queues + schedulers)
    │   ├── app.module.ts / worker.module.ts / worker-scheduler.service.ts
    │   ├── bootstrap/                   # env loading, HTTP app configuration shared by main and tests
    │   ├── config/                      # Typed env (Zod), loadConfig, InjectConfig
    │   ├── common/                      # auth decorators, request context, enums, constants, errors, events,
    │   │                                #   http (request id, JSON body, ETag, If-Match), listing, validation, ids
    │   ├── generated/prisma/            # Prisma client (generated, git-ignored)
    │   ├── infrastructure/
    │   │   ├── database/                # PrismaService (pg driver adapter), TransactionHost types, Prisma error helpers
    │   │   ├── redis/  queue/  outbox/  # Redis client, BullMQ queues + registry + ContextualProcessor, outbox writer/relay
    │   │   ├── crypto/                  # FieldCipher (AES-256-GCM, key ring), key providers (local, Azure Key Vault), BlindIndex
    │   │   ├── storage/                 # ObjectStorage port + Azure Blob adapter (Azurite locally)
    │   │   ├── idempotency/  rate-limit/  security/  maintenance/  logger/
    │   │   └── realtime/  cache/  telemetry/   # planned
    │   ├── engines/                     # PURE TypeScript — no Nest imports, ~100% unit-tested
    │   │   ├── party-matching/          # Normalisation, masking, match decisions (built)
    │   │   ├── conditions/  formulas/  facts/  questionnaire/  documents/   # planned
    │   │   ├── scoring/  improvement/  matching/  commissions/  assignment/  # planned
    │   │   └── state-machines/          # planned: application, submission, document, receivable, payout, lead, assignment
    │   ├── integrations/                # Port interface + adapters: sms/ email/ (built); whatsapp/ llm/ account-aggregator/
    │   │                                #   bureau/ gstn/ kyc/ digilocker/ antivirus/ (planned)
    │   ├── modules/
    │   │   ├── auth/  access/  parties/  audit/  notifications/  health/      # built in M0
    │   │   ├── borrowers/  attributes/  catalog/  questionnaires/  leads/  imports/  activities/  sla/
    │   │   ├── consents/  documents/  assessments/  lenders/  matching/  applications/
    │   │   ├── partners/  commissions/  risk/  config-publishing/  sync/
    │   │   └── compat/                  # v0.1 shim for the current app (§10.3) — temporary
    │   └── scripts/                     # seed (+ seed-data/), generate-keys, invite-staff, route-catalog, inventory-check
    ├── test/integration/                # Testcontainers (Postgres 18, Valkey, Azurite) + supertest specs
    └── docker-compose.yml               # local dependencies only: postgres 18, valkey, azurite, mailpit, clamav (profile)
```

Seeds never invent lender or lead data; M2 seeds port the app's constants into catalog, questions, consent and documents.

**Module anatomy** (same in every module):

```
modules/lenders/
├── lenders.module.ts
├── http/            # controllers per audience: admin.controller.ts, lender-portal.controller.ts
│   └── dto/         # Zod schemas (request + response)
├── application/     # Use-case services (one public façade service exported to other modules)
├── domain/          # Types, domain events, policies (calls into src/engines)
└── infrastructure/  # repositories (TransactionHost-based), processors, maintenance tasks
```

**Dependency rules** (enforced with `dependency-cruiser` in CI):
- `engines/*` imports nothing from Nest, modules or infrastructure.
- A module imports another module only through its exported façade service, or reacts to its domain events.
- No module touches another module's tables.
- `integrations/*` are reached only through their port interfaces, and mock adapters are selected by config, so local development and CI need no vendor accounts.

---

## 12. Postman collection strategy (instead of Swagger)

**Goal:** Postman is the single API reference with no Swagger decorators in the code. It must also stay correct over time. Three things make that happen: the source lives as small JSON files in Git, a build step assembles the importable collection, and CI fails if an endpoint has no Postman request.

```
postman/
├── README.md                                  # Conventions, how to import/build/run
├── collection/                                # SOURCE OF TRUTH — one file per request, reviewed in PRs
│   ├── _collection.json                       # info, Bearer {{accessToken}} auth, variables,
│   │                                          #   collection pre-request script (X-Request-Id, idempotency key)
│   ├── 01 Auth/
│   │   ├── _folder.json                       # folder description + auth override (noauth)
│   │   ├── 01 Request OTP.json
│   │   ├── 02 Verify OTP.json                 # test script saves accessToken / refreshToken / userId
│   │   ├── 03 Refresh Token.json
│   │   └── 04 Logout.json
│   ├── 02 Me/
│   ├── 03 Catalog/
│   ├── 04 Borrower Journey/
│   ├── 05 Documents/
│   ├── 06 Assessment & Matching/
│   ├── 07 Applications & Submissions/
│   ├── 08 Leads & Imports/
│   ├── 09 Sync & Sessions/
│   ├── 10 Partner Portal - Leads/
│   ├── 11 Partner Portal - Applications & Commissions/
│   ├── 20 Lender Portal/
│   ├── 30 Ops Console/
│   ├── 40 Admin - Lenders & Products/
│   ├── 41 Admin - Attributes & Questionnaires/
│   ├── 42 Admin - Documents, Scoring, Consent/
│   ├── 43 Admin - Partners & Finance/
│   ├── 44 Admin - Users, Change Requests, Audit/
│   ├── 90 Webhooks/
│   └── 99 Compat (v0.1 app)/
├── flows/                                     # Ordered end-to-end scenarios (also run in CI)
│   ├── lead-backlog-to-ca/                    #   import → map → validate → commit → route → CA accept →
│   │                                          #   activity → convert → application linked to lead
│   ├── multi-login/                           #   borrower OTP → partner signup → switch context → sessions
│   ├── msme-happy-path/                       #   OTP → profile → application → answers → consent →
│   ├── individual-salaried/                   #   docs → analysis → score → match → submit →
│   ├── partner-filed-application/             #   lender sanction → disbursal → commission
│   └── lender-onboarding/                     #   admin creates lender → product → simulate → publish
├── environments/
│   ├── local.postman_environment.json         # baseUrl, mock OTP; no secrets committed
│   ├── staging.postman_environment.json
│   └── production.postman_environment.json    # secrets entered locally (Postman vault), never in Git
├── scripts/
│   ├── build.ts      # collection/ → dist/FundenFlo.postman_collection.json (v2.1); strips "NN " ordering
│   │                 #   prefixes; validates every file against the v2.1 schema
│   ├── split.ts      # Exported collection from the Postman app → back into collection/ files
│   └── coverage.ts   # Boots Nest, lists every route, fails CI if any METHOD+path has no request file
└── dist/             # gitignored build output → import into Postman
```

**Request file shape** (Postman v2.1 item, one per file):

```json
{
  "name": "Verify OTP",
  "request": {
    "method": "POST",
    "url": "{{baseUrl}}/auth/otp/verify",
    "header": [{ "key": "Content-Type", "value": "application/json" }],
    "body": { "mode": "raw", "raw": "{\n  \"mobile\": \"{{mobile}}\",\n  \"otp\": \"{{otp}}\"\n}" },
    "description": "Verifies the 6-digit OTP. Returns access + refresh tokens. Errors: OTP_INVALID (401), OTP_EXPIRED (410), OTP_LOCKED (429)."
  },
  "event": [{ "listen": "test", "script": { "exec": [
    "pm.test('200 OK', () => pm.response.to.have.status(200));",
    "const b = pm.response.json();",
    "pm.collectionVariables.set('accessToken', b.accessToken);",
    "pm.collectionVariables.set('refreshToken', b.refreshToken);"
  ]}}],
  "response": [
    { "name": "200 OK", "code": 200, "body": "{ \"accessToken\": \"…\", \"refreshToken\": \"…\", \"expiresIn\": 900, \"user\": { … } }" },
    { "name": "401 OTP_INVALID", "code": 401, "body": "{ \"code\": \"OTP_INVALID\", \"message\": \"Incorrect Code. Please Check And Try Again.\" }" }
  ]
}
```

**Rules**
- Every PR that adds or changes an endpoint adds or updates its request file, including **saved example responses for success and each documented error**. The examples serve as the API documentation, and `coverage.ts` enforces this in CI.
- `flows/` run in CI with **Newman** against an ephemeral environment (Docker Compose), so the Postman collection doubles as the API contract test suite.
- From the built collection, the team can publish Postman documentation and create a **Postman mock server**, so frontend work can start before an endpoint is built.

---

## 13. AI architecture

**Document pipeline** (worker, per document):

1. Antivirus scan → magic-byte type check → page count and size limits.
2. **Classify** (cheap model or heuristics): is this the declared type? Which bank or format?
3. **Extract**, in this order of preference:
   1. Structured source (Account Aggregator, GSTN) when consented and available.
   2. Deterministic parsers for text PDFs (bank-statement parsers per bank format).
   3. LLM extraction for scans and unknown formats, using **structured output against a JSON Schema**.
4. **Validate:** running-balance continuity, date gaps, totals vs line items, metadata anomalies → `doc_tamper` and `inflow_mismatch` risk signals.
5. **Write facts** with `provenance = extracted`, confidence and page references. Low confidence → `needs_review`.

**Guardrails**
- AI never computes the score, decides eligibility or writes lender status.
- Every extraction stores model ID, **prompt version** (prompts are versioned files in `src/integrations/llm/prompts/`) and extractor version.
- Data minimisation: send only the pages needed and mask identifiers where the task allows.
- An offline **evaluation set** of labelled documents gates every prompt or model change with accuracy thresholds. This follows the roadmap's v2.0 rule to evaluate before deploying, and it applies from v1.0.
- The vendor contract must exclude training on customer data. Confirm data residency and cross-border transfer with counsel. Evaluate the API directly and through Microsoft Foundry on Azure.

**v1.1 workflow agent:** event-driven jobs for missing-document reminders, lender packet assembly and follow-ups. The LLM drafts messages and **outbound messages to lenders need human approval** until accuracy is measured. It can never invent a lender response.

---

## 14. Security, privacy & compliance

| Area | Controls |
|---|---|
| Data location | Indian Azure regions. This is a requirement for infra (Pradeep); the backend stores no data outside the database and blob storage. |
| Lead data shared with CAs | Shared only with a valid consent or lawful basis (§7.2); PII masked until a CA accepts; every contact reveal logged; a CA sees only leads assigned to their organization; revoking an assignment revokes access |
| Encryption | TLS 1.2+; database and blob storage encrypted at rest (infra); **field-level envelope encryption** (AES-256-GCM) for PAN, DOB, bank account and bureau payloads; **HMAC blind indexes** for PAN, mobile and GSTIN so duplicates can be found without decrypting. Never store full Aadhaar numbers. |
| Documents | Private blob container, no public access; read SAS URL ≤ 5 min; every access logged (`document_access_logs`); ClamAV; 10 MB limit (matches app); PDF/JPG/PNG only |
| Borrower auth | 6-digit OTP, HMAC-hashed, 5-min TTL, 5 attempts, 30 s resend (matches UI); limits per mobile, IP and device; DLT-registered templates |
| Sessions | ES256 JWT, 15-min access token, `kid` key rotation; rotating refresh tokens with reuse detection (revokes the family); device binding |
| Staff / lender auth | argon2id + mandatory TOTP; optional Google Workspace SSO for staff; optional admin IP allowlist |
| Authorization | CASL deny-by-default; query-level scoping; role-based field masking |
| Consent enforcement | `ConsentGuard(purpose)` on jobs and endpoints: AI extraction needs `ai_documents`, bureau pulls need `credit_bureau`, each lender packet needs `lender_sharing` scoped to that lender. Withdrawal stops further processing and sharing. |
| Audit | Hash-chained `audit_events` for every write, plus read access to PII and documents, recording who / what / when / where / why |
| Retention | Policy per document type and data category; scheduled purge jobs; legal-hold flag; DPDP erasure workflow |
| AppSec | Helmet, strict CORS, body limits, webhook signature verification, SSRF-safe outbound HTTP, Secrets Manager, Dependabot + CodeQL, OWASP ASVS L2 target, **external pen test before v1.0** |
| Legal items for counsel (from the roadmap) | DPDP Act & Rules (consent, notices, rights, breach reporting); RBI Digital Lending Directions (LSP obligations, grievance officer, India data storage, fee flows); **whether FundenFlo can be an Account Aggregator FIU or must go through a regulated lender/TSP**; **bureau access route (CICRA)**; partner agreements and lead-protection terms |

---

## 15. Integrations

Each integration is a **port** (TypeScript interface) with a **mock adapter**, used in local, CI and v0.1, plus one **real adapter** per chosen vendor. Vendors are business decisions (§18).

| Port | Purpose | Release |
|---|---|---|
| `SmsPort` | OTP + transactional SMS (DLT) | v0.1 |
| `StoragePort` / `AntivirusPort` / `CryptoPort` | Azure Blob (Azurite locally), ClamAV, Azure Key Vault | v0.1 |
| `LeadSourcePort` | Meta / Google lead ads, WhatsApp, IVR missed call | v1.1 |
| `PushPort` | Expo push (app), web push | v0.1 (Expo) |
| `TelephonyPort` | Masked calling for CAs, so the borrower's number stays hidden | Later; the `contact_reveals` design already allows it |
| `KycPort` | PAN verification, GSTIN lookup, Udyam | v1.0 |
| `LlmPort` | Classification, extraction, explanation | v1.0 |
| `AccountAggregatorPort` | Consent-based bank data (FIU route via partner, TBD) | v1.0 if a legal route exists, else v1.1 |
| `BureauPort` | Credit report (route TBD) | v1.0 if a legal route exists |
| `GstnPort` | GST returns via GSP | v1.0 / v1.1 |
| `DigiLockerPort` | Document fetch ("Soon" in the app today) | v1.1 |
| `WhatsAppPort` / `EmailPort` | Notifications (opt-in) | v1.1 (email for staff in v0.1) |
| `LenderDeliveryPort` | Packet delivery: lender portal (v1.0), email (v1.0), lender API (v3.0) | v1.0+ |

---

## 16. Local development, CI checks, observability, testing

**Deployment is out of scope.** Azure hosting, pipelines and environments are owned by Pradeep. The backend asks infra only for the following, all through environment variables:

| Need | Configuration |
|---|---|
| PostgreSQL 18 (primary + read replica) | `DATABASE_URL`, `DATABASE_REPLICA_URL` |
| Redis-compatible cache and queues | `REDIS_URL` |
| Private blob container | `STORAGE_DRIVER=azure_blob`, `STORAGE_ACCOUNT_URL`, `STORAGE_CONTAINER` (managed identity or connection string) |
| Key Vault key for envelope encryption; HMAC key for blind indexes | `CRYPTO_DRIVER=azure_key_vault`, `KEY_VAULT_URL`, `KEY_VAULT_KEY_NAME`, `BLIND_INDEX_KEY` |
| JWT signing keys (kid-tagged, rotatable) | `JWT_SIGNING_KEYS` |
| Vendor credentials | One variable group per adapter (§15). SMS: `SMS_API_KEY`, `SMS_SENDER_ID`, `SMS_DLT_ENTITY_ID`, `SMS_DLT_TEMPLATE_AUTH_OTP`, `SMS_DLT_TEMPLATE_INVITATION_MEMBER` (template IDs are applied to `notification_templates` by `pnpm db:seed`). Email: `SMTP_URL`, `EMAIL_FROM`. |
| Two processes from one build | `node dist/main.js` (API) and `node dist/worker.js` (worker), scaled independently |
| Health probes | `GET /health/live`, `GET /health/ready` |
| Telemetry | `OTEL_EXPORTER_OTLP_ENDPOINT`, `SENTRY_DSN` |

**Local:** `docker compose up` starts Postgres 18, Valkey 8, Azurite, Mailpit and ClamAV. `pnpm dev` runs the API and worker in watch mode. `pnpm db:migrate && pnpm db:seed` loads the catalog seeded from the current app's constants.

**CI checks on every PR** (run on whichever CI runner infra provides):
1. `pnpm lint` (oxlint) and `pnpm lint:boundaries` (dependency-cruiser).
2. `pnpm typecheck`.
3. `pnpm test` (unit).
4. `pnpm test:integration` (Testcontainers).
5. `prisma migrate diff --from-config-datasource --to-schema prisma/schema` must be empty (migration drift).
6. `pnpm postman:build` + `pnpm postman:coverage`.
7. `pnpm postman:flows` against the API started on Docker Compose dependencies.
8. `pnpm inventory:check`: every route in code has a row in `docs/inventory/api-routes.md` marked `useful`, and no `useful` row is missing from code.

**Observability:** pino JSON logs with PII redaction; OpenTelemetry traces across HTTP, Postgres, BullMQ and outbound calls; Sentry; queue dashboards. Business metrics come from domain events into reporting tables, covering the roadmap's metric families: journey funnel, funding outcomes, AI overrides, unit economics, partner quality, policy freshness.

**Testing approach**

| Layer | What | Tooling |
|---|---|---|
| Engines | Exhaustive unit tests + **property tests** (three-valued logic, ranges, scoring bounds 0–100) | Vitest, fast-check |
| Golden files | Fixed borrower profiles → expected score and match results; a model or rule change shows a reviewable diff | Vitest snapshots |
| Modules | Real Postgres/Valkey, transactions, CASL scoping, append-only triggers | Testcontainers |
| API / E2E | Postman `flows/` | Newman |
| Non-functional | Load (OTP, upload, matching); security | k6; external pen test |

---

## 17. Delivery plan mapped to app versions

Milestones are sequential gates, with **no calendar dates** (per the roadmap). Assign dates after team sizing.

| Milestone | Delivers | Release |
|---|---|---|
| **M0 Foundation** ✅ built | Repo scaffold, config, Prisma + migrations, flat error format, logging/tracing, **parties + party resolver**, **identity with multiple logins** (OTP with `loginAs`, `user_logins`, sessions, switch context), organizations/memberships/CASL, audit log, outbox + BullMQ, storage + crypto ports, Docker Compose, Postman skeleton + build/coverage scripts, inventory check | Foundation |
| **M1 Leads & CA distribution** (business priority) | Minimum catalog + geography (segments, categories, cities, pincodes, aliases), attribute dictionary + facts, basic questionnaire (sets + validation) for `lead_capture`, contact and share-with-partner consent, maker-checker publishing (first used by routing rules), import pipeline, lead capture (import, manual, public form, app drop-offs), dedupe + merge queue, light partner onboarding (KYC status, capacity, service areas, firm members), routing rules + assignment engine, CA lead APIs (masked inbox, accept/decline, activities, follow-ups, convert, offline conversion), SLA timers + reassignment, assignment notifications (SMS, email, push), real-time + delta sync, lead reports | **Lead gate:** backlog imported, deduped and consent-checked; CAs receive, work and close leads with a full audit trail |
| **M2 Config core** | Progressive profiling, journey consent templates, document types/requirements; **seeds ported from the app's constants** | v0.1 |
| **M3 Borrower intake** | Borrower profiles, applications (draft → pre_screened → documents_pending), answers → facts, private document upload + antivirus, PAN/profile, ops read-only case view, lead ↔ application link, **compat module** so the current app runs on the real backend | **v0.1 gate:** internal cases created and reviewed safely |
| **M4 Lender catalog** | Lenders, agreements, products, versioned rule definitions, simulation, coverage → computed category availability | v1.0 |
| **M5 Assessment** | Extraction pipeline (parsers + LLM + AA if available), provenance facts, consistency signals, scoring engine, improvement engine, analysis job API | v1.0 |
| **M6 Matching & execution** | Matching engine, lender-scoped sharing consent, packet generation, submission state machine, minimal lender portal, ops case queue (reuses assignment + SLA), document requests, outcome capture | v1.0 |
| **M7 Partners & money** | Full partner KYC, referral codes, attribution + protection + disputes, partner-filed applications with borrower OTP consent, commission schemes (including lead fees and credits), double-entry ledger, receivables, payouts, statements, reconciliation | v1.0 |
| **M8 Risk & hardening** | Duplicate-identity signals, fraud review queue, DPDP rights + retention jobs, load test, pen test, runbooks | **v1.0 gate:** real end-to-end case through to verified disbursal |
| v1.1 | WhatsApp/email, workflow agent (follow-ups, packets), AI override monitoring, ops dashboards, direct SAS uploads, DigiLocker, Postgres RLS, ad/WhatsApp/IVR lead sources, masked calling for CAs | v1.1 |
| v2.0 | Outcome datasets, offline evaluation harness for rule/model changes, rankings informed by outcomes, opt-in monitoring + reassessment + renewal reminders | v2.0 |
| v3.0 | Partner subscriptions + billing, advisory workflows (after legal approval), B2B API (`api_clients`, metering), direct lender API integrations | v3.0 |

**Immediate next step after approval:** M0 (scaffold, parties, multi-login identity, error format, Postman skeleton), then M1 (leads to CAs), because that is what the business needs first.

---

## 18. Decisions needed

| # | Decision | Recommendation |
|---|---|---|
| 1 | Cloud and region | **Decided:** Azure, owned by Pradeep. Backend needs listed in §16. |
| 2 | ORM | **Decided:** Prisma 7 |
| 3 | Backend Git remote | Workspace root is a local git repo (`backend/`, `postman/`, `docs/`; `frontend/` git-ignored). It still needs a GitHub remote. |
| 4 | Vendors: SMS OTP (DLT), WhatsApp provider, PAN/KYC, AA route, bureau route, GSP, LLM provider | Mocks until chosen; ports make swapping cheap |
| 5 | FundenFlo's legal role (LSP vs lender DSA) | Needed before AA/bureau design is final |
| 6 | Lender portal in v1.0: lender self-service, or ops acting on their behalf first? | Build both paths; start with ops on behalf |
| 7 | Parallel submissions per case (one lender or several?) | Allow N (config, default 3), with lender-scoped consent per submission |
| 8 | Default lead-protection window and attribution precedence | Configurable per partner agreement (the design implies about 60 days) |
| 9 | Who builds the ops/admin and partner/lender web frontends | The APIs here assume separate web apps |
| 10 | Hindi content for dynamic config at v1.0 | The schema supports it from day one; content can follow |
| 11 | Existing lead data: files, columns, sources | Share the real files so the import mapping and dedupe rules are built against actual data |
| 12 | Can backlog leads be shared with CAs (consent evidence / lawful basis)? | Legal decision. The system enforces whatever is decided, and leads with unknown basis wait in `consent_pending`. |
| 13 | Commercial terms with CAs for leads | Configurable (§7.7); start with `none` until terms are signed |
| 14 | How CAs are chosen today | Default: rule-based by pincode/city + least-loaded, with ops override |
| 15 | Who builds the CA lead screens (app or web) | The APIs in §10.2 are ready for either |
