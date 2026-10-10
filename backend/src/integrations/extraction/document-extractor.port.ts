import { Inject } from '@nestjs/common';
import type { Readable } from 'node:stream';

export const DOCUMENT_EXTRACTOR = Symbol('DOCUMENT_EXTRACTOR');

export const InjectDocumentExtractor = () => Inject(DOCUMENT_EXTRACTOR);

export type ExtractionRequest = {
  documentType: string;
  extractorKey: string | null;
  producesAttributes: string[];
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
