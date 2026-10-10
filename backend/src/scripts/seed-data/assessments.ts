import { MissingPolicy } from '../../engines/scoring/scoring.types.js';

const RUPEE = 100;
const THOUSAND = 1_000 * RUPEE;
const LAKH = 100_000 * RUPEE;

const en = (text: string) => ({ en: text });

const gte = (attr: string, value: number) => ({ attr, op: 'gte', value });

const tiers = (attr: string, steps: Array<[number, number]>, floor: number) => [...steps.map(([value, points]) => ({ when: gte(attr, value), points })), { when: { attr, op: 'exists' }, points: floor }];

const bounces = (max: number) => [
  { when: { attr: 'banking.bounces_6m', op: 'eq', value: 0 }, points: max },
  { when: { attr: 'banking.bounces_6m', op: 'lte', value: 1 }, points: Math.round(max * 0.7) },
  { when: { attr: 'banking.bounces_6m', op: 'lte', value: 3 }, points: Math.round(max * 0.4) },
  { when: { attr: 'banking.bounces_6m', op: 'exists' }, points: Math.round(max * 0.1) },
];

const SCORE_BANDS = [
  { min: 80, label: en('Strong — Ready For Funding') },
  { min: 60, label: en('Good — Ready For Funding') },
  { min: 40, label: en('Fair — A Few Gaps To Close') },
  { min: 0, label: en('Needs Work Before Matching') },
];

export const SCORING_MODEL_SEEDS: Array<{ key: string; name: string; content: unknown }> = [
  {
    key: 'score.msme',
    name: 'Financial Health Score for businesses (default)',
    content: {
      scope: { segments: ['msme'], subSegments: [] },
      attentionBelowPct: 60,
      bands: SCORE_BANDS,
      factors: [
        { key: 'cashflow', label: en('Cash Flow & Bank Behaviour'), max: 25, method: 'bands', missing: MissingPolicy.Insufficient, bands: tiers('banking.avg_monthly_inflow_paise', [[25 * LAKH, 25], [10 * LAKH, 21], [5 * LAKH, 17], [2 * LAKH, 12], [50 * THOUSAND, 7]], 3) },
        { key: 'profitability', label: en('Profitability & Margins'), max: 20, method: 'bands', missing: MissingPolicy.ExcludeRenormalise, bands: tiers('itr.total_income_paise', [[50 * LAKH, 20], [25 * LAKH, 16], [10 * LAKH, 12], [5 * LAKH, 8]], 4) },
        { key: 'repayment', label: en('Repayment Capacity'), max: 20, method: 'bands', missing: MissingPolicy.ExcludeRenormalise, bands: bounces(20) },
        { key: 'consistency', label: en('GST & ITR Consistency'), max: 15, method: 'bands', missing: MissingPolicy.ExcludeRenormalise, bands: tiers('gst.filed_months_12m', [[12, 15], [10, 11], [6, 7]], 3) },
        { key: 'vintage', label: en('Business Vintage'), max: 10, method: 'bands', missing: MissingPolicy.ExcludeRenormalise, bands: tiers('business.vintage_months', [[60, 10], [36, 8], [12, 5]], 2) },
      ],
    },
  },
  {
    key: 'score.individual',
    name: 'Financial Health Score for individuals (default)',
    content: {
      scope: { segments: ['individual'], subSegments: [] },
      attentionBelowPct: 60,
      bands: SCORE_BANDS,
      factors: [
        { key: 'cashflow', label: en('Cash Flow & Bank Behaviour'), max: 25, method: 'bands', missing: MissingPolicy.Insufficient, bands: tiers('banking.avg_monthly_inflow_paise', [[2 * LAKH, 25], [1 * LAKH, 21], [50 * THOUSAND, 17], [25 * THOUSAND, 12], [10 * THOUSAND, 7]], 3) },
        { key: 'income', label: en('Income Stability'), max: 20, method: 'bands', missing: MissingPolicy.ExcludeRenormalise, bands: tiers('person.net_monthly_income_paise', [[2 * LAKH, 20], [1 * LAKH, 16], [50 * THOUSAND, 12], [25 * THOUSAND, 8]], 4) },
        { key: 'repayment', label: en('Repayment Capacity'), max: 20, method: 'bands', missing: MissingPolicy.ExcludeRenormalise, bands: bounces(20) },
        { key: 'consistency', label: en('Income Consistency'), max: 15, method: 'bands', missing: MissingPolicy.ExcludeRenormalise, bands: tiers('banking.statement_months', [[6, 15], [3, 9]], 4) },
        { key: 'vintage', label: en('Work Vintage'), max: 10, method: 'bands', missing: MissingPolicy.ExcludeRenormalise, bands: tiers('person.work_experience_months', [[60, 10], [36, 8], [12, 5]], 2) },
      ],
    },
  },
];

