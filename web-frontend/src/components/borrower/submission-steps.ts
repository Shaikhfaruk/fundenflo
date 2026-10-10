import type { SubmissionEvent } from '@/lib/api/types/submission.types';
import { SUBMISSION_PROGRESS, SubmissionStatus } from '@/lib/constants/status.constants';

type SubmissionStepState = 'done' | 'active' | 'pending';

export type SubmissionStep = { status: string; state: SubmissionStepState; at: string | null };

const stageOf = (status: string) => (status === SubmissionStatus.QueryRaised ? SubmissionStatus.UnderReview : status);

export function submissionSteps(status: string, events: SubmissionEvent[]): SubmissionStep[] {
  const reachedAt = new Map<string, string>();
  for (const event of events) {
    if (event.toStatus && !reachedAt.has(stageOf(event.toStatus))) reachedAt.set(stageOf(event.toStatus), event.createdAt);
  }
  const furthest = SUBMISSION_PROGRESS.reduce((index, step, position) => (reachedAt.has(step) ? position : index), -1);
  const open = SUBMISSION_PROGRESS.includes(stageOf(status));
  const current = open ? SUBMISSION_PROGRESS.indexOf(stageOf(status)) : furthest;
  const last = SUBMISSION_PROGRESS.length - 1;
  const stateAt = (position: number): SubmissionStepState => {
    if (position < current) return 'done';
    if (position > current) return 'pending';
    return open && position !== last ? 'active' : 'done';
  };
  return SUBMISSION_PROGRESS.map((step, position) => ({
    status: step,
    state: stateAt(position),
    at: reachedAt.get(step) ?? null,
  }));
}
