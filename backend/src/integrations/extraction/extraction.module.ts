import { Module } from '@nestjs/common';

import { DOCUMENT_EXTRACTOR } from './document-extractor.port.js';
import { ManualExtractor } from './manual.extractor.js';

@Module({
  providers: [{ provide: DOCUMENT_EXTRACTOR, useClass: ManualExtractor }],
  exports: [DOCUMENT_EXTRACTOR],
})
export class ExtractionModule {}
