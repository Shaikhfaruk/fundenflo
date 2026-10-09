# Inventory — Domain events, real-time channels, notifications

> Event names are constants in `backend/src/common/events/event-names.ts`; routing to queues is `backend/src/infrastructure/queue/event-routes.ts`. Envelopes (`DomainEventEnvelope`) carry IDs, payload, actor snapshot, request ID and `occurredAt`, never PII.
> `useful` evidence = publisher file + `outbox_events` rows asserted in spec `auth-otp`; `planned` evidence = plan section.

## Domain events

| Event | Producer | Consumers | Real-time | Milestone | Status | Evidence |
|---|---|---|---|---|---|---|
| `party.created` · `party.match_review.opened` | parties (`party.service.ts`, `party-resolver.service.ts`) | none yet (M1: leads relink, ops review queue) | — | M0 | `useful` | §3.3 |
| `party.merged` | parties | sync, leads (relink), audit | — | M1 | `planned` | §3.3 |
| `user.signed_up` | auth (`otp-login.service.ts`) | none yet (M1: referral attribution, `leads.dropoff-detect`) | — | M0 | `useful` | §3.4 |
| `user.status_changed` | auth (`admin-users.service.ts`) | `auth.session-revocations` | — | M0 | `useful` | §3.4 |
| `user.mobile_changed` · `login.linked` · `login.removed` | auth (`login-methods.service.ts`) | none yet | — | M0 | `useful` | §3.4 |
| `session.created` · `session.revoked` | auth (`session.service.ts`) | none yet (M1: real-time `session.revoked` → user room) | M1 | M0 | `useful` | §3.4 |
| `membership.created` · `membership.changed` | access (`membership.service.ts`) | `membership.changed` → `auth.session-revocations` | M1 | M0 | `useful` | §3.4 |
| `invitation.created` · `invitation.accepted` · `invitation.revoked` | access (`invitation.service.ts`) | none yet | — | M0 | `useful` | §3.4 |
| `consent.granted` · `consent.withdrawn` | consents | leads (`consent_pending` → routable), documents, notifications | — | M1 | `planned` | §7.2 |
| `import.batch.validated` · `import.batch.committed` · `import.batch.undone` | imports | leads, reports, notifications (to uploader) | user room | M1 | `planned` | §7.1 |
| `lead.captured` · `lead.qualified` · `lead.unqualified` · `lead.status.changed` | leads | `leads.route`, reports, sync | org room (when assigned) | M1 | `planned` | §7.3 |
| `lead.assignment.offered` · `accepted` · `declined` · `expired` · `revoked` · `returned` · `completed` | leads | sla, `leads.route`, notifications, reports | partner org + assignee membership rooms | M1 | `planned` | §7.3 |
| `lead.contact.revealed` | leads | audit | — | M1 | `planned` | §7.5 |
| `lead.activity.logged` · `follow_up.due` | activities | sla, notifications | assignee room | M1 | `planned` | §7.5 |
| `lead.converted` · `lead.offline_conversion.recorded` | leads | commissions (lead terms), reports | org room | M1 / M3 | `planned` | §7.5 |
| `sla.warning` · `sla.breached` | sla | leads, applications, notifications | assignee room | M1 | `planned` | §7.6 |
| `config.published` | config-publishing | cache invalidation, catalog availability | — | M1 | `planned` | §6.9 |
| `application.created` · `application.status.changed` | applications | leads (derived status), notifications, reports | user + partner org rooms | M3 | `planned` | §8.1 |
| `document.uploaded` · `document.scanned` · `document.verified` · `document.rejected` | documents | `documents.extract`, applications, notifications | user room | M3 | `planned` | §8.3 |
| `analysis.completed` · `score.computed` | assessments | matching, notifications | user room | M5 | `planned` | §8.4 |
| `submission.status.changed` · `submission.disbursed` | applications | commissions, leads, notifications | user, partner org, lender org rooms | M6 | `planned` | §8.2 |
| `receivable.received` · `payout.paid` · `payout.reversed` | commissions | notifications, reports | partner org room | M7 | `planned` | §8.5 |
| `risk.signal.raised` | risk, documents | ops queue (assignment) | ops room | M8 | `planned` | §13 |

## Real-time channels (WebSocket namespace `/v1/realtime`)

| Room | Who joins | Server → client events | Milestone | Status |
|---|---|---|---|---|
| `user:{userId}` | the signed-in user (all sessions) | `session.revoked`, `import.updated`, `document.updated`, `application.updated` | M1 | `planned` |
| `membership:{membershipId}` | sessions acting as that membership | `lead.offered`, `lead.updated`, `follow_up.due`, `sla.warning` | M1 | `planned` |
| `org:{organizationId}` | members with the matching CASL ability | `lead.assigned`, `lead.updated`, `submission.updated`, `payout.updated` | M1 | `planned` |

Room joins are authorised on connect, using the same CASL abilities as HTTP.

## Notification templates (keys in `notification_templates`, seeded from `backend/src/scripts/seed-data/notification-templates.ts`)

| Key | Channel(s) | Recipient | Milestone | Status |
|---|---|---|---|---|
| `auth.otp` | SMS (DLT template ID to be added), email | user | M0 | `useful` |
| `invitation.staff` | email | invited staff member | M0 | `useful` |
| `invitation.member` | SMS, email | invited lender or partner member | M0 | `useful` |
| `partner.membership.approved` | SMS, email | partner owner | M1 | `planned` |
| `lead.offered` | push, SMS, email | CA assignee | M1 | `planned` |
| `lead.sla_warning` · `lead.reassigned` | push, email | CA assignee, ops | M1 | `planned` |
| `lead.consent_request` | SMS (later WhatsApp) | lead's person | M1 | `planned` |
| `import.completed` | email | uploader | M1 | `planned` |
| `analysis.completed` | push, WhatsApp (opt-in) | borrower | M5 | `planned` |
| `application.status_changed` · `document.requested` | push, SMS, WhatsApp (opt-in) | borrower, partner | M6 | `planned` |
| `payout.paid` | email, SMS | partner owner | M7 | `planned` |
