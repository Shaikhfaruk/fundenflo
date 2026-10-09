import { z } from 'zod';

const emptyToUndefined = (value: unknown) => (typeof value === 'string' && value.trim() === '' ? undefined : value);

const optional = <T extends z.ZodType>(schema: T) => z.preprocess(emptyToUndefined, schema.optional());

const booleanFlag = z
  .preprocess(emptyToUndefined, z.enum(['true', 'false']).default('false'))
  .transform((value) => value === 'true');

const csvList = z
  .preprocess(emptyToUndefined, z.string().optional())
  .transform((value) => (value ? value.split(',').map((item) => item.trim()).filter(Boolean) : []));

const base64Key = z
  .base64()
  .refine((value) => Buffer.from(value, 'base64').length === 32, 'must be 32 random bytes encoded as base64');

const json = <T extends z.ZodType>(schema: T) =>
  z
    .string()
    .transform((raw, ctx) => {
      try {
        return JSON.parse(raw) as unknown;
      } catch {
        ctx.addIssue({ code: 'custom', message: 'must be valid JSON' });
        return z.NEVER;
      }
    })
    .pipe(schema);

const signingJwk = z.object({
  kty: z.literal('EC'),
  crv: z.literal('P-256'),
  kid: z.string().min(1),
  x: z.string().min(1),
  y: z.string().min(1),
  d: z.string().min(1),
  alg: z.literal('ES256').optional(),
});

export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    TRUST_PROXY: booleanFlag,
    CORS_ORIGINS: csvList,

    DATABASE_URL: z.url(),
    REDIS_URL: z.url(),

    JWT_ISSUER: z.string().min(1),
    JWT_AUDIENCE: z.string().min(1),
    JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
    JWT_SIGNING_KEYS: json(z.array(signingJwk).min(1)),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(90).default(30),
    SESSION_MAX_AGE_DAYS: z.coerce.number().int().min(1).max(365).default(90),

    CRYPTO_DRIVER: z.enum(['local', 'azure_key_vault']),
    CRYPTO_ACTIVE_KEY_ID: z.string().min(1),
    CRYPTO_LOCAL_KEYS: optional(json(z.record(z.string().min(1), base64Key))),
    CRYPTO_WRAPPED_KEYS: optional(json(z.record(z.string().min(1), z.base64()))),
    KEY_VAULT_KEY_ID: optional(z.url()),
    BLIND_INDEX_KEY: base64Key,
    OTP_HASH_KEY: base64Key,

    AUTH_OTP_STATIC_CODE: optional(z.string().regex(/^\d{6}$/, 'must be 6 digits')),

    SMS_DRIVER: z.enum(['log']),
    SMS_API_KEY: optional(z.string().min(1)),
    SMS_SENDER_ID: optional(z.string().regex(/^[A-Za-z0-9]{3,11}$/, 'must be the 3-11 character sender header')),
    SMS_DLT_ENTITY_ID: optional(z.string().regex(/^\d{10,30}$/, 'must be the numeric DLT principal entity ID')),
    SMS_DLT_TEMPLATE_AUTH_OTP: optional(z.string().regex(/^\d{10,30}$/, 'must be a numeric DLT template ID')),
    SMS_DLT_TEMPLATE_INVITATION_MEMBER: optional(z.string().regex(/^\d{10,30}$/, 'must be a numeric DLT template ID')),
    EMAIL_DRIVER: z.enum(['smtp', 'log']),
    SMTP_URL: optional(z.url()),
    EMAIL_FROM: optional(z.string().min(3)),

    STORAGE_DRIVER: z.enum(['azure_blob']),
    STORAGE_CONNECTION_STRING: optional(z.string().min(1)),
    STORAGE_ACCOUNT_URL: optional(z.url()),
    STORAGE_CONTAINER: z.string().regex(/^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$/, 'must be a valid blob container name'),
  })
  .superRefine((env, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message });

    if (!env.JWT_SIGNING_KEYS.every((key, index, all) => all.findIndex((other) => other.kid === key.kid) === index)) {
      issue('JWT_SIGNING_KEYS', 'kid values must be unique');
    }

    if (env.CRYPTO_DRIVER === 'local') {
      if (!env.CRYPTO_LOCAL_KEYS) issue('CRYPTO_LOCAL_KEYS', 'required when CRYPTO_DRIVER=local');
      else if (!env.CRYPTO_LOCAL_KEYS[env.CRYPTO_ACTIVE_KEY_ID]) issue('CRYPTO_ACTIVE_KEY_ID', 'must be a key in CRYPTO_LOCAL_KEYS');
    }

    if (env.CRYPTO_DRIVER === 'azure_key_vault') {
      if (!env.KEY_VAULT_KEY_ID) issue('KEY_VAULT_KEY_ID', 'required when CRYPTO_DRIVER=azure_key_vault');
      if (!env.CRYPTO_WRAPPED_KEYS) issue('CRYPTO_WRAPPED_KEYS', 'required when CRYPTO_DRIVER=azure_key_vault');
      else if (!env.CRYPTO_WRAPPED_KEYS[env.CRYPTO_ACTIVE_KEY_ID]) issue('CRYPTO_ACTIVE_KEY_ID', 'must be a key in CRYPTO_WRAPPED_KEYS');
    }

    if (env.EMAIL_DRIVER === 'smtp') {
      if (!env.SMTP_URL) issue('SMTP_URL', 'required when EMAIL_DRIVER=smtp');
      if (!env.EMAIL_FROM) issue('EMAIL_FROM', 'required when EMAIL_DRIVER=smtp');
    }

    if (!env.STORAGE_CONNECTION_STRING && !env.STORAGE_ACCOUNT_URL) {
      issue('STORAGE_ACCOUNT_URL', 'set STORAGE_ACCOUNT_URL (managed identity) or STORAGE_CONNECTION_STRING');
    }

    if (env.NODE_ENV === 'production') {
      if (env.SMS_DRIVER === 'log') issue('SMS_DRIVER', 'a real SMS provider is required in production');
      if (env.EMAIL_DRIVER === 'log') issue('EMAIL_DRIVER', 'a real email provider is required in production');
      if (env.CRYPTO_DRIVER === 'local') issue('CRYPTO_DRIVER', 'azure_key_vault is required in production');
      if (env.AUTH_OTP_STATIC_CODE) issue('AUTH_OTP_STATIC_CODE', 'must be empty in production');
    }
  });

export type AppConfig = z.output<typeof envSchema>;

export function loadConfig(source: NodeJS.ProcessEnv): AppConfig {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const lines = result.error.issues.map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`);
    throw new Error(`Invalid environment configuration:\n${lines.join('\n')}`);
  }
  return result.data;
}
