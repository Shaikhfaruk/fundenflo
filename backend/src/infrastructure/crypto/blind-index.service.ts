import { createHmac } from 'node:crypto';
import { Injectable } from '@nestjs/common';

import { InjectConfig } from '../../config/config.constants.js';
import type { AppConfig } from '../../config/env.schema.js';
import type { BlindIndexDomain } from './crypto.constants.js';

@Injectable()
export class BlindIndex {
  private readonly key: Buffer;

  constructor(@InjectConfig() config: AppConfig) {
    this.key = Buffer.from(config.BLIND_INDEX_KEY, 'base64');
  }

  hash(domain: BlindIndexDomain, normalisedValue: string): string {
    return createHmac('sha256', this.key).update(`${domain}\u0000${normalisedValue}`, 'utf8').digest('base64url');
  }
}
