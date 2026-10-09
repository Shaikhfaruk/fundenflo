import { describe, expect, it } from 'vitest';

import type { AttributeSpec, Condition, FactValue } from './condition.types.js';
import { collectMessages, evaluateCondition, referencedAttributes } from './evaluate.js';
import { validateCondition } from './validate.js';

const facts = (values: Record<string, FactValue>) => (attr: string) => values[attr];

const outcome = (condition: Condition, values: Record<string, FactValue>) => evaluateCondition(condition, facts(values)).outcome;

describe('evaluateCondition — scalar facts', () => {
  it('compares numbers, strings and booleans', () => {
    expect(outcome({ attr: 'vintage', op: 'gte', value: 24 }, { vintage: 36 })).toBe('pass');
    expect(outcome({ attr: 'vintage', op: 'gte', value: 24 }, { vintage: 12 })).toBe('fail');
    expect(outcome({ attr: 'gst', op: 'eq', value: true }, { gst: true })).toBe('pass');
    expect(outcome({ attr: 'city', op: 'neq', value: 'Pune' }, { city: 'Pune' })).toBe('fail');
    expect(outcome({ attr: 'date', op: 'lt', value: '2026-01-01' }, { date: '2025-12-31' })).toBe('pass');
  });

  it('handles membership, between, contains and matches', () => {
    expect(outcome({ attr: 'state', op: 'in', value: ['06', '07', '09'] }, { state: '07' })).toBe('pass');
    expect(outcome({ attr: 'state', op: 'not_in', value: ['06', '07'] }, { state: '07' })).toBe('fail');
    expect(outcome({ attr: 'amount', op: 'between', value: [100, 200] }, { amount: 150 })).toBe('pass');
    expect(outcome({ attr: 'languages', op: 'contains', value: 'hi' }, { languages: ['en', 'hi'] })).toBe('pass');
    expect(outcome({ attr: 'name', op: 'matches', value: '^Sharma' }, { name: 'Sharma Autocraft' })).toBe('pass');
  });

  it('is unknown when a fact is missing, except for existence checks', () => {
    expect(outcome({ attr: 'vintage', op: 'gte', value: 24 }, {})).toBe('unknown');
    expect(outcome({ attr: 'vintage', op: 'exists' }, {})).toBe('fail');
    expect(outcome({ attr: 'vintage', op: 'not_exists' }, { vintage: null })).toBe('pass');
  });

  it('is unknown for incomparable types instead of failing', () => {
    expect(outcome({ attr: 'vintage', op: 'gte', value: 24 }, { vintage: 'old' })).toBe('unknown');
  });
});

const turnover = (min: number | null, max: number | null) => ({ turnover: { min, max } });

describe('evaluateCondition — range facts from bucketed answers', () => {

  it('passes when the whole range satisfies the rule', () => {
    expect(outcome({ attr: 'turnover', op: 'gte', value: 1_000 }, turnover(2_500, 9_999))).toBe('pass');
    expect(outcome({ attr: 'turnover', op: 'lte', value: 10_000 }, turnover(2_500, 9_999))).toBe('pass');
  });

  it('fails when the whole range violates the rule', () => {
    expect(outcome({ attr: 'turnover', op: 'gte', value: 10_000 }, turnover(2_500, 9_999))).toBe('fail');
    expect(outcome({ attr: 'turnover', op: 'lt', value: 2_500 }, turnover(2_500, 9_999))).toBe('fail');
  });

  it('is unknown when the range straddles the threshold', () => {
    expect(outcome({ attr: 'turnover', op: 'gte', value: 5_000 }, turnover(2_500, 9_999))).toBe('unknown');
    expect(outcome({ attr: 'turnover', op: 'eq', value: 5_000 }, turnover(2_500, 9_999))).toBe('unknown');
  });

  it('treats open-ended ranges correctly', () => {
    expect(outcome({ attr: 'turnover', op: 'gte', value: 10_000 }, turnover(10_000, null))).toBe('pass');
    expect(outcome({ attr: 'turnover', op: 'lt', value: 5_000 }, turnover(10_000, null))).toBe('fail');
    expect(outcome({ attr: 'turnover', op: 'between', value: [10_000, 20_000] }, turnover(10_000, null))).toBe('unknown');
    expect(outcome({ attr: 'turnover', op: 'between', value: [0, 5_000] }, turnover(10_000, null))).toBe('fail');
  });
});

