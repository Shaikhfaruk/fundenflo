# Inventory — Shared building blocks

> Build each capability once and reuse it. **Search this table before writing a helper, base class, guard, interceptor or engine.**
> Paths are relative to `backend/src/`. `useful` evidence = file path + the unit/integration specs noted; `planned` evidence = plan section.

## Engines (`engines/` — pure TypeScript, no Nest imports)

| Component | Path | Main exports | Used by | Milestone | Status | Evidence |
|---|---|---|---|---|---|---|
| Condition DSL | `engines/conditions/` | `validateCondition` (against an attribute resolver, size limits in `CONDITION_LIMITS`), `evaluateCondition` (three-valued `pass`/`fail`/`unknown` over scalar, list and `{min,max}` range facts, with a trace), `collectMessages`, `referencedAttributes`, `isRange` | attributes (`AttributeDictionary.validate/evaluate`); next: questionnaires, leads routing, lenders, documents, assessments, sla | M1 | `useful` | `conditions.spec.ts`; spec `attributes` |
| Formulas | `engines/formulas/` | `evaluateFormula` (JSON Logic) | attributes (derived), lenders (indicative amount), scoring | M1 | `planned` | §6.1 |
| Facts | `engines/facts/resolve-fact.ts` | `resolveFact` (skip expired, fresh before stale, then rank, then recency), `isBetterFact`, `isStale`, `isExpired`; `detectConflicts` comes with M5 | attributes (`FactService.current`); next: questionnaires, assessments, matching | M1 | `useful` | `facts.spec.ts`; spec `attributes` |
| Party matching | `engines/party-matching/` | `normaliseMobile`, `normaliseEmail`, `maskMobile`, `maskEmail`, `decideMatch` (identifier normalisers for PAN/GSTIN come with M3 KYC) | parties, auth, access, notifications | M0 | `useful` | `party-matching.spec.ts` |
| Assignment | `engines/assignment/` | `pickAssignee` with strategies `manual`, `round_robin`, `weighted`, `least_loaded`, `pool`, `broadcast`, `sticky` | leads, applications (case queue), risk | M1 | `planned` | §7.4 |
| State machines | `engines/state-machines/` | `defineMachine` (`can`, `next`, `events`), `TransitionError`; machines in `machines/`: `configVersionMachine` (built), `lead`, `leadAssignment`, `application`, `submission`, `document`, `analysis`, `receivable`, `payout` (planned) | config-publishing; next: leads, applications, documents, commissions | M1 | `useful` | `state-machines.spec.ts`; spec `config-publishing` |
| Questionnaire | `engines/questionnaire/` | `resolveQuestionnaire` (scope match, generic-then-specific merge, one entry per question, three-valued visibility), `scopeMatches`, `scopeSpecificity`, `remainingRequired`, `answerToFact` (option → fact, typed validation), `questionJsonSchema`; progressive profiling and discriminating order come with M2 | questionnaires | M1 basic, M2 full | `useful` | `questionnaire.spec.ts`; specs `questionnaires`, `config-publishing` |
| Document checklist | `engines/documents/` | `resolveChecklist` | documents | M2 | `planned` | §6.5 |
| Scoring | `engines/scoring/` | `computeScore` | assessments | M5 | `planned` | §6.6 |
| Improvement | `engines/improvement/` | `buildImprovementPlan` | assessments | M5 | `planned` | §6.7 |
| Matching | `engines/matching/` | `filterCandidates`, `evaluateEligibility`, `rankProducts`, `explainResult` | matching | M6 | `planned` | §6.8 |
| Commissions | `engines/commissions/` | `calculateCommission`, `buildLedgerPostings` | commissions | M7 | `planned` | §8.5, §7.7 |

## Infrastructure (`infrastructure/`)

