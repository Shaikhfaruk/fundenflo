# System Inventory

> The map of everything in the system. **Search here before creating any function, class, route, worker, queue, channel or file, and reuse or extend what is listed.**
> Any change that adds, renames, moves, removes or changes the behaviour or callers of an item updates this inventory and the matching diagram in [`ARCHITECTURE.md`](ARCHITECTURE.md) in the same change.
> Known duplicates: [`DUPLICATES.md`](DUPLICATES.md). Design: [`BACKEND_ARCHITECTURE_PLAN.md`](BACKEND_ARCHITECTURE_PLAN.md).
> Last updated: 2026-10-10 · Backend: **M0 foundation + M1.1 catalog + M1.2 attributes, facts and conditions + M1.3 config publishing and questionnaires + M1.4 consents + M1.5 partners light + M1.6a/b leads core, consent links and drop-offs + M1.7 imports + M1.8a routing rules and lead assignments + M1.8b CA lead inbox + M1.8c SLA timers, activities and follow-ups + M1.8d lead notifications, referrals, CA edits and offline conversions + M1.6c party match reviews and merges + M1.9a realtime and push + M1.9b sync, reports and partner dashboard built: **M1 complete**; **M2 config core built** (document types, versioned document requirements, checklist, progressive profiling hook); **M3a built** (borrower profiles, loan applications, requirement, pre-check, next-step journey, lead conversion); **M3b built** (private document upload, type sniffing, antivirus scan queue, download links, checklist satisfaction, application refresh queue, merge participants for profiles, applications and documents); **M3c built** (application consents, co-applicants with OTP consent, PAN verification, partner-filed applications, lead conversion by CAs, ops case view); **M4 built** (lenders, agreements, contacts, versioned lender products with simulation, category availability, lender knock-out questions, lender portal) (277 routes, 13 queues, 256 tests). Remaining M1+ items are `planned`.
> Automated checks: `pnpm inventory:check` (routes ↔ `inventory/api-routes.md`), `pnpm postman:coverage` (routes ↔ Postman), `pnpm lint:boundaries` (module rules).

## Status legend

| Status | Meaning | Evidence required |
|---|---|---|
| `planned` | Designed, not in code yet | Plan section reference |
| `useful` | Exists and has callers | File path + line, or caller list |
| `dead` | Exists, no callers | grep / knip / vulture output at the date checked |
| `duplicate` | A second implementation of something listed | Entry in `DUPLICATES.md` naming the copy to keep |
| `unsure` | Exists, callers or purpose unclear | What was checked and what is still open |

Items marked `dead` or `duplicate` are never deleted without the owner's review. Before deleting, re-check with a fresh grep, knip and vulture run, because this inventory is a snapshot.

## Per-service tables

| Service | Table | Items |
|---|---|---|
| API — modules | [`inventory/api-modules.md`](inventory/api-modules.md) | 27 modules (22 built) |
| API — routes | [`inventory/api-routes.md`](inventory/api-routes.md) | Every HTTP and WebSocket route, grouped by Postman folder (277 built) |
| Worker — queues, jobs, cron | [`inventory/worker-queues-jobs.md`](inventory/worker-queues-jobs.md) | 13 built, 7 planned (`reports.refresh` moved to M8) |
| Events, real-time channels, notifications | [`inventory/events-and-channels.md`](inventory/events-and-channels.md) | Domain events, rooms, notification templates |
| Shared building blocks (engines, infrastructure, common) | [`inventory/shared-building-blocks.md`](inventory/shared-building-blocks.md) | Reusable components and where enums/constants live |
| Frontend app (reference, not edited) | [`inventory/frontend-api-calls.md`](inventory/frontend-api-calls.md) | 19 service functions calling 17 endpoints |

## Repository files

