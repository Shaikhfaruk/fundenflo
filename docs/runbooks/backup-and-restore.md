# Backup and restore

## What holds data

- **PostgreSQL**: everything except files. Use point-in-time restore (Azure Database for PostgreSQL keeps 7–35 days; set at least 30).
- **Blob storage** (`STORAGE_CONTAINER`): documents, data exports. Enable soft delete and versioning (at least 30 days). Purged documents are deleted on purpose; a restore must not bring them back.
- **Redis/Valkey** (`REDIS_URL`): queues, rate limits, caches, token revocations. It can be rebuilt; losing it drops queued jobs (the outbox still holds unrelayed events) and revocations (sessions revoked in the last 15 minutes could be used until their tokens expire).

## Restore the database

1. Stop the worker and put the API in maintenance (scale to zero or block traffic).
2. Restore to a new server at the chosen time; run `pnpm exec prisma migrate status` against it to confirm the schema.
3. Verify the audit chain (`GET /admin/audit-events/verify`) and spot-check recent applications, submissions and payouts.
4. Point `DATABASE_URL` at the restored server, start the API, then the worker. Events written before the restore point and not yet relayed are relayed again; consumers are idempotent.
5. Re-apply anything done after the restore point from the audit log (payouts marked paid, lender decisions), with finance and ops.

## Drill

Restore last night's backup to a scratch server every quarter, point a test API at it, check the audit chain and the trial balance (`GET /admin/finance/ledger/trial-balance`: debits must equal credits), and record the time it took.
