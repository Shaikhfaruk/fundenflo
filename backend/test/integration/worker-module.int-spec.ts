import 'reflect-metadata';

import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { ApplicationRefreshProcessor } from '../../src/modules/applications/infrastructure/application-refresh.processor.js';
import { AnalysisRunProcessor } from '../../src/modules/assessments/infrastructure/analysis-run.processor.js';
import { DocumentScanProcessor } from '../../src/modules/documents/infrastructure/document-scan.processor.js';
import { LeadRoutingProcessor } from '../../src/modules/leads/infrastructure/lead-routing.processor.js';
import { SubscriptionDeliveryProcessor } from '../../src/modules/subscriptions/infrastructure/subscription-delivery.processor.js';
import { WorkerModule } from '../../src/worker.module.js';

describe('worker process', () => {
  it('resolves every processor dependency', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [WorkerModule] }).compile();
    expect(moduleRef.get(LeadRoutingProcessor)).toBeInstanceOf(LeadRoutingProcessor);
    expect(moduleRef.get(DocumentScanProcessor)).toBeInstanceOf(DocumentScanProcessor);
    expect(moduleRef.get(ApplicationRefreshProcessor)).toBeInstanceOf(ApplicationRefreshProcessor);
    expect(moduleRef.get(AnalysisRunProcessor)).toBeInstanceOf(AnalysisRunProcessor);
    expect(moduleRef.get(SubscriptionDeliveryProcessor)).toBeInstanceOf(SubscriptionDeliveryProcessor);
    await moduleRef.close();
  });
});
