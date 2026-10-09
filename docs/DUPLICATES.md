# Known Duplicates

> Register of anything implemented twice. Never add code to the copy marked for removal, and never recreate a deleted duplicate.
> Deleting a listed copy needs the owner's review first, plus a fresh grep, knip and vulture run at deletion time.
> Last updated: 2026-10-09

## Register

| # | Item | Copy to keep | Copy to remove | Evidence | Found on | Owner review |
|---|---|---|---|---|---|---|

No entries. Backend code has not started.

## Single implementations agreed by design

These are the places where a second copy is most tempting. Use the one listed.

| Need | Use only | Do not build |
|---|---|---|
| Custom fields on leads, campaigns or lender-specific forms | `questionnaires` (question sets with stage `lead_capture` / `lender_specific`) | A separate lead-form or custom-field system |
| Contact details, PAN, GSTIN of anyone | `parties` | Name, mobile or PAN columns copied onto leads, users or applications |
| Assigning leads to CAs, cases to reviewers, fraud reviews to staff | `engines/assignment` | Per-module round-robin or picker code |
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
| Locale handling | `common/i18n/locale.ts` (`localise`, `resolveLocale`, `@RequestLocale()`) | Per-module locale constants |
