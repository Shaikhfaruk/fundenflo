import { SetMetadata } from '@nestjs/common';

export const MAINTENANCE_TASK_METADATA = 'maintenance:task';

export const MaintenanceTask = (name: string) => SetMetadata(MAINTENANCE_TASK_METADATA, name);
