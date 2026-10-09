import { applyDecorators, Injectable, type OnModuleInit, SetMetadata } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';

import { collectKeyedProviders } from '../../../infrastructure/discovery/keyed-providers.js';
import { SLA_HANDLER_METADATA } from '../domain/sla.constants.js';
import type { SlaHandler } from '../domain/sla.types.js';

export const SlaHandlerFor = (kind: string) => applyDecorators(Injectable(), SetMetadata(SLA_HANDLER_METADATA, kind));

@Injectable()
export class SlaHandlerRegistry implements OnModuleInit {
  private handlers = new Map<string, SlaHandler>();

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly reflector: Reflector,
  ) {}

  onModuleInit() {
    this.handlers = collectKeyedProviders<string, SlaHandler>(this.discovery, this.reflector, SLA_HANDLER_METADATA);
  }

  get(kind: string): SlaHandler {
    const handler = this.handlers.get(kind);
    if (!handler) throw new Error(`No SLA handler is registered for ${kind}`);
    return handler;
  }
}
