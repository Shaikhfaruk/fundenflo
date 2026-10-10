import { Module } from '@nestjs/common';

import { APP_CONFIG } from '../../config/config.constants.js';
import type { AppConfig } from '../../config/env.schema.js';
import { DOCUMENT_EXTRACTOR } from './document-extractor.port.js';
import { ExtractionProvider } from './extraction.constants.js';
import { ManualExtractor } from './manual.extractor.js';
import { OpenAiCompatibleExtractor } from './openai-compatible.extractor.js';

export const extractorFor = (config: AppConfig) => {
  if (config.EXTRACTION_DRIVER === ExtractionProvider.OpenAi && config.OPENAI_API_KEY && config.EXTRACTION_MODEL) {
    return new OpenAiCompatibleExtractor({ provider: ExtractionProvider.OpenAi, baseUrl: config.OPENAI_BASE_URL, apiKey: config.OPENAI_API_KEY, model: config.EXTRACTION_MODEL });
  }
  const deployment = config.AZURE_OPENAI_DEPLOYMENT ?? config.EXTRACTION_MODEL;
  if (config.EXTRACTION_DRIVER === ExtractionProvider.AzureOpenAi && config.AZURE_OPENAI_ENDPOINT && config.AZURE_OPENAI_API_KEY && deployment) {
    return new OpenAiCompatibleExtractor({ provider: ExtractionProvider.AzureOpenAi, baseUrl: `${config.AZURE_OPENAI_ENDPOINT.replace(/\/$/, '')}/openai/v1`, apiKey: config.AZURE_OPENAI_API_KEY, model: deployment });
  }
  return new ManualExtractor();
};

@Module({
  providers: [{ provide: DOCUMENT_EXTRACTOR, inject: [APP_CONFIG], useFactory: extractorFor }],
  exports: [DOCUMENT_EXTRACTOR],
})
export class ExtractionModule {}
