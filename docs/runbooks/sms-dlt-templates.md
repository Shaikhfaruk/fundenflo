# SMS DLT templates

TRAI DLT rules require every SMS to use a registered sender (`SMS_SENDER_ID`), entity (`SMS_DLT_ENTITY_ID`) and template id.

**Status:** only the log sender exists (`SMS_DRIVER=log`), and production refuses to start with it. A provider adapter in `backend/src/integrations/sms/` (using `SMS_API_KEY`, `SMS_SENDER_ID`, `SMS_DLT_ENTITY_ID` and each template's `providerTemplateId`) has to be built once the provider is chosen.

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
