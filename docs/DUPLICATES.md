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
| Calls, notes, follow-ups, case notes | `activities` | `lead_notes`, `case_comments` or similar per-module tables |
| SLA deadlines and breach handling | `sla` | Per-module timers or cron checks |
| Bulk uploads (leads, coverage, geography, partners) | `imports` with one handler per type | A separate CSV parser per feature |
| Status after a lead converts | Derived from application events | A second status that is edited by hand |
| Draft → review → publish for any config | `config-publishing` + `createVersionedConfigController` | Per-resource version tables or approval flows |
| Eligibility, visibility, routing and trigger conditions | `engines/conditions` | Inline `if` trees or a second rule format |
| Money calculations | `common/money` + `engines/commissions` | Float arithmetic or local rounding helpers |
| JSON request body parsing | `common/http/json-body.middleware.ts` | `express.json()`, `body-parser` or Nest's built-in parser (bypasses `INVALID_JSON`; `express` is not a direct dependency) |
| Database transactions | `@Transactional()` + `TransactionHost<PrismaTx>` | Passing Prisma clients between services, or `prisma.$transaction` inside services |
| Row-level scoping of lists | `accessibleBy(ability, action).ofType('Model')` from `@casl/prisma/runtime` | Hand-written `where` filters that copy permission rules |
| Periodic cleanup | `@MaintenanceTask(name)` methods run by `maintenance.cleanup` | New cron queues per module for purges |
| Notifications | `NotificationService.send()` | Calling SMS/email adapters directly from modules |
| Request IDs, actor, IP in logs, audit and outbox | `RequestContext` | Reading headers or `req.user` in services |
| Matching free text (city names, aliases) to master data | `GeoService.resolveCity()` + `lookup_aliases` + `normaliseLookupText()` | Per-feature city lists or string maps |
| Caching reference data | `CacheService.wrap()` with tags, invalidated after commit | In-process maps or ad-hoc Redis keys |
| Audit + domain event for an admin or config change | `ChangeRecorder.record()` | Calling `AuditService` and `OutboxService` separately in each service |
| Clearing caches after a write | `runThenInvalidate()` | Invalidating inside the transaction (readers can re-cache old data before commit) |
| Borrower data points (turnover, vintage, income, GST status, …) | `attributes` dictionary + `FactService.record()` | Columns on leads, applications or partner tables, or per-feature JSON blobs |
| Choosing the current value among several facts | `engines/facts` `resolveFact()` with `PROVENANCE_RANK` | Ad-hoc "latest wins" queries |
| Day and time arithmetic constants | `common/constants/time.constants.ts` (`HOUR_MS`, `DAY_MS`) | Local `DAY_MS`-style constants or inline `3600_000` |
| Draft → review → publish for a new dynamic resource | A `@ConfigHandler(resource)` + `createVersionedConfigController` (and approve/reject via `/admin/change-requests`) | Resource-specific version tables, status columns or approval routes |
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
| Locale handling | `common/i18n/locale.ts` (`localise`, `resolveLocale`, `@RequestLocale()`) | Per-module locale constants |
| Which CAs may receive a lead (verified, active, unpaused, service area, capabilities) | `PartnerService.routingPool()` | Partner queries in leads, applications or reports that repeat the eligibility filters |
| Which organizations a person's consent covers for a purpose | `ConsentService.allowedOrganizations()` | Looping `hasConsent` per organization or reading `consent_records` |
| Offering, assigning, revoking or expiring a lead assignment | `LeadRoutingService` (`route`, `assign`, `revoke`, `expire`) | Writing `lead_assignments` from other services or controllers |
