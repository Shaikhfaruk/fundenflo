import { Global, Module } from '@nestjs/common';

import { RequestContext } from './request-context.service.js';

@Global()
@Module({
  providers: [RequestContext],
  exports: [RequestContext],
})
export class RequestContextModule {}
