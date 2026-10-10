import type { SlaTimer } from '../../../generated/prisma/client.js';

export type SlaEntity = { type: string; id: string };

export interface SlaHandler {
  warn?(timer: SlaTimer): Promise<void>;
  breach?(timer: SlaTimer): Promise<void>;
}

export type SlaFireResult = 'warned' | 'breached' | 'skipped';
