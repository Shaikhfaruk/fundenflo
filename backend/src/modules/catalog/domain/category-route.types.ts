export const CATEGORY_ROUTE_SOURCE_METADATA = 'catalog:category-route-source';

export type AvailabilityContext = {
  segmentKey?: string;
  pincode?: string;
};

export interface CategoryRouteSource {
  availableCategories(categoryKeys: string[], context: AvailabilityContext): Promise<Set<string>>;
}
