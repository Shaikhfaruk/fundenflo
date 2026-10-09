import { describe, expect, it } from 'vitest';

import { defineMachine, TransitionError } from './define-machine.js';
import { configVersionMachine } from './machines/config-version.machine.js';
import { importBatchMachine } from './machines/import-batch.machine.js';
import { leadMachine } from './machines/lead.machine.js';
import { organizationMachine } from './machines/organization.machine.js';
import { partnerVerificationMachine } from './machines/partner-verification.machine.js';

describe('defineMachine', () => {
  const door = defineMachine<'open' | 'closed' | 'locked', 'close' | 'open' | 'lock'>({
    name: 'door',
    states: ['open', 'closed', 'locked'],
    transitions: { close: { from: ['open'], to: 'closed' }, open: { from: ['closed'], to: 'open' }, lock: { from: ['closed'], to: 'locked' } },
  });

  it('moves along allowed transitions and lists available events', () => {
    expect(door.next('open', 'close')).toBe('closed');
    expect(door.events('closed')).toEqual(['open', 'lock']);
    expect(door.events('locked')).toEqual([]);
  });

  it('throws a TransitionError naming the machine, state and event', () => {
    expect(() => door.next('locked', 'open')).toThrow(TransitionError);
    expect(() => door.next('locked', 'open')).toThrow('door: cannot open from locked');
  });
});

describe('configVersionMachine', () => {
  it('follows draft → in_review → approved → published → retired', () => {
    expect(configVersionMachine.next('draft', 'submit')).toBe('in_review');
    expect(configVersionMachine.next('in_review', 'approve')).toBe('approved');
    expect(configVersionMachine.next('approved', 'publish')).toBe('published');
    expect(configVersionMachine.next('published', 'retire')).toBe('retired');
  });

  it('sends rejected versions back to draft and never edits or republishes frozen ones', () => {
    expect(configVersionMachine.next('in_review', 'reject')).toBe('draft');
    expect(configVersionMachine.can('in_review', 'edit')).toBe(false);
    expect(configVersionMachine.can('draft', 'publish')).toBe(false);
    expect(configVersionMachine.can('retired', 'publish')).toBe(false);
    expect(configVersionMachine.events('retired')).toEqual([]);
  });
});

describe('partnerVerificationMachine', () => {
  it('needs a recommendation before a final decision and keeps decisions final', () => {
    expect(partnerVerificationMachine.can('pending', 'approve')).toBe(false);
    expect(partnerVerificationMachine.next('pending', 'recommend')).toBe('in_review');
    expect(partnerVerificationMachine.next('in_review', 'approve')).toBe('verified');
    expect(partnerVerificationMachine.next('in_review', 'reject')).toBe('rejected');
    expect(partnerVerificationMachine.events('verified')).toEqual([]);
  });
});

describe('organizationMachine', () => {
  it('activates once, suspends and reinstates, and closes from any open state', () => {
    expect(organizationMachine.next('pending', 'activate')).toBe('active');
    expect(organizationMachine.next('active', 'suspend')).toBe('suspended');
    expect(organizationMachine.next('suspended', 'reinstate')).toBe('active');
    expect(organizationMachine.can('active', 'activate')).toBe(false);
    expect(organizationMachine.events('closed')).toEqual([]);
  });
});

describe('leadMachine', () => {
  it('qualifies, works and closes leads, and keeps closed leads closed', () => {
    expect(leadMachine.next('new', 'qualify')).toBe('qualified');
    expect(leadMachine.next('qualified', 'start')).toBe('in_progress');
    expect(leadMachine.next('in_progress', 'recycle')).toBe('new');
    expect(leadMachine.next('on_hold', 'reopen')).toBe('new');
    expect(leadMachine.next('converted', 'win')).toBe('won');
    expect(leadMachine.can('in_progress', 'disqualify')).toBe(false);
    expect(leadMachine.events('won')).toEqual([]);
    expect(leadMachine.events('unqualified')).toEqual([]);
  });
});

describe('importBatchMachine', () => {
  it('goes upload → map → validate → commit → undo, resumes stuck commits and re-maps only after a failed validation', () => {
    expect(importBatchMachine.next('awaiting_upload', 'inspect')).toBe('uploaded');
    expect(importBatchMachine.next('uploaded', 'map')).toBe('mapped');
    expect(importBatchMachine.next('mapped', 'validate')).toBe('validating');
    expect(importBatchMachine.next('validating', 'finish_validation')).toBe('validated');
    expect(importBatchMachine.next('validated', 'commit')).toBe('committing');
    expect(importBatchMachine.next('committing', 'commit')).toBe('committing');
    expect(importBatchMachine.can('committing', 'fail')).toBe(false);
    expect(importBatchMachine.next('validating', 'fail')).toBe('failed');
    expect(importBatchMachine.next('failed', 'map')).toBe('mapped');
    expect(importBatchMachine.can('committed', 'commit')).toBe(false);
    expect(importBatchMachine.next('committed', 'undo')).toBe('undoing');
  });
});
