import type { LenderAgreement, LenderContact } from '../../../generated/prisma/client.js';
import type { LenderRow } from '../infrastructure/lender.repository.js';

const day = (value: Date | null) => value?.toISOString().slice(0, 10) ?? null;

export const toLenderView = (lender: LenderRow) => ({
  id: lender.id,
  key: lender.key,
  name: lender.organization.name,
  organizationId: lender.organizationId,
  kind: lender.kind,
  rbiRegistrationNo: lender.rbiRegistrationNo,
  status: lender.status,
  website: lender.website,
  responseSlaHours: lender.responseSlaHours,
  notes: lender.notes,
  version: lender.version,
  createdAt: lender.createdAt.toISOString(),
  updatedAt: lender.updatedAt.toISOString(),
});

export const toAgreementView = (agreement: LenderAgreement, today = new Date().toISOString().slice(0, 10)) => ({
  id: agreement.id,
  reference: agreement.reference,
  status: agreement.status,
  validFrom: day(agreement.validFrom),
  validTo: day(agreement.validTo),
  inForce: agreement.status === 'active' && (day(agreement.validFrom) ?? '') <= today && (agreement.validTo === null || (day(agreement.validTo) ?? '') >= today),
  commissionNote: agreement.commissionNote,
  commissionSchemeKey: agreement.commissionSchemeKey,
  documentId: agreement.documentId,
  activatedAt: agreement.activatedAt?.toISOString() ?? null,
  terminatedAt: agreement.terminatedAt?.toISOString() ?? null,
  terminationReason: agreement.terminationReason,
  version: agreement.version,
  createdAt: agreement.createdAt.toISOString(),
});

export const toContactView = (contact: LenderContact) => ({
  id: contact.id,
  name: contact.name,
  designation: contact.designation,
  role: contact.role,
  email: contact.emailMasked,
  mobile: contact.mobileMasked,
  escalationLevel: contact.escalationLevel,
  active: contact.active,
  version: contact.version,
  createdAt: contact.createdAt.toISOString(),
});
