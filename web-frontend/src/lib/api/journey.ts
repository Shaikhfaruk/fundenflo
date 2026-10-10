import { queryOptions } from '@tanstack/react-query';

import { applicationKeys } from './applications';
import { apiRequest } from './client';
import type { Application } from './types/application.types';

type JourneyBlocker = { stage: string; code: string; details: string[] };

export type NextStep = { stage: string | null; completed: string[]; blockers: JourneyBlocker[] };

export const applicationQuery = (id: string) => queryOptions({ queryKey: applicationKeys.detail(id), queryFn: () => apiRequest<Application>('GET /applications/:id', { params: { id } }) });

export const nextStepQuery = (id: string) => queryOptions({ queryKey: [...applicationKeys.detail(id), 'next-step'] as const, queryFn: () => apiRequest<NextStep>('GET /applications/:id/next-step', { params: { id } }) });
