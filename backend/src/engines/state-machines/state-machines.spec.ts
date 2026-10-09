import { describe, expect, it } from 'vitest';

import { defineMachine, TransitionError } from './define-machine.js';
import { configVersionMachine } from './machines/config-version.machine.js';

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
