import { Injectable } from '@nestjs/common';

import { QueueName } from '../../../infrastructure/queue/queue-names.js';
import { QueueRegistry } from '../../../infrastructure/queue/queue-registry.service.js';
import { ROUTE_JOB } from '../domain/lead-routing.constants.js';

@Injectable()
export class LeadRoutingQueue {
  constructor(private readonly queues: QueueRegistry) {}

  async route(leadId: string) {
    await this.queues.get(QueueName.LeadsRoute).add(ROUTE_JOB, { leadId }, { jobId: `route-${leadId}-${Date.now()}` });
  }
}
