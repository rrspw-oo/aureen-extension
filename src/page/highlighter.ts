/**
 * Highlighter Module
 * Handles text highlighting with XPath-based position tracking
 */

import {
  createHighlightPosition,
  restoreRangeFromPosition,
  wrapRangeWithHighlight,
  removeHighlightById
} from '@/lib/dom';
import { generateSecureId } from '@/lib/security';
import { normalizePageUrl } from '@/lib/url';
import type { Highlight, HighlightColor } from '@/types/highlight';

export class Highlighter {
  private highlights: Map<string, Highlight> = new Map();
  private restoredIds: Set<string> = new Set();

  /**
   * Create a new highlight from selection
   */
  createHighlight(
    selection: Selection,
    color: HighlightColor,
    tags: string[]
  ): Highlight | null {
    const position = createHighlightPosition(selection);
    if (!position) {
      console.error('Failed to create highlight position');
      return null;
    }

    const highlight: Highlight = {
      id: generateSecureId(),
      url: window.location.href,
      pageTitle: document.title,
      text: selection.toString().trim(),
      tags,
      color,
      position,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.highlights.set(highlight.id, highlight);

    this.applyHighlight(highlight);

    return highlight;
  }

  /**
   * Apply highlight to DOM
   */
  applyHighlight(highlight: Highlight): boolean {
    try {
      const range = restoreRangeFromPosition(highlight.position, highlight.text);
      if (!range) {
        return false;
      }

      wrapRangeWithHighlight(range, highlight.id, highlight.color);

      this.attachHighlightEventListeners(highlight.id);

      return true;
    } catch (error) {
      console.error('Error applying highlight:', error);
      return false;
    }
  }

  /**
   * Remove highlight from DOM and storage
   */
  removeHighlight(highlightId: string): void {
    removeHighlightById(highlightId);
    this.highlights.delete(highlightId);
  }

  /**
   * Update highlight tags or color
   */
  updateHighlight(highlightId: string, updates: Partial<Highlight>): boolean {
    const highlight = this.highlights.get(highlightId);
    if (!highlight) {
      return false;
    }

    const updatedHighlight = {
      ...highlight,
      ...updates,
      updatedAt: Date.now()
    };

    this.highlights.set(highlightId, updatedHighlight);

    this.removeHighlight(highlightId);
    this.applyHighlight(updatedHighlight);

    return true;
  }

  /**
   * Restore highlights for current page
   */
  restoreHighlights(highlights: Highlight[]): void {
    const pageUrl = normalizePageUrl(window.location.href);
    const current = highlights.filter((highlight) => normalizePageUrl(highlight.url) === pageUrl);
    const currentIds = new Set(current.map((highlight) => highlight.id));

    for (const id of this.restoredIds) {
      if (!currentIds.has(id)) {
        this.removeHighlight(id);
        this.restoredIds.delete(id);
      }
    }

    for (const highlight of current) {
      this.highlights.set(highlight.id, highlight);
      this.restoredIds.add(highlight.id);
      if (!document.querySelector(`mark[data-highlight-id="${highlight.id}"]`)) {
        this.applyHighlight(highlight);
      }
    }
  }

  /**
   * Get all highlights for current page
   */
  getHighlights(): Highlight[] {
    return Array.from(this.highlights.values());
  }

  /**
   * Get single highlight by ID
   */
  getHighlight(highlightId: string): Highlight | null {
    return this.highlights.get(highlightId) || null;
  }

  /**
   * Attach event listeners to highlight marks
   */
  private attachHighlightEventListeners(highlightId: string): void {
    const marks = document.querySelectorAll(`mark[data-highlight-id="${highlightId}"]`);

    marks.forEach((mark) => {
      mark.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleHighlightClick(highlightId);
      });

      mark.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.handleHighlightContextMenu(highlightId);
      });
    });
  }

  /**
   * Handle click on highlight
   */
  private handleHighlightClick(highlightId: string): void {
    const highlight = this.highlights.get(highlightId);
    if (!highlight) {
      return;
    }

    chrome.runtime.sendMessage({
      action: 'show-highlight-details',
      highlight
    });
  }

  /**
   * Handle context menu on highlight
   */
  private handleHighlightContextMenu(highlightId: string): void {
    const highlight = this.highlights.get(highlightId);
    if (!highlight) {
      return;
    }

    chrome.runtime.sendMessage({
      action: 'show-highlight-menu',
      highlight
    });
  }

  /**
   * Scroll to highlight by ID
   */
  scrollToHighlight(highlightId: string): boolean {
    const mark = document.querySelector(`mark[data-highlight-id="${highlightId}"]`);

    if (!mark) {
      return false;
    }

    mark.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });

    mark.classList.add('animate-pulse');
    setTimeout(() => {
      mark.classList.remove('animate-pulse');
    }, 2000);

    return true;
  }

  /**
   * Check if text is already highlighted
   */
  isTextHighlighted(text: string): boolean {
    const normalizedText = text.trim().toLowerCase();

    for (const highlight of this.highlights.values()) {
      if (highlight.text.trim().toLowerCase() === normalizedText) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get highlights by tag
   */
  getHighlightsByTag(tag: string): Highlight[] {
    return Array.from(this.highlights.values()).filter((highlight) =>
      highlight.tags.includes(tag)
    );
  }

  /**
   * Get highlight statistics
   */
  getStats(): { count: number; tags: Set<string>; colors: Record<string, number> } {
    const tags = new Set<string>();
    const colors: Record<string, number> = {};

    for (const highlight of this.highlights.values()) {
      highlight.tags.forEach((tag) => tags.add(tag));

      if (colors[highlight.color]) {
        colors[highlight.color]++;
      } else {
        colors[highlight.color] = 1;
      }
    }

    return {
      count: this.highlights.size,
      tags,
      colors
    };
  }
}

export const highlighter = new Highlighter();
