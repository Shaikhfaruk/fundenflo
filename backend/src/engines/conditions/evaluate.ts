import {
  type Condition,
  type ConditionTrace,
  type FactLookup,
  type FactValue,
  type LeafCondition,
  LeafOperator,
  Outcome,
  type RangeValue,
  type Scalar,
} from './condition.types.js';

export const isRange = (value: unknown): value is RangeValue =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value) && 'min' in (value as object) && 'max' in (value as object);

const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const invert = (outcome: Outcome): Outcome => (outcome === Outcome.Pass ? Outcome.Fail : outcome === Outcome.Fail ? Outcome.Pass : Outcome.Unknown);

const fromBoolean = (value: boolean): Outcome => (value ? Outcome.Pass : Outcome.Fail);

function compareRange(range: RangeValue, op: LeafOperator, threshold: number): Outcome {
  const { min, max } = range;
  switch (op) {
    case LeafOperator.Gte:
      if (min !== null && min >= threshold) return Outcome.Pass;
      if (max !== null && max < threshold) return Outcome.Fail;
      return Outcome.Unknown;
    case LeafOperator.Gt:
      if (min !== null && min > threshold) return Outcome.Pass;
      if (max !== null && max <= threshold) return Outcome.Fail;
      return Outcome.Unknown;
    case LeafOperator.Lte:
      if (max !== null && max <= threshold) return Outcome.Pass;
      if (min !== null && min > threshold) return Outcome.Fail;
      return Outcome.Unknown;
    case LeafOperator.Lt:
      if (max !== null && max < threshold) return Outcome.Pass;
      if (min !== null && min >= threshold) return Outcome.Fail;
      return Outcome.Unknown;
    case LeafOperator.Eq:
      if (min === threshold && max === threshold) return Outcome.Pass;
      if ((min !== null && threshold < min) || (max !== null && threshold > max)) return Outcome.Fail;
      return Outcome.Unknown;
    default:
      return Outcome.Unknown;
  }
}

function compareScalar(actual: Scalar, op: LeafOperator, expected: unknown): Outcome {
  if (op === LeafOperator.Eq) return fromBoolean(actual === expected);
  const comparable = (isNumber(actual) && isNumber(expected)) || (typeof actual === 'string' && typeof expected === 'string');
  if (!comparable) return Outcome.Unknown;
  const left = actual;
  const right = expected;
  switch (op) {
    case LeafOperator.Gt:
      return fromBoolean(left > right);
    case LeafOperator.Gte:
      return fromBoolean(left >= right);
    case LeafOperator.Lt:
      return fromBoolean(left < right);
    case LeafOperator.Lte:
      return fromBoolean(left <= right);
    default:
      return Outcome.Unknown;
  }
}

function between(actual: FactValue, bounds: unknown): Outcome {
  if (!Array.isArray(bounds) || bounds.length !== 2 || !isNumber(bounds[0]) || !isNumber(bounds[1])) return Outcome.Unknown;
  const [low, high] = bounds as [number, number];
  if (isNumber(actual)) return fromBoolean(actual >= low && actual <= high);
  if (isRange(actual)) {
    const within = actual.min !== null && actual.max !== null && actual.min >= low && actual.max <= high;
    if (within) return Outcome.Pass;
    const disjoint = (actual.max !== null && actual.max < low) || (actual.min !== null && actual.min > high);
    return disjoint ? Outcome.Fail : Outcome.Unknown;
  }
  return Outcome.Unknown;
}

function membership(actual: FactValue, list: unknown): Outcome {
  if (!Array.isArray(list)) return Outcome.Unknown;
  if (Array.isArray(actual)) return fromBoolean(actual.some((item) => list.includes(item)));
  if (isRange(actual)) {
    if (actual.min !== null && actual.min === actual.max) return fromBoolean(list.includes(actual.min));
    return Outcome.Unknown;
  }
  return fromBoolean(list.includes(actual));
}

