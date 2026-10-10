# Incident response

## Detect

- Liveness `GET /health/live` (process up) and readiness `GET /health/ready` (database and Redis reachable). Readiness failing on one instance: take it out of rotation; on all instances: treat as a P1.
- Logs are JSON (pino) on stdout with `requestId`; every API response carries `X-Request-Id`. Search by it first.
- Errors return `{ code, message, details, requestId }`. A spike of `INTERNAL_ERROR` codes means a server fault; `RATE_LIMITED`, `VALIDATION_FAILED` or `CONSENT_REQUIRED` spikes usually mean a client release or a config change.

## Severity

| Level | Examples | Response |
|---|---|---|
| P1 | API down, sign-in failing, data exposed | Page on-call, open an incident channel, status update every 30 minutes |
| P2 | A worker queue stuck (scans, submissions, payouts), one lender integration down | On-call during working hours, update every 2 hours |
| P3 | A single flow broken for some users | Ticket, fix in the next release |

## First steps

1. Note the time, the `requestId`s and what changed last (deploy, config publish through `POST /admin/<config>/:id/versions/:number/publish`, env change).
2. Check readiness on every instance and the database and Redis dashboards (connections, CPU, storage).
3. Check the worker: `outbox_events` with `published_at IS NULL` growing means the relay is stuck (see [Queues and workers](queues-and-workers.md)).
4. Roll back a bad config by publishing the previous version or retiring the new one; roll back a bad deploy to the previous image. Migrations are additive; never roll a migration back in production without a restore plan.
5. If personal data may have leaked: keep evidence (audit chain `GET /admin/audit-events/verify`), involve compliance immediately. DPDP and RBI breach reporting timelines start when the breach is known.

## Close

- Write the timeline, cause and follow-ups; link the `requestId`s and audit events.
- Add a regression test (integration spec or Postman flow) for the failure.
