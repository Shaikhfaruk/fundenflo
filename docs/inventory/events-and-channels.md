# Inventory — Domain events, real-time channels, notifications

> Event names are constants in `backend/src/common/events/event-names.ts`; routing to queues is `backend/src/infrastructure/queue/event-routes.ts`. Envelopes (`DomainEventEnvelope`) carry IDs, payload, actor snapshot, request ID and `occurredAt`, never PII.
> `useful` evidence = publisher file + `outbox_events` rows asserted in spec `auth-otp`; `planned` evidence = plan section.

## Domain events

| Event | Producer | Consumers | Real-time | Milestone | Status | Evidence |
|---|---|---|---|---|---|---|
| `party.created` · `party.match_review.opened` | parties (`party.service.ts`, `party-resolver.service.ts`) | none (the review queue reads `party_match_reviews` directly) | — | M0 | `useful` | §3.3 |
| `party.merged` · `party.merge_reverted` · `party.match_review.resolved` | parties (`party-merge.service.ts`, via `ChangeRecorder`) | `leads.consent-sync` (recompute consent status of the survivor's open leads; on revert also the restored party); M1.9: sync | — | M1 | `useful` | spec `party-merge`; flow `party-merge` |
| `user.signed_up` | auth (`otp-login.service.ts`) | `leads.dropoff` (borrower sign-ups); M7: referral attribution | — | M0 | `useful` | §3.4 |
| `user.status_changed` | auth (`admin-users.service.ts`) | `auth.session-revocations` | — | M0 | `useful` | §3.4 |
| `user.mobile_changed` · `login.linked` · `login.removed` | auth (`login-methods.service.ts`) | none yet | — | M0 | `useful` | §3.4 |
| `session.created` · `session.revoked` | auth (`session.service.ts`) | none yet (M1: real-time `session.revoked` → user room) | M1 | M0 | `useful` | §3.4 |
| `membership.created` · `membership.changed` | access (`membership.service.ts`) | `membership.changed` → `auth.session-revocations` | M1 | M0 | `useful` | §3.4 |
| `invitation.created` · `invitation.accepted` · `invitation.revoked` | access (`invitation.service.ts`) | none yet | — | M0 | `useful` | §3.4 |
| `catalog.changed` · `geo.changed` | catalog (`catalog-admin.service.ts`, `geo.service.ts`) | none yet (caches are invalidated directly after commit) | — | M1 | `useful` | §6 |
| `attribute.changed` | attributes (`attribute-dictionary.service.ts`) | none yet (dictionary cache is invalidated directly after commit) | — | M1 | `useful` | §6.1 |
| `facts.recorded` | attributes (`fact.service.ts`) | none yet (M1: lead quality re-score, routing re-evaluation; M5: assessments) | — | M1 | `useful` | §6.1 |
| `consent.granted` · `consent.withdrawn` | consents (`consent.service.ts`, one event per record) | `leads.consent-sync` (lead consent status); later documents, notifications | — | M1 | `useful` | §7.2; spec `consents` |
| `organization.created` · `organization.status_changed` | access (`organization.service.ts`) | `organization.status_changed` (non-active) → `auth.session-revocations` (revokes every member's sessions) | — | M1 | `useful` | spec `partners` (suspended owner token rejected at once) |
| `partner.registered` · `partner.verification_recommended` · `partner.verified` · `partner.rejected` · `partner.suspended` · `partner.reinstated` · `partner.level_changed` · `partner.capacity_changed` · `partner.service_areas_changed` | partners (`partner.service.ts`, `partner-admin.service.ts`) | none yet (M1.8: routing pool refresh; notifications to the owner) | — | M1 | `useful` | §7.4 |
| `consent_purpose.changed` | consents (`consent-purpose.service.ts`) | none yet (purpose cache is invalidated directly after commit) | — | M1 | `useful` | §14 |
| `import.changed` · `import.batch.validated` · `import.batch.committed` · `import.batch.undone` | imports (`import.service.ts`) | none yet (M1.9: notify the uploader, user room, reports) | user room (M1.9) | M1 | `useful` | §7.1 |
| `lead.captured` · `lead.updated` · `lead.status_changed` · `lead.merged` · `lead.contact_revealed` | leads (`lead-capture.service.ts`, `lead.service.ts`) | `leads.route` (captured; status_changed to `new`/`qualified`; updated with consent `ok`); M1.9: reports, sync | org room (when assigned, M1.9) | M1 | `useful` | §7.3; spec `leads` |
| `consent.requested` | consents (`consent-request.service.ts`; on send and on completion) | none yet | — | M1 | `useful` | §7.2 |
| `lead_source.changed` · `api_client.changed` | leads, access | none yet | — | M1 | `useful` | §7.1 |
| `lead.assignment.offered` · `accepted` · `declined` · `expired` · `revoked` · `returned` · `completed` · `reassigned` | leads (`lead-assignment.service.ts`, via `ChangeRecorder`) | `leads.route` (`declined`, `expired`, `revoked` → route again; `returned` routes through the lead's `status_changed` to `new`); `leads.notify` (`offered` → firm owners SMS + email; `reassigned` → the member); next: reports and realtime (M1.9) | partner org + assignee membership rooms (M1.9) | M1 | `useful` | specs `lead-routing`, `partner-leads`; flows `lead-routing`, `partner-leads` |
| `follow_up.due` | activities (`follow-up-sla.handler.ts`, 30 min before `dueAt`, via outbox) | `leads.notify` (SMS reminder to the assignee) | assignee room (M1.9) | M1 | `useful` | spec `lead-referrals`; activities are lead timeline entries (`activity_logged`), not a separate domain event |
| `lead.assignment.offer_expiring` | leads (`AssignmentAcceptSlaHandler.warn`, 75% into the accept window) | `leads.notify` (SMS to firm owners) | — | M1 | `useful` | `lead-notification.service.ts` |
| `lead.referred` · `lead.offline_conversion.reported` · `.verified` · `.rejected` | leads (`partner-lead.service.ts`, `lead-conversion.service.ts`, via `ChangeRecorder`) | none yet (M1.9 reports; M7 commissions on verified disbursal) | — | M1 | `useful` | spec `lead-referrals` |
| `lead.converted` | leads (`LeadService.convertToApplication`, called by `ApplicationService.create` when the person has an open lead, via `ChangeRecorder`) | none yet (M7 commissions on lead terms; reports read lead status directly) | — | M3 | `useful` | spec `applications` |
| `lead.offline_conversion.recorded` | leads | commissions (lead terms), reports | org room | M7 | `planned` | §7.5 |
| `lead.sla_warned` · `lead.sla_breached` | leads (`lead-sla.handlers.ts`, first-contact SLA, via `ChangeRecorder`) | none yet `leads.notify` (warned: SMS to the assignee; breached: email to ops leads); M1.9 reports | assignee room (M1.9) | M1 | `useful` | spec `lead-activities` |
| `config.changed` · `config.change_requested` · `config.change_decided` · `config.published` · `config.retired` | config-publishing (`config-publishing.service.ts`) | none yet (caches are invalidated directly after commit; M1: notify checkers on `config.change_requested`, catalog availability on `config.published` for lender products) | — | M1 | `useful` | §6.9; spec `config-publishing` asserts the `config.published` outbox row |
| `question.changed` | questionnaires (`question.service.ts`) | none yet | — | M1 | `useful` | §6.2 |
| `answers.recorded` | questionnaires (`questionnaire.service.ts`) | none yet (M1: lead quality re-score, routing re-evaluation) | — | M1 | `useful` | §6.2 |
| `borrower_profile.changed` | borrowers (`borrower-profile.service.ts`, via `ChangeRecorder`) | none yet | — | M3 | `useful` | spec `applications` |
| `application.created` · `application.updated` · `application.status.changed` | applications (`application.service.ts`, via `ChangeRecorder`) | none yet (M3d sync source and user/partner org rooms; M6 notifications) | user + partner org rooms (planned) | M3 | `useful` | spec `applications`; flow `borrower-journey` |
| `document.uploaded` | documents (`DocumentService.upload`, via `ChangeRecorder`; payload ids, type, party, application, uploader) | `documents.scan`, `applications.refresh` | — | M3 | `useful` | spec `documents-upload`; flow `documents` |
| `document.scanned` · `document.rejected` · `document.deleted` | documents (`DocumentScanService`, `DocumentService.remove`) | `applications.refresh` (rejected, deleted); `realtime.publish` (`document.changed`); M5 `documents.extract` on scanned | uploader's user room + partner org room | M3 | `useful` | spec `documents-upload` |
| `document.scan_overdue` | documents (`DocumentScanSlaHandler`, 15 min after upload or the last re-queue) | `documents.scan` | — | M3 | `useful` | spec `documents-upload` |
| `document.verified` | documents (M5 extraction / ops review) | applications, notifications | user room | M5 | `planned` | §8.3 |
| `analysis.completed` · `score.computed` | assessments | matching, notifications | user room | M5 | `planned` | §8.4 |
| `submission.status.changed` · `submission.disbursed` | applications | commissions, leads, notifications | user, partner org, lender org rooms | M6 | `planned` | §8.2 |
| `receivable.received` · `payout.paid` · `payout.reversed` | commissions | notifications, reports | partner org room | M7 | `planned` | §8.5 |
| `risk.signal.raised` | risk, documents | ops queue (assignment) | ops room | M8 | `planned` | §13 |

## Real-time channels (WebSocket namespace `/v1/realtime`)

Built in M1.9a. Gateway: `backend/src/modules/realtime/http/realtime.gateway.ts` (Socket.IO on the API, `RedisIoAdapter` so every API instance sees every emit; CORS from `CORS_ORIGINS`). Clients connect with the access token in `auth.token` (or an `Authorization` header); invalid or revoked tokens get an `error` event with the error code and are disconnected; valid ones get `ready` with the session context. The worker emits through `@socket.io/redis-emitter` from `realtime.publish`; the event → room map is `backend/src/infrastructure/realtime/realtime-routes.ts`. Events carry ids, `eventId` and `occurredAt` only; clients refetch the resource.

| Room | Who joins | Server → client events | Milestone | Status |
|---|---|---|---|---|
| `user:{userId}` | every session of the user | `follow_up.due`, `document.changed` (`{ documentId, applicationId, status }` for documents the user uploaded); disconnected when the user is suspended | M1, M3 | `useful` |
| `session:{sessionId}` | that session | (reserved for session-level pushes) | M1 | `useful` |
| `membership:{membershipId}` | sessions acting as that membership | `lead.assignment.changed`, `lead.sla` for leads handed to the member; disconnected when the membership stops being active | M1 | `useful` |
| `org:{organizationId}` | partner and lender sessions of that organization | `lead.assignment.changed`, `lead.sla`, `lead.conversion.changed`, `document.changed` (documents of the firm's clients); later `submission.updated`, `payout.updated` | M1, M3 | `useful` |
| `staff` | staff sessions | `lead.changed`, `lead.assignment.changed`, `lead.sla`, `lead.conversion.changed`, `import.changed` | M1 | `useful` |


Room joins are authorised on connect, using the same CASL abilities as HTTP.

## Notification templates (keys in `notification_templates`, seeded from `backend/src/scripts/seed-data/notification-templates.ts`)

| Key | Channel(s) | Recipient | Milestone | Status |
|---|---|---|---|---|
| `auth.otp` | SMS (DLT template ID to be added), email | user | M0 | `useful` |
| `invitation.staff` | email | invited staff member | M0 | `useful` |
| `invitation.member` | SMS, email | invited lender or partner member | M0 | `useful` |
| `partner.membership.approved` | SMS, email | partner owner | M1 | `planned` |
| `lead.offered` | SMS (`SMS_DLT_TEMPLATE_LEAD_OFFERED`), email; push in M1.9 | firm owners | M1 | `useful` |
| `lead.offer_expiring` | SMS (`SMS_DLT_TEMPLATE_LEAD_OFFER_EXPIRING`) | firm owners | M1 | `useful` |
| `lead.handed_over` | SMS (`SMS_DLT_TEMPLATE_LEAD_HANDED_OVER`), email | firm member the lead was handed to | M1 | `useful` |
| `lead.first_contact_due` | SMS (`SMS_DLT_TEMPLATE_LEAD_FIRST_CONTACT_DUE`) | assignee (else firm owners) | M1 | `useful` |
| `lead.first_contact_missed` | email | active ops leads | M1 | `useful` |
| `follow_up.due` | SMS (`SMS_DLT_TEMPLATE_FOLLOW_UP_DUE`) | follow-up assignee | M1 | `useful` |
| `consent.request` | SMS (later WhatsApp); DLT id `SMS_DLT_TEMPLATE_CONSENT_REQUEST`; link from `CONSENT_LINK_URL` | lead's person | M1 | `useful` |
| `import.completed` | email | uploader | M1 | `planned` |
| `analysis.completed` | push, WhatsApp (opt-in) | borrower | M5 | `planned` |
| `application.status_changed` · `document.requested` | push, SMS, WhatsApp (opt-in) | borrower, partner | M6 | `planned` |
| `payout.paid` | email, SMS | partner owner | M7 | `planned` |
