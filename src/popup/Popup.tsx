/**
 * Popup Component
 * Main popup interface shown when clicking the extension icon
 */

import React, { useEffect, useState } from 'react';
import { storageService } from '@/services/storage';
import { imageCaptureStorage } from '@/services/image-capture-storage';
import { useStorageStats } from '@/hooks/useHighlights';
import { Button } from '@/components/Button';
import { COLORS } from '@/constants/theme';
import type { Highlight } from '@/types';
import type { ImageCapture } from '@/types/image-capture';

export const Popup: React.FC = () => {
  const { stats, loading: statsLoading } = useStorageStats();
  const [recentHighlights, setRecentHighlights] = useState<Highlight[]>([]);
  const [recentCaptures, setRecentCaptures] = useState<ImageCapture[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (): Promise<void> => {
    try {
      setLoading(true);

      const [allHighlights, allCaptures] = await Promise.all([
        storageService.getAllHighlights(),
        imageCaptureStorage.getAllCaptures()
      ]);

      const highlights = Object.values(allHighlights)
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 5);

      const captures = allCaptures
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 5);

      setRecentHighlights(highlights);
      setRecentCaptures(captures);
    } catch (error) {
      console.error('Error loading popup data:', error);
    } finally {
      setLoading(false);
    }
  };

  const openSidebar = (): void => {
    chrome.runtime.sendMessage({ action: 'open-sidebar-in-tab' });
    window.close();
  };

  const jumpToHighlight = (highlightId: string): void => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'open-sidebar',
          data: {
            tab: 'highlights',
            subTab: 'saved',
            highlightId
          }
        });
        window.close();
      }
    });
  };

  const jumpToCapture = (captureId: string): void => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'open-sidebar',
          data: {
            tab: 'images',
            subTab: 'saved',
            captureId
          }
        });
        window.close();
      }
    });
  };

  const startScreenshot = (): void => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'start-screenshot' });
        window.close();
      }
    });
  };

  if (loading || statsLoading) {
    return (
      <div className="w-96 h-96 flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-400 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-96 max-h-[600px] bg-white flex flex-col">
      <div className="p-6" style={{ backgroundColor: COLORS.primary }}>
        <h3 className="text-lg font-bold text-gray-800 mb-2">AUREEN</h3>
        <p className="text-sm text-gray-600">
          Select any text, highlight it, and export your notes in clean, readable Markdown format
        </p>
      </div>

      <div className="p-6 flex-1">
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="rounded-lg p-3 text-center" style={{ backgroundColor: COLORS.primary }}>
            <div className="text-xl font-bold text-gray-800">
              {stats.highlightCount}
            </div>
            <div className="text-xs text-gray-600 mt-1">Highlights</div>
          </div>

          <div className="rounded-lg p-3 text-center" style={{ backgroundColor: COLORS.primary }}>
            <div className="text-xl font-bold text-gray-800">{stats.tagCount}</div>
            <div className="text-xs text-gray-600 mt-1">Tags</div>
          </div>

          <div className="rounded-lg p-3 text-center" style={{ backgroundColor: COLORS.primary }}>
            <div className="text-xl font-bold text-gray-800">{stats.captureCount}</div>
            <div className="text-xs text-gray-600 mt-1">Captures</div>
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            Recent Highlights
          </h2>

          {recentHighlights.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="text-sm">No highlights yet</p>
              <p className="text-xs mt-1">
                Select text on any webpage to create your first highlight
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {recentHighlights.map((highlight) => (
                <button
                  key={highlight.id}
                  onClick={() => jumpToHighlight(highlight.id)}
                  className="w-full text-left p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <p className="text-sm text-gray-900 line-clamp-2 mb-1">
                    {highlight.text}
                  </p>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500 truncate">
                      {highlight.pageTitle}
                    </p>
                    {highlight.tags.length > 0 && (
                      <span className="text-xs text-gray-600 font-medium">
                        {highlight.tags[0].replace(/^#+/, '')}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            Recent Captures
          </h2>

          {recentCaptures.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="text-sm">No captures yet</p>
              <p className="text-xs mt-1">
                Click the capture button to save your first screenshot
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {recentCaptures.map((capture) => (
                <button
                  key={capture.id}
                  onClick={() => jumpToCapture(capture.id)}
                  className="w-full text-left p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <img
                      src={capture.imageData}
                      alt="Screenshot preview"
                      className="w-16 h-16 object-cover rounded flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      {capture.note && (
                        <p className="text-sm text-gray-900 line-clamp-2 mb-1">
                          {capture.note}
                        </p>
                      )}
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-gray-500 truncate">
                          {new URL(capture.url).hostname}
                        </p>
                        {capture.tags.length > 0 && (
                          <span className="text-xs text-gray-600 font-medium">
                            {capture.tags[0]}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <Button
            onClick={startScreenshot}
            variant="secondary"
            fullWidth
          >
            Capture for later
          </Button>

          <Button
            onClick={openSidebar}
            variant="primary"
            fullWidth
          >
            Open Full Sidebar
          </Button>
        </div>
      </div>

      <div className="border-t border-gray-200 p-4 bg-gray-50">
        <div className="text-center mb-3">
          <p className="text-xs text-gray-500">
            Press <kbd className="px-2 py-1 bg-white border border-gray-300 rounded">
              Alt+H
            </kbd>{' '}
            to highlight,{' '}
            <kbd className="px-2 py-1 bg-white border border-gray-300 rounded">
              Alt+S
            </kbd>{' '}
            to open sidebar
          </p>
        </div>
        <div className="text-center">
          <a
            href="https://github.com/[YOUR_REPO]"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            GitHub
          </a>
        </div>
      </div>
    </div>
  );
};
