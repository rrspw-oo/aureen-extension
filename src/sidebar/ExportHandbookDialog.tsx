import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { exportHandbook, exportHighlightHandbook } from '@/lib/handbook-export';
import { imageCaptureStorage } from '@/lib/capture-store';
import { storageService } from '@/lib/highlight-store';

interface ExportHandbookDialogProps {
  kind?: 'capture' | 'highlight';
  tags?: string[];
  onClose: () => void;
}

interface PickableItem {
  id: string;
  label: string;
  tags: string[];
  thumb?: string;
  createdAt: number;
}

export const ExportHandbookDialog: React.FC<ExportHandbookDialogProps> = ({
  kind = 'capture',
  tags: initialTags,
  onClose
}) => {
  const { t } = useTranslation();
  const isHighlight = kind === 'highlight';
  const [includeImage, setIncludeImage] = useState(true);
  const [items, setItems] = useState<PickableItem[] | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>(initialTags ?? []);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState('');
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async (): Promise<void> => {
      const list: PickableItem[] = isHighlight
        ? Object.values(await storageService.getAllHighlights()).map((h) => ({
            id: h.id,
            label: h.title?.trim() || h.text,
            tags: h.tags,
            createdAt: h.createdAt
          }))
        : (await imageCaptureStorage.getAllCaptures()).map((c) => ({
            id: c.id,
            label: c.title?.trim() || t('common.untitled'),
            tags: c.tags,
            thumb: c.imageData,
            createdAt: c.createdAt
          }));
      setItems(list.sort((a, b) => b.createdAt - a.createdAt));
    };
    load().catch(() => setItems([]));
  }, [isHighlight, t]);

  const tags = useMemo(() => {
    const names = new Set<string>();
    for (const item of items ?? []) item.tags.forEach((tag) => names.add(tag));
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [items]);

  const visible = useMemo(
    () => (items ?? []).filter((item) => selectedTags.length === 0 || item.tags.some((tag) => selectedTags.includes(tag))),
    [items, selectedTags]
  );

  // Changing the tag filter re-selects everything it shows; users then untick what they don't want.
  useEffect(() => {
    setChecked(new Set(visible.map((item) => item.id)));
  }, [visible]);

  const toggleTag = (name: string): void => {
    setSelectedTags((prev) => (prev.includes(name) ? prev.filter((tag) => tag !== name) : [...prev, name]));
  };

  const toggleItem = (id: string): void => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const ids = visible.filter((item) => checked.has(item.id)).map((item) => item.id);

  const handleConfirm = async (): Promise<void> => {
    setExporting(true);
    setError(null);
    try {
      const options = { ids, tags: selectedTags, title: title.trim() || undefined };
      if (isHighlight) {
        await exportHighlightHandbook({ ...options, includeImage: false });
      } else {
        await exportHandbook({ ...options, includeImage });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('exportDialog.failed'));
      setExporting(false);
    }
  };

  return (
    <div
      data-aureen-modal
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
      onClick={exporting ? undefined : onClose}
    >
      <div
        className="w-full max-w-sm max-h-full flex flex-col rounded-xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-gray-900">
          {isHighlight ? t('exportDialog.titleHighlights') : t('exportDialog.titleCaptures')}
        </h3>

        <label className="mt-4 block">
          <span className="text-sm text-gray-700">{t('exportDialog.fileName')}</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('exportDialog.fileNamePlaceholder')}
            disabled={exporting}
            className="mt-1.5 w-full h-9 rounded-lg border border-[#E2D8C4] px-3 text-sm focus:outline-none focus:border-[#C9A86C]"
          />
        </label>

        {tags.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">{t('exportDialog.chooseTags')}</span>
              {selectedTags.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedTags([])}
                  disabled={exporting}
                  className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-50"
                >
                  {t('common.clear')}
                </button>
              )}
            </div>
            <div className="mt-2 flex max-h-20 flex-wrap gap-1.5 overflow-y-auto">
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
                      (active ? 'bg-[#C9A86C] text-[#2C2417]' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')
                    }
                  >
                    #{item}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm text-gray-700">{t('exportDialog.chooseItems')}</span>
          <div className="flex gap-2 text-xs">
            <button type="button" className="text-[#7E5F25] hover:underline" onClick={() => setChecked(new Set(visible.map((i) => i.id)))}>
              {t('exportDialog.selectAll')}
            </button>
            <button type="button" className="text-gray-400 hover:text-gray-700" onClick={() => setChecked(new Set())}>
              {t('exportDialog.selectNone')}
            </button>
          </div>
        </div>
        <p className="mt-0.5 text-xs text-gray-400">
          {items === null ? t('exportDialog.counting') : t('exportDialog.selectedCount', { selected: ids.length, total: visible.length })}
        </p>
        <ul className="mt-2 min-h-0 flex-1 max-h-56 overflow-y-auto rounded-lg border border-[#EFE8DA] divide-y divide-[#EFE8DA]">
          {visible.map((item) => (
            <li key={item.id}>
              <label className="flex items-center gap-2.5 px-2.5 py-2 cursor-pointer hover:bg-[#FBF7EE]">
                <input
                  type="checkbox"
                  checked={checked.has(item.id)}
                  onChange={() => toggleItem(item.id)}
                  disabled={exporting}
                  className="h-4 w-4 flex-shrink-0 accent-[#C9A86C]"
                />
                {item.thumb && <img src={item.thumb} alt="" className="h-9 w-12 flex-shrink-0 rounded object-cover bg-gray-100" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-[#1F1F2E]">{item.label}</span>
                  {item.tags.length > 0 && (
                    <span className="block truncate text-[11px] text-gray-400">{item.tags.map((tag) => `#${tag}`).join(' ')}</span>
                  )}
                </span>
              </label>
            </li>
          ))}
        </ul>

        {!isHighlight && (
          <label className="mt-4 flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={includeImage}
              onChange={(e) => setIncludeImage(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300"
            />
            <span className="text-sm text-gray-700">
              {t('exportDialog.includeImage')}
              <span className="block text-xs text-gray-400">{t('exportDialog.includeImageHint')}</span>
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
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={exporting || ids.length === 0}
            className="rounded-md bg-[#C9A86C] px-4 py-1.5 text-sm font-medium text-[#2C2417] hover:bg-[#B8975B] disabled:opacity-50"
          >
            {exporting ? t('exportDialog.exporting') : t('exportDialog.exportPdf')}
          </button>
        </div>
      </div>
    </div>
  );
};
