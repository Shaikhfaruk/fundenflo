export const PAISE_PER_RUPEE = 100n;

export function paiseToNumber(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) {
    throw new RangeError(`Paise value ${value} cannot be represented exactly in JSON`);
  }
  return Number(value);
}

export function paiseFromNumber(value: number): bigint {
  if (!Number.isSafeInteger(value)) throw new RangeError(`Paise value ${value} must be a safe integer`);
  return BigInt(value);
}

export const rupeesToPaise = (rupees: number | bigint): bigint => BigInt(rupees) * PAISE_PER_RUPEE;
