# Fraud reviews

Rules raise risk signals; a person decides. Signals for the same application, person or partner firm gather in one open review (`GET /ops/fraud-reviews?status=open`).

| Signal | Raised when | Severity |
|---|---|---|
| `document_reuse` | The same file was uploaded by another person or business | high |
| `inflow_mismatch` / `gst_itr_mismatch` | A fact contradicts another source (consistency signal) | medium or high |
| `identity_mismatch` | The PAN holder's name does not match | medium |
| `duplicate_identity` | Two partner firms registered the same bank account | high |
| `referral_pattern` | 20 or more sign-ups on one firm's referral code within an hour | medium |

## Holds

An open review with a high or critical signal, or a review decided as `confirmed`, blocks lender submission approval (`risk_hold`) and partner payout approval for that subject.

## Deciding

1. Open the review (`GET /ops/fraud-reviews/:id`) and read each signal's evidence; check the documents and facts on the case.
2. Decide with `POST /ops/fraud-reviews/:id/decision`: `cleared` (signals dismissed, hold lifted) or `confirmed` (hold stays). The note (10+ characters) must say what was checked.
3. On `confirmed`: withdraw the case's open submissions, reverse unpaid payouts if a partner is involved, and suspend users or partner firms through the admin tools. Report to the lender where the file was already shared.
