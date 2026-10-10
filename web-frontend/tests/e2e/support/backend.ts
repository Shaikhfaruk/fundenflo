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

const api = async <T>(method: string, path: string, body?: unknown, token?: string, version?: number): Promise<T> => {
  const headers: Record<string, string> = { 'content-type': 'application/json', 'idempotency-key': randomUUID(), ...(token ? { authorization: `Bearer ${token}` } : {}) };
  if (version !== undefined) headers['if-match'] = `"${version}"`;
  const response = await fetch(`${API}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${path} -> ${response.status} ${text}`);
  return (text ? JSON.parse(text) : null) as T;
};

export async function staffToken(role: string, name: string): Promise<string> {
  const email = randomEmail(`e2e.${role}`);
  const password = `Passw0rd-${randomUUID()}`;
  await api('POST', '/auth/staff/invitations/accept', { token: inviteStaff(email, role), fullName: name, password });
  const login = await api<{ mfaToken: string; mfaSetup: { secret: string } }>('POST', '/auth/staff/login', { email, password });
  const session = await api<{ accessToken: string }>('POST', '/auth/staff/mfa/verify', { mfaToken: login.mfaToken, code: generateSync({ secret: login.mfaSetup.secret }) });
  return session.accessToken;
}

export async function inviteLender(email: string): Promise<string> {
  const token = await staffToken('super_admin', 'Lender Setup');
  const lenders = await api<{ items: Array<{ name: string; organizationId: string; status: string }> }>('GET', '/admin/lenders', undefined, token);
  const lender = lenders.items.find((item) => item.status === 'active') ?? lenders.items[0];
  if (!lender) throw new Error('No lender organisation to invite into. Run pnpm db:seed in backend/.');
  await api('POST', '/admin/invitations', { organizationId: lender.organizationId, role: 'lender_admin', email }, token);
  return lender.name;
}

const LAKH = 100_000_00;

export type TestLender = { id: string; name: string; productId: string; cleanUp: () => Promise<void> };

export async function liveTestLender(name: string, maker: string, checker: string): Promise<TestLender> {
  const key = `e2e${Date.now()}`;
  const lender = await api<{ id: string; version: number }>('POST', '/admin/lenders', { key, name, kind: 'nbfc' }, maker);
  const active = await api<{ version: number }>('PATCH', `/admin/lenders/${lender.id}`, { status: 'active' }, maker, lender.version);
  const agreement = await api<{ id: string; version: number }>('POST', `/admin/lenders/${lender.id}/agreements`, { reference: `${key}-1`, validFrom: new Date().toISOString().slice(0, 10) }, maker);
  await api('PATCH', `/admin/lenders/${lender.id}/agreements/${agreement.id}`, { status: 'active' }, maker, agreement.version);
  const content = {
    category: 'business',
    segments: ['msme'],
    amountPaise: { min: LAKH, max: 100 * LAKH },
    tenureMonths: { min: 12, max: 60 },
    coverage: { nationwide: true },
    eligibility: { hard: [{ id: 'gst', when: { attr: 'business.gst_registered', op: 'eq', value: true }, pass: { en: 'You are GST registered' } }], soft: [] },
    documents: [{ key: 'statement', documentTypes: ['bank_statement'], stage: 'assessment' }],
  };
  const product = await api<{ id: string }>('POST', '/admin/lender-products', { key: `${key}.working_capital`, name: { en: `${name} Working Capital` }, content }, maker);
  const submitted = await api<{ changeRequest: { id: string } }>('POST', `/admin/lender-products/${product.id}/versions/1/submit`, { reason: 'End-to-end test product' }, maker);
  await api('POST', `/admin/change-requests/${submitted.changeRequest.id}/approve`, {}, checker);
  await api('POST', `/admin/lender-products/${product.id}/versions/1/publish`, {}, maker);
  return {
    id: lender.id,
    name,
    productId: product.id,
    cleanUp: async () => {
      await api('POST', `/admin/lender-products/${product.id}/versions/1/retire`, { reason: 'End-to-end test finished' }, maker);
      const current = await api<{ version: number }>('GET', `/admin/lenders/${lender.id}`, undefined, maker);
      await api('PATCH', `/admin/lenders/${lender.id}`, { status: 'offboarded' }, maker, current.version ?? active.version);
    },
  };
}

export const opsReviewDocument = (token: string, documentId: string, fields: Array<{ attributeKey: string; value: unknown }>) => api('POST', `/ops/documents/${documentId}/review`, { outcome: 'verified', fields }, token);

export const opsApproveSubmission = (token: string, submissionId: string) => api<{ status: string }>('POST', `/ops/submissions/${submissionId}/approve`, { note: 'Checked in end-to-end test' }, token);
