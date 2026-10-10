import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { generateSync } from 'otplib';

import { acceptStaffInvitation, randomEmail, staffApi } from './backend';

type StaffAccount = { email: string; password: string; secret: string; role: string };

const CACHE_DIR = resolve(import.meta.dirname, '../.cache');
const CACHE_FILE = resolve(CACHE_DIR, 'staff-accounts.json');
const TOTP_WINDOW_MS = 30_000;
const MFA_REUSED = 'MFA_CODE_INVALID';

const readCache = (): Record<string, StaffAccount> => (existsSync(CACHE_FILE) ? (JSON.parse(readFileSync(CACHE_FILE, 'utf8')) as Record<string, StaffAccount>) : {});

const writeCache = (key: string, account: StaffAccount) => {
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(CACHE_FILE, JSON.stringify({ ...readCache(), [key]: account }, null, 2));
};

const nextWindow = () => new Promise((done) => setTimeout(done, TOTP_WINDOW_MS - (Date.now() % TOTP_WINDOW_MS) + 500));

export const freshCode = (secret: string) => generateSync({ secret });

const MFA_ATTEMPTS = 3;

const reused = (error: unknown) => error instanceof Error && error.message.includes(MFA_REUSED);

async function login(account: StaffAccount) {
  for (let attempt = 1; ; attempt += 1) {
    const first = await staffApi<{ mfaToken: string }>('POST', '/auth/staff/login', { email: account.email, password: account.password });
    try {
      return await staffApi<{ accessToken: string }>('POST', '/auth/staff/mfa/verify', { mfaToken: first.mfaToken, code: freshCode(account.secret) });
    } catch (error) {
      if (!reused(error) || attempt >= MFA_ATTEMPTS) throw error;
      await nextWindow();
    }
  }
}

export const STAFF_POOL: Record<string, { role: string; name: string }> = Object.fromEntries(
  ['desktop', 'phone'].flatMap((project) => [
    [`maker-${project}`, { role: 'super_admin', name: 'Lender Maker' }],
    [`checker-${project}`, { role: 'ops_lead', name: 'Case Reviewer' }],
    [`ops-${project}`, { role: 'ops_lead', name: 'Ops Desk' }],
    [`approver-${project}`, { role: 'ops_lead', name: 'Submission Approver' }],
    [`desk-${project}`, { role: 'ops_lead', name: 'Desk Viewer' }],
    [`risk-${project}`, { role: 'ops_lead', name: 'Risk Reviewer' }],
  ]),
);

export async function ensureStaffPool() {
  const cache = readCache();
  for (const [key, { role, name }] of Object.entries(STAFF_POOL)) {
    if (cache[key]?.role !== role) await create(key, role, name);
  }
}

export function staffAccount(key: string): StaffAccount {
  const account = readCache()[key];
  if (!account) throw new Error(`No cached staff account ${key}. Delete tests/e2e/.cache and run the suite again.`);
  return account;
}

async function create(key: string, role: string, name: string): Promise<StaffAccount> {
  const email = randomEmail(`e2e.${key}`);
  const password = `Passw0rd-${randomUUID()}`;
  await acceptStaffInvitation(email, role, name, password);
  const first = await staffApi<{ mfaToken: string; mfaSetup: { secret: string } }>('POST', '/auth/staff/login', { email, password });
  const account = { email, password, secret: first.mfaSetup.secret, role };
  await staffApi('POST', '/auth/staff/mfa/verify', { mfaToken: first.mfaToken, code: freshCode(account.secret) });
  writeCache(key, account);
  return account;
}

const TOKEN_REUSE_MS = 10 * 60 * 1000;

const TOKEN_FILE = resolve(CACHE_DIR, 'staff-tokens.json');

const readTokens = (): Record<string, { token: string; at: number }> => (existsSync(TOKEN_FILE) ? (JSON.parse(readFileSync(TOKEN_FILE, 'utf8')) as Record<string, { token: string; at: number }>) : {});

export async function pooledStaffToken(key: string): Promise<string> {
  const held = readTokens()[key];
  if (held && Date.now() - held.at < TOKEN_REUSE_MS) return held.token;
  const token = (await login(staffAccount(key))).accessToken;
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(TOKEN_FILE, JSON.stringify({ ...readTokens(), [key]: { token, at: Date.now() } }, null, 2));
  return token;
}
