/**
 * useHighlights Hook
 * Custom hook for managing highlights data
 */

import { useState, useEffect, useCallback } from 'react';
import { storageService } from '@/services/storage';
import { imageCaptureStorage } from '@/services/image-capture-storage';
import type { Highlight, Tag } from '@/types';

interface UseHighlightsReturn {
  highlights: Highlight[];
  tags: Tag[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  deleteHighlight: (highlightId: string) => Promise<void>;
}

/**
 * Hook to fetch and manage highlights
 */
export function useHighlights(): UseHighlightsReturn {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [allHighlights, allTags] = await Promise.all([
        storageService.getAllHighlights(),
        storageService.getAllTags()
      ]);

      setHighlights(Object.values(allHighlights));
      setTags(Object.values(allTags));
    } catch (err) {
      console.error('Error loading highlights:', err);
      setError(err instanceof Error ? err : new Error('Failed to load highlights'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    const handleStorageChange = (): void => {
      loadData();
    };

    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, [loadData]);

  const deleteHighlight = useCallback(async (highlightId: string) => {
    try {
      await storageService.deleteHighlight(highlightId);
      await loadData();
    } catch (err) {
      console.error('Error deleting highlight:', err);
      throw err;
    }
  }, [loadData]);

  return {
    highlights,
    tags,
    loading,
    error,
    refresh: loadData,
    deleteHighlight,
  };
}

/**
 * Hook to fetch storage statistics
 */
export function useStorageStats() {
  const [stats, setStats] = useState({
    highlightCount: 0,
    tagCount: 0,
    captureCount: 0,
    bytesUsed: 0
  });
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    try {
      setLoading(true);
      const [highlightStats, captureStats] = await Promise.all([
        storageService.getStorageStats(),
        imageCaptureStorage.getStorageStats()
      ]);

      setStats({
        highlightCount: highlightStats.highlightCount,
        tagCount: highlightStats.tagCount,
        captureCount: captureStats.totalCaptures,
        bytesUsed: highlightStats.bytesUsed + captureStats.totalSize
      });
    } catch (err) {
      console.error('Error loading storage stats:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();

    const handleStorageChange = (): void => {
      loadStats();
    };

    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, [loadStats]);

  return { stats, loading, refresh: loadStats };
}
