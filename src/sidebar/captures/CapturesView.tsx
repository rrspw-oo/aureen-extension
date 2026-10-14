import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { imageCaptureStorage } from '@/lib/capture-store';
import { storageService } from '@/lib/highlight-store';
import { runOcrForCapture } from '@/lib/ocr';
import type { ImageCapture } from '@/types/image-capture';
import type { Highlight } from '@/types/highlight';
import { CaptureCard } from '@/sidebar/captures/CaptureCard';
import { ExportHandbookDialog } from '@/sidebar/ExportHandbookDialog';
import { CaptureForm, type CaptureFormFields } from '@/sidebar/captures/CaptureForm';
import { CompareView } from '@/sidebar/captures/CompareView';
import { SearchField } from '@/sidebar/ui/SearchField';
import { TagChipRow } from '@/sidebar/ui/TagChipRow';
import { StorageMeter } from '@/sidebar/ui/StorageMeter';
import { resolveLinks, type LinkKind } from '@/sidebar/ui/LinkedItems';
import { resetCaptureData } from '@/sidebar/shell';

interface CapturesViewProps {
  initialData?: Record<string, unknown>;
  focusCaptureId?: string | null;
  onNavigate?: (kind: LinkKind, id: string) => void;
  onFocusHandled?: () => void;
}

type SheetState =
  | { kind: 'new'; id: string; imageData: string; url: string; fullPage: boolean; createdAt: number }
  | { kind: 'edit'; capture: ImageCapture };

