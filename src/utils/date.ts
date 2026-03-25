/**
 * Date Utility Functions
 * Centralized date formatting and manipulation
 */

/**
 * Format timestamp to locale date string
 * @param timestamp - Unix timestamp in milliseconds
 * @param locale - Locale string (default: browser locale)
 * @returns Formatted date string
 */
export function formatDate(timestamp: number, locale?: string): string {
  return new Date(timestamp).toLocaleDateString(locale);
}

/**
 * Format timestamp to locale date and time string
 * @param timestamp - Unix timestamp in milliseconds
 * @param locale - Locale string (default: browser locale)
 * @returns Formatted date and time string
 */
export function formatDateTime(timestamp: number, locale?: string): string {
  return new Date(timestamp).toLocaleString(locale);
}

/**
 * Get ISO date string (YYYY-MM-DD)
 * @param date - Date object or timestamp (default: now)
 * @returns ISO date string
 */
export function getISODate(date?: Date | number): string {
  const dateObj = date ? (date instanceof Date ? date : new Date(date)) : new Date();
  return dateObj.toISOString().split('T')[0];
}

/**
 * Get relative time string (e.g., "2 days ago")
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Relative time string
 */
export function getRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (years > 0) {
    return `${years} year${years > 1 ? 's' : ''} ago`;
  }
  if (months > 0) {
    return `${months} month${months > 1 ? 's' : ''} ago`;
  }
  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }
  if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  }
  if (minutes > 0) {
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  }
  return 'just now';
}

/**
 * Check if timestamp is today
 * @param timestamp - Unix timestamp in milliseconds
 * @returns True if timestamp is today
 */
export function isToday(timestamp: number): boolean {
  const today = new Date();
  const date = new Date(timestamp);

  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

/**
 * Get start of day timestamp
 * @param date - Date object or timestamp (default: now)
 * @returns Unix timestamp at start of day (00:00:00)
 */
export function getStartOfDay(date?: Date | number): number {
  const dateObj = date ? (date instanceof Date ? date : new Date(date)) : new Date();
  dateObj.setHours(0, 0, 0, 0);
  return dateObj.getTime();
}

/**
 * Get end of day timestamp
 * @param date - Date object or timestamp (default: now)
 * @returns Unix timestamp at end of day (23:59:59.999)
 */
export function getEndOfDay(date?: Date | number): number {
  const dateObj = date ? (date instanceof Date ? date : new Date(date)) : new Date();
  dateObj.setHours(23, 59, 59, 999);
  return dateObj.getTime();
}
