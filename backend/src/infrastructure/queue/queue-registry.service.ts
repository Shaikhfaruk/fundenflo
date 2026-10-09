import { getQueueToken } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { Queue } from 'bullmq';

import type { QueueName } from './queue-names.js';

@Injectable()
export class QueueRegistry {
  constructor(private readonly moduleRef: ModuleRef) {}

  get(name: QueueName): Queue {
    return this.moduleRef.get<Queue>(getQueueToken(name), { strict: false });
  }
}
