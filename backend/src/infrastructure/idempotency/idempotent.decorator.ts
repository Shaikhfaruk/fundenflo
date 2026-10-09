import { UseInterceptors } from '@nestjs/common';

import { IdempotencyInterceptor } from './idempotency.interceptor.js';

export const Idempotent = () => UseInterceptors(IdempotencyInterceptor);