| Component | Path | Main exports | Used by | Milestone | Status |
|---|---|---|---|---|---|
| Infrastructure module | `infrastructure/infrastructure.module.ts` | `InfrastructureModule.forRoot({ processName })` — config, logger, CLS + transactional plugin, database, Redis, crypto, storage, queues | api, worker, scripts | M0 | `useful` |
| Database | `infrastructure/database/` | `PrismaService` (pg driver adapter), `PrismaTx` (TransactionHost type), `isUniqueViolation`, `isRecordNotFound` | all repositories | M0 | `useful` |
| Transactions | `@nestjs-cls/transactional` via `infrastructure.module.ts` | `@Transactional()`, `TransactionHost<PrismaTx>` | every service that writes | M0 | `useful` |
| Redis | `infrastructure/redis/redis.module.ts` | `REDIS_CLIENT`, `@InjectRedis()` | rate limits, revocation, MFA challenges, health | M0 | `useful` |
| Queues | `infrastructure/queue/` | `QueueModule`, `QueueName`, `QueueRegistry`, `ContextualProcessor`, `EVENT_ROUTES`, `DEFAULT_JOB_OPTIONS`, `JobPriority` | notifications, outbox, auth, maintenance | M0 | `useful` |
| Outbox | `infrastructure/outbox/` | `OutboxService.publish()` (same transaction as the change), `OutboxRelayProcessor` | every module that emits events | M0 | `useful` |
| Crypto | `infrastructure/crypto/` | `FieldCipher` (AES-256-GCM, purpose-bound, key ring with rotation), `BlindIndex`, `LocalKeyProvider`, `AzureKeyVaultKeyProvider`, `CipherPurpose`, `BlindIndexDomain`, `randomToken`, `randomDigits`, `sha256`, `hmacSha256`, `safeEqual` | parties, auth, access, notifications | M0 | `useful` (spec `crypto.spec.ts`) |
| Storage | `infrastructure/storage/` | `ObjectStorage` port, `OBJECT_STORAGE`, `AzureBlobStorage` (shared-key SAS or user-delegation SAS) | documents, imports (M1+) | M0 | `useful` (container created against Azurite in every integration run; first caller in M1) |
| Idempotency | `infrastructure/idempotency/` | `@Idempotent()`, `IdempotencyInterceptor`, `IdempotencyMaintenance` | admin creates; all future create endpoints | M0 | `useful` (spec `staff-admin`) |
| Rate limiting | `infrastructure/rate-limit/` | `RateLimiter.consume/count/reset`, `@RateLimitByIp(rule)` | auth (OTP, refresh, staff login, MFA, invitations) | M0 | `useful` |
| Revocation | `infrastructure/security/revocation.service.ts` | `RevocationRegistry` (session, membership, user) | access-token guard, sessions, memberships, admin users | M0 | `useful` |
| Maintenance | `infrastructure/maintenance/` | `@MaintenanceTask(name)`, `MaintenanceProcessor` (discovers tasks), `RETENTION` | auth, idempotency; later documents, leads, audit retention | M0 | `useful` |
| Logger | `infrastructure/logger/` | `buildLoggerParams` (pino, PII redaction, path-only request logging) | api, worker | M0 | `useful` |
| Realtime | `infrastructure/realtime/` | `RealtimeGateway`, `RealtimePublisher.toRoom()` | sync, leads, applications | M1 | `planned` |
| Cache | `infrastructure/cache/` | `CacheService.wrap(key, tags, ttl, load)`, `invalidate(...tags)` (Redis, tag-versioned keys), `runThenInvalidate(txHost, cache, tags, work)` (runs `work` in a transaction, invalidates only after commit) | catalog, geo, attributes; next: config-publishing, leads routing | M1 | `useful` (specs `catalog`, `attributes`: admin change visible immediately) |
| Telemetry | `infrastructure/telemetry/` | OpenTelemetry setup | all | M1 | `planned` |

## Common (`common/`) and platform helpers

