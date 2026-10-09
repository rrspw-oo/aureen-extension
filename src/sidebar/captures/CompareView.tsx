import React, { useMemo, useState } from 'react';
import { imageCaptureStorage } from '@/lib/capture-store';
import { parsePriceInput } from '@/lib/price';
import type { Highlight } from '@/types/highlight';
import type { ImageCapture } from '@/types/image-capture';

interface CompareViewProps {
  tags: string[];
  captures: ImageCapture[];
  highlights: Highlight[];
  ocrRunningIds: string[];
  onBack: () => void;
  onRecognize: (capture: ImageCapture) => void;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export const CompareView: React.FC<CompareViewProps> = ({ tags, captures, highlights, ocrRunningIds, onBack, onRecognize }) => {
  const [sort, setSort] = useState<'price' | 'newest'>('price');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editError, setEditError] = useState(false);

  const items = useMemo(() => {
    const matching = captures.filter((capture) => capture.tags.some((tag) => tags.includes(tag)));
    return matching.sort((a, b) => {
      if (sort === 'newest') return b.createdAt - a.createdAt;
      if (a.price && b.price) return a.price.amount - b.price.amount;
      if (a.price) return -1;
      if (b.price) return 1;
      return b.createdAt - a.createdAt;
    });
  }, [captures, tags, sort]);

  const relatedHighlights = highlights.filter((highlight) => highlight.tags.some((tag) => tags.includes(tag)));
  const priced = items.filter((item) => item.price);
  const lowest = priced.length > 1 ? Math.min(...priced.map((item) => item.price!.amount)) : null;

  const startEdit = (capture: ImageCapture): void => {
    setEditingId(capture.id);
    setEditText(capture.price?.label ?? '');
    setEditError(false);
  };

  const commitEdit = async (capture: ImageCapture): Promise<void> => {
    const text = editText.trim();
    if (!text) {
      await imageCaptureStorage.updateCapture(capture.id, { price: undefined });
      setEditingId(null);
      return;
    }
    if (capture.price && text === capture.price.label) {
      setEditingId(null);
      return;
    }
    const parsed = parsePriceInput(text);
    if (!parsed) {
      setEditError(true);
      return;
    }
    await imageCaptureStorage.updateCapture(capture.id, { price: { ...parsed, source: 'manual' } });
    setEditingId(null);
  };

