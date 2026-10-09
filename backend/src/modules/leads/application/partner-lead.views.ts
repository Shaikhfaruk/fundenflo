import { AssignmentStatus } from '../../../common/enums/db.enums.js';
import { paiseToNumber } from '../../../common/money/paise.js';
import { maskName } from '../../../engines/party-matching/mask.js';
import type { PartnerAssignmentRow } from '../infrastructure/lead.repository.js';

const iso = (value: Date | null) => value?.toISOString() ?? null;

const paise = (value: bigint | null) => (value === null ? null : paiseToNumber(value));

const ACCEPTED: readonly AssignmentStatus[] = [AssignmentStatus.accepted, AssignmentStatus.working, AssignmentStatus.completed];

type ContactView = { type: string; masked: string; primary: boolean; doNotContact: boolean; invalid: boolean };

export const toPartnerLeadView = (assignment: PartnerAssignmentRow, contacts?: ContactView[]) => {
  const { lead } = assignment;
  const accepted = ACCEPTED.includes(assignment.status);
  const name = lead.party.displayName;
  return {
    assignment: {
      id: assignment.id,
      status: assignment.status,
      strategy: assignment.strategy,
      assigneeMembershipId: assignment.assigneeMembershipId,
      offeredAt: assignment.offeredAt.toISOString(),
      respondBy: iso(assignment.respondBy),
      acceptedAt: iso(assignment.acceptedAt),
      firstContactBy: iso(assignment.firstContactBy),
      closedAt: iso(assignment.closedAt),
      reason: assignment.reason,
    },
    lead: {
      id: lead.id,
      ref: lead.ref,
      status: lead.status,
      name: accepted ? name : name && maskName(name),
      businessName: accepted ? (lead.businessParty?.displayName ?? null) : null,
      segmentKey: lead.segmentKey,
      subSegmentKey: lead.subSegmentKey,
      categoryKey: lead.categoryKey,
      purposeKey: lead.purposeKey,
      purposeNote: accepted ? lead.purposeNote : null,
      amount: { minPaise: paise(lead.amountMinPaise), maxPaise: paise(lead.amountMaxPaise), text: lead.amountText },
      tenureMonths: lead.tenureMonths,
      location: { state: lead.state, city: lead.city, pincode: lead.pincode },
      urgency: lead.urgency,
      preferredLanguage: lead.preferredLanguage,
      preferredContactTime: lead.preferredContactTime,
      createdAt: lead.createdAt.toISOString(),
    },
    ...(contacts ? { contacts: contacts.map(({ type, masked, primary, doNotContact, invalid }) => ({ type, masked, primary, doNotContact, invalid })) } : {}),
  };
};
