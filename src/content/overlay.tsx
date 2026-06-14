/**
 * Overlay Component
 * React Portal-based overlay for tag input and highlight configuration
 * MUST use createPortal for proper z-index and modal behavior
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ColorPicker } from '@/components/ColorPicker';
import { TagInput } from '@/components/TagInput';
import { storageService } from '@/services/storage';
import type { HighlightColor, Tag } from '@/types';

interface OverlayProps {
  selectedText: string;
  onSave: (data: { color: HighlightColor; tags: string[] }) => void;
  onCancel: () => void;
  portalContainer?: HTMLElement;
}

export const HighlightOverlay: React.FC<OverlayProps> = ({
  selectedText,
  onSave,
  onCancel,
  portalContainer
}) => {
  const [color, setColor] = useState<HighlightColor>('yellow');
  const [tags, setTags] = useState<string[]>([]);
  const [tagSuggestions, setTagSuggestions] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSettings();
    loadTagSuggestions();

    const scrollY = window.scrollY;
    const scrollX = window.scrollX;

    window.scrollTo(0, 0);
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = '0';
    document.body.style.left = '0';
    document.body.style.width = '100%';
    document.body.style.height = '100%';

    const handleEscape = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.width = '';
      document.body.style.height = '';
      window.scrollTo(scrollX, scrollY);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onCancel]);

  const loadSettings = async (): Promise<void> => {
    try {
      const settings = await storageService.getSettings();
      setColor(settings.defaultColor);
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const loadTagSuggestions = async (): Promise<void> => {
    try {
      const allTags = await storageService.getAllTags();
      setTagSuggestions(Object.values(allTags));
    } catch (error) {
      console.error('Error loading tag suggestions:', error);
    }
  };

  const handleSave = async (): Promise<void> => {
    setLoading(true);
    try {
      onSave({ color, tags });
    } catch (error) {
      console.error('Error saving highlight:', error);
      alert('Failed to save highlight. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent): void => {
    if (e.target === e.currentTarget) {
      onCancel();
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000] p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="overlay-title"
    >
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <h2 id="overlay-title" className="text-xl font-bold text-gray-900">
            Create Highlight
          </h2>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Selected Text
            </label>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <p className="text-gray-900 leading-relaxed line-clamp-6">
                {selectedText}
              </p>
            </div>
          </div>

          <ColorPicker
            selectedColor={color}
            onChange={setColor}
            disabled={loading}
          />

          <TagInput
            tags={tags}
            suggestions={tagSuggestions}
            onChange={setTags}
            disabled={loading}
          />

          <div className="bg-[#FAF4E9] border border-[#E8DCC2] rounded-lg p-4">
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-[#A9863F] flex-shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="text-sm text-[#7E6332]">
                <p className="font-medium mb-1">Quick Tips:</p>
                <ul className="list-disc list-inside space-y-1 text-[#9A7B43]">
                  <li>Use tags to organize highlights across different pages</li>
                  <li>Tags can be filtered later in the sidebar</li>
                  <li>Separate multiple tags with spaces or commas</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>

          <button
            onClick={handleSave}
            disabled={loading}
            className="px-6 py-2 bg-[#A9863F] text-white rounded-lg hover:bg-[#9A7B43] transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading && (
              <svg
                className="animate-spin h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            )}
            {loading ? 'Saving...' : 'Save Highlight'}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, portalContainer || document.body);
};
