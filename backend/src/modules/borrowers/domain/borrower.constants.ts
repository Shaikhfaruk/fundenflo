import { RelationshipType } from '../../../common/enums/db.enums.js';

export const BorrowerSegment = {
  Individual: 'individual',
  Msme: 'msme',
} as const;

export const SUB_SEGMENT_RELATIONSHIP: Record<string, RelationshipType> = {
  proprietorship: RelationshipType.proprietor_of,
  partnership: RelationshipType.partner_of,
  llp: RelationshipType.partner_of,
  private_limited: RelationshipType.director_of,
};

export const DEFAULT_BUSINESS_RELATIONSHIP = RelationshipType.signatory_of;
