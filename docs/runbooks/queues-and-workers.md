# Queues and workers

One worker process (`node dist/worker.js`) runs every BullMQ processor. Events are written to `outbox_events` in the same transaction as the change and relayed every second to the queues in `backend/src/infrastructure/queue/event-routes.ts`. Jobs are idempotent (job id = event id) and retried 5 times with exponential back-off; failed jobs are kept 7 days.

## Queues

`outbox.relay`, `notifications.dispatch`, `notifications.subscriptions`, `auth.session-revocations`, `maintenance.cleanup`, `realtime.publish`, `imports.process`, `leads.route`, `leads.dropoff`, `leads.notify`, `leads.consent-sync`, `leads.referrals`, `sla.timers`, `documents.scan`, `documents.extract`, `applications.refresh`, `analysis.run`, `matching.run`, `submissions.deliver`, `submissions.notify`, `submissions.sync`, `commissions.accrue`, `commissions.notify`, `risk.detect`, `privacy.requests`.

## Checks

```sh
# failed and waiting jobs of a queue (Redis/Valkey keys are bull:<queue>:<state>)
valkey-cli ZCARD bull:submissions.deliver:failed
valkey-cli LLEN bull:submissions.deliver:wait
# events not yet relayed
psql -c "select count(*), min(occurred_at) from outbox_events where published_at is null"
# the oldest stuck events
psql -c "select id, event_name, occurred_at from outbox_events where published_at is null order by occurred_at limit 20"
```

## Steps

- **Relay stuck** (unpublished events growing): check the worker is running and can reach Redis; restart the worker. The relay moves up to 200 events per run in one transaction: if adding any job fails, the whole batch rolls back and the error is in the worker log for the `outbox.relay` job. It claims rows with `FOR UPDATE SKIP LOCKED`, so several workers are safe. An event name with no route in `EVENT_ROUTES` is marked published without jobs.
- **A job keeps failing**: read `failedReason` and the stack from the job (`bull:<queue>:<jobId>` hash) and the worker log for the same job id. Fix the cause, then retry the job from a BullMQ dashboard or by re-adding it with the same job id; handlers are idempotent.
- **Documents not scanned**: the `document_scan` SLA re-queues a scan after 15 minutes up to 6 times, then audits and stops. Check ClamAV (`CLAMAV_HOST`, `CLAMAV_PORT`; `StreamMaxLength` must be at least 50 MB).
- **Submissions not delivered**: an `approved` submission with no packet means `submissions.deliver` failed; the most common cause is the applicant withdrawing `lender_sharing` (the submission is then withdrawn, not delivered).
- **Commissions missing**: `commissions.accrue` audits `commission.unscheduled` when no published scheme matches; publish the scheme and re-add the job for the `submission.disbursed` event id.
- **Maintenance**: `maintenance.cleanup` runs hourly; each `@MaintenanceTask` (OTP challenges, sessions, refresh tokens, idempotency keys, document freshness and retention, orphan files, expired data exports) logs how many rows it handled.
