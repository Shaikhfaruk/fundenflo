export type AmountRange = { minPaise: number | null; maxPaise: number | null };

const UNIT_RUPEES: ReadonlyArray<[RegExp, number]> = [
  [/^(cr|crs|crore|crores)$/, 10_000_000],
  [/^(l|lac|lacs|lakh|lakhs|lk)$/, 100_000],
  [/^(m|mn|million|millions)$/, 1_000_000],
  [/^(k|thousand|thousands)$/, 1_000],
];

const UPPER_BOUND = /^(up ?to|upto|below|under|less than|max|maximum|till)\b/;

const LOWER_BOUND = /^(above|over|more than|min|minimum|at least|from)\b/;

const NUMBER_WITH_UNIT = /(\d+(?:\.\d+)?)\s*([a-z]+)?/g;

const unitMultiplier = (unit: string | undefined): number | null => {
  if (!unit) return 1;
  return UNIT_RUPEES.find(([pattern]) => pattern.test(unit))?.[1] ?? null;
};

const toPaise = (rupees: number) => Math.round(rupees * 100);

export function parseAmountText(text: string): AmountRange | null {
  const cleaned = text
    .toLowerCase()
    .replace(/(rs\.?|inr|₹)/g, ' ')
    .replace(/(\d),(?=\d)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return null;
  const parts = [...cleaned.matchAll(NUMBER_WITH_UNIT)].map((match) => ({ value: Number(match[1]), unit: match[2] }));
  if (parts.length === 0 || parts.length > 2) return null;
  const units = parts.map((part) => unitMultiplier(part.unit));
  if (units.some((unit) => unit === null)) return null;
  const sharedUnit = units.at(-1) ?? 1;
  const amounts = parts.map((part, index) => {
    const own = part.unit ? (units[index] ?? 1) : null;
    return part.value * (own ?? sharedUnit);
  });
  const [first, second] = amounts;
  if (first === undefined || !Number.isFinite(first)) return null;
  if (second !== undefined) {
    const [low, high] = first <= second ? [first, second] : [second, first];
    return { minPaise: toPaise(low), maxPaise: toPaise(high) };
  }
  if (UPPER_BOUND.test(cleaned)) return { minPaise: null, maxPaise: toPaise(first) };
  if (LOWER_BOUND.test(cleaned)) return { minPaise: toPaise(first), maxPaise: null };
  return { minPaise: toPaise(first), maxPaise: toPaise(first) };
}
