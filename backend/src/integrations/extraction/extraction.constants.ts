export const EXTRACTION_PROMPT_VERSION = 'fundenflo-extract-v1';

export const EXTRACTION_TIMEOUT_MS = 90_000;

export const EXTRACTION_RETRIES = 2;

export const EXTRACTION_RETRY_BASE_MS = 1_500;

export const PDF_TEXT_MIN_CHARS = 200;

export const PDF_TEXT_MAX_CHARS = 150_000;

export const PAISE_PER_RUPEE = 100;

export const PDF_MIME = 'application/pdf';

export const IMAGE_MIMES: ReadonlySet<string> = new Set(['image/jpeg', 'image/png', 'image/webp']);

export const OTHER_DOCUMENT = 'other';

export const ExtractionProvider = {
  OpenAi: 'openai',
  AzureOpenAi: 'azure_openai',
} as const;

export type ExtractionProvider = (typeof ExtractionProvider)[keyof typeof ExtractionProvider];

export const DOCUMENT_GUIDANCE: Record<string, string> = {
  bank_statement: 'This is a bank account statement. Work from the transaction table. A month counts only if the statement covers it. EMIs are recurring debits to banks or NBFCs (EMI, NACH, ECS, ACH loan debits). Bounces are returned cheques, ECS or NACH returns and debits rejected for insufficient funds.',
  gstr_3b: 'These are GSTR-3B returns. Turnover is the total taxable outward supplies across the returns provided. Count each tax period that has a filed return.',
  itr: 'This is an Indian income tax return or its acknowledgement. Use the gross total income for the assessment year shown.',
  salary_slip: 'These are salary slips. Net pay is the amount paid to the employee after deductions; average it over the slips provided.',
  udyam_certificate: 'This is a Udyam registration certificate. Use the date of commencement of business, or the date of incorporation if commencement is missing.',
};

export const ATTRIBUTE_GUIDANCE: Record<string, string> = {
  'banking.avg_monthly_inflow_paise': 'Average of total credits per month across the full months covered.',
  'banking.avg_monthly_balance_paise': 'Average closing or end-of-day balance per month.',
  'banking.monthly_emi_outflow_paise': 'Average total EMI and loan debits per month.',
  'banking.bounces_6m': 'Number of bounced or returned debits and cheques in the last six months covered.',
  'banking.statement_months': 'Number of whole months the statement covers.',
  'gst.annual_turnover_paise': 'Total taxable outward supplies over the last twelve months available.',
  'gst.filed_months_12m': 'Number of monthly tax periods with a filed return in the last twelve months.',
  'itr.total_income_paise': 'Gross total income for the year.',
  'person.net_monthly_income_paise': 'Average monthly net pay.',
  'business.vintage_months': 'Whole months from the commencement or incorporation date to today.',
};
