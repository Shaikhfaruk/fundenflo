import { type AttributeSpec, type Condition, type ConditionIssue, LeafOperator } from './condition.types.js';
import { CONDITION_LIMITS } from './conditions.constants.js';

const NUMERIC_TYPES = new Set<AttributeSpec['dataType']>(['integer', 'decimal', 'money', 'percentage']);
const ORDERED_TYPES = new Set<AttributeSpec['dataType']>([...NUMERIC_TYPES, 'date']);
const VALUELESS = new Set<LeafOperator>([LeafOperator.Exists, LeafOperator.NotExists]);
const ORDER_OPS = new Set<LeafOperator>([LeafOperator.Gt, LeafOperator.Gte, LeafOperator.Lt, LeafOperator.Lte]);
const LIST_OPS = new Set<LeafOperator>([LeafOperator.In, LeafOperator.NotIn]);
const OPERATORS = new Set<string>(Object.values(LeafOperator));

type Counter = { leaves: number };

function valueMatchesType(value: unknown, spec: AttributeSpec): boolean {
  if (NUMERIC_TYPES.has(spec.dataType)) return typeof value === 'number' && Number.isFinite(value);
  if (spec.dataType === 'boolean') return typeof value === 'boolean';
  if (spec.dataType === 'date') return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
  if (spec.dataType === 'enum') return typeof value === 'string' && (!spec.enumValues || spec.enumValues.includes(value));
  return typeof value === 'string';
}

function validateLeaf(condition: Record<string, unknown>, path: string, resolve: (attr: string) => AttributeSpec | undefined, issues: ConditionIssue[]) {
  const attr = condition.attr;
  const op = condition.op;
  if (typeof attr !== 'string' || attr.length === 0) {
    issues.push({ path: `${path}.attr`, message: 'attr is required' });
    return;
  }
  if (typeof op !== 'string' || !OPERATORS.has(op)) {
    issues.push({ path: `${path}.op`, message: `op must be one of ${[...OPERATORS].join(', ')}` });
    return;
  }
  const spec = resolve(attr);
  if (!spec) {
    issues.push({ path: `${path}.attr`, message: `unknown or inactive attribute ${attr}` });
    return;
  }
  const operator = op as LeafOperator;
  const value = condition.value;
  if (VALUELESS.has(operator)) {
    if (value !== undefined) issues.push({ path: `${path}.value`, message: `${operator} takes no value` });
    return;
  }
  if (ORDER_OPS.has(operator)) {
    if (!ORDERED_TYPES.has(spec.dataType)) issues.push({ path: `${path}.op`, message: `${operator} needs a numeric or date attribute` });
    else if (!valueMatchesType(value, spec)) issues.push({ path: `${path}.value`, message: `value must be a ${spec.dataType}` });
    return;
  }
  if (operator === LeafOperator.Between) {
    if (!NUMERIC_TYPES.has(spec.dataType)) issues.push({ path: `${path}.op`, message: 'between needs a numeric attribute' });
    else if (!Array.isArray(value) || value.length !== 2 || !value.every((bound) => valueMatchesType(bound, spec)) || (value[0] as number) > (value[1] as number)) {
      issues.push({ path: `${path}.value`, message: 'value must be [low, high] with low <= high' });
    }
    return;
  }
  if (LIST_OPS.has(operator)) {
    if (!Array.isArray(value) || value.length === 0 || value.length > CONDITION_LIMITS.maxListItems || !value.every((item) => valueMatchesType(item, spec))) {
      issues.push({ path: `${path}.value`, message: `value must be a non-empty list of ${spec.dataType} values` });
    }
    return;
  }
  if (operator === LeafOperator.Matches) {
    if (spec.dataType !== 'string') issues.push({ path: `${path}.op`, message: 'matches needs a string attribute' });
    else if (typeof value !== 'string' || value.length > CONDITION_LIMITS.maxPatternLength) issues.push({ path: `${path}.value`, message: 'value must be a pattern string' });
    else if (!isValidPattern(value)) issues.push({ path: `${path}.value`, message: 'value is not a valid pattern' });
    return;
  }
  if (operator === LeafOperator.Contains) {
    if (typeof value !== 'string' && typeof value !== 'number') issues.push({ path: `${path}.value`, message: 'value must be a string or number' });
    return;
  }
  if (!valueMatchesType(value, spec)) issues.push({ path: `${path}.value`, message: `value must be a ${spec.dataType}` });
}

function walk(node: unknown, path: string, depth: number, resolve: (attr: string) => AttributeSpec | undefined, issues: ConditionIssue[], counter: Counter) {
  if (depth > CONDITION_LIMITS.maxDepth) {
    issues.push({ path, message: `nesting deeper than ${CONDITION_LIMITS.maxDepth}` });
    return;
  }
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    issues.push({ path, message: 'condition must be an object' });
    return;
  }
  const record = node as Record<string, unknown>;
  const groupKeys = ['all', 'any', 'not'].filter((key) => key in record);
  if (groupKeys.length > 1) {
    issues.push({ path, message: 'use exactly one of all, any or not' });
    return;
  }
  const [group] = groupKeys;
  if (group === 'not') {
    walk(record.not, `${path}.not`, depth + 1, resolve, issues, counter);
    return;
  }
  if (group === 'all' || group === 'any') {
    const children = record[group];
    if (!Array.isArray(children) || children.length === 0) {
      issues.push({ path: `${path}.${group}`, message: `${group} needs at least one condition` });
      return;
    }
    children.forEach((child, index) => walk(child, `${path}.${group}[${index}]`, depth + 1, resolve, issues, counter));
    return;
  }
  counter.leaves += 1;
  if (counter.leaves > CONDITION_LIMITS.maxLeaves) {
    if (counter.leaves === CONDITION_LIMITS.maxLeaves + 1) issues.push({ path, message: `more than ${CONDITION_LIMITS.maxLeaves} conditions` });
    return;
  }
  validateLeaf(record, path, resolve, issues);
}

export function validateCondition(condition: unknown, resolve: (attr: string) => AttributeSpec | undefined): ConditionIssue[] {
  const issues: ConditionIssue[] = [];
  walk(condition, '$', 1, resolve, issues, { leaves: 0 });
  return issues;
}

export const isCondition = (value: unknown, resolve: (attr: string) => AttributeSpec | undefined): value is Condition =>
  validateCondition(value, resolve).length === 0;

function isValidPattern(pattern: string): boolean {
  try {
    return RegExp(pattern, 'u') instanceof RegExp;
  } catch {
    return false;
  }
}