export const CapturesView: React.FC<CapturesViewProps> = ({ initialData, focusCaptureId, onNavigate, onFocusHandled }) => {
  const { t } = useTranslation();
  const [captures, setCaptures] = useState<ImageCapture[]>([]);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [compareTags, setCompareTags] = useState<string[] | null>(null);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [ocrRunningIds, setOcrRunningIds] = useState<string[]>([]);
  const [lightboxId, setLightboxId] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async (): Promise<void> => {
      const [allCaptures, allHighlights] = await Promise.all([
        imageCaptureStorage.getAllCaptures(),
        storageService.getAllHighlights()
      ]);
      setCaptures(allCaptures);
      setHighlights(Object.values(allHighlights));
      setLoaded(true);
    };
    loadData();
    chrome.storage.onChanged.addListener(loadData);
    return () => chrome.storage.onChanged.removeListener(loadData);
  }, []);

  useEffect(() => {
    if (initialData?.mode === 'capture' && typeof initialData.imageData === 'string') {
      setCompareTags(null);
      setSheet({
        kind: 'new',
        id: (initialData.captureId as string) || `capture_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
        imageData: initialData.imageData,
        url: (initialData.url as string) || window.location.href,
        fullPage: Boolean(initialData.fullPage),
        createdAt: (initialData.timestamp as number) || Date.now()
      });
    } else if (!initialData || Object.keys(initialData).length === 0) {
      setSheet((current) => (current?.kind === 'new' ? null : current));
    }
  }, [initialData]);

  useEffect(() => {
    if (!focusCaptureId || !loaded) return;
    setCompareTags(null);
    setSelectedTags([]);
    setQuery('');
    setLightboxId(focusCaptureId);
    onFocusHandled?.();
  }, [focusCaptureId, loaded]);

  const tagSummaries = useMemo(() => {
    const counts = new Map<string, number>();
    for (const capture of captures) {
      for (const tag of capture.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [captures]);

  const recentTags = useMemo(() => {
    const seen: string[] = [];
    for (const capture of [...captures].sort((a, b) => b.createdAt - a.createdAt)) {
      for (const tag of capture.tags) {
        if (!seen.includes(tag)) seen.push(tag);
      }
    }
    return seen;
  }, [captures]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return captures
      .filter((capture) => {
        if (selectedTags.length > 0 && !capture.tags.some((tag) => selectedTags.includes(tag))) return false;
        if (!q) return true;
        return `${capture.title ?? ''} ${capture.note} ${capture.ocrText ?? ''} ${capture.tags.join(' ')}`.toLowerCase().includes(q);
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [captures, selectedTags, query]);

  const handleRecognize = async (capture: ImageCapture): Promise<void> => {
    setOcrRunningIds((prev) => [...prev, capture.id]);
    try {
      await runOcrForCapture(capture.id, capture.imageData);
    } finally {
      setOcrRunningIds((prev) => prev.filter((id) => id !== capture.id));
    }
  };

  const handleDelete = async (captureId: string): Promise<void> => {
    if (!confirm(t('captures.confirmDelete'))) return;
    await imageCaptureStorage.deleteCapture(captureId);
  };

  const closeSheet = (): void => {
    setSheet(null);
    resetCaptureData();
  };

  const handleSave = async (fields: CaptureFormFields): Promise<void> => {
    if (!sheet) return;
    try {
      if (sheet.kind === 'new') {
        await imageCaptureStorage.saveCapture({
          id: sheet.id,
          url: sheet.url,
          imageData: fields.imageData,
          tags: fields.tags,
          note: fields.note.trim(),
          title: fields.title.trim() || undefined,
          linkedIds: fields.linkedIds.length > 0 ? fields.linkedIds : undefined,
          price: fields.price,
          createdAt: sheet.createdAt
        });
      } else {
        await imageCaptureStorage.updateCapture(sheet.capture.id, {
          title: fields.title.trim() || undefined,
          tags: fields.tags,
          note: fields.note.trim(),
          linkedIds: fields.linkedIds.length > 0 ? fields.linkedIds : undefined,
          price: fields.price,
          ...(fields.imageData !== sheet.capture.imageData ? { imageData: fields.imageData } : {})
        });
      }
      closeSheet();
    } catch (error) {
      console.error('Failed to save capture:', error);
      alert(t('captures.saveFailed'));
    }
  };

  const startScreenshot = (): void => {
    window.postMessage({ type: 'AUREEN_START_SCREENSHOT' }, '*');
  };

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#C9A86C]" />
      </div>
    );
  }

  const sheetElement = sheet && (
    <CaptureForm
      key={sheet.kind === 'new' ? sheet.id : sheet.capture.id}
      isEdit={sheet.kind === 'edit'}
      selfId={sheet.kind === 'new' ? sheet.id : sheet.capture.id}
      imageData={sheet.kind === 'new' ? sheet.imageData : sheet.capture.imageData}
      pageUrl={sheet.kind === 'new' ? sheet.url : sheet.capture.url}
      ocrText={sheet.kind === 'edit' ? sheet.capture.ocrText : undefined}
      initial={
        sheet.kind === 'new'
          ? { title: '', note: '', tags: [], linkedIds: [] }
          : {
              title: sheet.capture.title ?? '',
              note: sheet.capture.note,
              tags: sheet.capture.tags,
              linkedIds: sheet.capture.linkedIds ?? [],
              price: sheet.capture.price
            }
      }
      suggestions={tagSummaries.map((tag) => tag.name)}
      recentTags={recentTags}
      highlights={highlights}
      captures={captures}
      onSave={handleSave}
      onCancel={closeSheet}
    />
  );

  if (compareTags) {
    return (
      <>
        <CompareView
          tags={compareTags}
          captures={captures}
          highlights={highlights}
          ocrRunningIds={ocrRunningIds}
          onBack={() => setCompareTags(null)}
          onRecognize={handleRecognize}
        />
        {sheetElement}
      </>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-2.5 flex flex-col gap-2.5 flex-shrink-0">
        <SearchField value={query} onChange={setQuery} placeholder={t('captures.search')} />
        {tagSummaries.length > 0 && (
          <TagChipRow
            tags={tagSummaries}
            total={captures.length}
            selected={selectedTags}
            onChange={setSelectedTags}
            trailing={
              selectedTags.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCompareTags(selectedTags)}
                  className="h-7 px-3 rounded-md bg-[#C9A86C] hover:bg-[#B8975B] text-[#2C2417] text-xs font-semibold"
                >
                  {t('captures.compare')}
                </button>
              )
            }
          />
        )}
      </div>

      <main className="flex-1 min-h-0 overflow-y-auto px-4 pt-3.5 pb-4">
        {captures.length > 0 && filtered.length === 0 ? (
          <div className="text-center py-12 px-6">
            <p className="text-[#1F1F2E] font-medium mb-1">{t('captures.noMatch')}</p>
            <button type="button" onClick={() => { setQuery(''); setSelectedTags([]); }} className="text-sm text-[#7E5F25] underline">
              {t('highlights.clearFilters')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((capture) => (
              <CaptureCard
                key={capture.id}
                capture={capture}
                onDelete={handleDelete}
                onEdit={(target) => setSheet({ kind: 'edit', capture: target })}
                onRecognize={handleRecognize}
                ocrRunning={ocrRunningIds.includes(capture.id)}
                links={resolveLinks(capture.id, capture.linkedIds, highlights, captures)}
                onNavigate={onNavigate}
                autoOpen={lightboxId === capture.id}
                onAutoOpened={() => setLightboxId(null)}
              />
            ))}
            <button
              type="button"
              onClick={startScreenshot}
              className="min-h-[180px] border-[1.5px] border-dashed border-[#D9CDB4] rounded-xl flex flex-col items-center justify-center gap-2 text-[13px] font-medium text-[#6E5428] hover:bg-[#FBF4E6]"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6E5428" strokeWidth="1.8" strokeLinecap="round"><path d="M4 8V5a1 1 0 011-1h3M16 4h3a1 1 0 011 1v3M20 16v3a1 1 0 01-1 1h-3M8 20H5a1 1 0 01-1-1v-3" /></svg>
              {t('captures.captureRegion')}
            </button>
          </div>
        )}
      </main>

      <footer className="h-14 flex-shrink-0 px-4 flex items-center justify-between gap-3 border-t border-[#ECE4D4] bg-white">
        <StorageMeter showLabel />
        <button
          type="button"
          disabled={captures.length === 0}
          onClick={() => setShowExportDialog(true)}
          className="h-9 px-3.5 rounded-[9px] bg-[#C9A86C] hover:bg-[#B8975B] text-[#2C2417] text-[13px] font-semibold disabled:opacity-50"
        >
          {t('captures.exportHandbook')}
        </button>
      </footer>

      {showExportDialog && (
        <ExportHandbookDialog tags={selectedTags} onClose={() => setShowExportDialog(false)} />
      )}
      {sheetElement}
    </div>
  );
};
