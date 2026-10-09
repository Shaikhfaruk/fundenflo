import { defineMachine } from '../define-machine.js';

export const LeadState = {
  New: 'new',
  Qualified: 'qualified',
  InProgress: 'in_progress',
  OnHold: 'on_hold',
  Converted: 'converted',
  Won: 'won',
  Lost: 'lost',
  Unqualified: 'unqualified',
} as const;

export type LeadState = (typeof LeadState)[keyof typeof LeadState];

export const LeadEvent = {
  Qualify: 'qualify',
  Start: 'start',
  Hold: 'hold',
  Reopen: 'reopen',
  Recycle: 'recycle',
  Disqualify: 'disqualify',
  Convert: 'convert',
  Win: 'win',
  Lose: 'lose',
} as const;

export type LeadEvent = (typeof LeadEvent)[keyof typeof LeadEvent];

const { New, Qualified, InProgress, OnHold, Converted, Won, Lost, Unqualified } = LeadState;

export const leadMachine = defineMachine<LeadState, LeadEvent>({
  name: 'lead',
  states: Object.values(LeadState),
  transitions: {
    qualify: { from: [New], to: Qualified },
    start: { from: [Qualified], to: InProgress },
    hold: { from: [New, Qualified, InProgress], to: OnHold },
    reopen: { from: [OnHold], to: New },
    recycle: { from: [Qualified, InProgress, OnHold], to: New },
    disqualify: { from: [New, Qualified, OnHold], to: Unqualified },
    convert: { from: [New, Qualified, InProgress], to: Converted },
    win: { from: [Converted], to: Won },
    lose: { from: [New, Qualified, InProgress, OnHold, Converted], to: Lost },
  },
});

export const OPEN_LEAD_STATES: readonly LeadState[] = [New, Qualified, InProgress, OnHold];
