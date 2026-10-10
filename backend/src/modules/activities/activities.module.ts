import { Module } from '@nestjs/common';

import { SlaModule } from '../sla/sla.module.js';
import { ActivityService } from './application/activity.service.js';
import { FollowUpDueSlaHandler } from './application/follow-up-sla.handler.js';
import { FollowUpSyncSource } from './application/follow-up-sync.source.js';
import { ActivityRepository } from './infrastructure/activity.repository.js';

@Module({
  imports: [SlaModule],
  providers: [ActivityRepository, ActivityService, FollowUpDueSlaHandler, FollowUpSyncSource],
  exports: [ActivityService],
})
export class ActivitiesModule {}
