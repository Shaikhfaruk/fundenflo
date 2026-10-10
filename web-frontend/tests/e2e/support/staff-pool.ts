import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { generateSync } from 'otplib';

import { acceptStaffInvitation, randomEmail, type SessionTokens, staffApi } from './backend';

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
      return await staffApi<SessionTokens>('POST', '/auth/staff/mfa/verify', { mfaToken: first.mfaToken, code: freshCode(account.secret) });
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
    [`admin-${project}`, { role: 'super_admin', name: 'Catalog Admin' }],
    [`auditor-${project}`, { role: 'super_admin', name: 'Records Admin' }],
    [`finance-${project}`, { role: 'finance', name: 'Finance Desk' }],
    [`treasurer-${project}`, { role: 'finance', name: 'Treasury Desk' }],
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

const SESSION_FILE = resolve(CACHE_DIR, 'staff-sessions.json');
const SESSION_REUSE_MARGIN_MS = 10 * 60_000;
const MS_PER_SECOND = 1000;

const expiresAt = (token: string) => (JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8')) as { exp: number }).exp * MS_PER_SECOND;

const readSessions = (): Record<string, SessionTokens> => (existsSync(SESSION_FILE) ? (JSON.parse(readFileSync(SESSION_FILE, 'utf8')) as Record<string, SessionTokens>) : {});

const writeSession = (key: string, session: SessionTokens) => {
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(SESSION_FILE, JSON.stringify({ ...readSessions(), [key]: session }, null, 2));
};

async function freshSession(key: string): Promise<SessionTokens> {
  const held = readSessions()[key];
  if (held && expiresAt(held.accessToken) - Date.now() > SESSION_REUSE_MARGIN_MS) return held;
  if (held) {
    try {
      return await staffApi<SessionTokens>('POST', '/auth/token/refresh', { refreshToken: held.refreshToken });
    } catch {
      return login(staffAccount(key));
    }
  }
  return login(staffAccount(key));
}

export async function prepareStaffSessions() {
  for (const key of Object.keys(STAFF_POOL)) writeSession(key, await freshSession(key));
}

export async function staffSession(key: string): Promise<SessionTokens> {
  const held = readSessions()[key];
  if (held) return held;
  const session = await freshSession(key);
  writeSession(key, session);
  return session;
}

export const pooledStaffToken = async (key: string) => (await staffSession(key)).accessToken;
