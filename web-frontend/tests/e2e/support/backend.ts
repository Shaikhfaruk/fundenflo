import { execFileSync } from 'node:child_process';
import { randomInt, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { generateSync } from 'otplib';

const BACKEND_DIR = resolve(import.meta.dirname, '../../../../backend');

const backendEnv = parseEnv(readFileSync(resolve(BACKEND_DIR, '.env'), 'utf8'));

export const staticOtp = () => {
  const code = process.env.E2E_OTP ?? backendEnv.AUTH_OTP_STATIC_CODE;
  if (!code) throw new Error('Set AUTH_OTP_STATIC_CODE in backend/.env or E2E_OTP for end-to-end tests');
  return code;
};

export const randomMobile = () => `98${String(randomInt(0, 100_000_000)).padStart(8, '0')}`;

export const randomEmail = (prefix: string) => `${prefix}.${Date.now()}.${randomInt(0, 1_000_000)}@sustaininsight.com`;

export function inviteStaff(email: string, role: string): string {
  const output = execFileSync('node', ['dist/scripts/invite-staff.js', '--email', email, '--role', role], { cwd: BACKEND_DIR, encoding: 'utf8' });
  const token = /Invitation code: (\S+)/.exec(output)?.[1];
  if (!token) throw new Error(`No invitation code in invite-staff output:\n${output}`);
  return token;
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXY';

const letter = () => LETTERS[randomInt(0, LETTERS.length)];

export const randomPan = (holder = 'P') => `${letter()}${letter()}${letter()}${holder}${letter()}${String(randomInt(0, 10_000)).padStart(4, '0')}${letter()}`;

const API = `${process.env.E2E_API_ORIGIN ?? 'http://localhost:3000'}/v1`;

const api = async <T>(method: string, path: string, body?: unknown, token?: string): Promise<T> => {
  const response = await fetch(`${API}${path}`, { method, headers: { 'content-type': 'application/json', 'idempotency-key': randomUUID(), ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${path} -> ${response.status} ${text}`);
  return (text ? JSON.parse(text) : null) as T;
};

export async function inviteLender(email: string): Promise<string> {
  const staffEmail = randomEmail('e2e.lender.setup');
  const password = `Passw0rd-${randomUUID()}`;
  await api('POST', '/auth/staff/invitations/accept', { token: inviteStaff(staffEmail, 'super_admin'), fullName: 'Lender Setup', password });
  const login = await api<{ mfaToken: string; mfaSetup: { secret: string } }>('POST', '/auth/staff/login', { email: staffEmail, password });
  const session = await api<{ accessToken: string }>('POST', '/auth/staff/mfa/verify', { mfaToken: login.mfaToken, code: generateSync({ secret: login.mfaSetup.secret }) });
  const lenders = await api<{ items: Array<{ name: string; organizationId: string }> }>('GET', '/admin/lenders', undefined, session.accessToken);
  const lender = lenders.items[0];
  if (!lender) throw new Error('No lender organisation to invite into. Run pnpm db:seed in backend/.');
  await api('POST', '/admin/invitations', { organizationId: lender.organizationId, role: 'lender_admin', email }, session.accessToken);
  return lender.name;
}
