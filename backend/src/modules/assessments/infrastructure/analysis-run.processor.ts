import { Processor } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { ClsService } from 'nestjs-cls';

import type { RequestContextStore } from '../../../common/context/request-context.service.js';
import type { AnalysisStatus } from '../../../common/enums/db.enums.js';
import type { DomainEventEnvelope } from '../../../common/events/domain-event.js';
import { ContextualProcessor } from '../../../infrastructure/queue/contextual.processor.js';
import { QueueName } from '../../../infrastructure/queue/queue-names.js';
import { AnalysisService } from '../application/analysis.service.js';

@Processor(QueueName.AnalysisRun)
export class AnalysisRunProcessor extends ContextualProcessor<DomainEventEnvelope, { status: AnalysisStatus | null }> {
  constructor(
    cls: ClsService<RequestContextStore>,
    private readonly analyses: AnalysisService,
  ) {
    super(cls);
  }

  protected async handle(job: Job<DomainEventEnvelope>): Promise<{ status: AnalysisStatus | null }> {
    const { analysisId } = (job.data.payload ?? {}) as { analysisId?: string };
    return { status: analysisId ? await this.analyses.run(analysisId) : null };
  }
}
