import type { Readable } from 'node:stream';

import type { AntivirusScanner, ScanVerdict } from './antivirus.port.js';

export const EICAR_ENGINE = 'eicar-test';

export const EICAR_SIGNATURE = 'Eicar-Test-Signature';

export const EICAR_TEST_STRING = ['X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR', '-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*'].join('');

export class EicarScanner implements AntivirusScanner {
  async scan(body: Readable): Promise<ScanVerdict> {
    const marker = Buffer.from(EICAR_TEST_STRING, 'latin1');
    let tail = Buffer.alloc(0);
    for await (const chunk of body) {
      const window = Buffer.concat([tail, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array)]);
      if (window.includes(marker)) {
        body.destroy();
        return { clean: false, signature: EICAR_SIGNATURE, engine: EICAR_ENGINE };
      }
      tail = window.subarray(Math.max(0, window.length - marker.length + 1));
    }
    return { clean: true, signature: null, engine: EICAR_ENGINE };
  }
}
