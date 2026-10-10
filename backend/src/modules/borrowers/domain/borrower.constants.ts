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

export const PanHolder = {
  Person: 'P',
  Company: 'C',
  Firm: 'F',
  Llp: 'E',
} as const;

export type PanHolder = (typeof PanHolder)[keyof typeof PanHolder];

export const PAN_HOLDER_FOR_SUB_SEGMENT: Record<string, PanHolder> = {
  proprietorship: PanHolder.Person,
  partnership: PanHolder.Firm,
  llp: PanHolder.Llp,
  private_limited: PanHolder.Company,
};

export const PAN_HOLDER_INDEX = 3;

export const PAN_VERIFY_RATE_LIMIT = { limit: 5, windowSeconds: 86_400 } as const;

export const KYC_SOURCE_PREFIX = 'kyc';
