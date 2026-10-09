/**
 * Export/Import Service
 * Handles exporting highlights to JSON and importing from JSON files
 */

import type { ExportData, Highlight, Tag } from '@/types/highlight';
import { ErrorType, ExtensionError } from '@/types/highlight';
import { storageService } from '@/lib/highlight-store';
import { downloadJSON, downloadMarkdown, generateFilenameWithDate, readFileAsText } from '@/lib/download';
import { getISODate } from '@/lib/date';

/**
 * Current export format version
 */
const EXPORT_VERSION = '1.0.0';

/**
 * Filter tags based on highlights
 * @param highlights - Array of highlights
 * @param allTags - All available tags
 * @returns Filtered tags that are used in the highlights
 */
function filterUsedTags(highlights: Highlight[], allTags: Record<string, Tag>): Tag[] {
  const usedTagNames = new Set<string>();
  highlights.forEach((highlight) => {
    highlight.tags.forEach((tag) => usedTagNames.add(tag));
  });

  return Object.values(allTags).filter((tag) => usedTagNames.has(tag.name));
}

/**
 * Create export data object
 * @param highlights - Highlights to export
 * @param tags - Tags to export
 * @returns ExportData object
 */
function createExportData(highlights: Highlight[], tags: Tag[]): ExportData {
  return {
    version: EXPORT_VERSION,
    exportDate: Date.now(),
    highlights,
    tags
  };
}

/**
 * Export/Import service class
 */
class ExportImportService {
  /**
   * Export all highlights and tags to JSON
   */
  async exportAll(): Promise<ExportData> {
    try {
      const [highlights, tags] = await Promise.all([
        storageService.getAllHighlights(),
        storageService.getAllTags()
      ]);

      return createExportData(
        Object.values(highlights),
        Object.values(tags)
      );
    } catch (error) {
      console.error('Error exporting data:', error);
      throw new ExtensionError(
        'Failed to export highlights and tags',
        ErrorType.STORAGE_QUOTA_EXCEEDED,
        error
      );
    }
  }

  /**
   * Export highlights filtered by tags
   */
  async exportByTags(tagNames: string[]): Promise<ExportData> {
    try {
      const [highlights, allTags] = await Promise.all([
        storageService.getHighlightsByTags(tagNames),
        storageService.getAllTags()
      ]);

      const tags = filterUsedTags(highlights, allTags);
      return createExportData(highlights, tags);
    } catch (error) {
      console.error('Error exporting by tags:', error);
      throw new ExtensionError(
        'Failed to export highlights by tags',
        ErrorType.STORAGE_QUOTA_EXCEEDED,
        error
      );
    }
  }

  /**
   * Export highlights for specific URL
   */
  async exportByUrl(url: string): Promise<ExportData> {
    try {
      const [highlights, allTags] = await Promise.all([
        storageService.getHighlightsByUrl(url),
        storageService.getAllTags()
      ]);

      const tags = filterUsedTags(highlights, allTags);
      return createExportData(highlights, tags);
    } catch (error) {
      console.error('Error exporting by URL:', error);
      throw new ExtensionError(
        'Failed to export highlights by URL',
        ErrorType.STORAGE_QUOTA_EXCEEDED,
        error
      );
    }
  }

  /**
   * Download export data as JSON file
   */
  downloadAsJson(data: ExportData, filename?: string): void {
    const defaultFilename = filename || generateFilenameWithDate('highlights-export', 'json');
    downloadJSON(data, defaultFilename);
  }

