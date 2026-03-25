/**
 * Text Processing Utilities
 * Functions for tag validation, text sanitization, and string manipulation
 */

/**
 * Validate tag name
 * Tags must be alphanumeric with optional hyphens and underscores
 */
export function validateTagName(tagName: string): boolean {
  if (!tagName || tagName.trim().length === 0) {
    return false;
  }

  // Remove hash symbol if present
  const cleanTag = tagName.startsWith('#') ? tagName.slice(1) : tagName;

  // Check if tag contains only allowed characters
  const tagRegex = /^[a-zA-Z0-9_-]+$/;
  return tagRegex.test(cleanTag);
}

/**
 * Normalize tag name
 * Removes hash symbol, trims whitespace, converts to lowercase
 */
export function normalizeTagName(tagName: string): string {
  let normalized = tagName.trim();

  // Remove hash symbol if present
  if (normalized.startsWith('#')) {
    normalized = normalized.slice(1);
  }

  // Convert to lowercase for consistency
  normalized = normalized.toLowerCase();

  return normalized;
}

/**
 * Parse tag string into array of normalized tag names
 * Supports space and comma separators
 */
export function parseTagString(tagString: string): string[] {
  if (!tagString || tagString.trim().length === 0) {
    return [];
  }

  // Split by comma or space
  const tags = tagString.split(/[,\s]+/);

  // Normalize and validate each tag
  const validTags = tags
    .map((tag) => normalizeTagName(tag))
    .filter((tag) => tag.length > 0 && validateTagName(tag));

  // Remove duplicates
  return Array.from(new Set(validTags));
}

/**
 * Add hash symbol to tag for display
 */
export function formatTagForDisplay(tagName: string): string {
  return tagName.startsWith('#') ? tagName : `#${tagName}`;
}

/**
 * Sanitize text content for storage
 * Removes excessive whitespace and control characters
 */
export function sanitizeText(text: string): string {
  // Replace multiple spaces with single space
  let sanitized = text.replace(/\s+/g, ' ');

  // Remove control characters except newlines
  sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');

  // Trim whitespace
  sanitized = sanitized.trim();

  return sanitized;
}

/**
 * Truncate text to specified length with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (error) {
    console.error('Error extracting domain:', error);
    return url;
  }
}

/**
 * Generate unique ID for highlight
 */
export function generateHighlightId(): string {
  const timestamp = Date.now().toString(36);
  const randomStr = Math.random().toString(36).substring(2, 9);
  return `highlight-${timestamp}-${randomStr}`;
}

/**
 * Format date for display
 */
export function formatDate(timestamp: number, locale = 'en'): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Format relative time (e.g., "2 days ago")
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;
  const month = 30 * day;

  if (diff < minute) {
    return 'just now';
  } else if (diff < hour) {
    const minutes = Math.floor(diff / minute);
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  } else if (diff < day) {
    const hours = Math.floor(diff / hour);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else if (diff < week) {
    const days = Math.floor(diff / day);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  } else if (diff < month) {
    const weeks = Math.floor(diff / week);
    return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
  } else {
    const months = Math.floor(diff / month);
    return `${months} month${months > 1 ? 's' : ''} ago`;
  }
}

/**
 * Highlight search terms in text
 */
export function highlightSearchTerms(text: string, searchTerm: string): string {
  if (!searchTerm || searchTerm.trim().length === 0) {
    return text;
  }

  const regex = new RegExp(`(${searchTerm})`, 'gi');
  return text.replace(regex, '<mark class="search-highlight">$1</mark>');
}

/**
 * Check if URL is valid
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Clean URL for comparison (removes hash and query params)
 */
export function cleanUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
  } catch {
    return url;
  }
}

/**
 * Escape HTML special characters
 */
export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Calculate reading time estimate (words per minute)
 */
export function estimateReadingTime(text: string, wordsPerMinute = 200): number {
  const words = text.trim().split(/\s+/).length;
  return Math.ceil(words / wordsPerMinute);
}

/**
 * Group items by property value
 */
export function groupBy<T>(
  items: T[],
  keySelector: (item: T) => string
): Map<string, T[]> {
  const groups = new Map<string, T[]>();

  for (const item of items) {
    const key = keySelector(item);
    const group = groups.get(key) || [];
    group.push(item);
    groups.set(key, group);
  }

  return groups;
}

/**
 * Sort items by multiple criteria
 */
export function sortBy<T>(
  items: T[],
  selectors: Array<{
    key: (item: T) => string | number;
    order: 'asc' | 'desc';
  }>
): T[] {
  return items.sort((a, b) => {
    for (const selector of selectors) {
      const aVal = selector.key(a);
      const bVal = selector.key(b);

      if (aVal < bVal) {
        return selector.order === 'asc' ? -1 : 1;
      }
      if (aVal > bVal) {
        return selector.order === 'asc' ? 1 : -1;
      }
    }
    return 0;
  });
}
