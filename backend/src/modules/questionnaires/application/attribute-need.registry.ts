import { applyDecorators, Injectable, type OnModuleInit, SetMetadata } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';

import type { AttributeNeed } from '../../../engines/questionnaire/progressive.js';
import { collectKeyedProviders } from '../../../infrastructure/discovery/keyed-providers.js';
import { ATTRIBUTE_NEED_SOURCE_METADATA, type AttributeNeedContext, type AttributeNeedSource } from '../domain/attribute-need.types.js';

export const AttributeNeedSourceFor = (key: string) => applyDecorators(Injectable(), SetMetadata(ATTRIBUTE_NEED_SOURCE_METADATA, key));

@Injectable()
export class AttributeNeedRegistry implements OnModuleInit {
  private sources: AttributeNeedSource[] = [];

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly reflector: Reflector,
  ) {}

  onModuleInit() {
    this.sources = [...collectKeyedProviders<string, AttributeNeedSource>(this.discovery, this.reflector, ATTRIBUTE_NEED_SOURCE_METADATA).values()];
  }

  async needs(context: AttributeNeedContext): Promise<AttributeNeed[]> {
    const all: AttributeNeed[] = [];
    for (const source of this.sources) all.push(...(await source.needs(context)));
    return all;
  }

  get empty() {
    return this.sources.length === 0;
  }
}
