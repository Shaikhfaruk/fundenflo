import { randomBytes } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { exportJWK, generateKeyPair } from 'jose';

import { uuidv7 } from '../common/ids/uuid-v7.js';

const ENV_FILE = '.env';
const TEMPLATE_FILE = '.env.example';

const randomKey = () => randomBytes(32).toString('base64');

if (!existsSync(ENV_FILE)) copyFileSync(TEMPLATE_FILE, ENV_FILE);
const lines = readFileSync(ENV_FILE, 'utf8').split('\n');
const current = new Map(
  lines.flatMap((line) => {
    const index = line.indexOf('=');
    return index > 0 ? [[line.slice(0, index), line.slice(index + 1).trim()] as const] : [];
  }),
);
const isEmpty = (key: string) => !current.get(key);

const { privateKey } = await generateKeyPair('ES256', { extractable: true });
const signingKey = { ...(await exportJWK(privateKey)), kid: uuidv7(), alg: 'ES256' };
const dataKeyId = `dk-${uuidv7()}`;

const generated: Record<string, string> = {};
if (isEmpty('JWT_SIGNING_KEYS')) generated.JWT_SIGNING_KEYS = `'${JSON.stringify([signingKey])}'`;
if (isEmpty('CRYPTO_ACTIVE_KEY_ID') && isEmpty('CRYPTO_LOCAL_KEYS')) {
  generated.CRYPTO_ACTIVE_KEY_ID = dataKeyId;
  generated.CRYPTO_LOCAL_KEYS = `'${JSON.stringify({ [dataKeyId]: randomKey() })}'`;
}
if (isEmpty('BLIND_INDEX_KEY')) generated.BLIND_INDEX_KEY = randomKey();
if (isEmpty('OTP_HASH_KEY')) generated.OTP_HASH_KEY = randomKey();

const output = lines.map((line) => {
  const index = line.indexOf('=');
  const key = index > 0 ? line.slice(0, index) : '';
  return key && generated[key] ? `${key}=${generated[key]}` : line;
});
writeFileSync(ENV_FILE, output.join('\n'));

const filled = Object.keys(generated);
process.stdout.write(filled.length > 0 ? `Generated ${filled.join(', ')} in ${ENV_FILE}\n` : `All keys in ${ENV_FILE} are already set\n`);
