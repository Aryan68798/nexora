/**
 * Media normalization utility.
 * The backend API returns media items with either snake_case (e.g. is_cover, sort_order, property_id)
 * from direct database queries, or camelCase (e.g. isCover, sortOrder, propertyId) from JSON schemas.
 * This utility guarantees consistent camelCase properties across all frontend components.
 */

export function normalizeMedia(item) {
  if (!item || typeof item !== 'object') return null;

  return {
    id: item.id || '',
    url: item.url || '',
    caption: item.caption || '',
    isCover: Boolean(item.isCover ?? item.is_cover),
    sortOrder: Number(item.sortOrder ?? item.sort_order ?? 0),
    propertyId: item.propertyId ?? item.property_id ?? null,
    spaceId: item.spaceId ?? item.space_id ?? null,
    createdAt: item.createdAt ?? item.created_at ?? null,
    updatedAt: item.updatedAt ?? item.updated_at ?? null,
  };
}

export function normalizeMediaList(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map(normalizeMedia)
    .filter(Boolean)
    .sort((a, b) => {
      // Cover first
      if (a.isCover && !b.isCover) return -1;
      if (!a.isCover && b.isCover) return 1;
      // Then by sortOrder ascending
      return a.sortOrder - b.sortOrder;
    });
}
