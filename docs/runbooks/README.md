# Runbooks

Operational procedures for the FundenFlo backend (API + worker). Each runbook lists when to use it, the checks to run and the steps, with the commands and settings as they exist in `backend/`. API paths are under `/v1` (for example `/v1/ops/fraud-reviews`), except `/health/live` and `/health/ready`.

| Runbook | Use it when |
|---|---|
| [Incident response](incident-response.md) | The API or worker is down, slow or returning errors |
| [Queues and workers](queues-and-workers.md) | Jobs fail, pile up or events seem lost |
| [Keys and secrets](keys-and-secrets.md) | Rotating JWT signing keys, field-encryption keys or provider secrets |
| [SMS DLT templates](sms-dlt-templates.md) | Registering or changing SMS templates |
| [Backup and restore](backup-and-restore.md) | Restoring the database or blob storage, or running a restore drill |
| [Data requests](data-requests.md) | Handling DPDP access, correction and erasure requests |
| [Fraud reviews](fraud-reviews.md) | Working the risk signal and fraud review queue |
| [Finance close](finance-close.md) | Month-end receivables, reconciliation and partner payouts |
