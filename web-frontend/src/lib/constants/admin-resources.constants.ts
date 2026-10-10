import type { BackendRoute } from '@/lib/api/backend-routes';

type FieldKind = 'key' | 'text' | 'longText' | 'localised' | 'longLocalised' | 'integer' | 'money' | 'boolean' | 'select' | 'multiselect' | 'list' | 'integerList' | 'date' | 'json';

export type OptionSource = 'states' | 'cities' | 'segments' | 'categories' | 'leadSources' | 'attributes' | 'commissionSchemes';

export type FieldSpec = {
  name: string;
  labelKey?: string;
  kind: FieldKind;
  options?: readonly string[];
  optionsEnum?: string;
  source?: OptionSource;
  required?: boolean;
  create?: boolean;
  edit?: boolean;
  nullable?: boolean;
};

type ColumnKind = 'text' | 'localised' | 'status' | 'active' | 'list' | 'count' | 'money' | 'date' | 'enum' | 'state' | 'city';

export type ColumnSpec = { name: string; kind: ColumnKind; optionsEnum?: string; labelKey?: string };

type FilterSpec = { name: string; options: readonly string[]; optionsEnum?: string; labelKey?: string; initial?: string };

export type ChildSpec = {
  key: string;
  itemsField?: string;
  list?: BackendRoute;
  create?: BackendRoute;
  update?: BackendRoute;
  childParam: string;
  columns: ColumnSpec[];
  fields: FieldSpec[];
};

export type ResourceSpec = {
  key: string;
  list: BackendRoute;
  create?: BackendRoute;
  get?: BackendRoute;
  update?: BackendRoute;
  remove?: BackendRoute;
  updateWithCreate?: boolean;
  idField: string;
  titleField: string;
  cursorParam?: string;
  search?: string;
  filters?: FilterSpec[];
  columns: ColumnSpec[];
  fields: FieldSpec[];
  children?: ChildSpec[];
  secretField?: string;
};

const STATUS = ['active', 'inactive'] as const;

const STATUS_FILTER: FilterSpec = { name: 'status', options: STATUS, optionsEnum: 'catalogStatus', initial: 'active' };

const statusField: FieldSpec = { name: 'status', kind: 'select', options: STATUS, optionsEnum: 'catalogStatus', create: false };

const DATA_TYPES = ['integer', 'decimal', 'money', 'boolean', 'enum', 'string', 'date', 'percentage'] as const;

const SUBJECTS = ['person', 'business', 'any'] as const;

const SENSITIVITY = ['public', 'personal', 'financial', 'special'] as const;

const PROVENANCE = ['declared', 'extracted', 'third_party_verified', 'ops_verified', 'derived'] as const;

const QUESTION_TYPES = ['single_select', 'multi_select', 'number', 'money', 'date', 'text', 'boolean', 'city', 'pincode'] as const;

const SCOPE_KINDS = ['none', 'organizations'] as const;

const SCOPE_ORGANIZATIONS = ['partner', 'lender'] as const;

const BASES = ['consent', 'legitimate_use'] as const;

const TEMPLATE_CHANNELS = ['sms', 'email', 'whatsapp'] as const;

const LOCALES = ['en', 'hi', 'bn', 'mr', 'gu', 'ta', 'te', 'kn', 'ml', 'pa', 'or'] as const;

const ALIAS_KINDS = ['city', 'state', 'category'] as const;

const MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/webp'] as const;

const PERIOD_RULES = ['last_3_months', 'last_6_months', 'last_12_months', 'latest_financial_year', 'latest_assessment_year', 'current'] as const;

const LEAD_SOURCE_KINDS = ['web_form', 'partner_referral', 'webhook', 'api', 'import', 'manual'] as const;

const API_SCOPES = ['leads:create'] as const;

const LENDER_KINDS = ['bank', 'nbfc', 'hfc', 'small_finance_bank', 'cooperative_bank', 'fintech'] as const;

const LENDER_STATUSES = ['onboarding', 'active', 'paused', 'offboarded'] as const;

