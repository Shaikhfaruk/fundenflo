import { Injectable, type OnModuleInit } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';

import type { ConfigResource } from '../../../common/enums/db.enums.js';
import { collectKeyedProviders } from '../../../infrastructure/discovery/keyed-providers.js';
import { CONFIG_HANDLER_METADATA } from '../domain/config.constants.js';
import type { ConfigResourceHandler } from '../domain/config.types.js';

@Injectable()
export class ConfigHandlerRegistry implements OnModuleInit {
  private readonly handlers = new Map<ConfigResource, ConfigResourceHandler>();

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly reflector: Reflector,
  ) {}

  onModuleInit() {
    for (const [resource, handler] of collectKeyedProviders<ConfigResource, ConfigResourceHandler>(this.discovery, this.reflector, CONFIG_HANDLER_METADATA)) {
      this.handlers.set(resource, handler);
    }
  }

  get(resource: ConfigResource): ConfigResourceHandler {
    const handler = this.handlers.get(resource);
    if (!handler) throw new Error(`No config handler is registered for ${resource}`);
    return handler;
  }

  resources(): ConfigResource[] {
    return [...this.handlers.keys()];
  }
}
