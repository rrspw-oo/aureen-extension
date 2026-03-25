/**
 * Security Utilities
 * Provides functions for input sanitization, XSS prevention, and secure data handling
 */

/**
 * Sanitize HTML to prevent XSS attacks
 * Removes all HTML tags and dangerous characters
 */
export function sanitizeHtml(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  // Create a temporary element to decode HTML entities
  const temp = document.createElement('div');
  temp.textContent = input;
  const decoded = temp.innerHTML;

  // Remove all HTML tags and scripts
  return decoded
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
}

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
 * Validate URL to prevent malicious URLs
 */
export function isValidUrl(url: string): boolean {
  if (typeof url !== 'string') {
    return false;
  }

  try {
    const parsed = new URL(url);
    // Only allow http and https protocols
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Sanitize URL to prevent XSS in href attributes
 */
export function sanitizeUrl(url: string): string {
  if (!isValidUrl(url)) {
    return '#';
  }

  // Remove javascript: and data: protocols
  if (url.toLowerCase().startsWith('javascript:') || url.toLowerCase().startsWith('data:')) {
    return '#';
  }

  return url;
}

/**
 * Validate and sanitize text input
 * Prevents control characters and excessive length
 */
export function sanitizeTextInput(input: string, maxLength = 10000): string {
  if (typeof input !== 'string') {
    return '';
  }

  // Remove control characters except newline and tab
  let sanitized = input.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');

  // Limit length
  sanitized = sanitized.substring(0, maxLength);

  return sanitized.trim();
}

/**
 * Validate color value to prevent CSS injection
 */
export function isValidColor(color: string): boolean {
  if (typeof color !== 'string') {
    return false;
  }

  // Allow only predefined color names or hex colors
  const validColors = [
    'yellow', 'mint', 'coral', 'peach', 'lavender', 'sky',
    'red', 'green', 'blue', 'orange', 'purple', 'pink'
  ];

  const hexPattern = /^#[0-9A-Fa-f]{6}$/;

  return validColors.includes(color.toLowerCase()) || hexPattern.test(color);
}

/**
 * Sanitize JSON data before parsing to prevent prototype pollution
 */
export function safeJsonParse<T>(jsonString: string): T | null {
  try {
    // First, validate that it's valid JSON
    const parsed = JSON.parse(jsonString);

    // Check for __proto__ or constructor properties (prototype pollution)
    const jsonStr = JSON.stringify(parsed);
    if (jsonStr.includes('__proto__') || jsonStr.includes('"constructor"')) {
      console.error('Potential prototype pollution detected in JSON');
      return null;
    }

    return parsed as T;
  } catch (error) {
    console.error('Invalid JSON:', error);
    return null;
  }
}

/**
 * Rate limiting helper to prevent abuse
 */
export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private readonly maxRequests: number;
  private readonly timeWindow: number;

  constructor(maxRequests = 10, timeWindowMs = 60000) {
    this.maxRequests = maxRequests;
    this.timeWindow = timeWindowMs;
  }

  /**
   * Check if request is allowed for given key
   */
  isAllowed(key: string): boolean {
    const now = Date.now();
    const requests = this.requests.get(key) || [];

    // Remove old requests outside time window
    const validRequests = requests.filter((timestamp) => now - timestamp < this.timeWindow);

    if (validRequests.length >= this.maxRequests) {
      return false;
    }

    validRequests.push(now);
    this.requests.set(key, validRequests);

    return true;
  }

  /**
   * Clear rate limit for a key
   */
  clear(key: string): void {
    this.requests.delete(key);
  }

  /**
   * Clear all rate limits
   */
  clearAll(): void {
    this.requests.clear();
  }
}

/**
 * Validate file upload to prevent malicious files
 */
export function validateFileUpload(file: File): { valid: boolean; error?: string } {
  // Check file type
  if (file.type !== 'application/json') {
    return { valid: false, error: 'Only JSON files are allowed' };
  }

  // Check file size (max 10MB)
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    return { valid: false, error: 'File size exceeds 10MB limit' };
  }

  // Check file name
  const validNamePattern = /^[\w\-. ]+\.json$/i;
  if (!validNamePattern.test(file.name)) {
    return { valid: false, error: 'Invalid file name format' };
  }

  return { valid: true };
}

/**
 * Create Content Security Policy for inline content
 */
export function createSecureInlineStyle(styles: Record<string, string>): string {
  const sanitizedStyles: string[] = [];

  for (const [property, value] of Object.entries(styles)) {
    // Validate property name (only alphanumeric and hyphens)
    if (!/^[a-z\-]+$/i.test(property)) {
      continue;
    }

    // Sanitize value
    let sanitizedValue = String(value).replace(/[^\w\s\-,.#()%]/g, '');

    // Prevent expression injection
    if (sanitizedValue.includes('expression') || sanitizedValue.includes('javascript:')) {
      continue;
    }

    sanitizedStyles.push(`${property}: ${sanitizedValue}`);
  }

  return sanitizedStyles.join('; ');
}

/**
 * Prevent clickjacking by checking if page is framed
 */
export function isPageFramed(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/**
 * Generate cryptographically secure random ID
 */
export function generateSecureId(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Validate highlight data structure for security
 */
export function validateHighlightData(data: unknown): boolean {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const highlight = data as Record<string, unknown>;

  // Check required fields exist and have correct types
  if (typeof highlight.id !== 'string' || highlight.id.length === 0) {
    return false;
  }

  if (typeof highlight.text !== 'string' || highlight.text.length === 0) {
    return false;
  }

  if (typeof highlight.url !== 'string' || !isValidUrl(highlight.url)) {
    return false;
  }

  if (!Array.isArray(highlight.tags)) {
    return false;
  }

  if (typeof highlight.color !== 'string' || !isValidColor(highlight.color)) {
    return false;
  }

  return true;
}
