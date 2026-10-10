import { Inject } from '@nestjs/common';
import type { Readable } from 'node:stream';

export const DOCUMENT_EXTRACTOR = Symbol('DOCUMENT_EXTRACTOR');

export const InjectDocumentExtractor = () => Inject(DOCUMENT_EXTRACTOR);

export type ExtractionAttribute = { key: string; label: string; dataType: string; unit: string | null; enumValues: string[] };

export type ExtractionRequest = {
  documentType: string;
  documentLabel: string;
  extractorKey: string | null;
  attributes: ExtractionAttribute[];
  mimeType: string;
  body: Readable;
  password: string | null;
};

export type ExtractedField = { attributeKey: string; value: unknown; confidence: number; page: number | null };

export type ExtractionOutcome = {
  extractor: string;
  model: string | null;
  promptVersion: string | null;
  classifiedAs: string | null;
  classConfidence: number | null;
  fields: ExtractedField[];
  needsReview: boolean;
  reason: string | null;
};

export interface DocumentExtractor {
  extract(request: ExtractionRequest): Promise<ExtractionOutcome>;
}

export const ExtractionReason = {
  ProviderFailed: 'extractor_failed',
  PasswordRequired: 'password_required',
  WrongPassword: 'wrong_password',
  EncryptedScan: 'encrypted_scan',
  UnsupportedType: 'unsupported_type',
  FieldsMissing: 'fields_missing',
  NoFields: 'no_fields_configured',
} as const;
