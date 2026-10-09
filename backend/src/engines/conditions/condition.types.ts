export const LeafOperator = {
  Eq: 'eq',
  Neq: 'neq',
  In: 'in',
  NotIn: 'not_in',
  Gt: 'gt',
  Gte: 'gte',
  Lt: 'lt',
  Lte: 'lte',
  Between: 'between',
  Exists: 'exists',
  NotExists: 'not_exists',
  Contains: 'contains',
  Matches: 'matches',
} as const;

export type LeafOperator = (typeof LeafOperator)[keyof typeof LeafOperator];

export const Outcome = {
  Pass: 'pass',
  Fail: 'fail',
  Unknown: 'unknown',
} as const;

export type Outcome = (typeof Outcome)[keyof typeof Outcome];

export type Scalar = number | string | boolean;

export type RangeValue = { min: number | null; max: number | null };

export type FactValue = Scalar | RangeValue | Scalar[] | null;

export type LeafCondition = {
  attr: string;
  op: LeafOperator;
  value?: unknown;
  pass?: string;
  fail?: string;
};

export type AllCondition = { all: Condition[] };
export type AnyCondition = { any: Condition[] };
export type NotCondition = { not: Condition };

export type Condition = AllCondition | AnyCondition | NotCondition | LeafCondition;

export type FactLookup = (attr: string) => FactValue | undefined;

export type LeafTrace = {
  kind: 'leaf';
  outcome: Outcome;
  attr: string;
  op: LeafOperator;
  expected: unknown;
  actual: FactValue | undefined;
  message: string | null;
};

export type GroupTrace = {
  kind: 'all' | 'any' | 'not';
  outcome: Outcome;
  children: ConditionTrace[];
};

export type ConditionTrace = LeafTrace | GroupTrace;

export type AttributeSpec = {
  dataType: 'integer' | 'decimal' | 'money' | 'boolean' | 'enum' | 'string' | 'date' | 'percentage';
  enumValues?: string[];
};

export type ConditionIssue = { path: string; message: string };
