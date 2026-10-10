import { applyDecorators, Injectable, type OnModuleInit, SetMetadata } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';

import { collectKeyedProviders } from '../../../infrastructure/discovery/keyed-providers.js';
import { PARTY_MERGE_PARTICIPANT_METADATA, type PartyMergeParticipantKey } from '../domain/party.constants.js';
import type { PartyMergeParticipant } from '../domain/party-merge.types.js';

export const PartyMergeParticipantFor = (key: PartyMergeParticipantKey) => applyDecorators(Injectable(), SetMetadata(PARTY_MERGE_PARTICIPANT_METADATA, key));

@Injectable()
export class PartyMergeRegistry implements OnModuleInit {
  private participants: Array<[PartyMergeParticipantKey, PartyMergeParticipant]> = [];

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly reflector: Reflector,
  ) {}

  onModuleInit() {
    this.participants = [...collectKeyedProviders<PartyMergeParticipantKey, PartyMergeParticipant>(this.discovery, this.reflector, PARTY_MERGE_PARTICIPANT_METADATA)].toSorted(([left], [right]) => left.localeCompare(right));
  }

  all(): ReadonlyArray<[PartyMergeParticipantKey, PartyMergeParticipant]> {
    return this.participants;
  }
}
