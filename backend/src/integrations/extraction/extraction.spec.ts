import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';

import { type ExtractionAttribute, ExtractionReason, type ExtractionRequest } from './document-extractor.port.js';
import { ExtractionProvider } from './extraction.constants.js';
import { OpenAiCompatibleExtractor } from './openai-compatible.extractor.js';
import { readPdfText } from './pdf-text.js';

const attributes: ExtractionAttribute[] = [
  { key: 'banking.avg_monthly_inflow_paise', label: 'Average Monthly Inflow', dataType: 'money', unit: 'paise', enumValues: [] },
  { key: 'banking.bounces_6m', label: 'Bounced Payments In Six Months', dataType: 'integer', unit: 'count', enumValues: [] },
  { key: 'banking.statement_months', label: 'Months Of Bank Statement', dataType: 'integer', unit: 'months', enumValues: [] },
];

const request = (overrides: Partial<ExtractionRequest> = {}): ExtractionRequest => ({
  documentType: 'bank_statement',
  documentLabel: 'Bank Statement',
  extractorKey: null,
  attributes,
  mimeType: 'application/pdf',
  body: Readable.from([Buffer.from('not really a pdf')]),
  password: null,
  ...overrides,
});

const answer = (fields: Record<string, { value: unknown; confidence: number; page: number | null }>): Partial<Response> => ({
  ok: true,
  status: 200,
  json: () => Promise.resolve({ output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ documentType: 'bank_statement', documentTypeConfidence: 0.97, fields }) }] }] }),
});

type Call = { url: string; headers: Record<string, string>; body: string };

const fakeFetch = (responses: Array<Partial<Response> | Error>) => {
  const calls: Call[] = [];
  const fetcher = (async (url: string, init: RequestInit) => {
    calls.push({ url, headers: init.headers as Record<string, string>, body: init.body as string });
    const next = responses.shift();
    if (next instanceof Error) throw next;
    return next as Response;
  }) as unknown as typeof fetch;
  return { calls, fetcher };
};

const openai = (fetcher: typeof fetch) => new OpenAiCompatibleExtractor({ provider: ExtractionProvider.OpenAi, baseUrl: 'https://api.example.test/v1/', apiKey: 'sk-test-0000000000000000', model: 'test-model' }, fetcher, 1);

describe('OpenAI-compatible document extractor', () => {
  it('sends the file with a strict schema and turns rupees into paise', async () => {
    const { calls, fetcher } = fakeFetch([answer({ field_0: { value: 485000.4, confidence: 0.92, page: 2 }, field_1: { value: 1, confidence: 0.88, page: 3 }, field_2: { value: 6, confidence: 0.99, page: 1 } })]);
    const outcome = await openai(fetcher).extract(request());
    expect(calls[0]?.url).toBe('https://api.example.test/v1/responses');
    expect(calls[0]?.headers.authorization).toBe('Bearer sk-test-0000000000000000');
    const body = JSON.parse(calls[0]?.body ?? '{}') as { model: string; store: boolean; input: Array<{ content: Array<{ type: string }> }>; text: { format: { strict: boolean; schema: { properties: { fields: { required: string[] } } } } } };
    expect(body).toMatchObject({ model: 'test-model', store: false });
    expect(body.input[0]?.content[0]?.type).toBe('input_file');
    expect(body.text.format.strict).toBe(true);
    expect(body.text.format.schema.properties.fields.required).toEqual(['field_0', 'field_1', 'field_2']);
    expect(outcome).toMatchObject({ extractor: 'openai', model: 'test-model', classifiedAs: 'bank_statement', needsReview: false, reason: null });
    expect(outcome.fields).toEqual([
      { attributeKey: 'banking.avg_monthly_inflow_paise', value: 48500040, confidence: 0.92, page: 2 },
      { attributeKey: 'banking.bounces_6m', value: 1, confidence: 0.88, page: 3 },
      { attributeKey: 'banking.statement_months', value: 6, confidence: 0.99, page: 1 },
    ]);
  });

  it('flags missing values for review and never invents them', async () => {
    const { fetcher } = fakeFetch([answer({ field_0: { value: null, confidence: 0, page: null }, field_1: { value: 'two', confidence: 0.5, page: null }, field_2: { value: 6, confidence: 0.9, page: 1 } })]);
    const outcome = await openai(fetcher).extract(request());
    expect(outcome).toMatchObject({ needsReview: true, reason: ExtractionReason.FieldsMissing });
    expect(outcome.fields.map((field) => field.attributeKey)).toEqual(['banking.statement_months']);
  });

  it('sends photos as images and uses the Azure api-key header', async () => {
    const { calls, fetcher } = fakeFetch([answer({ field_0: { value: 1000, confidence: 0.8, page: 1 }, field_1: { value: 0, confidence: 0.8, page: 1 }, field_2: { value: 3, confidence: 0.8, page: 1 } })]);
    const azure = new OpenAiCompatibleExtractor({ provider: ExtractionProvider.AzureOpenAi, baseUrl: 'https://fundenflo.openai.azure.com/openai/v1', apiKey: 'azure-key-000000000000', model: 'extract-deployment' }, fetcher, 1);
    await azure.extract(request({ mimeType: 'image/jpeg' }));
    const headers = calls[0]?.headers ?? {};
    expect(headers['api-key']).toBe('azure-key-000000000000');
    expect(headers.authorization).toBeUndefined();
    expect(JSON.parse(calls[0]?.body ?? '{}').input[0].content[0]).toMatchObject({ type: 'input_image', detail: 'high' });
  });

  it('retries busy or failing providers, then hands the document to a person', async () => {
    const busy: Partial<Response> = { ok: false, status: 503 };
    const retried = fakeFetch([busy, new Error('socket hang up'), answer({ field_0: { value: 10, confidence: 0.9, page: 1 }, field_1: { value: 0, confidence: 0.9, page: 1 }, field_2: { value: 6, confidence: 0.9, page: 1 } })]);
    expect((await openai(retried.fetcher).extract(request())).needsReview).toBe(false);
    expect(retried.calls).toHaveLength(3);
    const rejected = fakeFetch([{ ok: false, status: 400 }]);
    expect(await openai(rejected.fetcher).extract(request())).toMatchObject({ needsReview: true, reason: ExtractionReason.ProviderFailed, fields: [] });
    expect(rejected.calls).toHaveLength(1);
    const down = fakeFetch([busy, busy, busy]);
    expect((await openai(down.fetcher).extract(request())).reason).toBe(ExtractionReason.ProviderFailed);
    expect(down.calls).toHaveLength(3);
  });

  it('skips files it cannot read and document types with nothing to extract', async () => {
    const { calls, fetcher } = fakeFetch([]);
    expect((await openai(fetcher).extract(request({ mimeType: 'image/heic' }))).reason).toBe(ExtractionReason.UnsupportedType);
    expect((await openai(fetcher).extract(request({ attributes: [] }))).reason).toBe(ExtractionReason.NoFields);
    expect(calls).toHaveLength(0);
  });
});

const pdfWithText = (text: string) => {
  const stream = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let body = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(body.length);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Uint8Array(Buffer.from(body, 'latin1'));
};

describe('PDF text', () => {
  it('reads the text of each page', async () => {
    const result = await readPdfText(pdfWithText('Closing balance 1,25,000.00'), null);
    expect(result.kind).toBe('text');
    if (result.kind === 'text') {
      expect(result.pages).toBe(1);
      expect(result.text).toContain('Closing balance 1,25,000.00');
    }
  });
});
