/**
 * Sidebar Component
 * Main sidebar interface for managing highlights
 */

import React, { useEffect, useState } from 'react';
import { storageService } from '@/services/storage';
import { imageCaptureStorage } from '@/services/image-capture-storage';
import { HighlightList } from './HighlightList';
import { Button } from '@/components/Button';
import { COLORS } from '@/constants/theme';
import { sanitizeTagName } from '@/utils/security';
import type { Highlight, Tag } from '@/types';
import type { ImageCapture } from '@/types/image-capture';

type SortBy = 'date' | 'tag';

interface SidebarProps {
  initialData?: Record<string, unknown>;
}

export const Sidebar: React.FC<SidebarProps> = ({ initialData }) => {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [filteredHighlights, setFilteredHighlights] = useState<Highlight[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [loading, setLoading] = useState(true);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [showTagFilter, setShowTagFilter] = useState(false);
  const [showSortOptions, setShowSortOptions] = useState(false);
  const [tagInputValue, setTagInputValue] = useState('');
  const [noteInputValue, setNoteInputValue] = useState('');
  const [titleInputValue, setTitleInputValue] = useState('');

  // Linked items picker
  const [allCaptures, setAllCaptures] = useState<ImageCapture[]>([]);
  const [linkedIds, setLinkedIds] = useState<string[]>([]);
  const [showLinkedPicker, setShowLinkedPicker] = useState(false);
  const [linkedSearch, setLinkedSearch] = useState('');


  // Sub-tab state
  const [subTab, setSubTab] = useState<'new' | 'saved'>('saved');

  // Active action state (from content script)
  const [activeAction, setActiveAction] = useState<{
    mode?: 'highlight' | 'capture';
    // Highlight fields
    text?: string;
    highlightId?: string;
    position?: {
      startOffset: number;
      endOffset: number;
      xpath: string;
      textContent: string;
    };
    color?: string;
    // Capture fields
    captureId?: string;
    imageData?: string;
    // Common fields
    url?: string;
    pageTitle?: string;
    timestamp?: number;
  } | null>(null);

  // Update active action when initialData changes
  useEffect(() => {
    if (initialData && Object.keys(initialData).length > 0) {
      setActiveAction(initialData as typeof activeAction);
      setTagInputValue('');
      setNoteInputValue('');
      setTitleInputValue('');
      setLinkedIds([]);
      setLinkedSearch('');
      setShowLinkedPicker(false);

      // Handle sub-tab navigation from initialData
      if (initialData.subTab) {
        setSubTab(initialData.subTab as 'new' | 'saved');
      } else if (initialData.mode !== 'capture') {
        // Auto-switch to New tab when new highlight is detected
        setSubTab('new');
      }
    }
  }, [initialData]);

  useEffect(() => {
    loadData();

    const handleStorageChange = (): void => {
      loadData();
    };

    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  useEffect(() => {
    applyFiltersAndSort();
  }, [highlights, selectedTags, sortBy]);

  const loadData = async (): Promise<void> => {
    try {
      setLoading(true);

      const [allHighlights, allTags, captures] = await Promise.all([
        storageService.getAllHighlights(),
        storageService.getAllTags(),
        imageCaptureStorage.getAllCaptures()
      ]);

      setHighlights(Object.values(allHighlights));
      setTags(Object.values(allTags));
      setAllCaptures(captures);
    } catch (error) {
      console.error('Error loading sidebar data:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFiltersAndSort = (): void => {
    let filtered = [...highlights];

    if (selectedTags.length > 0) {
      filtered = filtered.filter((highlight) =>
        highlight.tags.some((tag) => selectedTags.includes(tag))
      );
    }

    switch (sortBy) {
      case 'date':
        filtered.sort((a, b) => b.createdAt - a.createdAt);
        break;
      case 'tag':
        filtered.sort((a, b) => {
          const tagA = a.tags[0] || '';
          const tagB = b.tags[0] || '';
          return tagA.localeCompare(tagB);
        });
        break;
    }

    setFilteredHighlights(filtered);
  };

  const handleDelete = async (highlightId: string): Promise<void> => {
    try {
      await storageService.deleteHighlight(highlightId);
      await loadData();
    } catch (error) {
      console.error('Error deleting highlight:', error);
      alert('Failed to delete highlight. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-gray-400 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading highlights...</p>
        </div>
      </div>
    );
  }

  const handleSave = async (inputTags: string[]): Promise<void> => {
    if (!activeAction) return;

    try {
      if (activeAction.mode === 'capture') {
        // Save capture
        if (!activeAction.imageData) return;

        const capture: ImageCapture = {
          id: activeAction.captureId || `capture_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
          imageData: activeAction.imageData,
          url: activeAction.url || window.location.href,
          tags: inputTags.length > 0 ? inputTags : [],
          note: noteInputValue.trim(),
          title: titleInputValue.trim() || undefined,
          linkedIds: linkedIds.length > 0 ? linkedIds : undefined,
          createdAt: activeAction.timestamp || Date.now()
        };

        await imageCaptureStorage.saveCapture(capture);
        showSuccessMessage('Screenshot saved!');
      } else {
        // Save highlight
        if (!activeAction.text) return;

        const highlight: Highlight = {
          id: activeAction.highlightId || `highlight_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
          url: activeAction.url || window.location.href,
          pageTitle: activeAction.pageTitle || document.title,
          text: activeAction.text,
          tags: inputTags.length > 0 ? inputTags : ['untagged'],
          color: (activeAction.color as any) || 'yellow',
          position: activeAction.position || {
            startOffset: 0,
            endOffset: 0,
            xpath: '',
            textContent: activeAction.text
          },
          title: titleInputValue.trim() || undefined,
          note: noteInputValue.trim() || undefined,
          linkedIds: linkedIds.length > 0 ? linkedIds : undefined,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        await storageService.saveHighlight(highlight);
        await storageService.bumpGlobalTags(highlight.tags);
        showSuccessMessage('Highlight saved!');
      }

      await loadData();
      setActiveAction(null);
      setTagInputValue('');
      setNoteInputValue('');
      setTitleInputValue('');
      setLinkedIds([]);
      setLinkedSearch('');
      setShowLinkedPicker(false);
      setSubTab('saved');
    } catch (error) {
      console.error('Error saving:', error);
      alert(`Failed to save ${activeAction.mode === 'capture' ? 'screenshot' : 'highlight'}. Please try again.`);
    }
  };


  const showSuccessMessage = (message: string): void => {
    const successMsg = document.createElement('div');
    successMsg.textContent = message;
    successMsg.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #10b981;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      z-index: 2147483647;
      font-family: system-ui, -apple-system, sans-serif;
    `;
    document.body.appendChild(successMsg);
    setTimeout(() => successMsg.remove(), 2000);
  };

  const handleCancelAction = async (): Promise<void> => {
    if (activeAction?.highlightId) {
      // Remove highlight from page (not from storage since it's not saved yet)
      try {
        // Notify content script to remove highlight from page via window message
        window.postMessage({
          type: 'AUREEN_REMOVE_HIGHLIGHT',
          highlightId: activeAction.highlightId
        }, '*');
      } catch (error) {
        console.error('Failed to remove temporary highlight:', error);
      }
    }
    setActiveAction(null);
  };

  return (
    <div className="flex flex-col h-screen bg-white font-sans antialiased">
      {/* Sub Tabs */}
      <div className="flex border-b border-gray-200 bg-gray-50">
        <button
          onClick={() => setSubTab('new')}
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
          /* New Highlight Tab */
          activeAction && activeAction.mode !== 'capture' ? (
            <div className="p-4 bg-gray-50">
              <div className="space-y-3">

                {/* Header */}
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-gray-900">New Highlight</h3>
                  <button onClick={handleCancelAction} className="text-gray-400 hover:text-gray-700">
                    ✕
                  </button>
                </div>

                {/* Selected text preview */}
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded-r">
                  <p className="text-sm text-gray-700 line-clamp-3">{activeAction.text}</p>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
                    Title <span className="text-gray-400 font-normal normal-case">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={titleInputValue}
                    onChange={(e) => setTitleInputValue(e.target.value)}
                    placeholder="e.g. Key concept from lecture 3"
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 text-sm"
                  />
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
                    Tags
                  </label>
                  <input
                    type="text"
                    id="tag-input"
                    value={tagInputValue}
                    onChange={(e) => setTagInputValue(e.target.value)}
                    placeholder="e.g. important, research, todo"
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const tags = tagInputValue.split(/[,\s]+/).map(t => sanitizeTagName(t)).filter(t => t.length > 0);
                        handleSave(tags);
                      }
                    }}
                    onFocus={() => setShowTagSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowTagSuggestions(false), 200)}
                  />
                  {showTagSuggestions && tags.length > 0 && (
                    <div className="mt-1 p-2 bg-white border border-gray-300 rounded-lg shadow-lg max-h-32 overflow-y-auto">
                      <p className="text-xs text-gray-400 mb-1">Quick select:</p>
                      <div className="flex flex-wrap gap-1">
                        {tags.slice(0, 20).map((tag) => {
                          const displayName = tag.name.startsWith('#') ? tag.name.slice(1) : tag.name;
                          return (
                            <button
                              key={tag.name}
                              type="button"
                              onClick={() => {
                                const cur = tagInputValue.trim();
                                setTagInputValue(cur ? `${cur}, ${displayName}` : displayName);
                              }}
                              className="px-2 py-0.5 text-xs rounded transition-colors"
                              style={{ backgroundColor: COLORS.primary, color: COLORS.textPrimary }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = COLORS.primaryHover}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = COLORS.primary}
                            >
                              {displayName}
                            </button>
                          );
                        })}
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
                    value={noteInputValue}
                    onChange={(e) => setNoteInputValue(e.target.value)}
                    placeholder="Study notes, thoughts, or context about this highlight..."
                    rows={3}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 text-sm resize-none"
                  />
                </div>

                {/* Linked items */}
                <div>
                  <button
                    type="button"
                    onClick={() => setShowLinkedPicker(v => !v)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 uppercase tracking-wide hover:text-indigo-600 transition-colors"
                  >
                    <span>{showLinkedPicker ? '▾' : '▸'}</span>
                    Link to existing items
                    {linkedIds.length > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold">
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
                          className="w-full px-2 py-1.5 bg-gray-50 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300"
                        />
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {/* Existing highlights */}
                        {highlights
                          .filter(h => h.id !== activeAction?.highlightId)
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
                                onChange={(e) => {
                                  setLinkedIds(prev => e.target.checked ? [...prev, h.id] : prev.filter(id => id !== h.id));
                                }}
                                className="mt-0.5 flex-shrink-0"
                              />
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-indigo-700 truncate">
                                  {h.title || h.text.slice(0, 40)}
                                </p>
                                {h.tags.length > 0 && (
                                  <p className="text-xs text-gray-400">{h.tags.slice(0,3).join(', ')}</p>
                                )}
                              </div>
                            </label>
                          ))}
                        {/* Saved captures */}
                        {allCaptures
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
                                onChange={(e) => {
                                  setLinkedIds(prev => e.target.checked ? [...prev, c.id] : prev.filter(id => id !== c.id));
                                }}
                                className="mt-0.5 flex-shrink-0"
                              />
                              <div className="flex items-center gap-2 min-w-0">
                                <img src={c.imageData} alt="" className="w-8 h-6 object-cover rounded flex-shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-xs font-medium text-green-700 truncate">
                                    {c.title || 'Screenshot'}
                                  </p>
                                  {c.tags.length > 0 && (
                                    <p className="text-xs text-gray-400">{c.tags.slice(0,3).join(', ')}</p>
                                  )}
                                </div>
                              </div>
                            </label>
                          ))}
                        {highlights.filter(h => h.id !== activeAction?.highlightId).length === 0 && allCaptures.length === 0 && (
                          <p className="px-3 py-4 text-xs text-gray-400 text-center">No saved items yet</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Save */}
                <Button
                  onClick={() => {
                    const tags = tagInputValue.split(/[,\s]+/).map(t => sanitizeTagName(t)).filter(t => t.length > 0);
                    handleSave(tags);
                  }}
                  variant="primary"
                  fullWidth
                  className="mt-1"
                >
                  Save Highlight
                </Button>

              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
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
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <p className="text-gray-500 mb-2">No new highlight</p>
                <p className="text-sm text-gray-400">
                  Select text on the page to create a highlight
                </p>
              </div>
            </div>
          )
        ) : (
          /* Saved Highlights Tab */
          <>
            <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
              <div className="px-4 py-2">
                {!showSortOptions ? (
                  <button
                    onClick={() => setShowSortOptions(true)}
                    className="w-full px-3 py-1 text-xs font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                  >
                    Sort by
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSortBy('date');
                        setSelectedTags([]);
                        setShowSortOptions(false);
                      }}
                      className="flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors"
                      style={{
                        backgroundColor: sortBy === 'date' && selectedTags.length === 0 ? COLORS.primary : COLORS.gray100,
                        color: sortBy === 'date' && selectedTags.length === 0 ? COLORS.textPrimary : COLORS.gray700
                      }}
                    >
                      Date
                    </button>
                    <button
                      onClick={() => {
                        setSortBy('tag');
                        setShowTagFilter(!showTagFilter);
                      }}
                      className="flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors"
                      style={{
                        backgroundColor: showTagFilter || selectedTags.length > 0 ? COLORS.primary : COLORS.gray100,
                        color: showTagFilter || selectedTags.length > 0 ? COLORS.textPrimary : COLORS.gray700
                      }}
                    >
                      Tag {selectedTags.length > 0 && `(${selectedTags.length})`}
                    </button>
                  </div>
                )}

                {showTagFilter && tags.length > 0 && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-gray-700">Select tags to filter:</p>
                      <button
                        onClick={() => setSelectedTags([])}
                        className="text-xs text-gray-600 hover:text-gray-800 font-medium"
                      >
                        Clear
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                      {tags.map((tag) => {
                        const displayName = tag.name.startsWith('#') ? tag.name.slice(1) : tag.name;
                        return (
                          <button
                            key={tag.name}
                            onClick={() => {
                              if (selectedTags.includes(tag.name)) {
                                setSelectedTags(selectedTags.filter(t => t !== tag.name));
                              } else {
                                setSelectedTags([...selectedTags, tag.name]);
                              }
                            }}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all"
                            style={{
                              backgroundColor: selectedTags.includes(tag.name) ? COLORS.primary : COLORS.white,
                              color: selectedTags.includes(tag.name) ? COLORS.textPrimary : COLORS.gray700,
                              border: selectedTags.includes(tag.name) ? 'none' : `1px solid ${COLORS.gray300}`
                            }}
                          >
                            <span>{displayName}</span>
                            <span
                              className="text-xs px-2 py-0.5 rounded-full"
                              style={{
                                backgroundColor: selectedTags.includes(tag.name) ? COLORS.primaryHover : COLORS.gray200
                              }}
                            >
                              {tag.highlightCount}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4">
              <HighlightList
                highlights={filteredHighlights}
                onDelete={handleDelete}
              />
            </div>
          </>
        )}
      </div>

    </div>
  );
};
