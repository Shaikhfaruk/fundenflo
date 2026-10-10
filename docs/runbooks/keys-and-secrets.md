# Keys and secrets

Generate new key material with `pnpm keys:generate` (prints JWKs and base64 keys; never commit the output). Store secrets in the deployment secret store, not in `.env` files on servers.

## JWT signing keys (`JWT_SIGNING_KEYS`)

The first key in the list signs new access tokens; every key in the list verifies (matched by `kid`).

1. Generate a new ES256 JWK with a new `kid`.
2. Put it **first** in `JWT_SIGNING_KEYS`, keep the old key second, deploy.
3. After `JWT_ACCESS_TTL_SECONDS` (default 15 minutes) plus a margin, remove the old key and deploy again.

A leaked signing key: do the same immediately and also revoke sessions (suspend affected users or rotate and let refresh tokens fail).

## Field encryption keys (`CRYPTO_ACTIVE_KEY_ID`, `CRYPTO_LOCAL_KEYS` / `CRYPTO_WRAPPED_KEYS`, `KEY_VAULT_KEY_ID`)

Every encrypted value is stored as `version:keyId:iv:tag:ciphertext`, so old values stay readable while their key is in the ring.

1. Add a new key to the ring (`CRYPTO_LOCAL_KEYS` locally; a data key wrapped by Key Vault in `CRYPTO_WRAPPED_KEYS` in Azure).
2. Set `CRYPTO_ACTIVE_KEY_ID` to it and deploy; new writes use it.
3. Keep old keys in the ring. Re-encrypting old values is not automated yet; do not remove a key while data encrypted with it exists.

## Blind index and OTP keys (`BLIND_INDEX_KEY`, `OTP_HASH_KEY`)

`BLIND_INDEX_KEY` hashes mobiles, emails, PAN, GSTIN and bank accounts for look-ups; changing it breaks every look-up until all hashes are recomputed. Rotate only with a planned re-index. `OTP_HASH_KEY` can be rotated at any time (open OTP challenges fail and users request a new code).

## Provider secrets

`EXPO_ACCESS_TOKEN`, `SMTP_URL`, `STORAGE_CONNECTION_STRING` (or a managed identity with `STORAGE_ACCOUNT_URL`): rotate at the provider, update the secret, deploy. `SMS_API_KEY` is reserved for the SMS provider adapter, which is not built yet. Notifications that fail during the switch are retried by `notifications.dispatch`.
