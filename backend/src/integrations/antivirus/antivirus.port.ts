import { Inject } from '@nestjs/common';
import type { Readable } from 'node:stream';

export const ANTIVIRUS_SCANNER = Symbol('ANTIVIRUS_SCANNER');

export const InjectAntivirusScanner = () => Inject(ANTIVIRUS_SCANNER);

export type ScanVerdict = {
  clean: boolean;
  signature: string | null;
  engine: string;
};

export interface AntivirusScanner {
  scan(body: Readable): Promise<ScanVerdict>;
}
