import type { DocumentExtractor, ExtractionOutcome, ExtractionRequest } from './document-extractor.port.js';

export const MANUAL_EXTRACTOR = 'manual';

export const MANUAL_KEYING_REASON = 'manual_keying';

export class ManualExtractor implements DocumentExtractor {
  async extract(request: ExtractionRequest): Promise<ExtractionOutcome> {
    request.body.destroy();
    return { extractor: MANUAL_EXTRACTOR, model: null, promptVersion: null, classifiedAs: null, classConfidence: null, fields: [], needsReview: true, reason: MANUAL_KEYING_REASON };
  }
}
