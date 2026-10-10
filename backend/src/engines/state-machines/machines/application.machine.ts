import { defineMachine } from '../define-machine.js';

export const ApplicationState = {
  Draft: 'draft',
  PreScreened: 'pre_screened',
  DocumentsPending: 'documents_pending',
  Assessed: 'assessed',
  ReadyForSubmission: 'ready_for_submission',
  Submitted: 'submitted',
  ClosedWon: 'closed_won',
  ClosedLost: 'closed_lost',
  Withdrawn: 'withdrawn',
  Expired: 'expired',
} as const;

export type ApplicationState = (typeof ApplicationState)[keyof typeof ApplicationState];

export const ApplicationEvent = {
  PreScreen: 'pre_screen',
  RequestDocuments: 'request_documents',
  Assess: 'assess',
  MarkReady: 'mark_ready',
  Submit: 'submit',
  Win: 'win',
  Lose: 'lose',
  Withdraw: 'withdraw',
  Expire: 'expire',
  Reopen: 'reopen',
} as const;

export type ApplicationEvent = (typeof ApplicationEvent)[keyof typeof ApplicationEvent];

const { Draft, PreScreened, DocumentsPending, Assessed, ReadyForSubmission, Submitted, ClosedWon, ClosedLost, Withdrawn, Expired } = ApplicationState;

const OPEN = [Draft, PreScreened, DocumentsPending, Assessed, ReadyForSubmission];

export const applicationMachine = defineMachine<ApplicationState, ApplicationEvent>({
  name: 'loan_application',
  states: Object.values(ApplicationState),
  transitions: {
    pre_screen: { from: [Draft], to: PreScreened },
    request_documents: { from: [PreScreened], to: DocumentsPending },
    assess: { from: [DocumentsPending], to: Assessed },
    mark_ready: { from: [Assessed], to: ReadyForSubmission },
    submit: { from: [ReadyForSubmission], to: Submitted },
    win: { from: [Submitted], to: ClosedWon },
    lose: { from: [Submitted], to: ClosedLost },
    withdraw: { from: [...OPEN, Submitted], to: Withdrawn },
    expire: { from: OPEN, to: Expired },
    reopen: { from: [Assessed, ReadyForSubmission], to: DocumentsPending },
  },
});

export const PRE_SUBMISSION_APPLICATION_STATES: readonly ApplicationState[] = OPEN;

export const OPEN_APPLICATION_STATES: readonly ApplicationState[] = [...OPEN, Submitted];

export const APPLIED_APPLICATION_STATES: readonly ApplicationState[] = [Submitted, ClosedWon, ClosedLost];

export const SUBMITTABLE_APPLICATION_STATES: readonly ApplicationState[] = [Assessed, ReadyForSubmission, Submitted];

export const CLOSED_APPLICATION_STATES: readonly ApplicationState[] = [ClosedWon, ClosedLost, Withdrawn, Expired];
