import { t } from '@/i18n/config';

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
  const minutes = Math.floor((Date.now() - timestamp) / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (years > 0) return t('time.years', { count: years });
  if (months > 0) return t('time.months', { count: months });
  if (days > 0) return t('time.days', { count: days });
  if (hours > 0) return t('time.hours', { count: hours });
  if (minutes > 0) return t('time.minutes', { count: minutes });
  return t('time.justNow');
}