| Path | Purpose | Status | Evidence |
|---|---|---|---|
| `.claude/CLAUDE.md` | Working rules for this repo | `useful` | Loaded as project instructions; local only (git-ignored) |
| `.claude/context/` | Machine-readable working context, by topic and date | `useful` | Local only (git-ignored) |
| `docs/BACKEND_ARCHITECTURE_PLAN.md` | Architecture and build plan | `useful` | Source for every `planned` row |
| `docs/ARCHITECTURE.md` | Living diagrams | `useful` | Linked from every inventory table |
| `docs/inventory.md`, `docs/inventory/*.md` | This system map | `useful` | — |
| `docs/DUPLICATES.md` | Known duplicates register and single-implementation rules | `useful` | No open duplicates as of 2026-10-09 |
| `postman/` | Postman collection source, environments, flows and scripts (plan §12) | `useful` | 277 request files + 1 external upload request, 20 flows, `fixtures/sample-bank-statement.pdf` for multipart uploads (newman runs with `--working-dir postman`) (the runner clears local loopback rate-limit counters before each flow, never in production or against a non-local Redis) (step variables may reference other variables) (the runner supports several staff identities per flow via `requires: checkerInvitation` and step `identity`); `pnpm postman:coverage` and `pnpm postman:flows` pass |
| `backend/` | NestJS 12 API + worker (`package.json`, `nest-cli.json`, `tsconfig*.json`, `prisma.config.ts`, `prisma/`, `src/`, `test/`, `docker-compose.yml`, `.env.example`, `.oxlintrc.json`, `.dependency-cruiser.cjs`, `vitest.config*.ts`, `pnpm-workspace.yaml`) | `useful` | `pnpm build`, `pnpm test`, `pnpm test:integration` pass |
| `backend/prisma/migrations/20261009154711_init` | Generated schema for M0 tables | `useful` | Applied locally and in every integration run |
| `backend/prisma/migrations/20261009163422_catalog_geography` | Catalog and geography tables | `useful` | Applied locally and in every integration run |
| `backend/prisma/migrations/20261009164623_attributes_facts` | Attribute dictionary and borrower facts; hand-added `borrower_facts_immutable()` trigger (values never change, `party_id` may be re-pointed on merge, deletes allowed for erasure), one-value and confidence-range checks | `useful` | Spec `attributes` (immutability, merge re-pointing) |
| `backend/prisma/migrations/20261009170341_config_questionnaires` | Config documents, versions and change requests; questions and answers; hand-added `immutable_except_party_id()` (now used by `borrower_facts` and `answers`; replaces `borrower_facts_immutable()`), `config_versions_freeze()`, `config_change_requests_decide_once()`, no-delete triggers, maker ≠ checker check | `useful` | Specs `config-publishing` (freeze, no delete), `questionnaires` (answers append-only), `attributes` (facts still immutable) |
| `backend/prisma/migrations/20261009172715_consents` | Consent purposes and records; hand-added `consent_records` immutability (`immutable_except_party_id()`) and no-delete triggers, purpose scope/basis checks | `useful` | Spec `consents` (append-only, no delete) |
| `backend/prisma/migrations/20261009173808_partners` | Partner profiles (capacity and capabilities) and service areas; hand-added checks: one area target, pincode format, capacity ≥ 0, working days 1–7, recommender ≠ decider | `useful` | Spec `partners` |
| `backend/prisma/migrations/20261009175506_leads` | Lead sources, leads, lead events, API clients; hand-added `lead_ref_seq`, `lead_events` append-only, amount/pincode/quality/self-link checks | `useful` | Spec `leads` |
| `backend/prisma/migrations/20261009181219_consent_requests`, `20261009181303_lead_event_consent_requested` | Consent request links; `consent_requested` lead event type | `useful` | Spec `lead-consent` |
| `backend/prisma/migrations/20261009182432_imports`, `20261009182710_import_sample_encrypted` | Import batches and rows (raw rows and samples encrypted), `import_undone` lead reason | `useful` | Spec `imports` |
| `backend/prisma/migrations/20261010095207_document_types` | Document types (CHECKs: size ≤ 50 MB, positive freshness/retention days, at least one MIME type) | `useful` | Spec `documents` |
| `backend/prisma/migrations/20261010090517_referrals_offline_conversions`, `20261010090651_lead_referral_conversion_events` | `lead_attributions`, `offline_conversions` (partial unique: one `reported` per lead; amount, date and reporter ≠ decider checks), lead events `referred`, `conversion_reported`, `conversion_decided` | `useful` | Spec `lead-referrals` |
| `backend/prisma/migrations/20261009191503_activities_sla`, `20261009191643_sla_timer_sweep_indexes`, `20261009191728_lead_sla_events` | SLA timers (partial unique: one pending per kind + entity; warn ≤ due; partial sweep indexes), activities (no-update trigger, outcome only on calls, duration ≥ 0), follow-ups, assignment `first_contact_minutes` / `first_contacted_at`, lead flag `first_contact_missed`, lead events `sla_warned`, `sla_breached`, `activity_logged` | `useful` | Spec `lead-activities` |
| `backend/prisma/migrations/20261009183811_lead_assignments` | Lead assignments (offer, accept and first-contact deadlines, rule version, strategy); hand-added partial unique index `lead_assignments_one_working_per_lead` (one accepted/working assignment per lead) | `useful` | Spec `lead-routing` |
| `backend/prisma/migrations/20261010100432_borrowers_applications` | Borrower profiles, loan applications, application events; hand-added `application_ref_seq`, `application_events` append-only (`forbid_mutation()`), checks: amount > 0, tenure 1–480, pincode format, partner channel ⇔ `partner_organization_id`, closed status ⇔ `closed_at` | `useful` | Spec `applications` |
| `backend/prisma/migrations/20261010102602_documents` | Documents (status, source, reject reason, sha256, freshness, retention, lock, soft delete, storage removal); CHECKs: size 1 B–50 MB, sha256 hex, pages > 0, period order, scan attempts ≥ 0, rejected has a reason, deleted/purged ⇔ `deleted_at`, storage removed only when gone or rejected | `useful` | Spec `documents-upload` |
| `backend/prisma/migrations/20261010105040_application_parties`, `20261010105345_application_party_events` | Application parties (roles borrower / applicant / co-applicant / guarantor / director, consent status, removal; one borrower row per application; CHECKs: removed ⇔ `removed_at`, pending ⇔ no `consented_at`), backfill for existing applications, `consent` OTP purpose, `party_added` / `party_removed` / `consent_recorded` timeline events | `useful` | Specs `application-parties-kyc`, `partner-applications` |
| `backend/prisma/migrations/20261010111339_lenders` | Lenders (key, kind, RBI registration, status, response SLA), lender agreements (validity, commission note and scheme key, signed document, termination), lender contacts (encrypted email and mobile, escalation level); CHECKs: key format, SLA 1–720 h, validity order, terminated ⇔ `terminated_at`, contact reachable, escalation 1–3 | `useful` | Spec `lenders` |
| `backend/prisma/migrations/20261009154712_audit_integrity` | Hand-written: `forbid_mutation()`, `audit_event_hash()`, audit chain + append-only triggers, `NULLS NOT DISTINCT` membership index | `useful` | Spec `platform` (append-only), `staff-admin` (chain verify); `prisma migrate diff` empty |
| `.gitignore` | Ignores `node_modules`, `dist`, `.env*` (except `.env.example`), generated Prisma client, `postman/dist`, `frontend/`, `.claude`, the roadmap docx | `useful` | — |
| `frontend/` | Reference clone of `fundenflo-v1-app` @ `7bc9685` | `useful` | Requirements source only; git-ignored once the backend repo is initialised; never edited |
| `FundenFlo_Revised_Master_Roadmap_With_App_Versions.docx` | Product roadmap (source of truth for product rules) | `useful` | Plan §2; local only (git-ignored) |

