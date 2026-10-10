import { randomUUID } from 'node:crypto';

import type { Page } from '@playwright/test';

export function bff(page: Page) {
  const call = async <T>(method: string, path: string, body?: unknown, version?: number): Promise<T> => {
    const origin = new URL(page.url()).origin;
    const headers: Record<string, string> = { origin, accept: 'application/json', 'idempotency-key': randomUUID() };
    if (version !== undefined) headers['if-match'] = `"${version}"`;
    const response = await page.request.fetch(`/api/v1${path}`, { method, headers, data: body });
    if (!response.ok()) throw new Error(`${method} ${path} -> ${response.status()} ${await response.text()}`);
    return (response.status() === 204 ? null : await response.json()) as T;
  };
  return {
    get: <T>(path: string) => call<T>('GET', path),
    post: <T>(path: string, body: unknown = {}) => call<T>('POST', path, body),
    put: <T>(path: string, body: unknown) => call<T>('PUT', path, body),
    patch: <T>(path: string, body: unknown, version: number) => call<T>('PATCH', path, body, version),
  };
}

type Api = ReturnType<typeof bff>;

const LAKH_PAISE = 100_000_00;

export async function preparedApplication(api: Api, businessName: string, city: string) {
  const created = await api.post<{ id: string; version: number }>('/applications', { segment: 'msme', subSegment: 'proprietorship', businessName, category: 'business' });
  await api.patch(`/applications/${created.id}/requirement`, { purpose: 'expansion', amountPaise: 20 * LAKH_PAISE, tenureMonths: 36, city }, created.version);
  await api.put(`/applications/${created.id}/answers`, {
    stage: 'pre_check',
    answers: [
      { questionKey: 'business_age', value: '3-5' },
      { questionKey: 'monthly_turnover', value: '5-25L' },
      { questionKey: 'existing_emis', value: 'no' },
      { questionKey: 'gst_registered', value: 'yes' },
    ],
  });
  const template = await api.get<{ versionId: string }>('/catalog/consent-templates?context=journey');
  await api.post(`/applications/${created.id}/consents`, { templateVersionId: template.versionId, items: [{ purpose: 'ai_documents', granted: true }] });
  return created.id;
}