  const sortButton = (value: 'price' | 'newest', label: string): React.ReactNode => (
    <button
      type="button"
      aria-pressed={sort === value}
      onClick={() => setSort(value)}
      className={`h-7 px-2.5 rounded-md text-xs ${sort === value ? 'bg-[#1F1F2E] text-white font-semibold' : 'border border-[#E2D8C4] text-[#5E5A4E] font-medium'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-2.5 pb-3 flex flex-col gap-3 border-b border-[#ECE4D4] flex-shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Back to screenshots"
            onClick={onBack}
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#F4F1EA] hover:bg-[#ECE6DA]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1F1F2E" strokeWidth="2" strokeLinecap="round"><path d="M15 6l-6 6 6 6" /></svg>
          </button>
          <div className="min-w-0">
            <div className="text-base font-semibold truncate">Compare {tags.map((tag) => `#${tag}`).join(' ')}</div>
            <div className="text-[11px] text-[#6B6878]">
              {items.length} {items.length === 1 ? 'screenshot' : 'screenshots'} · {relatedHighlights.length} {relatedHighlights.length === 1 ? 'highlight' : 'highlights'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-[#6B6878] mr-1">Sort</span>
          {sortButton('price', 'Price')}
          {sortButton('newest', 'Newest')}
          <span className="ml-auto text-[11px] text-[#6B6878]">Click a price to edit</span>
        </div>
      </div>

      <main className="flex-1 min-h-0 overflow-y-auto px-4 py-3 flex flex-col gap-2.5">
        {items.length === 0 && (
          <p className="text-center text-sm text-[#6B6878] py-10">No screenshots with these tags yet</p>
        )}
        {items.length > 0 && priced.length === 0 && (
          <p className="text-xs text-[#6B6878] px-1">Add a price or recognize text to compare.</p>
        )}

        {items.map((capture) => {
          const isLowest = lowest !== null && capture.price?.amount === lowest;
          const editing = editingId === capture.id;
          return (
            <article key={capture.id} className="grid grid-cols-[112px_minmax(0,1fr)] gap-3 p-2.5 bg-white border border-[#ECE4D4] rounded-xl">
              <img src={capture.imageData} alt="" className="w-[112px] h-24 object-cover rounded-lg bg-[#F4F1EA]" />
              <div className="flex flex-col gap-1.5 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <span className={`text-sm font-semibold line-clamp-2 ${capture.title ? '' : 'italic font-normal text-[#6B6878]'}`}>{capture.title || 'Untitled'}</span>
                  {editing ? (
                    <input
                      autoFocus
                      aria-label="Price"
                      value={editText}
                      onChange={(e) => { setEditText(e.target.value); setEditError(false); }}
                      onKeyDown={(e) => {
                        if (e.nativeEvent.isComposing) return;
                        if (e.key === 'Enter') commitEdit(capture);
                        if (e.key === 'Escape') { e.stopPropagation(); setEditingId(null); }
                      }}
                      onBlur={() => commitEdit(capture)}
                      className={`w-24 h-7 px-2 text-right text-sm border rounded-md outline-none ${editError ? 'border-[#C0533F]' : 'border-[#C9A86C]'}`}
                    />
                  ) : capture.price ? (
                    <button
                      type="button"
                      onClick={() => startEdit(capture)}
                      title={capture.price.source === 'ocr' ? 'Read from the screenshot text. Click to edit' : 'Click to edit'}
                      className={`text-[15px] font-semibold flex-shrink-0 hover:underline ${isLowest ? 'text-[#2F7A4D]' : 'text-[#1F1F2E]'}`}
                    >
                      {capture.price.label}
                    </button>
                  ) : (
                    <button type="button" onClick={() => startEdit(capture)} className="text-xs font-semibold text-[#7E5F25] flex-shrink-0 hover:underline">
                      Add price
                    </button>
                  )}
                </div>
                <div className="text-[11px] text-[#6B6878] truncate">{hostOf(capture.url)}</div>
                {capture.note && <div className="text-xs leading-snug text-[#5E5A4E] line-clamp-2">{capture.note}</div>}
                <div className="flex items-center gap-2">
                  {isLowest && <span className="h-5 px-1.5 rounded bg-[#E3F1E8] text-[#2F7A4D] text-[11px] font-semibold inline-flex items-center">Lowest</span>}
                  {editing && editError && <span className="text-[11px] text-[#B5533F]">Enter a number such as 1290</span>}
                  {!capture.price && capture.ocrStatus !== 'done' && (
                    <button
                      type="button"
                      disabled={ocrRunningIds.includes(capture.id)}
                      onClick={() => onRecognize(capture)}
                      className="text-xs font-medium text-[#5E5A4E] underline disabled:no-underline disabled:opacity-60"
                    >
                      {ocrRunningIds.includes(capture.id) ? 'Recognizing...' : 'Recognize text'}
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}

        {relatedHighlights.length > 0 && (
          <div className="mt-2 flex flex-col gap-2">
            <div className="text-xs font-semibold text-[#6B6878] px-1">Highlights with these tags</div>
            {relatedHighlights.map((highlight) => (
              <div key={highlight.id} className="p-3 border border-dashed border-[#D9CDB4] rounded-xl flex flex-col gap-1">
                <div className="text-[11px] text-[#6B6878] truncate">{hostOf(highlight.url)}</div>
                <div className="text-[13px] leading-snug text-[#2E2A22] line-clamp-3">{highlight.text}</div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};
