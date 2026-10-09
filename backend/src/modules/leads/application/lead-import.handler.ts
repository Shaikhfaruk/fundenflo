import { z } from 'zod';

import { AnswerChannel, ConsentBasis, ConsentChannel, ContactType, ImportKind, LeadFlag, LeadUrgency } from '../../../common/enums/db.enums.js';
import { AppError } from '../../../common/errors/app-error.js';
import { DEFAULT_LOCALE } from '../../../common/i18n/locale.js';
import { normaliseEmail, normaliseLandline, normaliseMobile } from '../../../engines/party-matching/normalise.js';
import { CatalogQueryService } from '../../catalog/application/catalog-query.service.js';
import { ConsentService } from '../../consents/application/consent.service.js';
import { ImportHandlerFor } from '../../imports/application/import-handler.registry.js';
import { ImportWarning } from '../../imports/domain/import.constants.js';
import type { ImportHandler, ImportRowContext, ImportRowIssue, MappedRow } from '../../imports/domain/import.types.js';
import { PartyService } from '../../parties/application/party.service.js';
import { LEAD_IMPORT_FIELDS, LEAD_NOTE_MAX_LENGTH, LEAD_SOURCE_KEY_PATTERN, LeadSourceKey, TRUTHY_CELL } from '../domain/lead.constants.js';
import { type LeadCaptureInput, LeadCaptureService } from './lead-capture.service.js';
import { LeadSourceService } from './lead-source.service.js';
import { LeadService } from './lead.service.js';

const leadImportDefaultsSchema = z
  .object({
    source: z.string().regex(LEAD_SOURCE_KEY_PATTERN).default(LeadSourceKey.Import),
    countryCode: z.string().trim().regex(/^\+?\d{1,4}$/).optional(),
    segment: z.string().trim().toLowerCase().optional(),
    subSegment: z.string().trim().toLowerCase().optional(),
    category: z.string().trim().max(100).optional(),
    campaign: z.string().trim().max(100).optional(),
    flags: z.array(z.enum([LeadFlag.test])).max(1).optional(),
    consent: z
      .object({
        basis: z.enum(Object.values(ConsentBasis)).default(ConsentBasis.consent),
        evidence: z.string().trim().min(5).max(LEAD_NOTE_MAX_LENGTH).optional(),
        purposes: z.array(z.string().regex(/^[a-z][a-z0-9_]{1,49}$/)).min(1).max(10),
      })
      .strict()
      .optional(),
  })
  .strict();

type LeadImportDefaults = z.output<typeof leadImportDefaultsSchema>;

const issue = (field: string, column: string | null, code: string, message: string): ImportRowIssue => ({ field, column, code, message });

@ImportHandlerFor(ImportKind.leads)
export class LeadImportHandler implements ImportHandler<LeadImportDefaults, LeadCaptureInput> {
  readonly kind = ImportKind.leads;
  readonly fields = [...LEAD_IMPORT_FIELDS];
  readonly defaultsSchema = leadImportDefaultsSchema;

  constructor(
    private readonly capture: LeadCaptureService,
    private readonly leads: LeadService,
    private readonly sources: LeadSourceService,
    private readonly catalog: CatalogQueryService,
    private readonly consents: ConsentService,
    private readonly parties: PartyService,
  ) {}

  async checkDefaults(defaults: LeadImportDefaults): Promise<ImportRowIssue[]> {
    const issues: ImportRowIssue[] = [];
    await this.sources.activeByKey(defaults.source).catch((error: unknown) => {
      if (!(error instanceof AppError)) throw error;
      issues.push(issue('source', null, 'inactive_source', `lead source ${defaults.source} is missing or inactive`));
    });
    const known = await this.catalog.referenceKeys();
    if (defaults.segment && !known.segments.has(defaults.segment)) issues.push(issue('segment', null, 'unknown_key', `unknown segment ${defaults.segment}`));
    if (defaults.subSegment && !known.subSegments.has(defaults.subSegment)) issues.push(issue('subSegment', null, 'unknown_key', `unknown sub-segment ${defaults.subSegment}`));
    if (defaults.category && !(await this.catalog.resolveCategory(defaults.category))) issues.push(issue('category', null, 'unknown_key', `unknown category ${defaults.category}`));
    if (defaults.consent) {
      const purposes = await this.consents.activePurposeKeys();
      for (const purpose of defaults.consent.purposes) if (!purposes.has(purpose)) issues.push(issue('consent', null, 'unknown_purpose', `unknown consent purpose ${purpose}`));
    }
    return issues;
  }

