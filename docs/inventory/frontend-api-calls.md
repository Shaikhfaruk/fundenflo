# Inventory — Frontend app API calls (reference)

> Repo `fundenflo-v1-app` @ `7bc9685`, cloned to `frontend/`. Not edited by us. Checked 2026-10-09 with `grep -rn` over `frontend/src/app` and `frontend/src/components`.
> Status is about the **frontend function**. The backend serves all of these through `compat` under `/v0` (built in M3d, spec `compat`, flow `compat`) until the app moves to `/v1`; set `EXPO_PUBLIC_API_URL=<host>/v0`. Known differences: the app's WhatsApp opt-ins are delivered by push with SMS fallback until a WhatsApp provider is chosen; `status` stays `under_review` until a final lender decision; MSME cases start as proprietorships named after the owner.

| # | Frontend function | Endpoint called | Call site | Callers (screens) | Status | Backend `compat` → v1 target |
|---|---|---|---|---|---|---|
| 1 | `requestOtp` | `POST /auth/otp/request` | `src/services/auth.ts:77` | `(auth)/login.tsx:71`, `(auth)/verify-otp.tsx:79` | `useful` | `POST /v1/auth/otp/request` (adds `loginAs`) |
| 2 | `verifyOtp` | `POST /auth/otp/verify` | `src/services/auth.ts:86` | `(auth)/verify-otp.tsx:53` | `useful` | `POST /v1/auth/otp/verify` (returns `token` alias of `accessToken`) |
| 3 | `saveProfile` | `PATCH /auth/profile` | `src/services/auth.ts:68` | `(borrower)/verify-details.tsx:56`, `(borrower)/profile.tsx:43` | `useful` | `PATCH /v1/me/profile` + `POST /v1/borrower-profiles/:id/kyc/pan` |
| 4 | `getLoanCategories` | `GET /loan/categories?entityType=` | `src/services/loan.ts:16` | `(borrower)/loan-category.tsx:29` | `useful` | `GET /v1/catalog/loan-categories` |
| 5 | `submitLoanRequirement` | `POST /loan/requirement` | `src/services/loan.ts:28` | `(borrower)/loan-purpose.tsx:50` | `useful` | `POST /v1/applications` + `PATCH /v1/applications/:id/requirement` |
| 6 | `submitPreCheck` | `POST /loan/pre-check` | `src/services/loan.ts:37` | `(borrower)/pre-check.tsx:48` | `useful` | `PUT /v1/applications/:id/answers` |
| 7 | `submitConsent` | `POST /consent` | `src/services/consent.ts:10` | `(borrower)/consent.tsx:68`, `(borrower)/lenders.tsx:81` | `useful` | `POST /v1/applications/:id/consents` |
| 8 | `uploadDocument` | `POST /documents` (multipart, XHR) | `src/services/documents.ts:46` | `(borrower)/documents.tsx:86` | `useful` | `POST /v1/documents` |
| 9 | `getDocumentStatus` | `GET /documents/:id` | `src/services/documents.ts:71` | Called by `waitForDocument` (`src/services/documents.ts`) | `useful` | `GET /v1/documents/:id` |
| 10 | `waitForDocument` | (polls #9) | `src/services/documents.ts` | `(borrower)/documents.tsx:90` | `useful` | — |
| 11 | `deleteDocument` | `DELETE /documents/:id` | `src/services/documents.ts:88` | `(borrower)/documents.tsx:108` | `useful` | `DELETE /v1/documents/:id` |
| 12 | `startAnalysis` | `POST /analysis` | `src/services/documents.ts:104` | `(borrower)/documents.tsx:128`, `(borrower)/analysing.tsx:88` | `useful` | `POST /v1/applications/:id/analyses` |
| 13 | `getAnalysis` | `GET /analysis/:id` | `src/services/documents.ts:123` | `(borrower)/analysing.tsx:41` | `useful` | `GET /v1/analyses/:id` |
| 14 | `requestWhatsAppUpdate` | `POST /notifications/whatsapp` (`analysis.completed`) | `src/services/documents.ts:132` | `(borrower)/analysing.tsx:75` | `useful` | `POST /v1/notifications/subscriptions` |
| 15 | `getAssessment` | `POST /score` | `src/services/score.ts:61` | `(borrower)/score.tsx:38` | `useful` | `GET /v1/applications/:id/assessment` |
| 16 | `getLenders` | `POST /lenders` | `src/services/lenders.ts:31` | `(borrower)/lenders.tsx:39` | `useful` | `POST /v1/applications/:id/matches` |
| 17 | `applyToLender` | `POST /applications` | `src/services/application.ts:40` | `(borrower)/lenders.tsx:84` | `useful` | `POST /v1/applications/:id/submissions` |
| 18 | `getApplication` | `GET /applications/:id` | `src/services/application.ts:50` | none found | `dead` | `GET /v1/applications/:id/submissions/:sid`. The app shows the stored copy from AsyncStorage, so status never refreshes from the server. |
| 19 | `requestApplicationUpdates` | `POST /notifications/whatsapp` (`application.status`) | `src/services/application.ts:58` | `(borrower)/application.tsx:59` | `useful` | `POST /v1/notifications/subscriptions` |

Shared client: `api()` in `src/services/api.ts:21` reads errors as top-level `{message, code}`, so the backend keeps a flat error body (plan §10.1).
