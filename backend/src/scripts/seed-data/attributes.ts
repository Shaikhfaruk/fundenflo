import { AttributeDataType, AttributeSubject, DataSensitivity, FactProvenance } from '../../common/enums/db.enums.js';
import type { EnumOption } from '../../modules/attributes/domain/fact-value.js';

export type AttributeSeed = {
  key: string;
  label: string;
  dataType: AttributeDataType;
  unit?: string;
  enumValues?: EnumOption[];
  subject: AttributeSubject;
  sensitivity: DataSensitivity;
  freshnessDays?: number;
};

export const SEED_ATTRIBUTE_PROVENANCE: FactProvenance[] = Object.values(FactProvenance);

const option = (value: string, label: string): EnumOption => ({ value, label: { en: label } });

export const ATTRIBUTE_SEEDS: AttributeSeed[] = [
  { key: 'banking.avg_monthly_inflow_paise', label: 'Average Monthly Inflow', dataType: AttributeDataType.money, unit: 'paise', subject: AttributeSubject.any, sensitivity: DataSensitivity.financial, freshnessDays: 90 },
  { key: 'banking.avg_monthly_balance_paise', label: 'Average Monthly Balance', dataType: AttributeDataType.money, unit: 'paise', subject: AttributeSubject.any, sensitivity: DataSensitivity.financial, freshnessDays: 90 },
  { key: 'banking.monthly_emi_outflow_paise', label: 'Monthly EMI Outflow', dataType: AttributeDataType.money, unit: 'paise', subject: AttributeSubject.any, sensitivity: DataSensitivity.financial, freshnessDays: 90 },
  { key: 'banking.bounces_6m', label: 'Bounced Payments In Six Months', dataType: AttributeDataType.integer, unit: 'count', subject: AttributeSubject.any, sensitivity: DataSensitivity.financial, freshnessDays: 90 },
  { key: 'banking.statement_months', label: 'Months Of Bank Statement', dataType: AttributeDataType.integer, unit: 'months', subject: AttributeSubject.any, sensitivity: DataSensitivity.financial, freshnessDays: 90 },
  { key: 'gst.annual_turnover_paise', label: 'GST Turnover In Twelve Months', dataType: AttributeDataType.money, unit: 'paise', subject: AttributeSubject.business, sensitivity: DataSensitivity.financial, freshnessDays: 180 },
  { key: 'gst.filed_months_12m', label: 'GST Returns Filed In Twelve Months', dataType: AttributeDataType.integer, unit: 'months', subject: AttributeSubject.business, sensitivity: DataSensitivity.financial, freshnessDays: 180 },
  { key: 'itr.total_income_paise', label: 'Total Income As Per ITR', dataType: AttributeDataType.money, unit: 'paise', subject: AttributeSubject.any, sensitivity: DataSensitivity.financial, freshnessDays: 400 },
  {
    key: 'business.vintage_months',
    label: 'Business Age',
    dataType: AttributeDataType.integer,
    unit: 'months',
    subject: AttributeSubject.business,
    sensitivity: DataSensitivity.personal,
  },
  {
    key: 'business.monthly_turnover_paise',
    label: 'Average Monthly Turnover',
    dataType: AttributeDataType.money,
    unit: 'paise',
    subject: AttributeSubject.business,
    sensitivity: DataSensitivity.financial,
    freshnessDays: 180,
  },
  {
    key: 'business.gst_registered',
    label: 'GST Registered',
    dataType: AttributeDataType.boolean,
    subject: AttributeSubject.business,
    sensitivity: DataSensitivity.personal,
    freshnessDays: 365,
  },
  {
    key: 'business.constitution',
    label: 'Business Constitution',
    dataType: AttributeDataType.enum,
    enumValues: [
      option('proprietorship', 'Proprietor'),
      option('partnership', 'Partnership'),
      option('llp', 'LLP'),
      option('private_limited', 'Pvt Ltd'),
      option('public_limited', 'Public Ltd'),
      option('opc', 'One Person Company'),
      option('huf', 'HUF'),
      option('trust', 'Trust'),
      option('society', 'Society'),
      option('cooperative', 'Co-operative Society'),
    ],
    subject: AttributeSubject.business,
    sensitivity: DataSensitivity.public,
  },
  {
    key: 'borrower.has_existing_emis',
    label: 'Has Existing EMIs',
    dataType: AttributeDataType.boolean,
    subject: AttributeSubject.any,
    sensitivity: DataSensitivity.financial,
    freshnessDays: 90,
  },
  {
    key: 'person.employment_type',
    label: 'Employment Type',
    dataType: AttributeDataType.enum,
    enumValues: [option('salaried', 'Salaried'), option('self_employed', 'Self-employed')],
    subject: AttributeSubject.person,
    sensitivity: DataSensitivity.personal,
    freshnessDays: 180,
  },
  {
    key: 'person.net_monthly_income_paise',
    label: 'Net Monthly Income',
    dataType: AttributeDataType.money,
    unit: 'paise',
    subject: AttributeSubject.person,
    sensitivity: DataSensitivity.financial,
    freshnessDays: 180,
  },
  {
    key: 'person.work_experience_months',
    label: 'Time In Current Work',
    dataType: AttributeDataType.integer,
    unit: 'months',
    subject: AttributeSubject.person,
    sensitivity: DataSensitivity.personal,
    freshnessDays: 365,
  },
];
