import { defineMachine } from '../define-machine.js';

export const DataRequestState = {
  Received: 'received',
  InProgress: 'in_progress',
  Completed: 'completed',
  Rejected: 'rejected',
} as const;

export type DataRequestState = (typeof DataRequestState)[keyof typeof DataRequestState];

export const DataRequestEvent = {
  Start: 'start',
  Complete: 'complete',
  Reject: 'reject',
} as const;

export type DataRequestEvent = (typeof DataRequestEvent)[keyof typeof DataRequestEvent];

export const dataRequestMachine = defineMachine<DataRequestState, DataRequestEvent>({
  name: 'data_subject_request',
  states: Object.values(DataRequestState),
  transitions: {
    start: { from: [DataRequestState.Received], to: DataRequestState.InProgress },
    complete: { from: [DataRequestState.Received, DataRequestState.InProgress], to: DataRequestState.Completed },
    reject: { from: [DataRequestState.Received, DataRequestState.InProgress], to: DataRequestState.Rejected },
  },
});

export const OPEN_DATA_REQUEST_STATES: readonly DataRequestState[] = [DataRequestState.Received, DataRequestState.InProgress];
