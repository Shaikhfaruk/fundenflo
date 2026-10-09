import { Injectable, type OnModuleInit, type Type } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';

import type { ConfigResource } from '../../../common/enums/db.enums.js';
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
    for (const wrapper of this.discovery.getProviders()) {
      if (!wrapper.metatype || wrapper.isNotMetatype || !wrapper.instance) continue;
      const resource = this.reflector.get<ConfigResource | undefined>(CONFIG_HANDLER_METADATA, wrapper.metatype as Type);
      if (!resource) continue;
      if (this.handlers.has(resource)) throw new Error(`More than one config handler is registered for ${resource}`);
      this.handlers.set(resource, wrapper.instance as ConfigResourceHandler);
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
