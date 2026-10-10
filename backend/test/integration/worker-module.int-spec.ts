import 'reflect-metadata';

import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { ApplicationRefreshProcessor } from '../../src/modules/applications/infrastructure/application-refresh.processor.js';
import { DocumentScanProcessor } from '../../src/modules/documents/infrastructure/document-scan.processor.js';
import { LeadRoutingProcessor } from '../../src/modules/leads/infrastructure/lead-routing.processor.js';
import { WorkerModule } from '../../src/worker.module.js';

describe('worker process', () => {
  it('resolves every processor dependency', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [WorkerModule] }).compile();
    expect(moduleRef.get(LeadRoutingProcessor)).toBeInstanceOf(LeadRoutingProcessor);
    expect(moduleRef.get(DocumentScanProcessor)).toBeInstanceOf(DocumentScanProcessor);
    expect(moduleRef.get(ApplicationRefreshProcessor)).toBeInstanceOf(ApplicationRefreshProcessor);
    await moduleRef.close();
  });
});
