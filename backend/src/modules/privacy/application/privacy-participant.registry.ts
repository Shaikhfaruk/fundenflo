import { applyDecorators, Injectable, type OnModuleInit, SetMetadata } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';

import { collectKeyedProviders } from '../../../infrastructure/discovery/keyed-providers.js';
import { ERASURE_ORDER, PRIVACY_PARTICIPANT_METADATA, type PrivacySection } from '../domain/privacy.constants.js';
import type { PrivacyParticipant } from '../domain/privacy-participant.types.js';

export const PrivacyParticipantFor = (section: PrivacySection) => applyDecorators(Injectable(), SetMetadata(PRIVACY_PARTICIPANT_METADATA, section));

@Injectable()
export class PrivacyParticipantRegistry implements OnModuleInit {
  private participants: Array<[PrivacySection, PrivacyParticipant]> = [];

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly reflector: Reflector,
  ) {}

  onModuleInit() {
    const found = collectKeyedProviders<PrivacySection, PrivacyParticipant>(this.discovery, this.reflector, PRIVACY_PARTICIPANT_METADATA);
    this.participants = ERASURE_ORDER.flatMap((section) => {
      const participant = found.get(section);
      return participant ? [[section, participant] as [PrivacySection, PrivacyParticipant]] : [];
    });
  }

  ordered(): ReadonlyArray<[PrivacySection, PrivacyParticipant]> {
    return this.participants;
  }
}
