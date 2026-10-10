import { execFileSync } from 'node:child_process';
import { randomInt, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';

import { pdfBytes } from './pdf';

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

export const staffApi = async <T>(method: string, path: string, body?: unknown, token?: string, version?: number): Promise<T> => {
  const headers: Record<string, string> = { 'content-type': 'application/json', 'idempotency-key': randomUUID(), ...(token ? { authorization: `Bearer ${token}` } : {}) };
  if (version !== undefined) headers['if-match'] = `"${version}"`;
  const response = await fetch(`${API}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${path} -> ${response.status} ${text}`);
  return (text ? JSON.parse(text) : null) as T;
};

const api = staffApi;

export const acceptStaffInvitation = (email: string, role: string, name: string, password: string) => api('POST', '/auth/staff/invitations/accept', { token: inviteStaff(email, role), fullName: name, password });

export async function inviteLender(email: string, token: string): Promise<string> {
  const lenders = await api<{ items: Array<{ name: string; organizationId: string; status: string }> }>('GET', '/admin/lenders', undefined, token);
  const lender = lenders.items.find((item) => item.status === 'active') ?? lenders.items[0];
  if (!lender) throw new Error('No lender organisation to invite into. Run pnpm db:seed in backend/.');
  await api('POST', '/admin/invitations', { organizationId: lender.organizationId, role: 'lender_admin', email }, token);
  return lender.name;
}

const LAKH = 100_000_00;

export type TestLender = { id: string; name: string; productId: string; organizationId: string; cleanUp: () => Promise<void> };

export async function liveTestLender(name: string, maker: string, checker: string): Promise<TestLender> {
  const key = `e2e${Date.now()}${randomInt(0, 1000)}`;
  const lender = await api<{ id: string; version: number; organizationId: string }>('POST', '/admin/lenders', { key, name, kind: 'nbfc' }, maker);
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
    organizationId: lender.organizationId,
    cleanUp: async () => {
      await api('POST', `/admin/lender-products/${product.id}/versions/2/retire`, { reason: 'End-to-end test finished' }, maker).catch(() => null);
      await api('POST', `/admin/lender-products/${product.id}/versions/1/retire`, { reason: 'End-to-end test finished' }, maker);
      const current = await api<{ version: number }>('GET', `/admin/lenders/${lender.id}`, undefined, maker);
      await api('PATCH', `/admin/lenders/${lender.id}`, { status: 'offboarded' }, maker, current.version ?? active.version);
    },
  };
}

export const opsReviewDocument = (token: string, documentId: string, fields: Array<{ attributeKey: string; value: unknown }>) => api('POST', `/ops/documents/${documentId}/review`, { outcome: 'verified', fields }, token);

const LAKH_RUPEES_PAISE = 100_000_00;

const borrowerSession = async () => {
  const mobile = randomMobile();
  await api('POST', '/auth/otp/request', { mobile, countryCode: '+91', loginAs: 'borrower' });
  const session = await api<{ accessToken: string }>('POST', '/auth/otp/verify', { mobile, countryCode: '+91', otp: staticOtp() });
  return session.accessToken;
};

const uploadPdf = async (token: string, applicationId: string, documentType: string, text: string) => {
  const form = new FormData();
  form.append('documentType', documentType);
  form.append('applicationId', applicationId);
  form.append('file', new Blob([pdfBytes(text)], { type: 'application/pdf' }), `${documentType}.pdf`);
  const response = await fetch(`${API}/documents`, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: form });
  if (!response.ok) throw new Error(`upload ${documentType} -> ${response.status} ${await response.text()}`);
  return ((await response.json()) as { id: string }).id;
};

const waitForStatus = async (token: string, documentId: string, status: string) => {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const document = await api<{ status: string }>('GET', `/documents/${documentId}`, undefined, token);
    if (document.status === status) return;
    await new Promise((done) => setTimeout(done, 500));
  }
  throw new Error(`document ${documentId} never reached ${status}`);
};

