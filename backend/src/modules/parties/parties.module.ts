import { Module } from '@nestjs/common';

import { ContactCodec } from './application/contact-codec.service.js';
import { PartyResolver } from './application/party-resolver.service.js';
import { PartyService } from './application/party.service.js';
import { PartyRepository } from './infrastructure/party.repository.js';

@Module({
  providers: [PartyRepository, ContactCodec, PartyService, PartyResolver],
  exports: [ContactCodec, PartyService, PartyResolver],
})
export class PartiesModule {}
