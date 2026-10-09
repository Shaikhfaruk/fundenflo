import { Injectable } from '@nestjs/common';

import { AvailabilityReason } from '../domain/catalog.constants.js';
import type { CategoryAvailability } from './catalog.views.js';

export type AvailabilityContext = {
  segmentKey?: string;
  pincode?: string;
};

@Injectable()
export class CategoryAvailabilityService {
  async evaluate(categoryKeys: string[], _context: AvailabilityContext): Promise<Map<string, CategoryAvailability>> {
    return new Map(categoryKeys.map((key) => [key, { available: false, reason: AvailabilityReason.NoVerifiedLenderRoute }]));
  }
}
