import { Global, Module } from '@nestjs/common';

import { AbilityFactory } from './application/ability.factory.js';
import { PoliciesGuard } from './http/policies.guard.js';

@Global()
@Module({
  providers: [AbilityFactory, PoliciesGuard],
  exports: [AbilityFactory, PoliciesGuard],
})
export class AuthorizationModule {}
