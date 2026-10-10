import 'reflect-metadata';

import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { ApplicationRefreshProcessor } from '../../src/modules/applications/infrastructure/application-refresh.processor.js';
import { AnalysisRunProcessor } from '../../src/modules/assessments/infrastructure/analysis-run.processor.js';
import { DocumentExtractProcessor } from '../../src/modules/documents/infrastructure/document-extract.processor.js';
import { DocumentScanProcessor } from '../../src/modules/documents/infrastructure/document-scan.processor.js';
import { LeadReferralProcessor } from '../../src/modules/leads/infrastructure/lead-referral.processor.js';
import { LeadRoutingProcessor } from '../../src/modules/leads/infrastructure/lead-routing.processor.js';
import { MatchingRunProcessor } from '../../src/modules/matching/infrastructure/matching-run.processor.js';
import { SubmissionDeliverProcessor } from '../../src/modules/submissions/infrastructure/submission-deliver.processor.js';
import { SubmissionNotifyProcessor } from '../../src/modules/submissions/infrastructure/submission-notify.processor.js';
import { SubmissionSyncProcessor } from '../../src/modules/submissions/infrastructure/submission-sync.processor.js';
import { SubscriptionDeliveryProcessor } from '../../src/modules/subscriptions/infrastructure/subscription-delivery.processor.js';
import { WorkerModule } from '../../src/worker.module.js';

describe('worker process', () => {
  it('resolves every processor dependency', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [WorkerModule] }).compile();
    expect(moduleRef.get(LeadRoutingProcessor)).toBeInstanceOf(LeadRoutingProcessor);
    expect(moduleRef.get(LeadReferralProcessor)).toBeInstanceOf(LeadReferralProcessor);
    expect(moduleRef.get(DocumentScanProcessor)).toBeInstanceOf(DocumentScanProcessor);
    expect(moduleRef.get(DocumentExtractProcessor)).toBeInstanceOf(DocumentExtractProcessor);
    expect(moduleRef.get(ApplicationRefreshProcessor)).toBeInstanceOf(ApplicationRefreshProcessor);
    expect(moduleRef.get(AnalysisRunProcessor)).toBeInstanceOf(AnalysisRunProcessor);
    expect(moduleRef.get(SubscriptionDeliveryProcessor)).toBeInstanceOf(SubscriptionDeliveryProcessor);
    expect(moduleRef.get(MatchingRunProcessor)).toBeInstanceOf(MatchingRunProcessor);
    expect(moduleRef.get(SubmissionDeliverProcessor)).toBeInstanceOf(SubmissionDeliverProcessor);
    expect(moduleRef.get(SubmissionNotifyProcessor)).toBeInstanceOf(SubmissionNotifyProcessor);
    expect(moduleRef.get(SubmissionSyncProcessor)).toBeInstanceOf(SubmissionSyncProcessor);
    await moduleRef.close();
  });
});
