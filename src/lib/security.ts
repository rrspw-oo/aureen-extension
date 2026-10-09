/**
 * Escape HTML special characters to prevent XSS
 */
export function escapeHtml(text: string): string {
  if (typeof text !== 'string') {
    return '';
  }

  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;'
  };

  return text.replace(/[&<>"'/]/g, (char) => map[char] || char);
}

/**
 * Validate and sanitize tag names
 * Only allows alphanumeric, hyphens, and underscores
 */
export function sanitizeTagName(tag: string): string {
  if (typeof tag !== 'string') {
    return '';
  }

  // Remove hash if present at start
  let cleaned = tag.trim();
  if (cleaned.startsWith('#')) {
    cleaned = cleaned.substring(1);
  }

  // Only allow alphanumeric, hyphens, underscores, and certain unicode characters
  cleaned = cleaned.replace(/[^a-zA-Z0-9\-_\u4e00-\u9fff\u3400-\u4dbf]/g, '');

  // Limit length
  return cleaned.substring(0, 50);
}

/**
 * Generate cryptographically secure random ID
 */
export function generateSecureId(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