  async mapRow(values: Record<string, string>, mapping: Record<string, string>, defaults: LeadImportDefaults): Promise<MappedRow<LeadCaptureInput>> {
    const column = (field: string) => mapping[field] ?? null;
    const get = (field: string) => {
      const name = column(field);
      const value = name ? values[name]?.trim() : undefined;
      return value ? value : undefined;
    };
    const errors: ImportRowIssue[] = [];
    const warnings: string[] = [];
    const countryCode = get('countryCode') ?? defaults.countryCode;

    const mobileText = get('mobile');
    const mobile = mobileText ? normaliseMobile(mobileText, countryCode) : null;
    const landlineText = get('landline');
    const landline = landlineText ? normaliseLandline(landlineText, countryCode) : null;
    const emailText = get('email');
    const email = emailText ? normaliseEmail(emailText) : null;
    if (mobileText && !mobile) warnings.push('invalid_mobile');
    if (landlineText && !landline) warnings.push('invalid_landline');
    if (emailText && !email) warnings.push('invalid_email');
    if (!mobile && !landline && !email) errors.push(issue('mobile', column('mobile'), 'contact_required', 'needs at least one valid mobile, landline or email'));

    const known = await this.catalog.referenceKeys();
    const segment = get('segment')?.toLowerCase() ?? defaults.segment;
    if (segment && !known.segments.has(segment)) errors.push(issue('segment', column('segment'), 'unknown_key', `unknown segment ${segment}`));
    const subSegment = get('subSegment')?.toLowerCase().replace(/[\s-]+/g, '_') ?? defaults.subSegment;
    if (subSegment && !known.subSegments.has(subSegment)) errors.push(issue('subSegment', column('subSegment'), 'unknown_key', `unknown sub-segment ${subSegment}`));

    const tenureText = get('tenureMonths');
    const tenureMonths = tenureText && /^\d{1,3}$/.test(tenureText) ? Number(tenureText) : undefined;
    if (tenureText && tenureMonths === undefined) warnings.push('invalid_tenure');
    const pincodeText = get('pincode')?.replace(/\s/g, '');
    const pincode = pincodeText && /^[1-9]\d{5}$/.test(pincodeText) ? pincodeText : undefined;
    if (pincodeText && !pincode) warnings.push('invalid_pincode');
    const urgencyText = get('urgency')?.toLowerCase().replace(/[\s-]+/g, '_');
    const urgency = urgencyText && (Object.values(LeadUrgency) as string[]).includes(urgencyText) ? (urgencyText as LeadUrgency) : undefined;
    if (urgencyText && !urgency) warnings.push('invalid_urgency');
    const language = get('preferredLanguage')?.toLowerCase();

    const consentApplies = defaults.consent && (!column('consentGiven') || TRUTHY_CELL.test(get('consentGiven') ?? ''));
    const evidence = get('consentEvidence') ?? defaults.consent?.evidence;
    if (consentApplies && !evidence) errors.push(issue('consentEvidence', column('consentEvidence'), 'required', 'consent evidence is required (a default or a per-row column)'));

    if (mobile && (await this.parties.contactExists(ContactType.mobile, mobile.e164))) warnings.push(ImportWarning.ExistingPerson);
    const input: LeadCaptureInput = {
      name: get('name'),
      mobile: mobile?.e164,
      landline: landline ?? undefined,
      email: email ?? undefined,
      businessName: get('businessName'),
      segment,
      subSegment,
      category: get('category') ?? defaults.category,
      purpose: get('purpose'),
      amountText: get('amount'),
      tenureMonths,
      city: get('city'),
      pincode,
      urgency,
      preferredLanguage: language && /^[a-z]{2,3}$/.test(language) ? language : undefined,
      preferredContactTime: get('preferredContactTime'),
      campaign: get('campaign') ?? defaults.campaign,
      externalRef: get('externalRef'),
      flags: defaults.flags,
      consent:
        consentApplies && defaults.consent && evidence
          ? { basis: defaults.consent.basis, evidence, items: defaults.consent.purposes.map((purpose) => ({ purpose, granted: true })) }
          : undefined,
    };
    const contactKey = mobile?.e164 ?? email ?? landline;
    return { input: errors.length === 0 ? input : null, errors, warnings, dedupeKey: contactKey ? `${contactKey}|${input.category ?? ''}` : null };
  }

  async commitRow(input: LeadCaptureInput, context: ImportRowContext<LeadImportDefaults>) {
    const result = await this.capture.capture(input, {
      source: await this.sources.activeByKey(context.defaults.source),
      consentChannel: ConsentChannel.import,
      answerChannel: AnswerChannel.import,
      capturedByUserId: context.actorUserId ?? undefined,
      importBatchId: context.batchId,
      importRowNumber: context.rowNumber,
      locale: DEFAULT_LOCALE,
    });
    return { entityId: result.lead.id };
  }

  undoRow(entityId: string, context: ImportRowContext<LeadImportDefaults>) {
    return this.leads.undoImported(entityId, context.batchId);
  }
}
