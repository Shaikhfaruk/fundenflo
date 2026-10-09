import type { TransactionHost } from '@nestjs-cls/transactional';

import type { PrismaTx } from '../database/database.types.js';
import type { CacheService } from './cache.service.js';

export async function runThenInvalidate<T>(txHost: TransactionHost<PrismaTx>, cache: CacheService, tags: string[], work: () => Promise<T>): Promise<T> {
  const result = await txHost.withTransaction(work);
  await cache.invalidate(...tags);
  return result;
}
