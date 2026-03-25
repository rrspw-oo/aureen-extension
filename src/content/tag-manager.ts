/**
 * Tag Manager Module
 * Handles tag validation, parsing, and management
 */

import { sanitizeTagName } from '@/utils/security';

export class TagManager {
  private readonly maxTagLength = 50;
  private readonly maxTagsPerHighlight = 10;
  private readonly tagPattern = /^[a-zA-Z0-9\-_\u4e00-\u9fff\u3400-\u4dbf]+$/;

  /**
   * Parse tag input string into array of valid tags
   * Handles space and comma separation
   */
  parseTags(input: string): string[] {
    if (!input || typeof input !== 'string') {
      return [];
    }

    const separators = /[\s,]+/;
    const rawTags = input.split(separators).filter((tag) => tag.trim().length > 0);

    const validTags: string[] = [];
    const seen = new Set<string>();

    for (const rawTag of rawTags) {
      const sanitized = this.sanitizeTag(rawTag);

      if (sanitized && this.validateTag(sanitized) && !seen.has(sanitized.toLowerCase())) {
        validTags.push(sanitized);
        seen.add(sanitized.toLowerCase());

        if (validTags.length >= this.maxTagsPerHighlight) {
          break;
        }
      }
    }

    return validTags;
  }

  /**
   * Sanitize a single tag
   */
  sanitizeTag(tag: string): string {
    return sanitizeTagName(tag);
  }

  /**
   * Validate tag format
   */
  validateTag(tag: string): boolean {
    if (!tag || tag.length === 0) {
      return false;
    }

    if (tag.length > this.maxTagLength) {
      return false;
    }

    if (!this.tagPattern.test(tag)) {
      return false;
    }

    return true;
  }

  /**
   * Format tag for display (adds hash if not present)
   */
  formatTag(tag: string): string {
    const sanitized = this.sanitizeTag(tag);
    return sanitized.startsWith('#') ? sanitized : `#${sanitized}`;
  }

  /**
   * Remove duplicate tags (case-insensitive)
   */
  deduplicateTags(tags: string[]): string[] {
    const seen = new Set<string>();
    const unique: string[] = [];

    for (const tag of tags) {
      const lower = tag.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        unique.push(tag);
      }
    }

    return unique;
  }

  /**
   * Sort tags alphabetically
   */
  sortTags(tags: string[]): string[] {
    return [...tags].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  }

  /**
   * Filter tags by search query
   */
  filterTags(tags: string[], query: string): string[] {
    if (!query || query.trim().length === 0) {
      return tags;
    }

    const lowerQuery = query.toLowerCase();
    return tags.filter((tag) => tag.toLowerCase().includes(lowerQuery));
  }

  /**
   * Get tag suggestions based on existing tags
   */
  getSuggestions(
    input: string,
    existingTags: string[],
    maxSuggestions = 5
  ): string[] {
    if (!input || input.trim().length === 0) {
      return [];
    }

    const lowerInput = input.toLowerCase();
    const suggestions = existingTags
      .filter((tag) => tag.toLowerCase().startsWith(lowerInput))
      .slice(0, maxSuggestions);

    return suggestions;
  }

  /**
   * Validate array of tags
   */
  validateTags(tags: string[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!Array.isArray(tags)) {
      errors.push('Tags must be an array');
      return { valid: false, errors };
    }

    if (tags.length > this.maxTagsPerHighlight) {
      errors.push(`Maximum ${this.maxTagsPerHighlight} tags allowed`);
    }

    for (const tag of tags) {
      if (typeof tag !== 'string') {
        errors.push('All tags must be strings');
        continue;
      }

      if (!this.validateTag(tag)) {
        errors.push(`Invalid tag: "${tag}"`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Merge tag arrays from multiple sources
   */
  mergeTags(...tagArrays: string[][]): string[] {
    const merged = tagArrays.flat();
    return this.deduplicateTags(merged);
  }

  /**
   * Get tag statistics
   */
  getTagStats(tags: string[]): {
    count: number;
    averageLength: number;
    longest: string | null;
    shortest: string | null;
  } {
    if (tags.length === 0) {
      return {
        count: 0,
        averageLength: 0,
        longest: null,
        shortest: null
      };
    }

    const lengths = tags.map((tag) => tag.length);
    const totalLength = lengths.reduce((sum, len) => sum + len, 0);
    const averageLength = totalLength / tags.length;

    const longest = tags.reduce((a, b) => (a.length > b.length ? a : b));
    const shortest = tags.reduce((a, b) => (a.length < b.length ? a : b));

    return {
      count: tags.length,
      averageLength,
      longest,
      shortest
    };
  }

  /**
   * Check if tag name is reserved or forbidden
   */
  isReservedTag(tag: string): boolean {
    const reserved = [
      'all',
      'none',
      'undefined',
      'null',
      'admin',
      'system',
      'config'
    ];

    return reserved.includes(tag.toLowerCase());
  }
}

export const tagManager = new TagManager();
