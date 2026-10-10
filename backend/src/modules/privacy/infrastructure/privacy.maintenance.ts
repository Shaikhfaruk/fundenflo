import { Injectable } from '@nestjs/common';

import { MaintenanceTask } from '../../../infrastructure/maintenance/maintenance-task.decorator.js';
import { DataRequestService } from '../application/data-request.service.js';

const EXPORT_PURGE_BATCH = 200;

@Injectable()
export class PrivacyMaintenance {
  constructor(private readonly requests: DataRequestService) {}

  @MaintenanceTask('privacy.expired-exports')
  dropExpiredExports(): Promise<number> {
    return this.requests.dropExpiredExports(new Date(), EXPORT_PURGE_BATCH);
  }
}
