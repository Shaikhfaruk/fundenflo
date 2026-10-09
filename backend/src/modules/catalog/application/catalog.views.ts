import { CatalogStatus } from '../../../common/enums/db.enums.js';
import { type Locale, localise, type LocalisedText } from '../../../common/i18n/locale.js';
import { paiseToNumber } from '../../../common/money/paise.js';
import type { CategoryPurpose, LookupAlias, SubSegment } from '../../../generated/prisma/client.js';
import type { AvailabilityReason } from '../domain/catalog.constants.js';
import type { CategoryWithRelations, SegmentWithSubSegments } from '../infrastructure/catalog.repository.js';
import type { CityWithState, PincodeWithPlace } from '../infrastructure/geo.repository.js';

export type SegmentView = {
  key: string;
  label: string;
  description: string | null;
  icon: string | null;
  subSegments: Array<{ key: string; label: string }>;
};

export type CategoryConfigView = {
  key: string;
  label: string;
  icon: string;
  segments: string[];
  minAmountPaise: number;
  maxAmountPaise: number;
  stepPaise: number;
  defaultAmountPaise: number;
  tenureOptionsMonths: number[];
  illustrativeRateBps: number | null;
  purposes: Array<{ key: string; label: string; requiresNote: boolean }>;
};

export type CategoryAvailability = { available: boolean; reason: AvailabilityReason | null };

export type CategoryView = CategoryConfigView & { availability: CategoryAvailability };

export const toSegmentView = (segment: SegmentWithSubSegments, locale: Locale): SegmentView => ({
  key: segment.key,
  label: localise(segment.label, locale),
  description: segment.description ? localise(segment.description, locale) : null,
  icon: segment.icon,
  subSegments: segment.subSegments.filter((sub) => sub.status === CatalogStatus.active).map((sub) => ({ key: sub.key, label: localise(sub.label, locale) })),
});

export const toCategoryConfigView = (category: CategoryWithRelations, locale: Locale): CategoryConfigView => ({
  key: category.key,
  label: localise(category.label, locale),
  icon: category.icon,
  segments: category.segments.map((link) => link.segment.key),
  minAmountPaise: paiseToNumber(category.minAmountPaise),
  maxAmountPaise: paiseToNumber(category.maxAmountPaise),
  stepPaise: paiseToNumber(category.stepPaise),
  defaultAmountPaise: paiseToNumber(category.defaultAmountPaise),
  tenureOptionsMonths: category.tenureOptionsMonths,
  illustrativeRateBps: category.illustrativeRateBps,
  purposes: category.purposes
    .filter((purpose) => purpose.status === CatalogStatus.active)
    .map((purpose) => ({ key: purpose.key, label: localise(purpose.label, locale), requiresNote: purpose.requiresNote })),
});

export const toSubSegmentAdminView = (sub: SubSegment) => ({
  id: sub.id,
  key: sub.key,
  label: sub.label as LocalisedText,
  sortOrder: sub.sortOrder,
  status: sub.status,
  version: sub.version,
});

export const toSegmentAdminView = (segment: SegmentWithSubSegments) => ({
  id: segment.id,
  key: segment.key,
  label: segment.label as LocalisedText,
  description: (segment.description as LocalisedText | null) ?? null,
  icon: segment.icon,
  sortOrder: segment.sortOrder,
  status: segment.status,
  version: segment.version,
  subSegments: segment.subSegments.map(toSubSegmentAdminView),
  updatedAt: segment.updatedAt.toISOString(),
});

export const toPurposeAdminView = (purpose: CategoryPurpose) => ({
  id: purpose.id,
  key: purpose.key,
  label: purpose.label as LocalisedText,
  requiresNote: purpose.requiresNote,
  sortOrder: purpose.sortOrder,
  status: purpose.status,
  version: purpose.version,
});

export const toCategoryAdminView = (category: CategoryWithRelations) => ({
  id: category.id,
  key: category.key,
  label: category.label as LocalisedText,
  icon: category.icon,
  segments: category.segments.map((link) => ({ key: link.segment.key, sortOrder: link.sortOrder })),
  minAmountPaise: paiseToNumber(category.minAmountPaise),
  maxAmountPaise: paiseToNumber(category.maxAmountPaise),
  stepPaise: paiseToNumber(category.stepPaise),
  defaultAmountPaise: paiseToNumber(category.defaultAmountPaise),
  tenureOptionsMonths: category.tenureOptionsMonths,
  illustrativeRateBps: category.illustrativeRateBps,
  sortOrder: category.sortOrder,
  status: category.status,
  version: category.version,
  purposes: category.purposes.map(toPurposeAdminView),
  updatedAt: category.updatedAt.toISOString(),
});

export const toCityView = (city: CityWithState) => ({
  id: city.id,
  name: city.name,
  status: city.status,
  version: city.version,
  state: city.state,
});

export const toPincodeView = (pincode: PincodeWithPlace) => ({
  pincode: pincode.pincode,
  district: pincode.district,
  status: pincode.status,
  state: pincode.state,
  city: pincode.city,
});

export const toAliasView = (alias: LookupAlias) => ({
  id: alias.id,
  kind: alias.kind,
  alias: alias.alias,
  targetId: alias.targetId,
  createdAt: alias.createdAt.toISOString(),
});
