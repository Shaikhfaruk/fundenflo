import { defineMachine } from '../define-machine.js';

export const AssignmentState = {
  Offered: 'offered',
  Accepted: 'accepted',
  Working: 'working',
  Completed: 'completed',
  Declined: 'declined',
  Expired: 'expired',
  Revoked: 'revoked',
  Returned: 'returned',
} as const;

export type AssignmentState = (typeof AssignmentState)[keyof typeof AssignmentState];

export const AssignmentEvent = {
  Accept: 'accept',
  StartWork: 'start_work',
  Complete: 'complete',
  Decline: 'decline',
  Expire: 'expire',
  Revoke: 'revoke',
  Return: 'return',
} as const;

export type AssignmentEvent = (typeof AssignmentEvent)[keyof typeof AssignmentEvent];

const { Offered, Accepted, Working, Completed, Declined, Expired, Revoked, Returned } = AssignmentState;

export const assignmentMachine = defineMachine<AssignmentState, AssignmentEvent>({
  name: 'lead_assignment',
  states: Object.values(AssignmentState),
  transitions: {
    accept: { from: [Offered], to: Accepted },
    start_work: { from: [Accepted], to: Working },
    complete: { from: [Accepted, Working], to: Completed },
    decline: { from: [Offered], to: Declined },
    expire: { from: [Offered], to: Expired },
    revoke: { from: [Offered, Accepted, Working], to: Revoked },
    return: { from: [Accepted, Working], to: Returned },
  },
});

export const ACTIVE_ASSIGNMENT_STATES: readonly AssignmentState[] = [Offered, Accepted, Working];
