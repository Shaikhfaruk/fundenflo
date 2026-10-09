import { describe, expect, it } from 'vitest';

import { parseAmountText } from './parse-amount.js';

const lakh = (value: number) => value * 100_000 * 100;

describe('parseAmountText', () => {
  it('reads plain numbers with Indian digit grouping and currency marks', () => {
    expect(parseAmountText('5,00,000')).toEqual({ minPaise: lakh(5), maxPaise: lakh(5) });
    expect(parseAmountText('Rs. 750000')).toEqual({ minPaise: lakh(7.5), maxPaise: lakh(7.5) });
  });

  it('reads lakh, crore, thousand and million units', () => {
    expect(parseAmountText('₹5 lakh')).toEqual({ minPaise: lakh(5), maxPaise: lakh(5) });
    expect(parseAmountText('1.5 cr')).toEqual({ minPaise: lakh(150), maxPaise: lakh(150) });
    expect(parseAmountText('50k')).toEqual({ minPaise: 5_000_000, maxPaise: 5_000_000 });
    expect(parseAmountText('2 million')).toEqual({ minPaise: lakh(20), maxPaise: lakh(20) });
  });

  it('reads ranges, sharing the trailing unit, and open bounds', () => {
    expect(parseAmountText('20-25 lakh')).toEqual({ minPaise: lakh(20), maxPaise: lakh(25) });
    expect(parseAmountText('50 lakh to 1 cr')).toEqual({ minPaise: lakh(50), maxPaise: lakh(100) });
    expect(parseAmountText('upto 10 lakhs')).toEqual({ minPaise: null, maxPaise: lakh(10) });
    expect(parseAmountText('above 2 crore')).toEqual({ minPaise: lakh(200), maxPaise: null });
  });

  it('gives up on text it cannot read', () => {
    expect(parseAmountText('as much as possible')).toBeNull();
    expect(parseAmountText('5 bananas')).toBeNull();
    expect(parseAmountText('1, 2 and 3 lakh')).toBeNull();
    expect(parseAmountText('')).toBeNull();
  });
});
