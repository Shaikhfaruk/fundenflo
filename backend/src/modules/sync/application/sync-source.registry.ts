import { applyDecorators, Injectable, type OnModuleInit, SetMetadata } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';

import { collectKeyedProviders } from '../../../infrastructure/discovery/keyed-providers.js';
import { SYNC_SOURCE_METADATA, type SyncSource, type SyncType } from '../domain/sync.types.js';

export const SyncSourceFor = (type: SyncType) => applyDecorators(Injectable(), SetMetadata(SYNC_SOURCE_METADATA, type));

@Injectable()
export class SyncSourceRegistry implements OnModuleInit {
  private sources = new Map<SyncType, SyncSource>();

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly reflector: Reflector,
  ) {}

  onModuleInit() {
    this.sources = collectKeyedProviders<SyncType, SyncSource>(this.discovery, this.reflector, SYNC_SOURCE_METADATA);
  }

  get(type: SyncType): SyncSource | undefined {
    return this.sources.get(type);
  }

  types(): SyncType[] {
    return [...this.sources.keys()].toSorted((left, right) => left.localeCompare(right));
  }
}
