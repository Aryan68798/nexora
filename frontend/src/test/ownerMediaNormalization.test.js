import { describe, it, expect } from 'vitest';
import { normalizeMedia, normalizeMediaList } from '../lib/mediaUtils';

describe('Owner Media Normalization Utilities', () => {
  describe('normalizeMedia', () => {
    it('normalizes camelCase media objects correctly', () => {
      const input = {
        id: 'media-1',
        url: 'https://example.com/photo1.jpg',
        isCover: true,
        sortOrder: 0,
        propertyId: 'prop-123',
      };

      const result = normalizeMedia(input);

      expect(result).toMatchObject({
        id: 'media-1',
        url: 'https://example.com/photo1.jpg',
        isCover: true,
        sortOrder: 0,
        propertyId: 'prop-123',
      });
    });

    it('normalizes snake_case database media objects to camelCase', () => {
      const input = {
        id: 'media-2',
        url: 'https://example.com/photo2.jpg',
        is_cover: true,
        sort_order: 3,
        property_id: 'prop-456',
        space_id: 'space-789',
      };

      const result = normalizeMedia(input);

      expect(result.id).toBe('media-2');
      expect(result.url).toBe('https://example.com/photo2.jpg');
      expect(result.isCover).toBe(true);
      expect(result.sortOrder).toBe(3);
      expect(result.propertyId).toBe('prop-456');
      expect(result.spaceId).toBe('space-789');
    });

    it('defaults sortOrder to 0 and isCover to false when omitted', () => {
      const input = {
        id: 'media-3',
        url: 'https://example.com/photo3.jpg',
      };

      const result = normalizeMedia(input);

      expect(result.isCover).toBe(false);
      expect(result.sortOrder).toBe(0);
    });

    it('handles null and undefined gracefully', () => {
      expect(normalizeMedia(null)).toBeNull();
      expect(normalizeMedia(undefined)).toBeNull();
    });
  });

  describe('normalizeMediaList', () => {
    it('normalizes and sorts a mixed list of camelCase and snake_case media by sortOrder', () => {
      const rawList = [
        { id: 'm3', url: 'https://example.com/3.jpg', sort_order: 2, is_cover: false },
        { id: 'm1', url: 'https://example.com/1.jpg', sortOrder: 0, isCover: true },
        { id: 'm2', url: 'https://example.com/2.jpg', sort_order: 1, is_cover: false },
      ];

      const normalized = normalizeMediaList(rawList);

      expect(normalized).toHaveLength(3);
      expect(normalized[0].id).toBe('m1');
      expect(normalized[0].sortOrder).toBe(0);
      expect(normalized[0].isCover).toBe(true);

      expect(normalized[1].id).toBe('m2');
      expect(normalized[1].sortOrder).toBe(1);

      expect(normalized[2].id).toBe('m3');
      expect(normalized[2].sortOrder).toBe(2);
    });

    it('returns empty array when input is not an array', () => {
      expect(normalizeMediaList(null)).toEqual([]);
      expect(normalizeMediaList(undefined)).toEqual([]);
      expect(normalizeMediaList({})).toEqual([]);
    });
  });
});
