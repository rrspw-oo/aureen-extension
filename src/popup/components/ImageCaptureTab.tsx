/**
 * Image Capture Tab Component
 * Displays all captured screenshots in a grid layout
 */

import React, { useState, useEffect } from 'react';
import { imageCaptureStorage } from '@/services/image-capture-storage';
import { runOcrForCapture } from '@/services/ocr';
import { formatBytes } from '@/services/screenshot';
import type { ImageCapture, ImageTag } from '@/types/image-capture';
import { ImageCaptureCard } from './ImageCaptureCard';
import { ExportHandbookDialog } from './ExportHandbookDialog';
import { ImageTagFilter } from './ImageTagFilter';
import { Button } from '@/components/Button';
import { COLORS } from '@/constants/theme';
import { resetCaptureData } from '@/content/sidebar-shadow';

interface ImageCaptureTabProps {
  initialData?: Record<string, unknown>;
}

/**
 * Modal for re-editing a saved screenshot's title, tags and note.
 */
const EditCaptureModal: React.FC<{
  capture: ImageCapture;
  onClose: () => void;
  onSaved: () => void;
}> = ({ capture, onClose, onSaved }) => {
  const [title, setTitle] = useState(capture.title ?? '');
  const [tags, setTags] = useState(capture.tags.join(', '));
  const [note, setNote] = useState(capture.note ?? '');
  const [saving, setSaving] = useState(false);

  const inputCls =
    'w-full px-3 py-2 bg-white border border-[#E2D6BE] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#E0CFA0] focus:border-[#C9A86C]';
  const labelCls = 'block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide';

  const handleSave = async (): Promise<void> => {
    setSaving(true);
    try {
      const parsedTags = tags
        .split(/[,\s]+/)
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
      await imageCaptureStorage.updateCapture(capture.id, {
        title: title.trim() || undefined,
        tags: parsedTags,
        note: note.trim()
      });
      onSaved();
    } catch (error) {
      console.error('Failed to update capture:', error);
      alert('Failed to update screenshot');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/30 p-4"
      onClick={saving ? undefined : onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold" style={{ color: COLORS.textPrimary }}>
          Edit screenshot
        </h3>
        <img
          src={capture.imageData}
          alt="Screenshot"
          className="mt-3 w-full max-h-28 object-contain rounded-lg border border-[#EFE7D8] bg-[#FBFAF7]"
        />

        <div className="mt-4 space-y-3">
          <div>
            <label className={labelCls}>Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Pricing table"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Tags</label>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g. research, pricing"
              className={inputCls}
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing) return;
                if (e.key === 'Enter') handleSave();
              }}
            />
          </div>
          <div>
            <label className={labelCls}>Notes</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Add a note about this screenshot..."
              className={`${inputCls} resize-none`}
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-[#C9A86C] px-4 py-1.5 text-sm font-medium text-[#2C2417] hover:bg-[#B8975B] disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

export const ImageCaptureTab: React.FC<ImageCaptureTabProps> = ({ initialData }) => {
  const [captures, setCaptures] = useState<ImageCapture[]>([]);
  const [allTags, setAllTags] = useState<ImageTag[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [storageSize, setStorageSize] = useState(0);

  // Screenshot editing state
  const [isEditingCapture, setIsEditingCapture] = useState(false);
  const [editTags, setEditTags] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);

  // Linked items
  const [linkedIds, setLinkedIds] = useState<string[]>([]);
  const [showLinkedPicker, setShowLinkedPicker] = useState(false);
  const [linkedSearch, setLinkedSearch] = useState('');
  const [allHighlights, setAllHighlights] = useState<{id:string; text:string; title?:string; tags:string[]}[]>([]);

  // Sub-tab state
  const [subTab, setSubTab] = useState<'new' | 'saved'>('saved');

  // Export state
  const [showExportDialog, setShowExportDialog] = useState(false);

  // Editing a saved capture
  const [editingCapture, setEditingCapture] = useState<ImageCapture | null>(null);

  const [ocrRunningIds, setOcrRunningIds] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  // Detect capture mode from initialData
  useEffect(() => {
    if (initialData && Object.keys(initialData).length > 0) {
      if (initialData.subTab) {
        setSubTab(initialData.subTab as 'new' | 'saved');
      } else if (initialData.mode === 'capture') {
        // A fresh screenshot just came in — switch to New tab and show the editor
        setIsEditingCapture(true);
        setEditTags('');
        setEditNote('');
        setEditTitle('');
        setLinkedIds([]);
        setLinkedSearch('');
        setShowLinkedPicker(false);
        setSubTab('new');
      }
    } else {
      // initialData was cleared (e.g. resetCaptureData was called) — clear editor
      setIsEditingCapture(false);
      setEditTags('');
      setEditNote('');
      setEditTitle('');
      setLinkedIds([]);
    }
  }, [initialData]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allCaptures, tags, stats, highlights] = await Promise.all([
        imageCaptureStorage.getAllCaptures(),
        imageCaptureStorage.getAllTags(),
        imageCaptureStorage.getStorageStats(),
        import('@/services/storage').then(m => m.storageService.getAllHighlights())
      ]);

      setCaptures(allCaptures);
      setAllTags(tags);
      setStorageSize(stats.totalSize);
      setAllHighlights(Object.values(highlights).map(h => ({ id: h.id, text: h.text, title: (h as any).title, tags: h.tags })));
    } catch (error) {
      console.error('Failed to load captures:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTagFilterChange = async (tagNames: string[]) => {
    setSelectedTags(tagNames);

    if (tagNames.length === 0) {
      const allCaptures = await imageCaptureStorage.getAllCaptures();
      setCaptures(allCaptures);
    } else {
      const filtered = await imageCaptureStorage.getCapturesByTags(tagNames);
      setCaptures(filtered);
    }
  };

  const handleRecognize = async (capture: ImageCapture): Promise<void> => {
    setOcrRunningIds((prev) => [...prev, capture.id]);
    try {
      await runOcrForCapture(capture.id, capture.imageData);
      const updated = await imageCaptureStorage.getCaptureById(capture.id);
      if (updated) {
        setCaptures((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      }
    } finally {
      setOcrRunningIds((prev) => prev.filter((id) => id !== capture.id));
    }
  };

  const handleDelete = async (captureId: string) => {
    if (!confirm('Are you sure you want to delete this screenshot?')) {
      return;
    }

    try {
      await imageCaptureStorage.deleteCapture(captureId);
      await loadData();
    } catch (error) {
      console.error('Failed to delete capture:', error);
      alert('Failed to delete screenshot');
    }
  };

  const handleSaveCapture = async () => {
    if (!initialData || initialData.mode !== 'capture') {
      return;
    }

    setSaving(true);
    try {
      const tags = editTags
        .split(/[,\s]+/)
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);

      const capture = {
        id: initialData.captureId as string,
        url: initialData.url as string,
        imageData: initialData.imageData as string,
        tags,
        note: editNote.trim(),
        title: editTitle.trim() || undefined,
        linkedIds: linkedIds.length > 0 ? linkedIds : undefined,
        createdAt: initialData.timestamp as number
      };

      await imageCaptureStorage.saveCapture(capture);

      setIsEditingCapture(false);
      setEditTags('');
      setEditNote('');
      setEditTitle('');
      setLinkedIds([]);
      setLinkedSearch('');
      setShowLinkedPicker(false);
      setSubTab('saved');
      await loadData();
    } catch (error) {
      console.error('Failed to save capture:', error);
      alert('Failed to save screenshot');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelCapture = () => {
    setIsEditingCapture(false);
    setEditTags('');
    setEditNote('');
    setEditTitle('');
    setLinkedIds([]);
    setLinkedSearch('');
    setShowLinkedPicker(false);
  };

  const startScreenshot = (): void => {
    // Send message to content script via window.postMessage
    window.postMessage({
      type: 'AUREEN_START_SCREENSHOT'
    }, '*');
    // Keep sidebar open so users can capture while browsing
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-400 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading screenshots...</p>
        </div>
      </div>
    );
  }

  const maxSize = 10 * 1024 * 1024; // 10 MB
  const usagePercent = (storageSize / maxSize) * 100;

  return (
    <div className="flex flex-col h-screen bg-white font-sans antialiased">
      {/* Sub Tabs */}
      <div className="flex border-b border-gray-200 bg-gray-50">
        <button
          onClick={() => {
            // If there is a pending capture being displayed and the user manually
            // clicks NEW, we treat it as "discard and start fresh" — clear stale data.
            if (isEditingCapture) {
              resetCaptureData();
            }
            setSubTab('new');
          }}
          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
            subTab === 'new'
              ? 'text-gray-900 border-b-2 border-gray-700'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          New
        </button>
        <button
          onClick={() => setSubTab('saved')}
          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
            subTab === 'saved'
              ? 'text-gray-900 border-b-2 border-gray-700'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Saved
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto">
        {subTab === 'new' ? (
          /* New Screenshot Tab */
          isEditingCapture && initialData?.mode === 'capture' ? (
            <div className="p-4 bg-gray-50">
              <div className="space-y-3">

                {/* Header */}
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-gray-900">New Screenshot</h3>
                  <button
                    onClick={handleCancelCapture}
                    disabled={saving}
                    className="text-gray-400 hover:text-gray-700 disabled:cursor-not-allowed"
                  >
                    ✕
                  </button>
                </div>

                {/* Image Preview */}
                <div className="bg-white p-2 rounded border border-gray-200">
                  <img
                    src={initialData.imageData as string}
                    alt="Screenshot preview"
                    className="w-full max-h-48 object-contain rounded"
                  />
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        const link = document.createElement('a');
                        link.href = initialData.imageData as string;
                        link.download = `aureen-capture-${Date.now()}.jpg`;
                        link.click();
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                        <path d="M8 1v9M4 7l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M2 13h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
                      </svg>
                      Download
                    </button>
                  </div>
                </div>

                {/* Source Info */}
                <div className="text-xs text-gray-500">
                  <p className="font-medium text-gray-700 truncate">{initialData.pageTitle as string}</p>
                  <p className="truncate">{initialData.url as string}</p>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
                    Title <span className="text-gray-400 font-normal normal-case">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="e.g. Lecture slide on recursion"
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E0CFA0] focus:border-[#C9A86C] text-sm"
                  />
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
                    Tags
                  </label>
                  <input
                    type="text"
                    value={editTags}
                    onChange={(e) => setEditTags(e.target.value)}
                    placeholder="e.g. product, comparison, laptop"
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E0CFA0] focus:border-[#C9A86C] text-sm"
                    onKeyDown={(e) => {
                      if (e.nativeEvent.isComposing) return;
                      if (e.key === 'Enter') handleSaveCapture();
                    }}
                    onFocus={() => setShowTagSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowTagSuggestions(false), 200)}
                  />
                  {showTagSuggestions && allTags.length > 0 && (
                    <div className="mt-1 p-2 bg-white border border-gray-300 rounded-lg shadow-lg max-h-32 overflow-y-auto">
                      <p className="text-xs text-gray-400 mb-1">Quick select:</p>
                      <div className="flex flex-wrap gap-1">
                        {allTags.slice(0, 20).map((tag) => (
                          <button
                            key={tag.name}
                            type="button"
                            onClick={() => {
                              const cur = editTags.trim();
                              setEditTags(cur ? `${cur}, ${tag.name}` : tag.name);
                            }}
                            className="px-2 py-0.5 text-xs rounded transition-colors"
                            style={{ backgroundColor: COLORS.primary, color: COLORS.textPrimary }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORS.primaryHover}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = COLORS.primary}
                          >
                            {tag.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Note */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
                    Notes <span className="text-gray-400 font-normal normal-case">(optional)</span>
                  </label>
                  <textarea
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    placeholder="Add a note about this screenshot..."
                    rows={3}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E0CFA0] focus:border-[#C9A86C] text-sm resize-none"
                  />
                </div>

                {/* Linked items */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowLinkedPicker(v => !v)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 uppercase tracking-wide hover:text-[#9A7B43] transition-colors"
                  >
                    <span>{showLinkedPicker ? '▾' : '▸'}</span>
                    Link to existing items
                    {linkedIds.length > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 bg-[#F4ECDD] text-[#9A7B43] rounded-full text-xs font-bold">
                        {linkedIds.length}
                      </span>
                    )}
                  </button>

                  {showLinkedPicker && (
                    <div className="mt-2 border border-gray-200 rounded-lg bg-white overflow-hidden">
                      <div className="p-2 border-b border-gray-100">
                        <input
                          type="text"
                          value={linkedSearch}
                          onChange={(e) => setLinkedSearch(e.target.value)}
                          placeholder="Search highlights or captures..."
                          className="w-full px-2 py-1.5 bg-gray-50 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-[#E0CFA0]"
                        />
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {/* Saved highlights */}
                        {allHighlights
                          .filter(h => {
                            const q = linkedSearch.toLowerCase();
                            return !q || h.text.toLowerCase().includes(q) || (h.title || '').toLowerCase().includes(q) || h.tags.join(' ').toLowerCase().includes(q);
                          })
                          .slice(0, 10)
                          .map(h => (
                            <label key={h.id} className="flex items-start gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={linkedIds.includes(h.id)}
                                onChange={(e) => setLinkedIds(prev => e.target.checked ? [...prev, h.id] : prev.filter(id => id !== h.id))}
                                className="mt-0.5 flex-shrink-0"
                              />
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-[#9A7B43] truncate">
                                  {h.title || h.text.slice(0, 40)}
                                </p>
                                {h.tags.length > 0 && <p className="text-xs text-gray-400">{h.tags.slice(0,3).join(', ')}</p>}
                              </div>
                            </label>
                          ))}
                        {/* Other captures */}
                        {captures
                          .filter(c => c.id !== initialData?.captureId)
                          .filter(c => {
                            const q = linkedSearch.toLowerCase();
                            return !q || (c.title || '').toLowerCase().includes(q) || c.note.toLowerCase().includes(q) || c.tags.join(' ').toLowerCase().includes(q);
                          })
                          .slice(0, 6)
                          .map(c => (
                            <label key={c.id} className="flex items-start gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={linkedIds.includes(c.id)}
                                onChange={(e) => setLinkedIds(prev => e.target.checked ? [...prev, c.id] : prev.filter(id => id !== c.id))}
                                className="mt-0.5 flex-shrink-0"
                              />
                              <div className="flex items-center gap-2 min-w-0">
                                <img src={c.imageData} alt="" className="w-8 h-6 object-cover rounded flex-shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-xs font-medium text-[#9A7B43] truncate">{c.title || 'Screenshot'}</p>
                                  {c.tags.length > 0 && <p className="text-xs text-gray-400">{c.tags.slice(0,3).join(', ')}</p>}
                                </div>
                              </div>
                            </label>
                          ))}
                        {allHighlights.length === 0 && captures.filter(c => c.id !== initialData?.captureId).length === 0 && (
                          <p className="px-3 py-4 text-xs text-gray-400 text-center">No saved items yet</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Save */}
                <Button
                  onClick={handleSaveCapture}
                  disabled={saving}
                  variant="primary"
                  fullWidth
                  className="mt-1"
                >
                  {saving ? 'Saving...' : 'Save Screenshot'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-12">
              <div className="text-center max-w-sm px-6">
                <svg
                  className="mx-auto h-16 w-16 text-gray-400 mb-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <p className="text-gray-500 mb-2">No new screenshot</p>
                <p className="text-sm text-gray-400 mb-6">
                  Click the button below to capture an image
                </p>
                <Button
                  onClick={startScreenshot}
                  variant="secondary"
                  fullWidth
                >
                  Capture for later
                </Button>
              </div>
            </div>
          )
        ) : (
          /* Saved Screenshots Tab */
          <>
            {/* Header with storage stats */}
            <div className="px-6 py-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-gray-900">Screenshots</h2>
                <span className="text-sm text-gray-500">
                  {captures.length} {captures.length === 1 ? 'item' : 'items'}
                </span>
              </div>

              {/* Storage usage */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Storage used</span>
                  <span className="font-medium text-gray-900">
                    {formatBytes(storageSize)} / {formatBytes(maxSize)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(usagePercent, 100)}%`,
                      backgroundColor: usagePercent > 80 ? '#ef4444' : usagePercent > 50 ? '#f59e0b' : '#10b981'
                    }}
                  />
                </div>
                {usagePercent > 80 && (
                  <p className="text-xs text-red-600">
                    Storage is running low. Consider deleting old screenshots.
                  </p>
                )}
              </div>
            </div>

            {/* Tag Filter */}
            {allTags.length > 0 && (
              <div className="px-6 py-4 border-t border-gray-200">
                <ImageTagFilter
                  tags={allTags}
                  selectedTags={selectedTags}
                  onTagsChange={handleTagFilterChange}
                />
              </div>
            )}

            {/* Export */}
            {captures.length > 0 && (
              <div className="px-6 py-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowExportDialog(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-[#C9A86C] text-[#2C2417] text-sm font-medium hover:bg-[#B8975B]"
                >
                  {selectedTags.length > 0
                    ? `Export #${selectedTags[0]} Handbook`
                    : 'Export Handbook'}
                </button>
                <p className="mt-2 text-xs text-gray-500">
                  A polished PDF laid out by title, tag and notes. Choose whether to include the original image.
                </p>
              </div>
            )}

            {/* Captures Grid */}
            <div className="px-6 py-4">
              {captures.length === 0 ? (
                <div className="text-center py-12">
                  <svg
                    className="mx-auto h-16 w-16 text-gray-400 mb-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <p className="text-gray-500 mb-2">No screenshots yet</p>
                  <p className="text-sm text-gray-400">
                    Click the screenshot button to capture your first image
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {captures.map((capture) => (
                    <ImageCaptureCard
                      key={capture.id}
                      capture={capture}
                      onDelete={handleDelete}
                      onEdit={setEditingCapture}
                      onRecognize={handleRecognize}
                      ocrRunning={ocrRunningIds.includes(capture.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {showExportDialog && (
        <ExportHandbookDialog
          tag={selectedTags.length > 0 ? selectedTags[0] : undefined}
          onClose={() => setShowExportDialog(false)}
        />
      )}

      {editingCapture && (
        <EditCaptureModal
          capture={editingCapture}
          onClose={() => setEditingCapture(null)}
          onSaved={async () => {
            setEditingCapture(null);
            await loadData();
          }}
        />
      )}
    </div>
  );
};
