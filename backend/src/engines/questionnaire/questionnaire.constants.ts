export const QUESTIONNAIRE_LIMITS = {
  maxItems: 100,
  maxOptions: 50,
  maxSections: 20,
  maxTextLength: 2_000,
  maxPatternLength: 200,
} as const;

export const PINCODE_PATTERN = /^[1-9]\d{5}$/;

export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
