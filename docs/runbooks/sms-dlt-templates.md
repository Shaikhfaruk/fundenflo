# SMS DLT templates

TRAI DLT rules require every SMS to use a registered sender (`SMS_SENDER_ID`), entity (`SMS_DLT_ENTITY_ID`) and template id.

**Status:** two drivers, chosen by `SMS_DRIVER`. `log` writes the text to the API log (not allowed in production). `msg91` sends one-time codes (`auth.otp`, `consent.otp`) through the MSG91 OTP API (`POST https://control.msg91.com/api/v5/otp`, header `authkey` = `SMS_API_KEY`, `template_id` = `MSG91_OTP_TEMPLATE_ID`, our own code as `otp`); the MSG91 OTP template must contain `##OTP##` and carry the approved DLT template inside MSG91. Other SMS templates fail at once with a clear reason until MSG91 flow templates are added for them.

## Template ids

The texts are seeded from `backend/src/scripts/seed-data/notification-templates.ts`. Register each SMS text exactly as seeded (placeholders `{{name}}` become DLT variables), put the approved id in its env key and run `pnpm db:seed`; the seed stores it as the template's `providerTemplateId`.

| Template | Env key |
|---|---|
| `auth.otp` | `SMS_DLT_TEMPLATE_AUTH_OTP` |
| `invitation.member` | `SMS_DLT_TEMPLATE_INVITATION_MEMBER` |
| `consent.request` | `SMS_DLT_TEMPLATE_CONSENT_REQUEST` |
| `consent.otp` | `SMS_DLT_TEMPLATE_CONSENT_OTP` |
| `lead.offered` | `SMS_DLT_TEMPLATE_LEAD_OFFERED` |
| `lead.offer_expiring` | `SMS_DLT_TEMPLATE_LEAD_OFFER_EXPIRING` |
| `lead.handed_over` | `SMS_DLT_TEMPLATE_LEAD_HANDED_OVER` |
| `lead.first_contact_due` | `SMS_DLT_TEMPLATE_LEAD_FIRST_CONTACT_DUE` |
| `follow_up.due` | `SMS_DLT_TEMPLATE_FOLLOW_UP_DUE` |
| `analysis.completed` | `SMS_DLT_TEMPLATE_ANALYSIS_COMPLETED` |
| `application.status_changed` | `SMS_DLT_TEMPLATE_APPLICATION_STATUS` |
| `document.requested` | `SMS_DLT_TEMPLATE_DOCUMENT_REQUESTED` |
| `submission.received` | `SMS_DLT_TEMPLATE_SUBMISSION_RECEIVED` |
| `submission.status_changed` | `SMS_DLT_TEMPLATE_SUBMISSION_STATUS` |
| `payout.paid` | `SMS_DLT_TEMPLATE_PAYOUT_PAID` |

## Changing a text

1. Register the new text with DLT and wait for approval.
2. Change the text in the seed file so new environments get it.
3. The seed does not overwrite the text of a template that already exists (it only sets a new id). In existing environments a compliance officer sends the new text and its DLT id together with `PATCH /admin/notification-templates/:id` (`{ "body": "…", "providerTemplateId": "…" }`); a changed SMS text without a new id is refused. Then check the notification deliveries for failures.
