# Data requests (DPDP)

People file requests from the app (`POST /me/data-requests`, kinds `access`, `correction`, `erasure`). Compliance works the queue at `GET /ops/data-requests`. Each request is due 30 days after it was filed (`dueAt`).

## Access

Handled automatically: the `privacy.requests` worker writes a JSON export (profile, contacts, account, consents, answers, facts, documents, leads, applications, lenders the file went to) and completes the request; the person downloads it from `GET /me/data-requests/:id/export-url` for 7 days. If the worker failed, `POST /ops/data-requests/:id/complete` rebuilds the export.

## Correction

1. Read `details`. Correct the data with the normal tools (fact verification on the case, profile edits, PAN re-verification).
2. Complete with a `response` that says what changed, or reject with the `reason` (for example the value matches a verified source).

## Erasure

1. Open the request: `GET /ops/data-requests/:id` lists the legal holds that apply now (open applications, loans disbursed in the last 5 years, active partner, lender or staff roles).
2. If holds apply, reject with a reason that names the obligation, or wait (for example until an open case is closed).
3. Without holds, complete it. Every module erases its own data in order: answers, facts, documents and their files, leads (open leads closed as lost, captured payloads cleared), consents (withdrawn), account (sessions revoked at once, logins removed, user marked deleted), then contacts, identifiers and names. Borrower profiles, applications and lender sharing have no erase step; their records stay under the holds above. Consent records stay as proof of consent; the audit log keeps who did what without the personal values.
4. The response is sent back through the request; the person can no longer sign in to that account (a new sign-up starts a new account).

The 5-year retention for disbursed loans (`LOAN_RECORD_RETENTION_YEARS`) is a default to confirm with counsel against the RBI KYC and Digital Lending directions.