  /**
   * Validate import data structure
   */
  private validateImportData(data: unknown): data is ExportData {
    if (typeof data !== 'object' || data === null) {
      return false;
    }

    const exportData = data as Partial<ExportData>;

    // Check required fields
    if (!exportData.version || !exportData.exportDate) {
      return false;
    }

    // Check highlights array
    if (!Array.isArray(exportData.highlights)) {
      return false;
    }

    // Validate each highlight has required fields
    for (const highlight of exportData.highlights) {
      if (
        !highlight.id ||
        !highlight.url ||
        !highlight.text ||
        !Array.isArray(highlight.tags) ||
        !highlight.color ||
        !highlight.position
      ) {
        return false;
      }
    }

    // Check tags array
    if (!Array.isArray(exportData.tags)) {
      return false;
    }

    // Validate each tag has required fields
    for (const tag of exportData.tags) {
      if (!tag.name || typeof tag.highlightCount !== 'number') {
        return false;
      }
    }

    return true;
  }

  /**
   * Parse JSON file and validate
   */
  async parseImportFile(file: File): Promise<ExportData> {
    try {
      const text = await readFileAsText(file);
      const data = JSON.parse(text);

      if (!this.validateImportData(data)) {
        throw new Error('Invalid import data structure');
      }

      return data;
    } catch (error) {
      console.error('Error parsing import file:', error);
      throw new ExtensionError(
        'Invalid import file format. Please ensure the file is a valid JSON export.',
        ErrorType.INVALID_IMPORT_DATA,
        error
      );
    }
  }

  /**
   * Import highlights and tags from ExportData
   */
  async import(data: ExportData, options: {
    merge: boolean;
    overwriteExisting: boolean;
  }): Promise<{ imported: number; skipped: number; errors: number }> {
    const stats = { imported: 0, skipped: 0, errors: 0 };

    try {
      const existingHighlights = await storageService.getAllHighlights();

      // Process highlights
      for (const highlight of data.highlights) {
        try {
          const exists = highlight.id in existingHighlights;

          if (exists && !options.overwriteExisting) {
            stats.skipped++;
            continue;
          }

          await storageService.saveHighlight(highlight);
          stats.imported++;
        } catch (error) {
          console.error(`Error importing highlight ${highlight.id}:`, error);
          stats.errors++;
        }
      }

      return stats;
    } catch (error) {
      console.error('Error during import:', error);
      throw new ExtensionError(
        'Failed to import highlights',
        ErrorType.INVALID_IMPORT_DATA,
        error
      );
    }
  }

  /**
   * Import from JSON file with UI feedback
   */
  async importFromFile(
    file: File,
    options: { merge: boolean; overwriteExisting: boolean }
  ): Promise<{ imported: number; skipped: number; errors: number }> {
    const data = await this.parseImportFile(file);
    return await this.import(data, options);
  }

  /**
   * Get import summary for preview
   */
  async getImportSummary(file: File): Promise<{
    highlightCount: number;
    tagCount: number;
    urls: string[];
    dateRange: { earliest: number; latest: number };
  }> {
    const data = await this.parseImportFile(file);

    const urls = new Set<string>();
    let earliest = Infinity;
    let latest = 0;

    for (const highlight of data.highlights) {
      urls.add(highlight.url);
      earliest = Math.min(earliest, highlight.createdAt);
      latest = Math.max(latest, highlight.updatedAt || highlight.createdAt);
    }

    return {
      highlightCount: data.highlights.length,
      tagCount: data.tags.length,
      urls: Array.from(urls),
      dateRange: { earliest, latest }
    };
  }

