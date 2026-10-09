/**
 * Image Capture Storage Service
 * Handles CRUD operations for image captures
 * Completely independent from highlight storage
 */

import type {
  ImageCapture,
  ImageTag,
  ImageStorageStats
} from '@/types/image-capture';
import { HIGHLIGHT_COLORS, type HighlightColor } from '@/types/highlight';

const STORAGE_KEYS = {
  CAPTURES: 'imageCaptures',
  TAGS: 'imageTags'
} as const;

class ImageCaptureStorage {
  /**
   * Save a new image capture
   */
  async saveCapture(capture: ImageCapture): Promise<void> {
    const data = await chrome.storage.local.get(STORAGE_KEYS.CAPTURES);
    const captures = data[STORAGE_KEYS.CAPTURES] || {};

    captures[capture.id] = capture;

    await chrome.storage.local.set({ [STORAGE_KEYS.CAPTURES]: captures });

    // Update tag statistics
    await this.updateTagStats(capture.tags);
  }

  /**
   * Get all image captures
   */
  async getAllCaptures(): Promise<ImageCapture[]> {
    const data = await chrome.storage.local.get(STORAGE_KEYS.CAPTURES);
    const captures = data[STORAGE_KEYS.CAPTURES] || {};

    return (Object.values(captures) as ImageCapture[]).sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Get a single capture by ID
   */
  async getCaptureById(id: string): Promise<ImageCapture | null> {
    const data = await chrome.storage.local.get(STORAGE_KEYS.CAPTURES);
    const captures = data[STORAGE_KEYS.CAPTURES] || {};

    return captures[id] || null;
  }

  /**
   * Update an existing capture
   */
  async updateCapture(id: string, updates: Partial<ImageCapture>): Promise<void> {
    const data = await chrome.storage.local.get(STORAGE_KEYS.CAPTURES);
    const captures = data[STORAGE_KEYS.CAPTURES] || {};

    if (!captures[id]) {
      throw new Error(`Capture with ID ${id} not found`);
    }

    const oldTags = captures[id].tags;
    captures[id] = { ...captures[id], ...updates };

    await chrome.storage.local.set({ [STORAGE_KEYS.CAPTURES]: captures });

    // Update tag statistics if tags changed
    if (updates.tags && JSON.stringify(oldTags) !== JSON.stringify(updates.tags)) {
      await this.rebuildTagStats();
    }
  }

  /**
   * Delete a capture
   */
  async deleteCapture(id: string): Promise<void> {
    const data = await chrome.storage.local.get(STORAGE_KEYS.CAPTURES);
    const captures = data[STORAGE_KEYS.CAPTURES] || {};

    const capture = captures[id];
    if (!capture) {
      throw new Error(`Capture with ID ${id} not found`);
    }

    delete captures[id];

    await chrome.storage.local.set({ [STORAGE_KEYS.CAPTURES]: captures });

    // Rebuild tag statistics
    await this.rebuildTagStats();
  }

  /**
   * Get all tags with statistics
   */
  async getAllTags(): Promise<ImageTag[]> {
    const data = await chrome.storage.local.get(STORAGE_KEYS.TAGS);
    const tags = data[STORAGE_KEYS.TAGS] || {};

    return (Object.values(tags) as ImageTag[]).sort((a, b) => b.captureCount - a.captureCount);
  }

  /**
   * Update tag statistics
   */
  private async updateTagStats(tagNames: string[]): Promise<void> {
    const data = await chrome.storage.local.get(STORAGE_KEYS.TAGS);
    const tags = data[STORAGE_KEYS.TAGS] || {};

    for (const tagName of tagNames) {
      const normalizedName = tagName.trim();
      if (!normalizedName) continue;

      if (!tags[normalizedName]) {
        // Create new tag with random color
        const colorKeys = Object.keys(HIGHLIGHT_COLORS) as HighlightColor[];
        const randomColor = colorKeys[Math.floor(Math.random() * colorKeys.length)];

        tags[normalizedName] = {
          name: normalizedName,
          color: randomColor,
          captureCount: 0,
          createdAt: Date.now()
        };
      }
    }

    await chrome.storage.local.set({ [STORAGE_KEYS.TAGS]: tags });
    await this.rebuildTagStats();
  }

  /**
   * Rebuild tag statistics from actual captures
   */
  private async rebuildTagStats(): Promise<void> {
    const allCaptures = await this.getAllCaptures();
    const data = await chrome.storage.local.get(STORAGE_KEYS.TAGS);
    const tags = data[STORAGE_KEYS.TAGS] || {};

    // Reset all counts
    for (const tagName in tags) {
      tags[tagName].captureCount = 0;
    }

    // Count tag usage
    for (const capture of allCaptures) {
      for (const tagName of capture.tags) {
        if (tags[tagName]) {
          tags[tagName].captureCount++;
        }
      }
    }

    // Remove tags with zero count
    for (const tagName in tags) {
      if (tags[tagName].captureCount === 0) {
        delete tags[tagName];
      }
    }

    await chrome.storage.local.set({ [STORAGE_KEYS.TAGS]: tags });
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<ImageStorageStats> {
    const allCaptures = await this.getAllCaptures();
    const allTags = await this.getAllTags();

    let totalSize = 0;
    for (const capture of allCaptures) {
      // Approximate size from base64 data URL
      const base64 = capture.imageData.split(',')[1];
      if (base64) {
        const padding = (base64.match(/=/g) || []).length;
        totalSize += (base64.length * 3) / 4 - padding;
      }
    }

    return {
      totalCaptures: allCaptures.length,
      totalSize,
      totalTags: allTags.length
    };
  }
}

export const imageCaptureStorage = new ImageCaptureStorage();
