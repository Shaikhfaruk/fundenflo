import { queryOptions } from '@tanstack/react-query';

import { applicationKeys } from './applications';
import { apiRequest } from './client';
import type { AddPartyInput, Application, ApplicationParty, RequirementInput } from './types/application.types';
import type { ConsentItemInput, ConsentOtpChallenge, ConsentState } from './types/consent.types';
import type { AnswerInput, AnswersResult, ApplicationQuestions } from './types/question.types';

type JourneyBlocker = { stage: string; code: string; details: string[] };

export type NextStep = { stage: string | null; completed: string[]; blockers: JourneyBlocker[] };

export const journeyKeys = {
  nextStep: (id: string) => [...applicationKeys.detail(id), 'next-step'] as const,
  questions: (id: string, stage: string) => [...applicationKeys.detail(id), 'questions', stage] as const,
  parties: (id: string) => [...applicationKeys.detail(id), 'parties'] as const,
};

export const applicationQuery = (id: string) => queryOptions({ queryKey: applicationKeys.detail(id), queryFn: () => apiRequest<Application>('GET /applications/:id', { params: { id } }) });

export const nextStepQuery = (id: string) => queryOptions({ queryKey: journeyKeys.nextStep(id), queryFn: () => apiRequest<NextStep>('GET /applications/:id/next-step', { params: { id } }) });

export const updateRequirement = (id: string, body: RequirementInput, version: number) => apiRequest<Application>('PATCH /applications/:id/requirement', { params: { id }, body, version });

export const questionsQuery = (id: string, stage: string) =>
  queryOptions({ queryKey: journeyKeys.questions(id, stage), queryFn: () => apiRequest<ApplicationQuestions>('GET /applications/:id/questions', { params: { id }, query: { stage } }) });

export const submitAnswers = (id: string, stage: string, answers: AnswerInput[]) => apiRequest<AnswersResult>('PUT /applications/:id/answers', { params: { id }, body: { stage, answers } });

export const recordApplicationConsent = (id: string, body: { templateVersionId: string; items: ConsentItemInput[] }) =>
  apiRequest<{ consents: ConsentState[]; missingRequired: string[]; application: Application }>('POST /applications/:id/consents', { params: { id }, body, idempotent: true });

export const partiesQuery = (id: string) => queryOptions({ queryKey: journeyKeys.parties(id), queryFn: () => apiRequest<{ items: ApplicationParty[] }>('GET /applications/:id/parties', { params: { id } }) });

export const addParty = (id: string, body: AddPartyInput) => apiRequest<ApplicationParty>('POST /applications/:id/parties', { params: { id }, body, idempotent: true });

export const removeParty = (id: string, pid: string) => apiRequest<void>('DELETE /applications/:id/parties/:pid', { params: { id, pid } });

export const sendPartyConsent = (id: string, pid: string) => apiRequest<ConsentOtpChallenge>('POST /applications/:id/parties/:pid/consent-otp', { params: { id, pid } });

export const confirmPartyConsent = (id: string, pid: string, body: { challengeId: string; code: string; items: ConsentItemInput[] }) =>
  apiRequest<{ party: ApplicationParty; missingRequired: string[] }>('POST /applications/:id/parties/:pid/consent-otp/verify', { params: { id, pid }, body });
