import { rupeesToPaise } from '../../common/money/paise.js';

const LAKH = 100_000;
const CRORE = 100 * LAKH;
const YEAR_MONTHS = 12;

export type SegmentSeed = {
  key: string;
  label: string;
  description: string;
  icon: string;
  subSegments: Array<{ key: string; label: string }>;
};

export type PurposeSeed = { key: string; label: string; requiresNote?: boolean };

export type CategorySeed = {
  key: string;
  label: string;
  icon: string;
  minRupees: number;
  maxRupees: number;
  stepRupees: number;
  defaultRupees: number;
  tenureYears: number[];
  illustrativeRateBps: number;
  purposes: PurposeSeed[];
};

const OTHER: PurposeSeed = { key: 'other', label: 'Something Else', requiresNote: true };

export const SEGMENT_SEEDS: SegmentSeed[] = [
  {
    key: 'msme',
    label: 'Business / MSME',
    description: 'Proprietor, Partnership, LLP Or Pvt Ltd',
    icon: 'business',
    subSegments: [
      { key: 'proprietorship', label: 'Proprietor' },
      { key: 'partnership', label: 'Partnership' },
      { key: 'llp', label: 'LLP' },
      { key: 'private_limited', label: 'Pvt Ltd' },
    ],
  },
  {
    key: 'individual',
    label: 'Individual',
    description: 'Salaried Or Self-Employed',
    icon: 'person',
    subSegments: [
      { key: 'salaried', label: 'Salaried' },
      { key: 'self_employed', label: 'Self-Employed' },
    ],
  },
];

export const CATEGORY_SEEDS: CategorySeed[] = [
  {
    key: 'business', label: 'Business Loan', icon: 'store', minRupees: 5 * LAKH, maxRupees: 2 * CRORE, stepRupees: 2.5 * LAKH, defaultRupees: 25 * LAKH, tenureYears: [1, 2, 3, 5], illustrativeRateBps: 1500,
    purposes: [
      { key: 'expansion', label: 'Business Expansion' },
      { key: 'inventory', label: 'Buy Inventory Or Stock' },
      { key: 'equipment', label: 'Equipment Or Technology' },
      { key: 'marketing', label: 'Marketing And Growth' },
      { key: 'refinance', label: 'Refinance An Existing Loan' },
      OTHER,
    ],
  },
  {
    key: 'working-capital', label: 'Working Capital', icon: 'sync-alt', minRupees: 5 * LAKH, maxRupees: 2 * CRORE, stepRupees: 2.5 * LAKH, defaultRupees: 25 * LAKH, tenureYears: [1, 2, 3, 5], illustrativeRateBps: 1400,
    purposes: [
      { key: 'operations', label: 'Day-To-Day Operations' },
      { key: 'raw-material', label: 'Inventory Or Raw Material' },
      { key: 'suppliers', label: 'Pay Suppliers And Vendors' },
      { key: 'seasonal', label: 'Seasonal Demand' },
      { key: 'receivables', label: 'Bridge A Receivables Gap' },
      OTHER,
    ],
  },
  {
    key: 'lap', label: 'Loan Against Property', icon: 'business', minRupees: 10 * LAKH, maxRupees: 5 * CRORE, stepRupees: 5 * LAKH, defaultRupees: 50 * LAKH, tenureYears: [3, 5, 10, 15], illustrativeRateBps: 1000,
    purposes: [
      { key: 'business-use', label: 'Business Needs' },
      { key: 'debt-consolidation', label: 'Consolidate Existing Debt' },
      { key: 'education', label: 'Education' },
      { key: 'medical', label: 'Medical Expenses' },
      { key: 'renovation', label: 'Home Renovation' },
      OTHER,
    ],
  },
  {
    key: 'machinery', label: 'Machinery Finance', icon: 'machinery', minRupees: 5 * LAKH, maxRupees: 2 * CRORE, stepRupees: 2.5 * LAKH, defaultRupees: 25 * LAKH, tenureYears: [1, 3, 5, 7], illustrativeRateBps: 1300,
    purposes: [
      { key: 'new-machine', label: 'Buy New Machinery' },
      { key: 'used-machine', label: 'Buy Used / Refurbished Machinery' },
      { key: 'upgrade', label: 'Upgrade Or Replace Equipment' },
      OTHER,
    ],
  },
  {
    key: 'invoice', label: 'Invoice Finance', icon: 'receipt', minRupees: 5 * LAKH, maxRupees: 2 * CRORE, stepRupees: 2.5 * LAKH, defaultRupees: 25 * LAKH, tenureYears: [1], illustrativeRateBps: 1400,
    purposes: [{ key: 'unpaid-invoices', label: 'Fund Unpaid Invoices' }, OTHER],
  },
  {
    key: 'personal', label: 'Personal Loan', icon: 'wallet', minRupees: 50_000, maxRupees: 40 * LAKH, stepRupees: 50_000, defaultRupees: 5 * LAKH, tenureYears: [1, 2, 3, 5], illustrativeRateBps: 1300,
    purposes: [
      { key: 'medical', label: 'Medical Expenses' },
      { key: 'education', label: 'Education' },
      { key: 'wedding', label: 'Wedding' },
      { key: 'travel', label: 'Travel' },
      { key: 'renovation', label: 'Home Renovation' },
      { key: 'debt-consolidation', label: 'Consolidate Existing Debt' },
      OTHER,
    ],
  },
  {
    key: 'home', label: 'Home Loan', icon: 'home', minRupees: 5 * LAKH, maxRupees: 5 * CRORE, stepRupees: 5 * LAKH, defaultRupees: 50 * LAKH, tenureYears: [5, 10, 15, 20], illustrativeRateBps: 900,
    purposes: [
      { key: 'ready', label: 'Buy A Ready-To-Move Home' },
      { key: 'under-construction', label: 'Buy An Under-Construction Home' },
      { key: 'construct', label: 'Build On My Own Plot' },
      { key: 'extension', label: 'Renovation Or Extension' },
      { key: 'balance-transfer', label: 'Transfer An Existing Home Loan' },
      OTHER,
    ],
  },
  {
    key: 'vehicle', label: 'Vehicle Loan', icon: 'car', minRupees: LAKH, maxRupees: 50 * LAKH, stepRupees: LAKH, defaultRupees: 8 * LAKH, tenureYears: [1, 3, 5, 7], illustrativeRateBps: 1000,
    purposes: [
      { key: 'new-car', label: 'New Car' },
      { key: 'used-car', label: 'Used Car' },
      { key: 'two-wheeler', label: 'Two-wheeler' },
      { key: 'commercial', label: 'Commercial Vehicle' },
      OTHER,
    ],
  },
];

export const SEGMENT_CATEGORY_ORDER: Record<string, string[]> = {
  msme: ['business', 'working-capital', 'lap', 'machinery', 'invoice', 'personal', 'home', 'vehicle'],
  individual: ['personal', 'home', 'vehicle', 'lap'],
};

export const categoryAmounts = (seed: CategorySeed) => ({
  minAmountPaise: rupeesToPaise(seed.minRupees),
  maxAmountPaise: rupeesToPaise(seed.maxRupees),
  stepPaise: rupeesToPaise(seed.stepRupees),
  defaultAmountPaise: rupeesToPaise(seed.defaultRupees),
  tenureOptionsMonths: seed.tenureYears.map((years) => years * YEAR_MONTHS),
});
