import { applyDecorators, Injectable, type OnModuleInit, SetMetadata } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';

import type { ImportKind } from '../../../common/enums/db.enums.js';
import { collectKeyedProviders } from '../../../infrastructure/discovery/keyed-providers.js';
import { IMPORT_HANDLER_METADATA } from '../domain/import.constants.js';
import type { ImportHandler } from '../domain/import.types.js';

export const ImportHandlerFor = (kind: ImportKind) => applyDecorators(Injectable(), SetMetadata(IMPORT_HANDLER_METADATA, kind));

@Injectable()
export class ImportHandlerRegistry implements OnModuleInit {
  private handlers = new Map<ImportKind, ImportHandler>();

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly reflector: Reflector,
  ) {}

  onModuleInit() {
    this.handlers = collectKeyedProviders<ImportKind, ImportHandler>(this.discovery, this.reflector, IMPORT_HANDLER_METADATA);
  }

  get(kind: ImportKind): ImportHandler {
    const handler = this.handlers.get(kind);
    if (!handler) throw new Error(`No import handler is registered for ${kind}`);
    return handler;
  }
}