describe('evaluateCondition — groups use three-valued logic', () => {
  const pass = { attr: 'a', op: 'eq', value: 1 } as const;
  const fail = { attr: 'a', op: 'eq', value: 2 } as const;
  const unknown = { attr: 'missing', op: 'eq', value: 1 } as const;
  const values = { a: 1 };

  it('all: any fail wins, then unknown, then pass', () => {
    expect(outcome({ all: [pass, unknown, fail] }, values)).toBe('fail');
    expect(outcome({ all: [pass, unknown] }, values)).toBe('unknown');
    expect(outcome({ all: [pass, pass] }, values)).toBe('pass');
  });

  it('any: any pass wins, then unknown, then fail', () => {
    expect(outcome({ any: [fail, unknown, pass] }, values)).toBe('pass');
    expect(outcome({ any: [fail, unknown] }, values)).toBe('unknown');
    expect(outcome({ any: [fail, fail] }, values)).toBe('fail');
  });

  it('not keeps unknown as unknown', () => {
    expect(outcome({ not: pass }, values)).toBe('fail');
    expect(outcome({ not: unknown }, values)).toBe('unknown');
  });
});

describe('traces and helpers', () => {
  const rule: Condition = {
    all: [
      { attr: 'vintage', op: 'gte', value: 24, pass: 'Business vintage fits their policy', fail: 'They need at least 2 years of history' },
      { attr: 'gst', op: 'eq', value: true, pass: 'You are GST registered', fail: 'They lend only to GST-registered businesses' },
    ],
  };

  it('collects pass and fail messages from the trace', () => {
    const trace = evaluateCondition(rule, facts({ vintage: 36, gst: false }));
    expect(trace.outcome).toBe('fail');
    expect(collectMessages(trace, 'pass')).toEqual(['Business vintage fits their policy']);
    expect(collectMessages(trace, 'fail')).toEqual(['They lend only to GST-registered businesses']);
  });

  it('lists referenced attributes once', () => {
    expect(referencedAttributes({ any: [rule, { attr: 'gst', op: 'exists' }] })).toEqual(['vintage', 'gst']);
  });
});

describe('validateCondition', () => {
  const dictionary: Record<string, AttributeSpec> = {
    vintage: { dataType: 'integer' },
    gst: { dataType: 'boolean' },
    employment: { dataType: 'enum', enumValues: ['salaried', 'self_employed'] },
    name: { dataType: 'string' },
  };
  const resolve = (attr: string) => dictionary[attr];

  it('accepts a well-formed condition', () => {
    expect(validateCondition({ all: [{ attr: 'vintage', op: 'between', value: [12, 60] }, { attr: 'employment', op: 'in', value: ['salaried'] }] }, resolve)).toEqual([]);
  });

  it('reports unknown attributes, wrong operators and wrong values with paths', () => {
    const issues = validateCondition(
      {
        all: [
          { attr: 'turnover', op: 'gte', value: 1 },
          { attr: 'gst', op: 'gte', value: true },
          { attr: 'employment', op: 'eq', value: 'retired' },
          { attr: 'vintage', op: 'between', value: [60, 12] },
          { attr: 'name', op: 'matches', value: '(' },
          { attr: 'vintage', op: 'exists', value: 1 },
        ],
      },
      resolve,
    );
    expect(issues.map((issue) => issue.path)).toEqual(['$.all[0].attr', '$.all[1].op', '$.all[2].value', '$.all[3].value', '$.all[4].value', '$.all[5].value']);
  });

  it('rejects ambiguous groups, empty groups and excessive nesting', () => {
    expect(validateCondition({ all: [], any: [] }, resolve)[0]?.message).toBe('use exactly one of all, any or not');
    expect(validateCondition({ any: [] }, resolve)[0]?.message).toBe('any needs at least one condition');
    let deep: Condition = { attr: 'gst', op: 'exists' };
    for (let level = 0; level < 12; level += 1) deep = { not: deep };
    expect(validateCondition(deep, resolve).some((issue) => issue.message.startsWith('nesting deeper'))).toBe(true);
  });
});