export async function caseWithDocuments(businessName: string, statementText?: string) {
  const token = await borrowerSession();
  const created = await api<{ id: string; version: number }>('POST', '/applications', { segment: 'msme', subSegment: 'proprietorship', businessName, category: 'business' }, token);
  await api('PATCH', `/applications/${created.id}/requirement`, { purpose: 'expansion', amountPaise: 20 * LAKH_RUPEES_PAISE, tenureMonths: 36, city: 'Pune' }, token, created.version);
  await api('PUT', `/applications/${created.id}/answers`, { stage: 'pre_check', answers: [{ questionKey: 'business_age', value: '3-5' }, { questionKey: 'monthly_turnover', value: '5-25L' }, { questionKey: 'existing_emis', value: 'no' }, { questionKey: 'gst_registered', value: 'yes' }] }, token);
  const template = await api<{ versionId: string }>('GET', '/catalog/consent-templates?context=journey', undefined, token);
  await api('POST', `/applications/${created.id}/consents`, { templateVersionId: template.versionId, items: [{ purpose: 'ai_documents', granted: true }] }, token);
  const stamp = `${businessName} ${Date.now()}`;
  const statement = await uploadPdf(token, created.id, 'bank_statement', statementText ?? `Statement ${stamp}`);
  const gst = await uploadPdf(token, created.id, 'gstr_3b', `GST ${stamp}`);
  await waitForStatus(token, statement, 'needs_review');
  await waitForStatus(token, gst, 'needs_review');
  const application = await api<{ party: { id: string } }>('GET', `/applications/${created.id}`, undefined, token);
  return { applicationId: created.id, statementId: statement, gstId: gst, partyId: application.party.id, token };
}

export const requestDataCorrection = (token: string, details: string) => api<{ id: string; ref: string }>('POST', '/me/data-requests', { kind: 'correction', details }, token);

export const opsLeadPerson = async (token: string, name: string) => (await api<{ party: { id: string } }>('POST', '/ops/leads', { name, mobile: randomMobile(), countryCode: '+91' }, token)).party.id;

export const inviteLenderUser = (email: string, organizationId: string, token: string) => api('POST', '/admin/invitations', { organizationId, role: 'lender_admin', email }, token);

export type SessionTokens = { accessToken: string; refreshToken: string; expiresIn: number; refreshExpiresIn: number };

export type TestFirm = { mobile: string; organizationId: string; name: string; session: SessionTokens };

export async function verifiedFirm(maker: string, checker: string, name: string): Promise<TestFirm> {
  const mobile = randomMobile();
  await api('POST', '/auth/otp/request', { mobile, countryCode: '+91', loginAs: 'ca' });
  const first = await api<SessionTokens>('POST', '/auth/otp/verify', { mobile, countryCode: '+91', otp: staticOtp() });
  const firm = await api<{ id: string; organizationId: string }>('POST', '/partner/signup', { kind: 'ca', firmName: name, membershipNumber: '512345', segments: ['msme'], categories: ['business'], languages: ['en', 'hi'], serviceAreas: [{ stateGstCode: '27' }] }, first.accessToken);
  await api('POST', `/admin/partners/${firm.id}/verify`, { decision: 'approve', note: 'End-to-end firm check' }, maker);
  await api('POST', `/admin/partners/${firm.id}/verify`, { decision: 'approve', note: 'End-to-end second check' }, checker);
  const me = await api<{ memberships: Array<{ id: string; organization: { id: string } | null }> }>('GET', '/me', undefined, first.accessToken);
  const membership = me.memberships.find((item) => item.organization?.id === firm.organizationId);
  if (!membership) throw new Error(`No membership in ${name} after verification`);
  const session = await api<SessionTokens>('POST', '/auth/switch-context', { membershipId: membership.id }, first.accessToken);
  return { mobile, organizationId: firm.organizationId, name, session };
}

export async function assignedLead(ops: string, organizationId: string, name: string, businessName: string) {
  const lead = await api<{ id: string }>('POST', '/ops/leads', {
    name,
    mobile: randomMobile(),
    countryCode: '+91',
    businessName,
    segment: 'msme',
    category: 'business',
    city: 'Pune',
    amountText: '15 lakh',
    consent: { basis: 'consent', evidence: 'Agreed on the phone call', items: [{ purpose: 'contact', granted: true }, { purpose: 'partner_sharing', granted: true }] },
  }, ops);
  await api('POST', `/ops/leads/${lead.id}/assign`, { organizationId }, ops);
  return lead.id;
}

export const approveAsOps = async (ops: string, submissionId: string) => {
  const submission = await api<{ version: number }>('GET', `/ops/submissions/${submissionId}`, undefined, ops);
  return api<{ status: string }>('POST', `/ops/submissions/${submissionId}/approve`, { expectedVersion: submission.version }, ops);
};
