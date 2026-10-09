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
  tags?: string[];
  onClose: () => void;
}

export const ExportHandbookDialog: React.FC<ExportHandbookDialogProps> = ({
  kind = 'capture',
  tags: initialTags,
  onClose
}) => {
  const isHighlight = kind === 'highlight';
  const [includeImage, setIncludeImage] = useState(true);
  const [count, setCount] = useState<number | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>(initialTags ?? []);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const counter = isHighlight ? getHighlightHandbookCount : getHandbookCount;
    counter(selectedTags).then(setCount).catch(() => setCount(0));
  }, [selectedTags, isHighlight]);

  useEffect(() => {
    const loadTags = async () => {
      const allTags = isHighlight
        ? Object.values(await storageService.getAllTags())
        : await imageCaptureStorage.getAllTags();
      setTags(allTags.map((item) => item.name).sort((a, b) => a.localeCompare(b)));
    };
    loadTags();
  }, [isHighlight]);

  const toggleTag = (name: string): void => {
    setSelectedTags((prev) =>
      prev.includes(name) ? prev.filter((t) => t !== name) : [...prev, name]
    );
  };

  const handleConfirm = async () => {
    setExporting(true);
    setError(null);
    try {
      if (isHighlight) {
        await exportHighlightHandbook({ includeImage: false, tags: selectedTags });
      } else {
        await exportHandbook({ includeImage, tags: selectedTags });
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
      data-aureen-modal
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={exporting ? undefined : onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-gray-900">
          {isHighlight ? 'Export Highlights' : 'Export Handbook'}
        </h3>
        <p className="mt-1 text-xs text-gray-500">
          {count === null ? 'Counting...' : `${count} ${unit}`}
        </p>

        {tags.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Choose tags to export</span>
              {selectedTags.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedTags([])}
                  disabled={exporting}
                  className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-50"
                >
                  Clear
                </button>
              )}
            </div>
            <p className="mt-0.5 text-xs text-gray-400">
              {selectedTags.length === 0
                ? 'None selected — exports everything'
                : 'Items with any selected tag are included'}
            </p>
            <div className="mt-2 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
              {tags.map((item) => {
                const active = selectedTags.includes(item);
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggleTag(item)}
                    disabled={exporting}
                    className={
                      'rounded-full px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50 ' +
                      (active
                        ? 'bg-[#C9A86C] text-[#2C2417]'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200')
                    }
                  >
                    #{item}
                  </button>
                );
              })}
            </div>
          </div>
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
                When off, pages show text instead
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
