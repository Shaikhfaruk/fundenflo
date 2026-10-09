export const CatalogCacheTag = {
  Catalog: 'catalog',
  Geo: 'geo',
} as const;

export const CATALOG_CACHE_TTL_SECONDS = 300;

export const CITY_SEARCH_LIMIT = 20;

export const CITY_SEARCH_MIN_LENGTH = 2;

export const MAX_TENURE_MONTHS = 360;

export const PINCODE_PATTERN = /^[1-9]\d{5}$/;

export const GST_STATE_CODE_PATTERN = /^\d{2}$/;

export const CATALOG_KEY_PATTERN = /^[a-z][a-z0-9_-]{1,40}$/;

export const AvailabilityReason = {
  NoVerifiedLenderRoute: 'NO_VERIFIED_LENDER_ROUTE',
  CategoryInactive: 'CATEGORY_INACTIVE',
} as const;

export type AvailabilityReason = (typeof AvailabilityReason)[keyof typeof AvailabilityReason];
