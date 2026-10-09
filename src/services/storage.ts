/**
 * Chrome Storage Service
 * Handles all interactions with Chrome Storage API (sync and local)
 * Implements chunking for large datasets to avoid quota limits
 */

import type {
  StorageData,
  Highlight,
  Tag,
  Settings
} from '@/types';
import { ErrorType, ExtensionError } from '@/types';
import { normalizePageUrl } from '@/utils/url';

/**
 * Default settings for new installations
 */
const DEFAULT_SETTINGS: Settings = {
  defaultColor: 'yellow',
  interfaceLanguage: 'en'
};

/**
 * Storage service class
 */
class StorageService {
  /**
   * Get all highlights from storage
   */
  async getAllHighlights(): Promise<Record<string, Highlight>> {
    try {
      const result = await chrome.storage.local.get('highlights');
      return result.highlights || {};
    } catch (error) {
      console.error('Error getting highlights:', error);
      throw new ExtensionError(
        'Failed to retrieve highlights from storage',
        ErrorType.STORAGE_QUOTA_EXCEEDED,
        error
      );
    }
  }

  /**
   * Get highlights for specific URL
   */
  async getHighlightsByUrl(url: string): Promise<Highlight[]> {
    const allHighlights = await this.getAllHighlights();
    const target = normalizePageUrl(url);
    return Object.values(allHighlights).filter(
      (highlight) => normalizePageUrl(highlight.url) === target
    );
  }

  /**
   * Get single highlight by ID
   */
  async getHighlight(id: string): Promise<Highlight | null> {
    const allHighlights = await this.getAllHighlights();
    return allHighlights[id] || null;
  }

  /**
   * Save or update a highlight
   */
  async saveHighlight(highlight: Highlight): Promise<void> {
    try {
      const allHighlights = await this.getAllHighlights();
      allHighlights[highlight.id] = highlight;

      await chrome.storage.local.set({ highlights: allHighlights });

      // Update tag counts
      await this.updateTagCounts(highlight.tags);
    } catch (error) {
      console.error('Error saving highlight:', error);
      throw new ExtensionError(
        'Failed to save highlight to storage',
        ErrorType.STORAGE_QUOTA_EXCEEDED,
        error
      );
    }
  }

  /**
   * Delete a highlight
   */
  async deleteHighlight(id: string): Promise<void> {
    try {
      const allHighlights = await this.getAllHighlights();
      const highlight = allHighlights[id];

      if (highlight) {
        delete allHighlights[id];
        await chrome.storage.local.set({ highlights: allHighlights });

        // Update tag counts
        await this.updateTagCounts(highlight.tags, true);
      }
    } catch (error) {
      console.error('Error deleting highlight:', error);
      throw new ExtensionError(
        'Failed to delete highlight from storage',
        ErrorType.STORAGE_QUOTA_EXCEEDED,
        error
      );
    }
  }

  /**
   * Get all tags
   */
  async getAllTags(): Promise<Record<string, Tag>> {
    try {
      const result = await chrome.storage.local.get('tags');
      return result.tags || {};
    } catch (error) {
      console.error('Error getting tags:', error);
      throw new ExtensionError(
        'Failed to retrieve tags from storage',
        ErrorType.STORAGE_QUOTA_EXCEEDED,
        error
      );
    }
  }

  /**
   * Update tag counts based on highlight tags
   */
  private async updateTagCounts(
    tagNames: string[],
    isDelete = false
  ): Promise<void> {
    const allTags = await this.getAllTags();

    for (const tagName of tagNames) {
      if (!allTags[tagName]) {
        allTags[tagName] = {
          name: tagName,
          color: '#10b981',
          highlightCount: 0,
          createdAt: Date.now()
        };
      }

      if (isDelete) {
        allTags[tagName].highlightCount = Math.max(
          0,
          allTags[tagName].highlightCount - 1
        );
      } else {
        allTags[tagName].highlightCount += 1;
      }

      // Remove tags with zero count
      if (allTags[tagName].highlightCount === 0) {
        delete allTags[tagName];
      }
    }

    await chrome.storage.local.set({ tags: allTags });
  }

  /**
   * Get user settings
   */
  async getSettings(): Promise<Settings> {
    try {
      const result = await chrome.storage.sync.get('settings');
      return result.settings || DEFAULT_SETTINGS;
    } catch (error) {
      console.error('Error getting settings:', error);
      return DEFAULT_SETTINGS;
    }
  }

  /**
   * Save user settings
   */
  async saveSettings(settings: Partial<Settings>): Promise<void> {
    try {
      const currentSettings = await this.getSettings();
      const updatedSettings = { ...currentSettings, ...settings };
      await chrome.storage.sync.set({ settings: updatedSettings });
    } catch (error) {
      console.error('Error saving settings:', error);
      throw new ExtensionError(
        'Failed to save settings to storage',
        ErrorType.STORAGE_QUOTA_EXCEEDED,
        error
      );
    }
  }

