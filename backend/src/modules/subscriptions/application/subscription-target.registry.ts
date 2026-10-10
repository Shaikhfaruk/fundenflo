import { applyDecorators, Injectable, type OnModuleInit, SetMetadata } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';

import { collectKeyedProviders } from '../../../infrastructure/discovery/keyed-providers.js';
import { SUBSCRIPTION_TARGET_METADATA, type SubscriptionEvent } from '../domain/subscription.constants.js';
import type { SubscriptionTarget } from '../domain/subscription-target.types.js';

export const SubscriptionTargetFor = (event: SubscriptionEvent) => applyDecorators(Injectable(), SetMetadata(SUBSCRIPTION_TARGET_METADATA, event));

@Injectable()
export class SubscriptionTargetRegistry implements OnModuleInit {
  private targets = new Map<SubscriptionEvent, SubscriptionTarget>();

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly reflector: Reflector,
  ) {}

  onModuleInit() {
    this.targets = collectKeyedProviders<SubscriptionEvent, SubscriptionTarget>(this.discovery, this.reflector, SUBSCRIPTION_TARGET_METADATA);
  }

  get(event: SubscriptionEvent): SubscriptionTarget | undefined {
    return this.targets.get(event);
  }
}
