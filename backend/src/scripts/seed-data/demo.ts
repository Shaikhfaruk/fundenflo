import { LenderKind, Role } from '../../common/enums/db.enums.js';

const LAKH_PAISE = 100_000 * 100;

export const DEMO_PASSWORD_BYTES = 12;

export const DEMO_AGREEMENT_REFERENCE_SUFFIX = 'demo-agreement';

export const DEMO_STAFF = [
  { key: 'approver', role: Role.ops_lead, fullName: 'Demo Approver', localPart: 'demo.approver' },
  { key: 'finance', role: Role.finance, fullName: 'Demo Finance', localPart: 'demo.finance' },
] as const;

const gstRule = { id: 'gst', when: { attr: 'business.gst_registered', op: 'eq', value: true }, weight: 3, pass: { en: 'Your business is GST registered' }, fail: { en: 'A GST registration helps with this lender' } };

const statement = { key: 'statement', documentTypes: ['bank_statement'], stage: 'assessment' };

export const DEMO_LENDERS = [
  {
    key: 'demo_capital',
    name: 'Demo Capital Finance',
    kind: LenderKind.nbfc,
    responseSlaHours: 24,
    products: [
      {
        key: 'demo_capital.working_capital',
        name: 'Demo Capital Working Capital',
        content: { category: 'working-capital', segments: ['msme'], amountPaise: { min: 5 * LAKH_PAISE, max: 100 * LAKH_PAISE }, tenureMonths: { min: 12, max: 36 }, coverage: { nationwide: true }, eligibility: { hard: [], soft: [gstRule] }, documents: [statement] },
      },
      {
        key: 'demo_capital.personal_loan',
        name: 'Demo Capital Personal Loan',
        content: { category: 'personal', segments: ['individual'], amountPaise: { min: LAKH_PAISE, max: 25 * LAKH_PAISE }, tenureMonths: { min: 12, max: 60 }, coverage: { nationwide: true }, eligibility: { hard: [], soft: [] }, documents: [statement] },
      },
    ],
  },
  {
    key: 'sahyadri_bank',
    name: 'Sahyadri Co-operative Bank',
    kind: LenderKind.cooperative_bank,
    responseSlaHours: 48,
    products: [
      {
        key: 'sahyadri_bank.business_loan',
        name: 'Sahyadri Business Loan',
        content: { category: 'business', segments: ['msme'], amountPaise: { min: 10 * LAKH_PAISE, max: 200 * LAKH_PAISE }, tenureMonths: { min: 12, max: 60 }, coverage: { nationwide: true }, eligibility: { hard: [], soft: [gstRule] }, documents: [statement] },
      },
    ],
  },
] as const;
