import { DataSensitivity } from '../../common/enums/db.enums.js';
import type { LocalisedText } from '../../common/i18n/locale.js';
import { DocumentStage } from '../../modules/documents/domain/document.constants.js';

const MB = 1024 * 1024;

const UPLOADS = ['application/pdf', 'image/jpeg', 'image/png'];

export type DocumentTypeSeed = {
  key: string;
  label: LocalisedText;
  description: LocalisedText;
  icon: string;
  acceptedMimeTypes: string[];
  maxSizeBytes: number;
  periodRule: string | null;
  freshnessDays: number | null;
  producesAttributes: string[];
  sensitivity: DataSensitivity;
};

const type = (key: string, label: string, description: string, icon: string, extra: Partial<DocumentTypeSeed> = {}): DocumentTypeSeed => ({
  key,
  label: { en: label },
  description: { en: description },
  icon,
  acceptedMimeTypes: UPLOADS,
  maxSizeBytes: 10 * MB,
  periodRule: null,
  freshnessDays: null,
  producesAttributes: [],
  sensitivity: DataSensitivity.financial,
  ...extra,
});

export const DOCUMENT_TYPE_SEEDS: DocumentTypeSeed[] = [
  type('pan', 'PAN Card', 'PAN Of The Applicant Or Business', 'badge', { sensitivity: DataSensitivity.personal }),
  type('bank_statement', 'Bank Statement', 'Last 6 Months · Main Account', 'bank', { periodRule: 'last_6_months', freshnessDays: 45 }),
  type('itr', 'Income Tax Return', 'ITR For Assessment Year {{assessmentYear}}', 'receipt', { periodRule: 'latest_assessment_year' }),
  type('gstr_3b', 'GST Returns', 'Last 12 Months GSTR-3B', 'receipt', { periodRule: 'last_12_months' }),
  type('salary_slip', 'Salary Slips', 'Last 3 Months', 'payments', { periodRule: 'last_3_months', freshnessDays: 60 }),
  type('property_papers', 'Property Papers', 'Sale Deed Or Title Document', 'home'),
  type('vehicle_quotation', 'Vehicle Quotation', 'Proforma Invoice From The Dealer', 'car', { sensitivity: DataSensitivity.public }),
  type('machinery_quotation', 'Machinery Quotation', 'Quotation From The Supplier', 'quote', { sensitivity: DataSensitivity.public }),
  type('udyam_certificate', 'Udyam Registration', 'Udyam Registration Certificate', 'badge', { sensitivity: DataSensitivity.public }),
  type('sanction_letter', 'Sanction Letter', 'Sanction Letter From The Lender', 'receipt'),
  type('disbursement_advice', 'Disbursement Advice', 'Disbursal Confirmation From The Lender', 'receipt'),
];

const slot = (key: string, documentTypes: string[], extra: Record<string, unknown> = {}) => ({ key, documentTypes, required: true, minCount: 1, ...extra });

const optional = (category: string, document: string, description?: string) => ({
  key: `assessment.${category}`,
  name: `Optional document for ${category} loans`,
  content: { stage: DocumentStage.Assessment, scope: { categories: [category] }, items: [slot('category_document', [document], { required: false, ...(description ? { description: { en: description } } : {}) })] },
});

export const DOCUMENT_REQUIREMENT_SEEDS: Array<{ key: string; name: string; content: unknown }> = [
  { key: 'assessment.base', name: 'Financial Health Score documents for everyone', content: { stage: DocumentStage.Assessment, scope: {}, items: [slot('bank_statement', ['bank_statement'])] } },
  {
    key: 'assessment.msme',
    name: 'Income proof for businesses',
    content: { stage: DocumentStage.Assessment, scope: { segments: ['msme'] }, items: [slot('income_proof', ['itr', 'gstr_3b'], { label: { en: 'ITR Or GST Returns' }, description: { en: 'Assessment Year {{assessmentYear}} Or Last 12 Months GSTR-3B' } })] },
  },
  {
    key: 'assessment.individual',
    name: 'Income proof for individuals',
    content: {
      stage: DocumentStage.Assessment,
      scope: { segments: ['individual'] },
      items: [
        slot('salary_slips', ['salary_slip'], { when: { attr: 'person.employment_type', op: 'eq', value: 'salaried' } }),
        slot('income_proof', ['itr'], { when: { attr: 'person.employment_type', op: 'neq', value: 'salaried' } }),
      ],
    },
  },
  optional('lap', 'property_papers'),
  optional('home', 'property_papers', 'Sale Agreement Or Allotment Letter'),
  optional('vehicle', 'vehicle_quotation'),
  optional('machinery', 'machinery_quotation'),
];
