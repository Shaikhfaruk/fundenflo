export const PartnerKind = {
  Ca: 'ca',
  Dsa: 'dsa',
  Connector: 'connector',
} as const;

export const SERVICE_LANGUAGES = ['en', 'hi', 'bn', 'mr', 'gu', 'ta', 'te', 'kn', 'ml', 'pa', 'or'] as const;

export const PartnerVerificationStatus = {
  Pending: 'pending',
  InReview: 'in_review',
  Verified: 'verified',
  Rejected: 'rejected',
} as const;
