/**
 * Type definitions for Image Capture functionality
 * Defines data structures for captured images, tags, and storage
 * This is completely independent from the highlight system
 */

/**
 * Core image capture object stored in Chrome Storage
 */
export interface ImageCapture {
  id: string;
  imageData: string;          // Base64 data URL — PNG for region captures (crisp text), JPEG q95 for full-page
  url: string;                 // Source webpage URL
  tags: string[];              // Independent tag system (not shared with highlights)
  note: string;                // User-provided note/description
  createdAt: number;           // Unix timestamp
  // New optional fields — backward-compatible
  title?: string;              // User-defined title for this capture
  linkedIds?: string[];        // IDs of linked highlights or captures
  ocrText?: string;
  ocrStatus?: OcrStatus;
  ocrLang?: string;
  price?: CapturePrice;
}

export interface CapturePrice {
  amount: number;
  label: string;
  source: 'ocr' | 'manual';
}

export type OcrStatus = 'done' | 'failed';

/**
 * Tag object with metadata for image captures
 * Completely independent from highlight tags
 */
export interface ImageTag {
  name: string;
  color: string;
  captureCount: number;       // Number of captures using this tag
  createdAt: number;           // Unix timestamp
}

/**
 * Rectangle coordinates for screenshot selection
 */
export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Storage stats for image captures
 */
export interface ImageStorageStats {
  totalCaptures: number;
  totalSize: number;          // Total size in bytes
  totalTags: number;
}
