import React, { useEffect, useState } from 'react';
import {
  exportHandbook,
  exportHighlightHandbook,
  getHandbookCount,
  getHighlightHandbookCount
} from '@/services/handbook-export';
import { imageCaptureStorage } from '@/services/image-capture-storage';
import { storageService } from '@/services/storage';

interface ExportHandbookDialogProps {
  kind?: 'capture' | 'highlight';
  tag?: string;
  onClose: () => void;
}

export const ExportHandbookDialog: React.FC<ExportHandbookDialogProps> = ({
  kind = 'capture',
  tag,
  onClose
}) => {
  const isHighlight = kind === 'highlight';
  const [includeImage, setIncludeImage] = useState(true);
  const [count, setCount] = useState<number | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [selectedTag, setSelectedTag] = useState(tag || '');
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const counter = isHighlight ? getHighlightHandbookCount : getHandbookCount;
    counter(selectedTag || undefined).then(setCount).catch(() => setCount(0));
  }, [selectedTag, isHighlight]);

  useEffect(() => {
    const loadTags = async () => {
      const allTags = isHighlight
        ? Object.values(await storageService.getAllTags())
        : await imageCaptureStorage.getAllTags();
      setTags(allTags.map((item) => item.name).sort((a, b) => a.localeCompare(b)));
    };
    loadTags();
  }, [isHighlight]);

  const handleConfirm = async () => {
    setExporting(true);
    setError(null);
    try {
      if (isHighlight) {
        await exportHighlightHandbook({ includeImage: false, tag: selectedTag || undefined });
      } else {
        await exportHandbook({ includeImage, tag: selectedTag || undefined });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
      setExporting(false);
    }
  };

  const noun = isHighlight ? 'highlight' : 'capture';
  const unit = count === 1 ? noun : `${noun}s`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={exporting ? undefined : onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-gray-900">
          {isHighlight ? 'Export Highlights' : 'Export Handbook'}{tag ? ` #${tag}` : ''}
        </h3>
        <p className="mt-1 text-xs text-gray-500">
          {count === null ? 'Counting...' : `${count} ${unit}`}
        </p>

        {tags.length > 0 && (
          <label className="mt-4 block text-sm text-gray-700">
            Export by tag
            <select
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
              disabled={exporting}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm"
            >
              <option value="">All tags</option>
              {tags.map((item) => <option key={item} value={item}>#{item}</option>)}
            </select>
          </label>
        )}

        {!isHighlight && (
          <label className="mt-4 flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={includeImage}
              onChange={(e) => setIncludeImage(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300"
            />
            <span className="text-sm text-gray-700">
              Include original image
              <span className="block text-xs text-gray-400">
                When off, pages show OCR text instead
              </span>
            </span>
          </label>
        )}

        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={exporting}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={exporting || count === 0}
            className="rounded-md bg-[#C9A86C] px-4 py-1.5 text-sm font-medium text-[#2C2417] hover:bg-[#B8975B] disabled:opacity-50"
          >
            {exporting ? 'Exporting...' : 'Export PDF'}
          </button>
        </div>
      </div>
    </div>
  );
};
