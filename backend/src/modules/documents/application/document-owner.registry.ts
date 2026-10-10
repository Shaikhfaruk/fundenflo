import { applyDecorators, Injectable, type OnModuleInit, SetMetadata } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';

import { collectKeyedProviders } from '../../../infrastructure/discovery/keyed-providers.js';
import { DOCUMENT_OWNER_METADATA, type DocumentOwnerKind } from '../domain/document.constants.js';
import type { DocumentOwner } from '../domain/document-owner.types.js';

export const DocumentOwnerFor = (kind: DocumentOwnerKind) => applyDecorators(Injectable(), SetMetadata(DOCUMENT_OWNER_METADATA, kind));

@Injectable()
export class DocumentOwnerRegistry implements OnModuleInit {
  private owners = new Map<DocumentOwnerKind, DocumentOwner>();

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly reflector: Reflector,
  ) {}

  onModuleInit() {
    this.owners = collectKeyedProviders<DocumentOwnerKind, DocumentOwner>(this.discovery, this.reflector, DOCUMENT_OWNER_METADATA);
  }

  get(kind: DocumentOwnerKind): DocumentOwner {
    const owner = this.owners.get(kind);
    if (!owner) throw new Error(`No document owner is registered for ${kind}`);
    return owner;
  }
}
