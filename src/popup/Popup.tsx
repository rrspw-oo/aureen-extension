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

  // Route tab-targeted actions through the service worker, which injects the
  // content script first (ensureContentScript) when it is missing. Sending
  // directly with chrome.tabs.sendMessage throws an uncaught
  // "Could not establish connection. Receiving end does not exist." on pages
  // that have no content script (chrome:// pages, the Web Store, PDFs, or tabs
  // opened before the extension loaded). The .catch keeps any rejection from
  // surfacing as an unhandled promise.
  const openSidebar = (): void => {
    chrome.runtime.sendMessage({ action: 'open-sidebar-in-tab' }).catch(() => {});
    window.close();
  };

  const jumpToHighlight = (highlightId: string): void => {
    chrome.runtime
      .sendMessage({
        action: 'open-sidebar-in-tab',
        data: { tab: 'highlights', subTab: 'saved', highlightId }
      })
      .catch(() => {});
    window.close();
  };

  const jumpToCapture = (captureId: string): void => {
    chrome.runtime
      .sendMessage({
        action: 'open-sidebar-in-tab',
        data: { tab: 'images', subTab: 'saved', captureId }
      })
      .catch(() => {});
    window.close();
  };

  const startScreenshot = (): void => {
    chrome.runtime.sendMessage({ action: 'start-screenshot-in-tab' }).catch(() => {});
    window.close();
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
    <div className="w-96 max-h-[600px] flex flex-col" style={{ backgroundColor: COLORS.surface }}>
      <div
        className="px-6 py-5 flex items-center gap-2.5"
        style={{ borderBottom: `1px solid ${COLORS.goldSoft}` }}
      >
        <span
          className="inline-block rounded-full"
          style={{ width: 11, height: 11, backgroundColor: COLORS.primary }}
        />
        <span
          className="text-lg"
          style={{ color: COLORS.textPrimary, fontWeight: 500, letterSpacing: '0.04em' }}
        >
          Aureen
        </span>
      </div>

      <div className="p-6 flex-1">
        <div className="grid grid-cols-3 gap-2 mb-6">
          {[
            { value: stats.highlightCount, label: 'Highlights' },
            { value: stats.tagCount, label: 'Tags' },
            { value: stats.captureCount, label: 'Captures' },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl p-3 text-center"
              style={{ backgroundColor: COLORS.goldSoft }}
            >
              <div className="text-xl" style={{ color: COLORS.textPrimary, fontWeight: 500 }}>
                {s.value}
              </div>
              <div className="text-xs mt-1" style={{ color: COLORS.goldChipText }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div className="mb-6">
          <h2 className="text-sm font-medium text-[#8B8898] mb-3">
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
                  className="w-full text-left p-3 rounded-xl border border-[#EFE7D8] bg-white hover:bg-[#FBF7EE] transition-colors"
                >
                  <p className="text-sm text-gray-900 line-clamp-2 mb-1">
                    {highlight.text}
                  </p>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500 truncate">
                      {highlight.pageTitle}
                    </p>
                    {highlight.tags.length > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-[#F4ECDD] text-[#9A7B43]">
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
          <h2 className="text-sm font-medium text-[#8B8898] mb-3">
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
                  className="w-full text-left p-3 rounded-xl border border-[#EFE7D8] bg-white hover:bg-[#FBF7EE] transition-colors"
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
                          <span className="text-xs px-2 py-0.5 rounded-full bg-[#F4ECDD] text-[#9A7B43]">
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

      <div className="p-4" style={{ borderTop: `1px solid ${COLORS.goldSoft}` }}>
        <div className="text-center">
          <p className="text-xs" style={{ color: '#A8A4B2' }}>
            Press <kbd className="px-2 py-0.5 bg-white border border-[#EBE3D3] rounded" style={{ color: COLORS.goldChipText }}>
              Alt+H
            </kbd>{' '}
            to highlight,{' '}
            <kbd className="px-2 py-0.5 bg-white border border-[#EBE3D3] rounded" style={{ color: COLORS.goldChipText }}>
              Alt+S
            </kbd>{' '}
            for sidebar
          </p>
        </div>
      </div>
    </div>
  );
};
