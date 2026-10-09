/**
 * Type definitions for Chrome Highlighter Extension
 * Defines data structures for highlights, tags, and storage
 */

/**
 * Position information for text highlight on webpage
 */
export interface HighlightPosition {
  startOffset: number;
  endOffset: number;
  xpath: string;
  endXpath?: string;
  textContent: string;
}

/**
 * Core highlight object stored in Chrome Storage
 */
export interface Highlight {
  id: string;
  url: string;
  pageTitle: string;
  text: string;
  tags: string[];
  color: HighlightColor;
  position: HighlightPosition;
  createdAt: number;
  updatedAt: number;
  // New optional fields — backward-compatible with existing data
  title?: string;       // User-defined title for this highlight
  note?: string;        // Free-text annotation / study note
  linkedIds?: string[]; // IDs of linked highlights or captures
}

/**
 * Tag object with metadata
 */
export interface Tag {
  name: string;
  color: string;
  highlightCount: number;
  createdAt: number;
}

/**
 * User settings for extension behavior
 */
export interface Settings {
  defaultColor: HighlightColor;
  language: LanguageSetting;
}

/**
 * Supported highlight colors
 */
export type HighlightColor =
  | 'yellow'
  | 'mint'
  | 'coral'
  | 'peach'
  | 'lavender'
  | 'sky';

/**
 * Supported interface languages
 */
export type LanguageSetting = 'auto' | 'en' | 'zh-TW';

/**
 * Color mapping for Tailwind CSS classes
 */
export const HIGHLIGHT_COLORS: Record<HighlightColor, string> = {
  yellow: 'bg-highlight-yellow',
  mint: 'bg-highlight-mint',
  coral: 'bg-highlight-coral',
  peach: 'bg-highlight-peach',
  lavender: 'bg-highlight-lavender',
  sky: 'bg-highlight-sky'
};

/**
 * Export/Import data format
 */
export interface ExportData {
  version: string;
  exportDate: number;
  highlights: Highlight[];
  tags: Tag[];
}

/**
 * Error types for extension
 */
export enum ErrorType {
  STORAGE_QUOTA_EXCEEDED = 'STORAGE_QUOTA_EXCEEDED',
  INVALID_IMPORT_DATA = 'INVALID_IMPORT_DATA',
  HIGHLIGHT_POSITION_ERROR = 'HIGHLIGHT_POSITION_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR'
}

/**
 * Custom error class for extension
 */
export class ExtensionError extends Error {
  type: ErrorType;
  details?: unknown;

  constructor(message: string, type: ErrorType, details?: unknown) {
    super(message);
    this.name = 'ExtensionError';
    this.type = type;
    this.details = details;
  }
}