  /**
   * Export highlights as Markdown grouped by tag
   */
  private async generateMarkdownByTag(highlights: Highlight[]): Promise<string> {
    highlights.sort((a, b) => b.createdAt - a.createdAt);

    let markdown = '# Highlights Export (Grouped by Tag)\n\n';
    markdown += `Generated: ${new Date().toLocaleString()}\n\n`;
    markdown += `Total highlights: ${highlights.length}\n\n`;
    markdown += '---\n\n';

    const groupedByTag: Record<string, Highlight[]> = {};
    const untaggedHighlights: Highlight[] = [];

    for (const highlight of highlights) {
      if (highlight.tags.length === 0) {
        untaggedHighlights.push(highlight);
      } else {
        for (const tag of highlight.tags) {
          if (!groupedByTag[tag]) {
            groupedByTag[tag] = [];
          }
          groupedByTag[tag].push(highlight);
        }
      }
    }

    const sortedTags = Object.keys(groupedByTag).sort();

    for (const tag of sortedTags) {
      const tagHighlights = groupedByTag[tag];
      const displayTag = tag.startsWith('#') ? tag : `#${tag}`;

      markdown += `## Tag: ${displayTag}\n\n`;

      for (const highlight of tagHighlights) {
        const date = getISODate(highlight.createdAt);
        const tagsDisplay = highlight.tags.map((t) => t.startsWith('#') ? t : `#${t}`).join(', ');

        markdown += `- **[${highlight.pageTitle}](${highlight.url})** - ${date}\n`;
        markdown += `  > ${highlight.text}\n`;
        markdown += `  Tags: ${tagsDisplay}\n\n`;
      }
    }

    if (untaggedHighlights.length > 0) {
      markdown += '## Untagged\n\n';

      for (const highlight of untaggedHighlights) {
        const date = getISODate(highlight.createdAt);

        markdown += `- **[${highlight.pageTitle}](${highlight.url})** - ${date}\n`;
        markdown += `  > ${highlight.text}\n\n`;
      }
    }

    return markdown;
  }

  /**
   * Export highlights as Markdown
   */
  async exportAsMarkdown(options?: {
    tags?: string[];
    url?: string;
    groupBy?: 'url' | 'tag';
  }): Promise<string> {
    try {
      let highlights;

      if (options?.tags && options.tags.length > 0) {
        highlights = await storageService.getHighlightsByTags(options.tags);
      } else if (options?.url) {
        highlights = await storageService.getHighlightsByUrl(options.url);
      } else {
        const allHighlights = await storageService.getAllHighlights();
        highlights = Object.values(allHighlights);
      }

      if (options?.groupBy === 'tag') {
        return await this.generateMarkdownByTag(highlights);
      }

      highlights.sort((a, b) => b.createdAt - a.createdAt);

      let markdown = '# Highlights Export\n\n';
      markdown += `Generated: ${new Date().toLocaleString()}\n\n`;
      markdown += `Total highlights: ${highlights.length}\n\n`;
      markdown += '---\n\n';

      const groupedByPage = highlights.reduce((acc, highlight) => {
        if (!acc[highlight.url]) {
          acc[highlight.url] = [];
        }
        acc[highlight.url].push(highlight);
        return acc;
      }, {} as Record<string, typeof highlights>);

      for (const [url, pageHighlights] of Object.entries(groupedByPage)) {
        const pageTitle = pageHighlights[0].pageTitle;

        markdown += `## ${pageTitle}\n\n`;
        markdown += `**URL:** ${url}\n\n`;

        for (const highlight of pageHighlights) {
          const date = getISODate(highlight.createdAt);

          markdown += `### ${date}\n\n`;
          markdown += `> ${highlight.text}\n\n`;

          if (highlight.tags.length > 0) {
            markdown += `**Tags:** ${highlight.tags.map((tag) => `#${tag}`).join(', ')}\n\n`;
          }

          markdown += '---\n\n';
        }
      }

      return markdown;
    } catch (error) {
      console.error('Error exporting as markdown:', error);
      throw new ExtensionError(
        'Failed to export highlights as markdown',
        ErrorType.STORAGE_QUOTA_EXCEEDED,
        error
      );
    }
  }

  /**
   * Download highlights as Markdown file
   */
  async downloadAsMarkdown(options?: {
    tags?: string[];
    url?: string;
    filename?: string;
    groupBy?: 'url' | 'tag';
  }): Promise<void> {
    const markdown = await this.exportAsMarkdown(options);
    const defaultFilename = options?.filename || generateFilenameWithDate('highlights', 'md');
    downloadMarkdown(markdown, defaultFilename);
  }
}

/**
 * Export singleton instance
 */
export const exportImportService = new ExportImportService();
