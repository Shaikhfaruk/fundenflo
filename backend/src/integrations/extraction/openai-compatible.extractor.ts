import { Logger } from '@nestjs/common';
import { setTimeout as delay } from 'node:timers/promises';
import type { Readable } from 'node:stream';

import { type DocumentExtractor, type ExtractedField, type ExtractionAttribute, type ExtractionOutcome, ExtractionReason, type ExtractionRequest } from './document-extractor.port.js';
import {
  ATTRIBUTE_GUIDANCE,
  DOCUMENT_GUIDANCE,
  EXTRACTION_PROMPT_VERSION,
  EXTRACTION_RETRIES,
  EXTRACTION_RETRY_BASE_MS,
  EXTRACTION_TIMEOUT_MS,
  ExtractionProvider,
  IMAGE_MIMES,
  OTHER_DOCUMENT,
  PAISE_PER_RUPEE,
  PDF_MIME,
  PDF_TEXT_MIN_CHARS,
} from './extraction.constants.js';
import { isEncryptedPdf, readPdfText } from './pdf-text.js';

export type OpenAiCompatibleConfig = { provider: ExtractionProvider; baseUrl: string; apiKey: string; model: string };

type JsonSchema = Record<string, unknown>;

type ModelField = { value: unknown; confidence: number; page: number | null };

type ModelAnswer = { documentType: string; documentTypeConfidence: number; fields: Record<string, ModelField> };

type ResponsesBody = { output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }> };

class ProviderError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

const RETRYABLE_STATUS: ReadonlySet<number> = new Set([408, 409, 429, 500, 502, 503, 504]);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const fieldName = (index: number) => `field_${index}`;

const valueSchema = (attribute: ExtractionAttribute): JsonSchema => {
  switch (attribute.dataType) {
    case 'money':
    case 'decimal':
    case 'percentage':
      return { type: ['number', 'null'] };
    case 'integer':
      return { type: ['integer', 'null'] };
    case 'boolean':
      return { type: ['boolean', 'null'] };
    case 'enum':
      return { type: ['string', 'null'], enum: [...attribute.enumValues, null] };
    default:
      return { type: ['string', 'null'] };
  }
};

const describe = (attribute: ExtractionAttribute) => {
  const unit = attribute.dataType === 'money' ? 'Indian rupees as a plain number' : attribute.dataType === 'date' ? 'a date as YYYY-MM-DD' : attribute.unit;
  return [attribute.label, unit ? `(${unit})` : null, ATTRIBUTE_GUIDANCE[attribute.key]].filter(Boolean).join(' ');
};

export const answerSchema = (request: Pick<ExtractionRequest, 'documentType' | 'attributes'>): JsonSchema => ({
  type: 'object',
  additionalProperties: false,
  required: ['documentType', 'documentTypeConfidence', 'fields'],
  properties: {
    documentType: { type: 'string', enum: [request.documentType, OTHER_DOCUMENT], description: `Use ${request.documentType} when the file is that kind of document, otherwise ${OTHER_DOCUMENT}.` },
    documentTypeConfidence: { type: 'number', description: 'Between 0 and 1.' },
    fields: {
      type: 'object',
      additionalProperties: false,
      required: request.attributes.map((_, index) => fieldName(index)),
      properties: Object.fromEntries(
        request.attributes.map((attribute, index) => [
          fieldName(index),
          {
            type: 'object',
            additionalProperties: false,
            required: ['value', 'confidence', 'page'],
            description: describe(attribute),
            properties: { value: valueSchema(attribute), confidence: { type: 'number', description: 'Between 0 and 1.' }, page: { type: ['integer', 'null'], description: 'Page the value was read from, starting at 1.' } },
          },
        ]),
      ),
    },
  },
});

export const instructionsFor = (request: Pick<ExtractionRequest, 'documentType' | 'documentLabel'>, today: string) =>
  [
    'You read Indian financial documents for FundenFlo, a loan-readiness platform.',
    'Extract only what the document shows. Never guess or invent values: use null when a value is not in the document or cannot be worked out from it.',
    'Write amounts as plain numbers in Indian rupees, without commas or currency symbols.',
    'Give each value a confidence between 0 and 1 that reflects how clearly the document supports it.',
    `Today is ${today}. The borrower uploaded this as: ${request.documentLabel}.`,
    DOCUMENT_GUIDANCE[request.documentType] ?? '',
  ]
    .filter(Boolean)
    .join('\n');

export function toFields(attributes: ExtractionAttribute[], answer: ModelAnswer): { fields: ExtractedField[]; missing: number } {
  const fields: ExtractedField[] = [];
  let missing = 0;
  for (const [index, attribute] of attributes.entries()) {
    const raw = answer.fields[fieldName(index)];
    const value = raw ? normalise(attribute, raw.value) : undefined;
    if (value === undefined) {
      missing += 1;
      continue;
    }
    const confidence = Math.min(1, Math.max(0, typeof raw?.confidence === 'number' ? raw.confidence : 0));
    fields.push({ attributeKey: attribute.key, value, confidence, page: Number.isInteger(raw?.page) ? (raw?.page ?? null) : null });
  }
  return { fields, missing };
}

