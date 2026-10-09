import { defineMachine } from '../define-machine.js';

export const OrganizationState = {
  Pending: 'pending',
  Active: 'active',
  Suspended: 'suspended',
  Closed: 'closed',
} as const;

export type OrganizationState = (typeof OrganizationState)[keyof typeof OrganizationState];

export const OrganizationEvent = {
  Activate: 'activate',
  Suspend: 'suspend',
  Reinstate: 'reinstate',
  Close: 'close',
} as const;

export type OrganizationEvent = (typeof OrganizationEvent)[keyof typeof OrganizationEvent];

const { Pending, Active, Suspended, Closed } = OrganizationState;

export const organizationMachine = defineMachine<OrganizationState, OrganizationEvent>({
  name: 'organization',
  states: Object.values(OrganizationState),
  transitions: {
    activate: { from: [Pending], to: Active },
    suspend: { from: [Active], to: Suspended },
    reinstate: { from: [Suspended], to: Active },
    close: { from: [Pending, Active, Suspended], to: Closed },
  },
});
