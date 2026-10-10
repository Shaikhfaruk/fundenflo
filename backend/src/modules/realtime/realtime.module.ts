import { type DynamicModule, Module } from '@nestjs/common';

import { RealtimePublishProcessor } from '../../infrastructure/realtime/realtime-publish.processor.js';
import { SessionsModule } from '../auth/sessions.module.js';
import { RealtimeGateway } from './http/realtime.gateway.js';

@Module({})
export class RealtimeModule {
  static forRoot(options: { worker: boolean }): DynamicModule {
    return {
      module: RealtimeModule,
      imports: options.worker ? [] : [SessionsModule],
      providers: options.worker ? [RealtimePublishProcessor] : [RealtimeGateway],
    };
  }
}
