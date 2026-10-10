import { Module } from '@nestjs/common';

import { PAN_VERIFIER } from './pan-verifier.port.js';
import { StubPanVerifier } from './stub-pan.verifier.js';

@Module({
  providers: [{ provide: PAN_VERIFIER, useClass: StubPanVerifier }],
  exports: [PAN_VERIFIER],
})
export class KycModule {}
