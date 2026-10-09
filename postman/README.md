# FundenFlo Postman collection

The API reference. Source files live here and are reviewed in pull requests; the importable collection is built from them.

| Path | What |
|---|---|
| `collection/_collection.json` | Collection info, bearer auth, collection variables, pre-request script |
| `collection/<NN Folder>/_folder.json` | Folder description |
| `collection/<NN Folder>/<NN Request>.json` | One Postman v2.1 item per request, with test scripts and saved example responses (success + documented errors) |
| `environments/*.postman_environment.json` | Environment values; secrets stay empty and are filled locally |
| `flows/*.flow.json` | Ordered end-to-end scenarios built from the request files and run with Newman |
| `scripts/` | `build.ts`, `split.ts`, `coverage.ts`, `run-flows.ts` |
| `dist/` | Build output (git-ignored) |

## Commands (run from `backend/`)

| Command | Does |
|---|---|
| `pnpm postman:build` | Builds `postman/dist/FundenFlo.postman_collection.json` for import |
| `pnpm postman:split <file>` | Writes a collection exported from the Postman app back into `collection/`, keeping existing file names |
| `pnpm postman:coverage` | Fails if any implemented route has no request file, or a request targets a route that does not exist (needs `pnpm build`) |
| `pnpm postman:flows [name...]` | Runs every flow (or the named ones) against the local API with Newman (needs the API running, `AUTH_OTP_STATIC_CODE` in `backend/.env`, and `pnpm build` for the staff invitation script) |

## Rules

- Every route added or changed in the backend adds or updates its request file in the same change, with example responses.
- Request names in files carry a two-digit order prefix; the build strips it.
- Never commit tokens, passwords or OTPs. Flows generate or read them at run time.
