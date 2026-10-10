import { createHash } from 'node:crypto';

import { PAN_PATTERN, type PanQuery, type PanResult, PanStatus, type PanVerifier } from './pan-verifier.port.js';

export const STUB_PAN_PROVIDER = 'stub';

export const STUB_PAN_NOT_FOUND_SUFFIX = 'Z';

export class StubPanVerifier implements PanVerifier {
  async verify(query: PanQuery): Promise<PanResult> {
    const reference = `stub-${createHash('sha256').update(query.pan).digest('hex').slice(0, 12)}`;
    if (!PAN_PATTERN.test(query.pan)) return { status: PanStatus.Invalid, nameOnRecord: null, provider: STUB_PAN_PROVIDER, reference };
    if (query.pan.endsWith(STUB_PAN_NOT_FOUND_SUFFIX)) return { status: PanStatus.NotFound, nameOnRecord: null, provider: STUB_PAN_PROVIDER, reference };
    return { status: PanStatus.Valid, nameOnRecord: query.name.trim().toUpperCase(), provider: STUB_PAN_PROVIDER, reference };
  }
}