const rule = (key: string, name: string, trigger: unknown, priority: number, texts: { title: string; found: string; why: string; action: string; evidence: string }, evidenceDocumentType?: string, segments: string[] = []) => ({
  key,
  name,
  content: { scope: { segments }, trigger, priority, title: en(texts.title), found: en(texts.found), why: en(texts.why), action: en(texts.action), evidence: en(texts.evidence), ...(evidenceDocumentType ? { evidenceDocumentType } : {}) },
});

export const IMPROVEMENT_RULE_SEEDS = [
  rule('improve.bounces', 'Payment bounces (default)', { attr: 'banking.bounces_6m', op: 'gte', value: 1 }, 10, {
    title: 'Payment Bounces On Your Account',
    found: 'Your bank statement shows bounced cheques or failed EMI debits in the last six months.',
    why: 'Lenders treat bounces as a sign that repayments may be missed.',
    action: 'Keep enough balance before every EMI and cheque date for the next three months.',
    evidence: 'A fresh bank statement with no bounces.',
  }, 'bank_statement'),
  rule('improve.existing_emis', 'Existing EMIs (default)', { attr: 'borrower.has_existing_emis', op: 'eq', value: true }, 20, {
    title: 'Existing EMIs Reduce Your Headroom',
    found: 'You already pay EMIs alongside this new loan.',
    why: 'Lenders look at how much of your monthly inflow already goes to EMIs.',
    action: 'Close or consolidate one small loan, or add a co-applicant with steady income.',
    evidence: 'The latest loan statement or a loan closure letter.',
  }),
  rule('improve.gst_gaps', 'GST filing gaps (default)', { attr: 'gst.filed_months_12m', op: 'lt', value: 12 }, 30, {
    title: 'GST Returns Missing For Some Months',
    found: 'Some GSTR-3B returns in the last twelve months are not filed.',
    why: 'Regular GST filing shows lenders that your turnover is real and steady.',
    action: 'File the pending GSTR-3B returns, then upload the updated returns.',
    evidence: 'GSTR-3B returns for the last twelve months.',
  }, 'gstr_3b', ['msme']),
  rule('improve.low_balance', 'Low average balance (default)', { attr: 'banking.avg_monthly_balance_paise', op: 'lt', value: 25 * THOUSAND }, 40, {
    title: 'Low Average Bank Balance',
    found: 'Your average monthly balance is low compared with your inflows.',
    why: 'A healthy balance tells lenders you can absorb a delayed payment.',
    action: 'Leave a larger share of your inflows in the main account for the next three months.',
    evidence: 'A fresh bank statement for the main account.',
  }, 'bank_statement'),
  rule('improve.young_business', 'Young business (default)', { attr: 'business.vintage_months', op: 'lt', value: 24 }, 50, {
    title: 'Business Is Less Than Two Years Old',
    found: 'Your business has been running for under two years.',
    why: 'Many lenders want two or more years of track record for business loans.',
    action: 'Add a co-applicant or guarantor with stable income, or apply for a smaller amount first.',
    evidence: 'Udyam registration or the business registration certificate.',
  }, 'udyam_certificate', ['msme']),
];