function contains(actual: FactValue, expected: unknown): Outcome {
  if (Array.isArray(actual)) return fromBoolean(actual.includes(expected as Scalar));
  if (typeof actual === 'string' && typeof expected === 'string') return fromBoolean(actual.toLowerCase().includes(expected.toLowerCase()));
  return Outcome.Unknown;
}

function matches(actual: FactValue, pattern: unknown): Outcome {
  if (typeof actual !== 'string' || typeof pattern !== 'string') return Outcome.Unknown;
  try {
    return fromBoolean(new RegExp(pattern, 'u').test(actual));
  } catch {
    return Outcome.Unknown;
  }
}

function evaluateLeaf(condition: LeafCondition, actual: FactValue | undefined): Outcome {
  const missing = actual === undefined || actual === null;
  if (condition.op === LeafOperator.Exists) return fromBoolean(!missing);
  if (condition.op === LeafOperator.NotExists) return fromBoolean(missing);
  if (missing) return Outcome.Unknown;

  switch (condition.op) {
    case LeafOperator.Eq:
    case LeafOperator.Gt:
    case LeafOperator.Gte:
    case LeafOperator.Lt:
    case LeafOperator.Lte:
      if (isRange(actual)) return isNumber(condition.value) ? compareRange(actual, condition.op, condition.value) : Outcome.Unknown;
      if (Array.isArray(actual)) return condition.op === LeafOperator.Eq ? fromBoolean(actual.length === 1 && actual[0] === condition.value) : Outcome.Unknown;
      return compareScalar(actual, condition.op, condition.value);
    case LeafOperator.Neq:
      return invert(evaluateLeaf({ ...condition, op: LeafOperator.Eq }, actual));
    case LeafOperator.Between:
      return between(actual, condition.value);
    case LeafOperator.In:
      return membership(actual, condition.value);
    case LeafOperator.NotIn:
      return invert(membership(actual, condition.value));
    case LeafOperator.Contains:
      return contains(actual, condition.value);
    case LeafOperator.Matches:
      return matches(actual, condition.value);
    default:
      return Outcome.Unknown;
  }
}

const combineAll = (outcomes: Outcome[]): Outcome =>
  outcomes.includes(Outcome.Fail) ? Outcome.Fail : outcomes.includes(Outcome.Unknown) ? Outcome.Unknown : Outcome.Pass;

const combineAny = (outcomes: Outcome[]): Outcome =>
  outcomes.includes(Outcome.Pass) ? Outcome.Pass : outcomes.includes(Outcome.Unknown) ? Outcome.Unknown : Outcome.Fail;

export function evaluateCondition(condition: Condition, lookup: FactLookup): ConditionTrace {
  if ('all' in condition) {
    const children = condition.all.map((child) => evaluateCondition(child, lookup));
    return { kind: 'all', outcome: combineAll(children.map((child) => child.outcome)), children };
  }
  if ('any' in condition) {
    const children = condition.any.map((child) => evaluateCondition(child, lookup));
    return { kind: 'any', outcome: combineAny(children.map((child) => child.outcome)), children };
  }
  if ('not' in condition) {
    const child = evaluateCondition(condition.not, lookup);
    return { kind: 'not', outcome: invert(child.outcome), children: [child] };
  }
  const actual = lookup(condition.attr);
  const outcome = evaluateLeaf(condition, actual);
  const message = outcome === Outcome.Pass ? (condition.pass ?? null) : outcome === Outcome.Fail ? (condition.fail ?? null) : null;
  return { kind: 'leaf', outcome, attr: condition.attr, op: condition.op, expected: condition.value, actual, message };
}

export function collectMessages(trace: ConditionTrace, outcome: Outcome): string[] {
  if (trace.kind === 'leaf') return trace.outcome === outcome && trace.message ? [trace.message] : [];
  return trace.children.flatMap((child) => collectMessages(child, outcome));
}

export function referencedAttributes(condition: Condition): string[] {
  if ('all' in condition) return [...new Set(condition.all.flatMap(referencedAttributes))];
  if ('any' in condition) return [...new Set(condition.any.flatMap(referencedAttributes))];
  if ('not' in condition) return referencedAttributes(condition.not);
  return [condition.attr];
}