| Component | Path | Main exports | Used by | Milestone | Status |
|---|---|---|---|---|---|
| Config | `config/` | `envSchema`, `loadConfig`, `AppConfig`, `APP_CONFIG`, `@InjectConfig()` | everything | M0 | `useful` |
| Errors | `common/errors/` | `ErrorCode`, `ERROR_CATALOG`, `AppError`, `HttpErrorFilter` (flat `{ code, message, details?, requestId }`) | everything | M0 | `useful` (spec `platform`) |
| HTTP | `common/http/` | `requestIdMiddleware`, `JsonBodyMiddleware` (1 MB limit, `INVALID_JSON`), `EtagInterceptor`, `@IfMatchVersion()`, `assertVersion()` | all controllers | M0 | `useful` (spec `platform`, `auth-otp`) |
| Auth decorators | `common/auth/auth.decorators.ts` | `@Public()`, `@AllowContexts()`, `@AnyContext()`, `@StaffOnly()`, `@CurrentActor()` | all controllers | M0 | `useful` |
| Access-token guard | `modules/auth/http/access-token.guard.ts` | `AccessTokenGuard` (global): verify JWT, revocation check, context check, set actor | every route | M0 | `useful` |
| Policies | `modules/access/http/policies.guard.ts`, `modules/access/application/ability.factory.ts` | `@CheckPolicies()`, `@CurrentAbility()`, `PoliciesGuard`, `AbilityFactory`; scoping in queries via `accessibleBy(ability).ofType(...)` | admin controllers, services | M0 | `useful` |
| Change recorder | `modules/audit/application/change-recorder.service.ts` | `ChangeRecorder.record({ action, entityType, entityId, metadata, event?, payload? })`: audit event + optional outbox event in the caller's transaction | catalog, attributes; next: every admin/config write | M1 | `useful` (specs `catalog`, `attributes`) |
| Request context | `common/context/` | `RequestContext` (request ID, IP, user agent, actor), `UserActor`, `SystemActor`, `ActorSnapshot` | audit, outbox, OTP, sessions | M0 | `useful` |
| Validation | `common/validation/` | `ZodValidationPipe`, `parseOrThrow(schema, value, pathPrefix?)` (same error shape outside controllers), `@ValidBody()`, `@ValidQuery()`, `@ValidParam()`, `uuidSchema`, `deviceSchema`, `otpCodeSchema`, `personNameSchema`, `localeSchema` | all controllers | M0 | `useful` |
| Listing | `common/listing/cursor-page.ts` | `pageQuerySchema`, `pageWindow`, `toPage` (uuidv7 cursor) | admin lists, audit | M0 | `useful` |
| IDs | `common/ids/uuid-v7.ts` | `uuidv7()` | OTP challenges, scripts | M0 | `useful` (spec `uuid-v7.spec.ts`) |
| Events | `common/events/` | `EventName`, `DomainEventInput`, `DomainEventEnvelope` | outbox and consumers | M0 | `useful` |
| Enums and constants | `common/enums/` (`db.enums.ts` re-exports Prisma enums, `device-platform.enum.ts`), `common/constants/`; module-only in `modules/<m>/domain/` | — | all | M0 | `useful` |
| Time constants | `common/constants/time.constants.ts` | `DAY_MS` | sessions, auth maintenance, facts engine | M1 | `useful` |
| JSON diff | `common/utils/json-diff.ts` | `diffJson(before, after, maxChanges?)` → `{ changes: [{ path, kind, before?, after? }], truncated }` | change requests | M1 | `useful` (spec `json-diff.spec.ts`) |
| Regex patterns | `common/utils/regex.ts` | `isValidPattern` | conditions engine, question validation | M1 | `useful` |
| Exhaustive switch | `common/utils/assert-never.ts` | `assertNever` | questionnaire engine | M1 | `useful` |
| Stable JSON | `common/utils/stable-json.ts` | `stableStringify` | idempotency request hashing | M0 | `useful` |
| Templates | `modules/notifications/domain/template-renderer.ts` | `renderTemplate`, `MissingTemplateParamsError` | notifications | M0 | `useful` (spec `template-renderer.spec.ts`) |
| Route catalog | `scripts/route-catalog.ts`, `scripts/inventory-check.ts` | `listRoutes(AppModule)`; `pnpm inventory:check` | Postman coverage, inventory check | M0 | `useful` |
| Versioned config controller | `modules/config-publishing/http/versioned-config.controller.ts` | `createVersionedConfigController({ resource, path, name })` (10 routes per resource) | question sets; next: routing rules, consent templates, document requirements, lender products, scoring models, commission schemes | M1 | `useful` |
| Config resource handlers | `modules/config-publishing/application/config-handler.decorator.ts`, `config-handler.registry.ts`, `domain/config.types.ts` | `@ConfigHandler(resource)`, `ConfigResourceHandler` (`contentSchema`, `compile`, `onPublished?`), `ConfigHandlerRegistry` (discovery) | questionnaires (`QuestionSetHandler`) | M1 | `useful` |
| Money | `common/money/paise.ts` | `paiseToNumber`, `paiseFromNumber`, `rupeesToPaise` (BigInt in DB, safe integers in JSON); basis-point maths and INR formatting come with M7 | catalog; next: leads, commissions | M1 | `useful` |
| Human refs | `common/ids/` | `nextRef(prefix)` (`FF-26-…`, `LD-26-…`) | applications, leads | M1 | `planned` |
| i18n | `common/i18n/` | `SUPPORTED_LOCALES`, `DEFAULT_LOCALE`, `LocalisedText`, `localisedTextSchema`, `localise()`, `resolveLocale()`, `@RequestLocale()` | catalog, notifications, validation; next: questionnaires, consents | M1 | `useful` (spec `locale.spec.ts`) |
