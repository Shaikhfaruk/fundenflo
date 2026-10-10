import { defineMachine } from '../define-machine.js';

export const LenderState = {
  Onboarding: 'onboarding',
  Active: 'active',
  Paused: 'paused',
  Offboarded: 'offboarded',
} as const;

export type LenderState = (typeof LenderState)[keyof typeof LenderState];

export const LenderEvent = {
  Activate: 'activate',
  Pause: 'pause',
  Offboard: 'offboard',
} as const;

export type LenderEvent = (typeof LenderEvent)[keyof typeof LenderEvent];

export const lenderMachine = defineMachine<LenderState, LenderEvent>({
  name: 'lender',
  states: Object.values(LenderState),
  transitions: {
    activate: { from: [LenderState.Onboarding, LenderState.Paused], to: LenderState.Active },
    pause: { from: [LenderState.Active], to: LenderState.Paused },
    offboard: { from: [LenderState.Onboarding, LenderState.Active, LenderState.Paused], to: LenderState.Offboarded },
  },
});

export const LENDER_EVENT_FOR_STATUS: Partial<Record<LenderState, LenderEvent>> = {
  [LenderState.Active]: LenderEvent.Activate,
  [LenderState.Paused]: LenderEvent.Pause,
  [LenderState.Offboarded]: LenderEvent.Offboard,
};

export const AgreementState = {
  Draft: 'draft',
  Active: 'active',
  Expired: 'expired',
  Terminated: 'terminated',
} as const;

export type AgreementState = (typeof AgreementState)[keyof typeof AgreementState];

export const AgreementEvent = {
  Activate: 'activate',
  Expire: 'expire',
  Terminate: 'terminate',
} as const;

export type AgreementEvent = (typeof AgreementEvent)[keyof typeof AgreementEvent];

export const agreementMachine = defineMachine<AgreementState, AgreementEvent>({
  name: 'lender_agreement',
  states: Object.values(AgreementState),
  transitions: {
    activate: { from: [AgreementState.Draft], to: AgreementState.Active },
    expire: { from: [AgreementState.Active], to: AgreementState.Expired },
    terminate: { from: [AgreementState.Draft, AgreementState.Active], to: AgreementState.Terminated },
  },
});

export const AGREEMENT_EVENT_FOR_STATUS: Partial<Record<AgreementState, AgreementEvent>> = {
  [AgreementState.Active]: AgreementEvent.Activate,
  [AgreementState.Expired]: AgreementEvent.Expire,
  [AgreementState.Terminated]: AgreementEvent.Terminate,
};
