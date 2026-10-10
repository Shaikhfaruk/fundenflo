import { defineMachine } from '../define-machine.js';

export const ReceivableState = {
  Accrued: 'accrued',
  Invoiced: 'invoiced',
  Received: 'received',
  Reconciled: 'reconciled',
  WrittenOff: 'written_off',
} as const;

export type ReceivableState = (typeof ReceivableState)[keyof typeof ReceivableState];

export const ReceivableEvent = {
  Invoice: 'invoice',
  Receive: 'receive',
  Reconcile: 'reconcile',
  WriteOff: 'write_off',
} as const;

export type ReceivableEvent = (typeof ReceivableEvent)[keyof typeof ReceivableEvent];

export const receivableMachine = defineMachine<ReceivableState, ReceivableEvent>({
  name: 'receivable',
  states: Object.values(ReceivableState),
  transitions: {
    invoice: { from: [ReceivableState.Accrued], to: ReceivableState.Invoiced },
    receive: { from: [ReceivableState.Accrued, ReceivableState.Invoiced], to: ReceivableState.Received },
    reconcile: { from: [ReceivableState.Received], to: ReceivableState.Reconciled },
    write_off: { from: [ReceivableState.Accrued, ReceivableState.Invoiced], to: ReceivableState.WrittenOff },
  },
});

export const COLLECTED_RECEIVABLE_STATES: readonly ReceivableState[] = [ReceivableState.Received, ReceivableState.Reconciled];

export const OPEN_RECEIVABLE_STATES: readonly ReceivableState[] = [ReceivableState.Accrued, ReceivableState.Invoiced];

export const PayoutState = {
  Pending: 'pending',
  Approved: 'approved',
  Paid: 'paid',
  Reversed: 'reversed',
} as const;

export type PayoutState = (typeof PayoutState)[keyof typeof PayoutState];

export const PayoutEvent = {
  Approve: 'approve',
  Pay: 'pay',
  Reverse: 'reverse',
} as const;

export type PayoutEvent = (typeof PayoutEvent)[keyof typeof PayoutEvent];

export const payoutMachine = defineMachine<PayoutState, PayoutEvent>({
  name: 'partner_payout',
  states: Object.values(PayoutState),
  transitions: {
    approve: { from: [PayoutState.Pending], to: PayoutState.Approved },
    pay: { from: [PayoutState.Approved], to: PayoutState.Paid },
    reverse: { from: [PayoutState.Pending, PayoutState.Approved], to: PayoutState.Reversed },
  },
});

export const UNPAID_PAYOUT_STATES: readonly PayoutState[] = [PayoutState.Pending, PayoutState.Approved];
