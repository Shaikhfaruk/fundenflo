import { Module } from '@nestjs/common';

import { ActivityService } from './application/activity.service.js';
import { ActivityRepository } from './infrastructure/activity.repository.js';

@Module({
  providers: [ActivityRepository, ActivityService],
  exports: [ActivityService],
})
export class ActivitiesModule {}