function normalise(attribute: ExtractionAttribute, value: unknown): unknown {
  if (value === null || value === undefined) return undefined;
  switch (attribute.dataType) {
    case 'money':
      return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.round(value * PAISE_PER_RUPEE) : undefined;
    case 'integer':
      return typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : undefined;
    case 'decimal':
    case 'percentage':
      return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
    case 'boolean':
      return typeof value === 'boolean' ? value : undefined;
    case 'enum':
      return typeof value === 'string' && attribute.enumValues.includes(value) ? value : undefined;
    case 'date':
      return typeof value === 'string' && ISO_DATE.test(value) && !Number.isNaN(Date.parse(value)) ? value : undefined;
    default:
      return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }
}

async function readAll(body: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of body) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array));
  return Buffer.concat(chunks);
}

export class OpenAiCompatibleExtractor implements DocumentExtractor {
  private readonly logger = new Logger(OpenAiCompatibleExtractor.name);

  constructor(
    private readonly config: OpenAiCompatibleConfig,
    private readonly fetcher: typeof fetch = fetch,
    private readonly backoffMs = EXTRACTION_RETRY_BASE_MS,
  ) {}

  async extract(request: ExtractionRequest): Promise<ExtractionOutcome> {
    if (request.attributes.length === 0) {
      request.body.destroy();
      return this.review(ExtractionReason.NoFields);
    }
    const bytes = await readAll(request.body);
    const content = await this.contentFor(request, bytes);
    if (typeof content === 'string') return this.review(content);
    try {
      const answer = await this.ask(request, content);
      const { fields, missing } = toFields(request.attributes, answer);
      return {
        extractor: this.config.provider,
        model: this.config.model,
        promptVersion: EXTRACTION_PROMPT_VERSION,
        classifiedAs: answer.documentType,
        classConfidence: Math.min(1, Math.max(0, typeof answer.documentTypeConfidence === 'number' ? answer.documentTypeConfidence : 0)),
        fields,
        needsReview: missing > 0,
        reason: missing > 0 ? ExtractionReason.FieldsMissing : null,
      };
    } catch (error) {
      this.logger.warn({ err: error, documentType: request.documentType }, 'document extraction failed');
      return this.review(ExtractionReason.ProviderFailed);
    }
  }

  private review(reason: string): ExtractionOutcome {
    return { extractor: this.config.provider, model: this.config.model, promptVersion: EXTRACTION_PROMPT_VERSION, classifiedAs: null, classConfidence: null, fields: [], needsReview: true, reason };
  }

  private async contentFor(request: ExtractionRequest, bytes: Buffer): Promise<Array<Record<string, unknown>> | string> {
    if (request.mimeType === PDF_MIME) {
      if (request.password) {
        const text = await readPdfText(bytes, request.password);
        if (text.kind !== 'text') return text.kind === 'wrong_password' ? ExtractionReason.WrongPassword : ExtractionReason.PasswordRequired;
        if (text.text.replaceAll(/\s+/g, '').length < PDF_TEXT_MIN_CHARS) return ExtractionReason.EncryptedScan;
        return [{ type: 'input_text', text: `Text of the document:\n${text.text}` }];
      }
      if (await isEncryptedPdf(bytes)) return ExtractionReason.PasswordRequired;
      return [{ type: 'input_file', filename: `${request.documentType}.pdf`, file_data: `data:${PDF_MIME};base64,${bytes.toString('base64')}` }];
    }
    if (IMAGE_MIMES.has(request.mimeType)) return [{ type: 'input_image', image_url: `data:${request.mimeType};base64,${bytes.toString('base64')}`, detail: 'high' }];
    return ExtractionReason.UnsupportedType;
  }

  private async ask(request: ExtractionRequest, content: Array<Record<string, unknown>>): Promise<ModelAnswer> {
    const body = JSON.stringify({
      model: this.config.model,
      instructions: instructionsFor(request, new Date().toISOString().slice(0, 10)),
      input: [{ role: 'user', content: [...content, { type: 'input_text', text: 'Fill in every field from this document.' }] }],
      text: { format: { type: 'json_schema', name: 'document_fields', strict: true, schema: answerSchema(request) } },
      store: false,
    });
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await this.send(body);
      } catch (error) {
        if (!(error instanceof ProviderError) || !error.retryable || attempt >= EXTRACTION_RETRIES) throw error;
        await delay(this.backoffMs * 2 ** attempt);
      }
    }
  }

  private async send(body: string): Promise<ModelAnswer> {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (this.config.provider === ExtractionProvider.AzureOpenAi) headers['api-key'] = this.config.apiKey;
    else headers.authorization = `Bearer ${this.config.apiKey}`;
    let response: Response;
    try {
      response = await this.fetcher(`${this.config.baseUrl.replace(/\/$/, '')}/responses`, { method: 'POST', headers, body, signal: AbortSignal.timeout(EXTRACTION_TIMEOUT_MS) });
    } catch (error) {
      throw new ProviderError(error instanceof Error ? error.message : 'network error', true);
    }
    if (!response.ok) throw new ProviderError(`provider answered ${response.status}`, RETRYABLE_STATUS.has(response.status));
    const parsed = (await response.json()) as ResponsesBody;
    const text = parsed.output?.flatMap((item) => item.content ?? []).find((part) => part.type === 'output_text')?.text;
    if (!text) throw new ProviderError('provider returned no text', true);
    return JSON.parse(text) as ModelAnswer;
  }
}
