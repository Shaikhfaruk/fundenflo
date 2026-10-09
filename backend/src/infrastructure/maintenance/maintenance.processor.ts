import { Processor } from '@nestjs/bullmq';
import { Logger, type OnModuleInit } from '@nestjs/common';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { ClsService } from 'nestjs-cls';

import type { RequestContextStore } from '../../common/context/request-context.service.js';
import { ContextualProcessor } from '../queue/contextual.processor.js';
import { QueueName } from '../queue/queue-names.js';
import { MAINTENANCE_TASK_METADATA } from './maintenance-task.decorator.js';

type Task = { name: string; run: () => Promise<number> };

@Processor(QueueName.MaintenanceCleanup, { concurrency: 1 })
export class MaintenanceProcessor extends ContextualProcessor<unknown, Record<string, number>> implements OnModuleInit {
  private readonly logger = new Logger(MaintenanceProcessor.name);
  private tasks: Task[] = [];

  constructor(
    cls: ClsService<RequestContextStore>,
    private readonly discovery: DiscoveryService,
    private readonly scanner: MetadataScanner,
    private readonly reflector: Reflector,
  ) {
    super(cls);
  }

  onModuleInit() {
    this.tasks = this.discovery.getProviders().flatMap((wrapper) => {
      const instance = wrapper.instance as Record<string, unknown> | undefined;
      if (!instance || typeof instance !== 'object' || wrapper.isNotMetatype) return [];
      const prototype = Object.getPrototypeOf(instance) as object;
      return this.scanner.getAllMethodNames(prototype).flatMap((method) => {
        const handler = instance[method];
        if (typeof handler !== 'function') return [];
        const name = this.reflector.get<string | undefined>(MAINTENANCE_TASK_METADATA, handler);
        return name ? [{ name, run: () => (handler as () => Promise<number>).call(instance) }] : [];
      });
    });
  }

  protected async handle(): Promise<Record<string, number>> {
    const results: Record<string, number> = {};
    for (const task of this.tasks) {
      try {
        results[task.name] = await task.run();
      } catch (error) {
        this.logger.error({ err: error, task: task.name }, 'Maintenance task failed');
        results[task.name] = -1;
      }
    }
    this.logger.log({ results }, 'Maintenance completed');
    return results;
  }
}
