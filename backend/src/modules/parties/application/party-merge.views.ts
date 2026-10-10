import type { Party, PartyContact, PartyIdentifier, PartyMatchReview, PartyMerge } from '../../../generated/prisma/client.js';

type PartyWithLinks = Party & {
  contacts: PartyContact[];
  identifiers: PartyIdentifier[];
  user: { id: string } | null;
  organization: { id: string; name: string; type: string } | null;
};

export type PartySummary = ReturnType<typeof toPartySummary>;

export const toPartySummary = (party: PartyWithLinks) => ({
  id: party.id,
  kind: party.kind,
  displayName: party.displayName,
  status: party.status,
  mergedIntoId: party.mergedIntoId,
  hasLogin: party.user !== null,
  organization: party.organization,
  contacts: party.contacts.map((contact) => ({ type: contact.type, masked: contact.valueMasked, primary: contact.isPrimary, verified: contact.verifiedAt !== null, doNotContact: contact.doNotContact, invalid: contact.invalidAt !== null })),
  identifiers: party.identifiers.map((identifier) => ({ type: identifier.type, masked: identifier.valueMasked, verified: identifier.verifiedAt !== null })),
  createdAt: party.createdAt.toISOString(),
});

export const toMatchReviewView = (review: PartyMatchReview, parties: PartySummary[]) => ({
  id: review.id,
  partyId: review.partyId,
  candidatePartyIds: review.candidatePartyIds,
  signals: review.signals,
  status: review.status,
  resolution: review.resolution,
  resolvedByUserId: review.resolvedByUserId,
  resolvedAt: review.resolvedAt?.toISOString() ?? null,
  createdAt: review.createdAt.toISOString(),
  ...(parties.length > 0 ? { parties } : {}),
});

export const toMergeView = (merge: PartyMerge) => ({
  id: merge.id,
  sourcePartyId: merge.sourcePartyId,
  targetPartyId: merge.targetPartyId,
  reason: merge.reason,
  mergedByUserId: merge.mergedByUserId,
  mergedAt: merge.mergedAt.toISOString(),
  revertedAt: merge.revertedAt?.toISOString() ?? null,
  revertedByUserId: merge.revertedByUserId,
});