const AGREEMENT_STATUSES = ['draft', 'active', 'expired', 'terminated'] as const;

const CONTACT_ROLES = ['relationship', 'credit', 'operations', 'escalation'] as const;

export const ResourceKey = {
  Segments: 'segments',
  Categories: 'categories',
  Cities: 'cities',
  Pincodes: 'pincodes',
  Aliases: 'aliases',
  Attributes: 'attributes',
  Questions: 'questions',
  ConsentPurposes: 'consentPurposes',
  NotificationTemplates: 'notificationTemplates',
  DocumentTypes: 'documentTypes',
  LeadSources: 'leadSources',
  ApiClients: 'apiClients',
  Lenders: 'lenders',
} as const;

export type ResourceKey = (typeof ResourceKey)[keyof typeof ResourceKey];

export const ADMIN_RESOURCES: Record<ResourceKey, ResourceSpec> = {
  [ResourceKey.Segments]: {
    key: ResourceKey.Segments,
    list: 'GET /admin/segments',
    create: 'POST /admin/segments',
    update: 'PATCH /admin/segments/:id',
    idField: 'id',
    titleField: 'label',
    filters: [STATUS_FILTER],
    columns: [
      { name: 'label', kind: 'localised' },
      { name: 'key', kind: 'text' },
      { name: 'subSegments', kind: 'count' },
      { name: 'sortOrder', kind: 'text' },
      { name: 'status', kind: 'status' },
    ],
    fields: [
      { name: 'key', kind: 'key', required: true, edit: false },
      { name: 'label', kind: 'localised', required: true },
      { name: 'description', kind: 'localised', nullable: true },
      { name: 'icon', kind: 'text', nullable: true },
      { name: 'sortOrder', kind: 'integer' },
      statusField,
    ],
    children: [
      {
        key: 'subSegments',
        itemsField: 'subSegments',
        create: 'POST /admin/segments/:id/sub-segments',
        update: 'PATCH /admin/sub-segments/:id',
        childParam: 'id',
        columns: [
          { name: 'label', kind: 'localised' },
          { name: 'key', kind: 'text' },
          { name: 'status', kind: 'status' },
        ],
        fields: [
          { name: 'key', kind: 'key', required: true, edit: false },
          { name: 'label', kind: 'localised', required: true },
          { name: 'sortOrder', kind: 'integer' },
          statusField,
        ],
      },
    ],
  },
  [ResourceKey.Categories]: {
    key: ResourceKey.Categories,
    list: 'GET /admin/loan-categories',
    create: 'POST /admin/loan-categories',
    get: 'GET /admin/loan-categories/:id',
    update: 'PATCH /admin/loan-categories/:id',
    idField: 'id',
    titleField: 'label',
    filters: [STATUS_FILTER],
    columns: [
      { name: 'label', kind: 'localised' },
      { name: 'key', kind: 'text' },
      { name: 'minAmountPaise', kind: 'money' },
      { name: 'maxAmountPaise', kind: 'money' },
      { name: 'purposes', kind: 'count' },
      { name: 'status', kind: 'status' },
    ],
    fields: [
      { name: 'key', kind: 'key', required: true, edit: false },
      { name: 'label', kind: 'localised', required: true },
      { name: 'icon', kind: 'text', required: true },
      { name: 'segmentKeys', kind: 'multiselect', source: 'segments', required: true },
      { name: 'minAmountPaise', kind: 'money', required: true },
      { name: 'maxAmountPaise', kind: 'money', required: true },
      { name: 'stepPaise', kind: 'money', required: true },
      { name: 'defaultAmountPaise', kind: 'money', required: true },
      { name: 'tenureOptionsMonths', kind: 'integerList', required: true },
      { name: 'illustrativeRateBps', kind: 'integer', nullable: true },
      { name: 'sortOrder', kind: 'integer' },
      statusField,
    ],
    children: [
      {
        key: 'purposes',
        itemsField: 'purposes',
        create: 'POST /admin/loan-categories/:id/purposes',
        update: 'PATCH /admin/loan-categories/:id/purposes/:purposeId',
        childParam: 'purposeId',
        columns: [
          { name: 'label', kind: 'localised' },
          { name: 'key', kind: 'text' },
          { name: 'status', kind: 'status' },
        ],
        fields: [
          { name: 'key', kind: 'key', required: true, edit: false },
          { name: 'label', kind: 'localised', required: true },
          { name: 'requiresNote', kind: 'boolean' },
          { name: 'sortOrder', kind: 'integer' },
          statusField,
        ],
      },
    ],
  },
  [ResourceKey.Cities]: {
    key: ResourceKey.Cities,
    list: 'GET /admin/geo/cities',
    create: 'POST /admin/geo/cities',
    update: 'PATCH /admin/geo/cities/:id',
    idField: 'id',
    titleField: 'name',
    search: 'q',
    columns: [
      { name: 'name', kind: 'text' },
      { name: 'state', kind: 'state' },
      { name: 'status', kind: 'status' },
    ],
    fields: [
      { name: 'stateGstCode', kind: 'select', source: 'states', required: true, edit: false },
      { name: 'name', kind: 'text', required: true },
      statusField,
    ],
  },
  [ResourceKey.Pincodes]: {
    key: ResourceKey.Pincodes,
    list: 'GET /admin/geo/pincodes',
    create: 'POST /admin/geo/pincodes',
    updateWithCreate: true,
    idField: 'pincode',
    titleField: 'pincode',
    cursorParam: 'after',
    search: 'prefix',
    columns: [
      { name: 'pincode', kind: 'text' },
      { name: 'district', kind: 'text' },
      { name: 'city', kind: 'city' },
      { name: 'state', kind: 'state' },
      { name: 'status', kind: 'status' },
    ],
    fields: [
      { name: 'pincode', kind: 'text', required: true, edit: false },
      { name: 'stateGstCode', kind: 'select', source: 'states', required: true },
      { name: 'cityId', kind: 'select', source: 'cities' },
      { name: 'district', kind: 'text' },
      { name: 'status', kind: 'select', options: STATUS, optionsEnum: 'catalogStatus' },
    ],
  },
  [ResourceKey.Aliases]: {
    key: ResourceKey.Aliases,
    list: 'GET /admin/lookup-aliases',
    create: 'POST /admin/lookup-aliases',
    remove: 'DELETE /admin/lookup-aliases/:id',
    idField: 'id',
    titleField: 'alias',
    filters: [{ name: 'kind', options: ALIAS_KINDS, optionsEnum: 'aliasKind' }],
    columns: [
      { name: 'alias', kind: 'text' },
      { name: 'kind', kind: 'enum', optionsEnum: 'aliasKind' },
      { name: 'createdAt', kind: 'date' },
    ],
    fields: [
      { name: 'kind', kind: 'select', options: ALIAS_KINDS, optionsEnum: 'aliasKind', required: true },
      { name: 'alias', kind: 'text', required: true },
      { name: 'targetId', kind: 'text', required: true },
    ],
  },
  [ResourceKey.Attributes]: {
    key: ResourceKey.Attributes,
    list: 'GET /admin/attributes',
    create: 'POST /admin/attributes',
    get: 'GET /admin/attributes/:id',
    update: 'PATCH /admin/attributes/:id',
    idField: 'id',
    titleField: 'label',
    filters: [STATUS_FILTER, { name: 'subject', options: SUBJECTS, optionsEnum: 'attributeSubject', labelKey: 'appliesTo' }],
    columns: [
      { name: 'label', kind: 'localised' },
      { name: 'key', kind: 'text' },
      { name: 'dataType', kind: 'enum', optionsEnum: 'dataType' },
      { name: 'subject', kind: 'enum', optionsEnum: 'attributeSubject', labelKey: 'appliesTo' },
      { name: 'sensitivity', kind: 'enum', optionsEnum: 'sensitivity' },
      { name: 'status', kind: 'status' },
    ],
    fields: [
      { name: 'key', kind: 'key', required: true, edit: false },
      { name: 'label', kind: 'localised', required: true },
      { name: 'description', kind: 'localised', nullable: true },
      { name: 'dataType', kind: 'select', options: DATA_TYPES, optionsEnum: 'dataType', required: true, edit: false },
      { name: 'subject', labelKey: 'appliesTo', kind: 'select', options: SUBJECTS, optionsEnum: 'attributeSubject', required: true, edit: false },
      { name: 'sensitivity', kind: 'select', options: SENSITIVITY, optionsEnum: 'sensitivity', required: true },
      { name: 'allowedProvenance', kind: 'multiselect', options: PROVENANCE, optionsEnum: 'provenance', required: true },
      { name: 'unit', kind: 'text', nullable: true },
      { name: 'freshnessDays', kind: 'integer', nullable: true },
      { name: 'enumValues', kind: 'json' },
      statusField,
    ],
  },
  [ResourceKey.Questions]: {
    key: ResourceKey.Questions,
    list: 'GET /admin/questions',
    create: 'POST /admin/questions',
    get: 'GET /admin/questions/:id',
    update: 'PATCH /admin/questions/:id',
    idField: 'id',
    titleField: 'label',
    filters: [STATUS_FILTER],
    columns: [
      { name: 'label', kind: 'localised' },
      { name: 'key', kind: 'text' },
      { name: 'attributeKey', kind: 'text' },
      { name: 'type', kind: 'enum', optionsEnum: 'questionType' },
      { name: 'status', kind: 'status' },
    ],
    fields: [
      { name: 'key', kind: 'key', required: true, edit: false },
      { name: 'attributeKey', kind: 'select', source: 'attributes', required: true, edit: false },
      { name: 'type', kind: 'select', options: QUESTION_TYPES, optionsEnum: 'questionType', required: true, edit: false },
      { name: 'label', kind: 'localised', required: true },
      { name: 'help', kind: 'localised', nullable: true },
      { name: 'options', kind: 'json' },
      { name: 'validation', kind: 'json', nullable: true },
      { name: 'ui', kind: 'json', nullable: true },
      statusField,
    ],
  },
  [ResourceKey.ConsentPurposes]: {
    key: ResourceKey.ConsentPurposes,
    list: 'GET /admin/consent-purposes',
    create: 'POST /admin/consent-purposes',
    get: 'GET /admin/consent-purposes/:id',
    update: 'PATCH /admin/consent-purposes/:id',
    idField: 'id',
    titleField: 'label',
    filters: [STATUS_FILTER],
    columns: [
      { name: 'label', kind: 'localised' },
      { name: 'key', kind: 'text' },
      { name: 'scopeKind', kind: 'enum', optionsEnum: 'scopeKind' },
      { name: 'allowedBases', kind: 'list' },
      { name: 'status', kind: 'status' },
    ],
    fields: [
      { name: 'key', kind: 'key', required: true, edit: false },
      { name: 'label', kind: 'localised', required: true },
      { name: 'description', kind: 'localised', nullable: true },
      { name: 'scopeKind', kind: 'select', options: SCOPE_KINDS, optionsEnum: 'scopeKind', edit: false },
      { name: 'scopeOrganizationType', kind: 'select', options: SCOPE_ORGANIZATIONS, optionsEnum: 'organizationType', edit: false },
      { name: 'allowedBases', kind: 'multiselect', options: BASES, optionsEnum: 'consentBasis', required: true },
      { name: 'validityDays', kind: 'integer', nullable: true },
      statusField,
    ],
  },
  [ResourceKey.NotificationTemplates]: {
    key: ResourceKey.NotificationTemplates,
    list: 'GET /admin/notification-templates',
    create: 'POST /admin/notification-templates',
    update: 'PATCH /admin/notification-templates/:id',
    idField: 'id',
    titleField: 'key',
    filters: [{ name: 'channel', options: TEMPLATE_CHANNELS, optionsEnum: 'notificationChannel' }],
    columns: [
      { name: 'key', kind: 'text' },
      { name: 'channel', kind: 'enum', optionsEnum: 'notificationChannel' },
      { name: 'locale', kind: 'text' },
      { name: 'placeholders', kind: 'list' },
      { name: 'active', kind: 'active' },
    ],
    fields: [
      { name: 'key', kind: 'text', required: true, edit: false },
      { name: 'channel', kind: 'select', options: TEMPLATE_CHANNELS, optionsEnum: 'notificationChannel', required: true, edit: false },
      { name: 'locale', kind: 'select', options: LOCALES, required: true, edit: false },
      { name: 'subject', kind: 'text', nullable: true },
      { name: 'body', kind: 'longText', required: true },
      { name: 'providerTemplateId', kind: 'text', nullable: true },
      { name: 'active', kind: 'boolean', create: false },
    ],
  },
  [ResourceKey.DocumentTypes]: {
    key: ResourceKey.DocumentTypes,
    list: 'GET /admin/document-types',
    create: 'POST /admin/document-types',
    get: 'GET /admin/document-types/:id',
    update: 'PATCH /admin/document-types/:id',
    idField: 'id',
    titleField: 'label',
    filters: [STATUS_FILTER],
    columns: [
      { name: 'label', kind: 'localised' },
      { name: 'key', kind: 'text' },
      { name: 'periodRule', kind: 'enum', optionsEnum: 'periodRule' },
      { name: 'sensitivity', kind: 'enum', optionsEnum: 'sensitivity' },
      { name: 'status', kind: 'status' },
    ],
    fields: [
      { name: 'key', kind: 'key', required: true, edit: false },
      { name: 'label', kind: 'localised', required: true },
      { name: 'description', kind: 'longLocalised', nullable: true },
      { name: 'icon', kind: 'text' },
      { name: 'acceptedMimeTypes', kind: 'multiselect', options: MIME_TYPES, required: true },
      { name: 'maxSizeBytes', kind: 'integer', required: true },
      { name: 'periodRule', kind: 'select', options: PERIOD_RULES, optionsEnum: 'periodRule' },
      { name: 'freshnessDays', kind: 'integer' },
      { name: 'extractorKey', kind: 'text' },
      { name: 'producesAttributes', kind: 'list' },
      { name: 'retentionDays', kind: 'integer' },
      { name: 'sensitivity', kind: 'select', options: SENSITIVITY, optionsEnum: 'sensitivity', required: true },
      statusField,
    ],
  },
  [ResourceKey.LeadSources]: {
    key: ResourceKey.LeadSources,
    list: 'GET /admin/lead-sources',
    create: 'POST /admin/lead-sources',
    get: 'GET /admin/lead-sources/:id',
    update: 'PATCH /admin/lead-sources/:id',
    idField: 'id',
    titleField: 'name',
    filters: [STATUS_FILTER],
    columns: [
      { name: 'name', kind: 'text' },
      { name: 'key', kind: 'text' },
      { name: 'kind', kind: 'enum', optionsEnum: 'leadSourceKind' },
      { name: 'consentContext', kind: 'text' },
      { name: 'status', kind: 'status' },
    ],
    fields: [
      { name: 'key', kind: 'key', required: true, edit: false },
      { name: 'name', kind: 'text', required: true },
      { name: 'kind', kind: 'select', options: LEAD_SOURCE_KINDS, optionsEnum: 'leadSourceKind', required: true, edit: false },
      { name: 'questionSetStage', kind: 'text', nullable: true },
      { name: 'consentContext', kind: 'text', nullable: true },
      { name: 'defaultLawfulBasis', kind: 'select', options: BASES, optionsEnum: 'consentBasis', nullable: true },
      statusField,
    ],
  },
  [ResourceKey.ApiClients]: {
    key: ResourceKey.ApiClients,
    list: 'GET /admin/api-clients',
    create: 'POST /admin/api-clients',
    remove: 'DELETE /admin/api-clients/:id',
    idField: 'id',
    titleField: 'name',
    secretField: 'key',
    columns: [
      { name: 'name', kind: 'text' },
      { name: 'keyPrefix', kind: 'text' },
      { name: 'scopes', kind: 'list' },
      { name: 'lastUsedAt', kind: 'date' },
      { name: 'status', kind: 'status' },
    ],
    fields: [
      { name: 'name', kind: 'text', required: true },
      { name: 'scopes', kind: 'multiselect', options: API_SCOPES, required: true },
      { name: 'leadSourceId', kind: 'select', source: 'leadSources' },
      { name: 'expiresAt', kind: 'date' },
    ],
  },
  [ResourceKey.Lenders]: {
    key: ResourceKey.Lenders,
    list: 'GET /admin/lenders',
    create: 'POST /admin/lenders',
    get: 'GET /admin/lenders/:id',
    update: 'PATCH /admin/lenders/:id',
    idField: 'id',
    titleField: 'name',
    filters: [{ name: 'status', options: LENDER_STATUSES, optionsEnum: 'lenderStatus' }],
    columns: [
      { name: 'name', kind: 'text' },
      { name: 'key', kind: 'text' },
      { name: 'kind', kind: 'enum', optionsEnum: 'lenderKind' },
      { name: 'responseSlaHours', kind: 'text' },
      { name: 'status', kind: 'enum', optionsEnum: 'lenderStatus' },
    ],
    fields: [
      { name: 'key', kind: 'key', required: true, edit: false },
      { name: 'name', kind: 'text', required: true, edit: false },
      { name: 'kind', kind: 'select', options: LENDER_KINDS, optionsEnum: 'lenderKind', required: true, edit: false },
      { name: 'rbiRegistrationNo', kind: 'text', nullable: true },
      { name: 'website', kind: 'text', nullable: true },
      { name: 'responseSlaHours', kind: 'integer', nullable: true },
      { name: 'notes', kind: 'longText', nullable: true },
      { name: 'status', kind: 'select', options: LENDER_STATUSES, optionsEnum: 'lenderStatus', create: false },
    ],
    children: [
      {
        key: 'agreements',
        list: 'GET /admin/lenders/:id/agreements',
        create: 'POST /admin/lenders/:id/agreements',
        update: 'PATCH /admin/lenders/:id/agreements/:aid',
        childParam: 'aid',
        columns: [
          { name: 'reference', kind: 'text' },
          { name: 'validFrom', kind: 'text' },
          { name: 'validTo', kind: 'text' },
          { name: 'commissionSchemeKey', kind: 'text' },
          { name: 'status', kind: 'enum', optionsEnum: 'agreementStatus' },
        ],
        fields: [
          { name: 'reference', kind: 'text', required: true, edit: false },
          { name: 'validFrom', kind: 'date', required: true, edit: false },
          { name: 'validTo', kind: 'date', nullable: true },
          { name: 'commissionSchemeKey', kind: 'select', source: 'commissionSchemes', nullable: true },
          { name: 'commissionNote', kind: 'longText', nullable: true },
          { name: 'status', kind: 'select', options: AGREEMENT_STATUSES, optionsEnum: 'agreementStatus', create: false },
          { name: 'terminationReason', kind: 'text', create: false },
        ],
      },
      {
        key: 'contacts',
        list: 'GET /admin/lenders/:id/contacts',
        create: 'POST /admin/lenders/:id/contacts',
        update: 'PATCH /admin/lenders/:id/contacts/:cid',
        childParam: 'cid',
        columns: [
          { name: 'name', kind: 'text' },
          { name: 'designation', kind: 'text' },
          { name: 'role', kind: 'enum', optionsEnum: 'contactRole' },
          { name: 'escalationLevel', kind: 'text' },
          { name: 'active', kind: 'active' },
        ],
        fields: [
          { name: 'name', kind: 'text', required: true, edit: false },
          { name: 'designation', kind: 'text', nullable: true },
          { name: 'role', kind: 'select', options: CONTACT_ROLES, optionsEnum: 'contactRole', required: true },
          { name: 'email', kind: 'text', edit: false },
          { name: 'mobile', kind: 'text', edit: false },
          { name: 'escalationLevel', kind: 'integer' },
          { name: 'active', kind: 'boolean', create: false },
        ],
      },
    ],
  },
};
