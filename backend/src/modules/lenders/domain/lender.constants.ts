export const LENDER_KEY_PATTERN = /^[a-z][a-z0-9_]{1,39}$/;

export const LENDER_PRODUCT_KEY_SEPARATOR = '.';

export const LENDER_CACHE_TAG = 'lenders';

export const LENDER_CACHE_TTL_SECONDS = 300;

export const LENDER_RULES_MAX = 50;

export const LENDER_PRODUCT_DOCUMENTS_MAX = 30;

export const LENDER_SIMULATION_PROFILES_MAX = 50;

export const LENDER_NEED_SOURCE_KEY = 'lender_products';

export const LENDER_ROUTE_SOURCE_KEY = 'lenders';

export const LENDER_NEED_STAGES = ['pre_check', 'profile'] as const;

export const SOFT_RULE_WEIGHT_MAX = 10;

export const LENDER_CONTACTS_MAX = 50;
