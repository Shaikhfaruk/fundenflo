# Known Duplicates

> Register of anything implemented twice. Never add code to the copy marked for removal, and never recreate a deleted duplicate.
> Deleting a listed copy needs the owner's review first, plus a fresh grep, knip and vulture run at deletion time.
> Last updated: 2026-10-09

## Register

| # | Item | Copy to keep | Copy to remove | Evidence | Found on | Owner review |
|---|---|---|---|---|---|---|

No open entries. Resolved in the same change, so nothing is left to remove: 2026-10-09, three local `DAY_MS` constants (`maintenance.constants.ts`, `session.service.ts`, `attribute.constants.ts`) merged into `common/constants/time.constants.ts`; checked with `grep -rn DAY_MS backend/src`.

## Single implementations agreed by design

These are the places where a second copy is most tempting. Use the one listed.

| Need | Use only | Do not build |
|---|---|---|
| Custom fields on leads, campaigns or lender-specific forms | `questionnaires` (question sets with stage `lead_capture` / `lender_specific`) | A separate lead-form or custom-field system |
| Contact details, PAN, GSTIN of anyone | `parties` | Name, mobile or PAN columns copied onto leads, users or applications |
| Assigning leads to CAs, cases to reviewers, fraud reviews to staff | `engines/assignment` (`pickAssignees`) + the module's routing service (`LeadRoutingService` for leads) | Per-module round-robin or picker code, or a second lead-offer path that skips the consent and partner checks |
| Calls, notes, follow-ups, case notes | `ActivityService` (`activities` module), called by the owning module after its own access checks (`LeadActivityService` for leads) | `lead_notes`, `case_comments` or similar per-module tables |
| SLA deadlines and breach handling | `SlaService.start/satisfy/cancel` + a `@SlaHandlerFor(kind)` provider in the owning module | Per-module timers, delayed queue jobs per deadline, or cron checks |
| Bulk uploads (leads, coverage, geography, partners) | `imports` with one handler per type | A separate CSV parser per feature |
| Status after a lead converts | Derived from application events | A second status that is edited by hand |
| Draft → review → publish for any config | `config-publishing` + `createVersionedConfigController` | Per-resource version tables or approval flows |
| Eligibility, visibility, routing and trigger conditions | `engines/conditions` | Inline `if` trees or a second rule format |
| Money calculations | `common/money` + `engines/commissions` | Float arithmetic or local rounding helpers |
| JSON request body parsing | `common/http/json-body.middleware.ts` | `express.json()`, `body-parser` or Nest's built-in parser (bypasses `INVALID_JSON`; `express` is not a direct dependency) |
| Database transactions | `@Transactional()` + `TransactionHost<PrismaTx>` | Passing Prisma clients between services, or `prisma.$transaction` inside services |
| Row-level scoping of lists | `accessibleBy(ability, action).ofType('Model')` from `@casl/prisma/runtime` | Hand-written `where` filters that copy permission rules |
| Periodic cleanup | `@MaintenanceTask(name)` methods run by `maintenance.cleanup` | New cron queues per module for purges |
| Notifications | `NotificationService.send()` for a known address; `UserNotifier.notify()` for users by id; triggered from outbox events (after commit), e.g. `leads.notify` | Calling SMS/email adapters directly from modules, or sending inside a transaction that can roll back |
| Request IDs, actor, IP in logs, audit and outbox | `RequestContext` | Reading headers or `req.user` in services |
| Matching free text (city names, aliases) to master data | `GeoService.resolveCity()` + `lookup_aliases` + `normaliseLookupText()` | Per-feature city lists or string maps |
| Caching reference data | `CacheService.wrap()` with tags, invalidated after commit | In-process maps or ad-hoc Redis keys |
| Audit + domain event for an admin or config change | `ChangeRecorder.record()` | Calling `AuditService` and `OutboxService` separately in each service |
| Clearing caches after a write | `runThenInvalidate()` | Invalidating inside the transaction (readers can re-cache old data before commit) |
| Borrower data points (turnover, vintage, income, GST status, …) | `attributes` dictionary + `FactService.record()` | Columns on leads, applications or partner tables, or per-feature JSON blobs |
| Choosing the current value among several facts | `engines/facts` `resolveFact()` with `PROVENANCE_RANK` | Ad-hoc "latest wins" queries |
| Day and time arithmetic constants | `common/constants/time.constants.ts` (`HOUR_MS`, `DAY_MS`) | Local `DAY_MS`-style constants or inline `3600_000` |
| Draft → review → publish for a new dynamic resource | A `@ConfigHandler(resource)` + `createVersionedConfigController` (and approve/reject via `/admin/change-requests`) | Resource-specific version tables, status columns or approval routes |
| Merging or un-merging duplicate people or businesses | `PartyMergeService` + one `@PartyMergeParticipantFor(key)` provider per owning module (moves only that module's rows, returns an undo record) | Updating `party_id` columns from other services, or merges without an undo snapshot |
| Checking that a party exists | `PartyService.assertExists()` | Counting `parties` rows inside other modules' repositories |
| Validating admin-supplied regular expressions | `isValidPattern()` | Local `try { new RegExp() }` blocks |
| Turning an answer into a fact value | `engines/questionnaire` `answerToFact()` | Mapping option ids to values in lead capture, imports or the compat layer |
| Checking consent or lawful basis before contacting, sharing or processing | `ConsentService.hasConsent()` / `assertConsent()` | Reading `consent_records` directly or boolean consent columns on leads, users or applications |
| The signed-in user's party id | `MeService.partyIdOf()` | Querying `users` from other modules |
| Seeding a published config version | `seedPublishedConfig()` in `scripts/seed-data/run-seed.ts` | Hand-built `configDocument.create` calls per resource |
| Applying a state machine transition in a service | `transitionOrThrow()` | Local try/catch around `machine.next` |
| Organization lifecycle (pending, active, suspended, closed) and member token revocation | `OrganizationService` | Updating `organizations.status` or revoking memberships from partner, lender or other modules |
| Normalising an invitation recipient (mobile or email) | `toInvitationRecipient()` | Per-controller normalisation before `InvitationService.create` |
| Creating a lead from any source (ops, web form, import, drop-off, partner, webhook) | `LeadCaptureService.capture()` | Source-specific insert paths into `leads` |
| Human-readable references | `RefGenerator.next(RefKind.X)` with a Postgres sequence per kind | Counting rows or random strings for refs |
| Reading amounts written as text | `parseAmountText()` | Per-feature regexes for lakh/crore |
| Authenticating external systems | `ApiClientService` + `@ApiKeyAuth(scope)` | Per-endpoint shared secrets or header checks |
| Mapping the current actor to an audit actor type | `actorTypeOf()` | Local ternaries over `actor.type` |
| Asking a person for consent by link | `ConsentRequestService.send()` | Separate SMS/WhatsApp consent flows per module |
| Keeping lead consent status current | `LeadService.refreshConsentStatus()` via `leads.consent-sync` | Recomputing consent in routing or reports |
| Finding providers by a key decorator (handlers per resource or kind) | `collectKeyedProviders()` | Hand-written `DiscoveryService` loops |
| Reading CSV or XLSX uploads | `readTable()` in `modules/imports/infrastructure/table-reader.ts` | Per-feature spreadsheet parsing |
| Pushing live updates to open screens | an entry in `realtimeTargets` (`infrastructure/realtime/realtime-routes.ts`) for the domain event | Emitting from services or controllers, or a second socket server |
| Push notifications to app users | `UserNotifier` with the `push` channel (tokens from sessions) | Storing device tokens elsewhere or calling Expo directly |
| Offline catch-up feeds | a `@SyncSourceFor(type)` provider in the owning module, served by `GET /sync/changes` | Per-screen `updatedSince` endpoints |
| Lead and CA reports | `LeadReportService` | Ad-hoc report queries in controllers |
| Local day or month boundaries | `startOfDisplayDay` / `startOfDisplayMonth` | Manual timezone offsets |
| Which documents a borrower needs | `resolveChecklist` via `DocumentChecklistService` over published document requirements | Hard-coded document lists per segment or category |
| Turning query text into typed fact values | `coerceFactText()` with the attribute spec | Per-endpoint string parsing of facts |
| Asking for attributes a lender or model needs | an `@AttributeNeedSourceFor(key)` provider (progressive profiling) | Adding questions to question sets per lender by hand |
| Locale handling | `common/i18n/locale.ts` (`localise`, `resolveLocale`, `@RequestLocale()`) | Per-module locale constants |
| Referral protection and lead attribution to a partner firm | `LeadAttributionService` (partners) | Protection flags or referrer columns on leads |
| Reporting and verifying a loan closed outside the platform | `LeadConversionService` | Marking leads won by hand |
| Which CAs may receive a lead (verified, active, unpaused, service area, capabilities) | `PartnerService.routingPool()` | Partner queries in leads, applications or reports that repeat the eligibility filters |
| Which organizations a person's consent covers for a purpose | `ConsentService.allowedOrganizations()` | Looping `hasConsent` per organization or reading `consent_records` |
| Choosing who gets a lead (rules, pool, strategy) | `LeadRoutingService` (`route`, `assign`) | Picking CAs in controllers, processors or partner code |
| Any change to a lead assignment (offer, accept, decline, return, revoke, expire, complete, hand-over) | `LeadAssignmentService` | Writing `lead_assignments` from other services or controllers |
| Adding lead routing jobs | `LeadRoutingQueue`, and outbox events for re-routing after an assignment closes | `QueueRegistry.get(LeadsRoute).add` elsewhere, or enqueueing inside a transaction |
| Hiding a person's name before a CA accepts | `maskName()` in `engines/party-matching` | Per-view name truncation |
| Checking a membership belongs to an organization before handing work to it | `MembershipService.requireActiveMember()` | Reading `memberships` from other modules |
| Resolving free-text city, state or pincode to catalog ids | `PlaceLocator` (catalog) | Per-module city lookups (the old `LeadLocator` in leads was moved here in M3a) |
| Creating a borrower profile or the business party behind it | `BorrowerProfileService.ensure()` | Writing `borrower_profiles` or business `parties` from applications, partners or leads |
| Changing an application's status | `ApplicationService.transition()` (state machine, event row, audit, outbox) | Updating `loan_applications.status` from other services or controllers |
| Marking a lead converted when its person starts an application | `LeadService.convertToApplication()` | Closing lead assignments or setting `convertedApplicationId` from applications |
| Deciding an application's next step and blockers | `computeJourney()` in `applications/domain/journey.ts` | Per-client or per-controller stage logic |
| Receiving a document file | `POST /documents` → `DocumentService.upload` (streamed by `DocumentUploadEngine`, owner via `@DocumentOwnerFor`) | Per-module upload routes or buffering files in memory |
| Deciding a file's real type | `sniffMimeType()` in `engines/documents/file-signature.ts` | Trusting the client `Content-Type` or the file extension |
| Scanning files for malware | `AntivirusScanner` port through `DocumentScanService` | Calling clamd or another engine from other modules |
| Whether a checklist slot is covered | `DocumentChecklistService.heldChecklist()` (`satisfyChecklist`) | Counting `documents` rows in applications or lenders |
| Logging who read or downloaded a document | Audit events with `AuditEntity.Document` (`document.download_url_issued`) | A separate `document_access_logs` table (planned in §9, replaced by the audit log) |
| Re-checking an application after documents or consents change | queue `applications.refresh` → `ApplicationService.refreshForParties()` | Updating `journey_stage` or status from documents or consents code |
| Sanitising a file name | `common/utils/file-name.ts` (`safeFileName`, `displayFileName`) | Local regex helpers in services |
| Taking consent by a one-time code (co-applicants, partner-assisted borrowers) | `ConsentOtpService` (consents) | Calling `OtpService` or `ConsentService.record` with OTP evidence from other modules |
| Finding a mobile that may be contacted | `PartyService.reachableContact()` | Filtering `listContacts` for do-not-contact and invalid flags in each module |
| Storing PAN, GSTIN or other identifiers | `PartyService.setIdentifier()` (encrypted, blind index, conflict check) | Writing `party_identifiers` from other modules |
| Verifying a PAN | `BorrowerKycService.verifyPan()` through the `PanVerifier` port | Calling a KYC provider from controllers or other services |
| Registering a borrower on behalf of a partner firm | `PartnerBorrowerService.register()` | Creating parties or borrower profiles in partner code |
| Adding or removing co-applicants, guarantors and directors | `ApplicationPartyService` | Writing `application_parties` from other services |
| Ops view of an application | `OpsCaseService.detail()` | Assembling case data in ops controllers |
| Storing lender product definitions and their versions | Config resource `lender_product` (`LenderProductHandler`) | `lender_products` / `lender_product_versions` tables (planned in §9, replaced by the config store) |
| Which lender products are live right now | `LenderCatalogService.liveProducts()` | Filtering `config.active(lender_product)` or lender status in other modules |
| Whether a category has a lender route | `@CategoryRouteSourceFor` providers via `CategoryRouteRegistry` | Availability checks in catalog controllers or lenders code |
| Screening a case against a product and evaluating its rules | `screenProduct` / `evaluateProduct` in `engines/lending` | Rule loops in services (matching must use these) |
| Facts with their trust level for rules | `FactService.rankedLookup()` | Reading `borrower_facts` provenance in other modules |
| Creating an organization without an owner (lenders) | `OrganizationService.registerActive()` | Writing `organizations` from lenders or ops code |
| Computing a financial health score | `ScoringService.score()` → `computeScore` | Factor maths in controllers, matching or the compat layer |
| Running document analysis for a case | `AnalysisService` (queue `analysis.run`) | Scoring inline in HTTP requests |
| Correcting or confirming a fact as ops | `ApplicationService.verifyFact()` (`ops_verified` through `FactService`) | Writing `borrower_facts` from ops controllers |
| Telling a user when something finishes | `POST /notifications/subscriptions` + a `@SubscriptionTargetFor` provider | Per-feature notification flags or ad-hoc sends after events |
| Storing scoring models and improvement rules | Config resources `scoring_model` / `improvement_rule` | `scoring_models` / `improvement_rules` tables (planned in §9, replaced by the config store) |