## Naming conventions (so items are easy to find)

| Item | Convention | Example |
|---|---|---|
| Module folder | `backend/src/modules/<kebab-name>/` | `backend/src/modules/leads/` |
| Prisma schema | `backend/prisma/schema/<area>.prisma`, models PascalCase with `@@map` snake_case tables, fields camelCase with `@map` snake_case columns | `identity.prisma` → `user_logins` |
| Façade service | `<Name>Service`, exported from the module | `LeadService` |
| Controller | `<audience>.controller.ts` in `http/` | `partner.controller.ts` |
| Queue name | `<domain>.<action>` constant in `backend/src/infrastructure/queue/queue-names.ts` | `leads.route` |
| Domain event | `<entity>.<past-tense>` constant in `backend/src/common/events/event-names.ts` | `lead.assigned` |
| Error code | `UPPER_SNAKE` in `backend/src/common/errors/error-codes.ts`, with status and message in `ERROR_CATALOG` | `OTP_COOLDOWN` |
| Enums / constants | Database enums: Prisma schema, re-exported by `backend/src/common/enums/db.enums.ts`. Other shared: `common/enums/`, `common/constants/`. Module-only: `modules/<m>/domain/<m>.enums.ts`, `<m>.constants.ts` | `auth.enums.ts` |
| Postman request | `postman/collection/<NN Folder>/<NN Request Name>.json` | `08 Leads & Imports/03 List Leads.json` |