  /**
   * Search highlights by text content
   */
  async searchHighlights(query: string): Promise<Highlight[]> {
    const allHighlights = await this.getAllHighlights();
    const lowerQuery = query.toLowerCase();

    return Object.values(allHighlights).filter(
      (highlight) =>
        highlight.text.toLowerCase().includes(lowerQuery) ||
        highlight.tags.some((tag) => tag.toLowerCase().includes(lowerQuery)) ||
        highlight.pageTitle.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get highlights by tags
   */
  async getHighlightsByTags(tags: string[]): Promise<Highlight[]> {
    const allHighlights = await this.getAllHighlights();
    const lowerTags = tags.map((tag) => tag.toLowerCase());

    return Object.values(allHighlights).filter((highlight) =>
      highlight.tags.some((tag) => lowerTags.includes(tag.toLowerCase()))
    );
  }

  /**
   * Get storage usage statistics
   */
  async getStorageStats(): Promise<{
    highlightCount: number;
    tagCount: number;
    bytesUsed: number;
  }> {
    try {
      const [highlights, tags] = await Promise.all([
        this.getAllHighlights(),
        this.getAllTags()
      ]);

      const highlightCount = Object.keys(highlights).length;
      const tagCount = Object.keys(tags).length;

      // Estimate bytes used (approximate)
      const bytesUsed = new Blob([JSON.stringify({ highlights, tags })]).size;

      return { highlightCount, tagCount, bytesUsed };
    } catch (error) {
      console.error('Error getting storage stats:', error);
      return { highlightCount: 0, tagCount: 0, bytesUsed: 0 };
    }
  }

  /**
   * Clear all data (use with caution)
   */
  async clearAllData(): Promise<void> {
    try {
      await chrome.storage.local.clear();
      await chrome.storage.sync.clear();
    } catch (error) {
      console.error('Error clearing data:', error);
      throw new ExtensionError(
        'Failed to clear storage data',
        ErrorType.STORAGE_QUOTA_EXCEEDED,
        error
      );
    }
  }

  /**
   * Export all data for backup
   */
  async exportAllData(): Promise<StorageData> {
    const [highlights, tags, settings] = await Promise.all([
      this.getAllHighlights(),
      this.getAllTags(),
      this.getSettings()
    ]);

    return { highlights, tags, settings };
  }

  /**
   * Import data from backup
   */
  async importAllData(
    data: StorageData,
    merge = false
  ): Promise<void> {
    try {
      if (merge) {
        const [currentHighlights, currentTags] = await Promise.all([
          this.getAllHighlights(),
          this.getAllTags()
        ]);

        const mergedHighlights = { ...currentHighlights, ...data.highlights };
        const mergedTags = { ...currentTags, ...data.tags };

        await chrome.storage.local.set({
          highlights: mergedHighlights,
          tags: mergedTags
        });
      } else {
        await chrome.storage.local.set({
          highlights: data.highlights,
          tags: data.tags
        });
      }

      if (data.settings) {
        await chrome.storage.sync.set({ settings: data.settings });
      }
    } catch (error) {
      console.error('Error importing data:', error);
      throw new ExtensionError(
        'Failed to import data to storage',
        ErrorType.INVALID_IMPORT_DATA,
        error
      );
    }
  }

  /**
   * Get global tags (MRU - Most Recently Used)
   */
  async getGlobalTags(): Promise<{ name: string; count: number; lastUsedAt: number }[]> {
    try {
      const result = await chrome.storage.local.get('globalTags');
      return result.globalTags || [];
    } catch (error) {
      console.error('Error getting global tags:', error);
      return [];
    }
  }

  /**
   * Update global tags with MRU tracking
   */
  async bumpGlobalTags(tags: string[]): Promise<void> {
    try {
      const list = await this.getGlobalTags();
      const map = new Map(list.map(t => [t.name, t]));
      const now = Date.now();

      for (const name of tags) {
        const cur = map.get(name);
        if (cur) {
          cur.count += 1;
          cur.lastUsedAt = now;
        } else {
          map.set(name, { name, count: 1, lastUsedAt: now });
        }
      }

      const merged = Array.from(map.values()).sort((a, b) => b.lastUsedAt - a.lastUsedAt);
      await chrome.storage.local.set({ globalTags: merged });
    } catch (error) {
      console.error('Error bumping global tags:', error);
    }
  }

  /**
   * Add highlight to URL-specific storage
   */
  async addHighlight(_url: string, item: Highlight): Promise<void> {
    try {
      const allHighlights = await this.getAllHighlights();
      allHighlights[item.id] = item;
      await chrome.storage.local.set({ highlights: allHighlights });
      await this.updateTagCounts(item.tags);
    } catch (error) {
      console.error('Error adding highlight:', error);
      throw new ExtensionError(
        'Failed to add highlight to storage',
        ErrorType.STORAGE_QUOTA_EXCEEDED,
        error
      );
    }
  }

  /**
   * Get highlights for specific URL
   */
  async getHighlights(url: string): Promise<Highlight[]> {
    return this.getHighlightsByUrl(url);
  }
}

/**
 * Export singleton instance
 */
export const storageService = new StorageService();
