import { describe, expect, it } from 'vitest';

import type { SubmissionEvent } from '@/lib/api/types/submission.types';
import { submissionSteps } from './submission-steps';

const event = (toStatus: string, createdAt: string): SubmissionEvent => ({ id: createdAt, type: 'status_changed', fromStatus: null, toStatus, actorType: 'user', actorContext: null, note: null, data: null, evidenceDocumentId: null, createdAt });

describe('submissionSteps', () => {
  it('marks the steps before the current status done and the current one active', () => {
    const steps = submissionSteps('sent_to_lender', [event('pending_approval', '2026-10-01'), event('approved', '2026-10-02'), event('sent_to_lender', '2026-10-03')]);
    expect(steps.map((step) => step.state)).toEqual(['done', 'done', 'active', 'pending', 'pending', 'pending']);
    expect(steps[1]?.at).toBe('2026-10-02');
  });

  it('shows a raised query as the lender review step', () => {
    const steps = submissionSteps('query_raised', [event('pending_approval', '2026-10-01'), event('approved', '2026-10-02'), event('sent_to_lender', '2026-10-03'), event('query_raised', '2026-10-04')]);
    expect(steps[3]).toEqual({ status: 'under_review', state: 'active', at: '2026-10-04' });
  });

  it('completes every step once disbursed and keeps reached steps of a closed file', () => {
    expect(submissionSteps('disbursed', []).every((step) => step.state === 'done')).toBe(true);
    const closed = submissionSteps('rejected', [event('pending_approval', '2026-10-01'), event('approved', '2026-10-02'), event('sent_to_lender', '2026-10-03'), event('rejected', '2026-10-05')]);
    expect(closed.map((step) => step.state)).toEqual(['done', 'done', 'done', 'pending', 'pending', 'pending']);
  });
});
