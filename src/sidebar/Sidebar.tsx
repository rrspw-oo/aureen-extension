import React, { useEffect, useMemo, useState } from 'react';
import { storageService } from '@/services/storage';
import { imageCaptureStorage } from '@/services/image-capture-storage';
import { HighlightList, type HighlightGroup } from './HighlightList';
import { HighlightForm, type HighlightFormFields } from './HighlightForm';
import { SearchField } from '@/components/SearchField';
import { TagChipRow } from '@/components/TagChipRow';
import { StorageMeter } from '@/components/StorageMeter';
import { resolveLinks, type LinkKind } from '@/components/LinkedItems';
import { normalizePageUrl } from '@/utils/url';
import { resetCaptureData } from '@/content/sidebar-shadow';
import type { Highlight, HighlightColor, HighlightPosition } from '@/types';
import type { ImageCapture } from '@/types/image-capture';

interface SidebarProps {
  initialData?: Record<string, unknown>;
  focusHighlightId?: string | null;
  onNavigate?: (kind: LinkKind, id: string) => void;
  onFocusHandled?: () => void;
}

interface HighlightAction {
  text: string;
  url: string;
  pageTitle: string;
  highlightId?: string;
  position?: HighlightPosition;
  color?: HighlightColor;
  createdAt?: number;
  focusNote?: boolean;
  isEdit: boolean;
  initial: HighlightFormFields;
}

const EMPTY_FIELDS: HighlightFormFields = { title: '', note: '', tags: [], linkedIds: [] };

export const Sidebar: React.FC<SidebarProps> = ({ initialData, focusHighlightId, onNavigate, onFocusHandled }) => {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [allCaptures, setAllCaptures] = useState<ImageCapture[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [action, setAction] = useState<HighlightAction | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);

  useEffect(() => {
    if (initialData?.mode === 'highlight' && typeof initialData.text === 'string') {
      setAction({
        text: initialData.text,
        url: (initialData.url as string) || window.location.href,
        pageTitle: (initialData.pageTitle as string) || document.title,
        highlightId: initialData.highlightId as string | undefined,
        position: initialData.position as HighlightPosition | undefined,
        color: initialData.color as HighlightColor | undefined,
        focusNote: Boolean(initialData.focusNote),
        isEdit: false,
        initial: EMPTY_FIELDS
      });
    }
  }, [initialData]);

  useEffect(() => {
    const loadData = async (): Promise<void> => {
      const [allHighlights, captures] = await Promise.all([
        storageService.getAllHighlights(),
        imageCaptureStorage.getAllCaptures()
      ]);
      setHighlights(Object.values(allHighlights));
      setAllCaptures(captures);
      setLoaded(true);
    };
    loadData();
    chrome.storage.onChanged.addListener(loadData);
    return () => chrome.storage.onChanged.removeListener(loadData);
  }, []);

  useEffect(() => {
    if (!focusHighlightId || !loaded) return;
    setSelectedTags([]);
    setQuery('');
    setFocusedId(focusHighlightId);
    onFocusHandled?.();
  }, [focusHighlightId, loaded]);

  useEffect(() => {
    if (!focusedId) return;
    const timer = setTimeout(() => setFocusedId(null), 2000);
    return () => clearTimeout(timer);
  }, [focusedId]);

  const tagSummaries = useMemo(() => {
    const counts = new Map<string, number>();
    for (const highlight of highlights) {
      for (const tag of highlight.tags) {
        if (tag !== 'untagged') counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [highlights]);

  const recentTags = useMemo(() => {
    const seen: string[] = [];
    for (const highlight of [...highlights].sort((a, b) => b.createdAt - a.createdAt)) {
      for (const tag of highlight.tags) {
        if (tag !== 'untagged' && !seen.includes(tag)) seen.push(tag);
      }
    }
    return seen;
  }, [highlights]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return highlights.filter((highlight) => {
      if (selectedTags.length > 0 && !highlight.tags.some((tag) => selectedTags.includes(tag))) return false;
      if (!q) return true;
      return `${highlight.text} ${highlight.title ?? ''} ${highlight.note ?? ''} ${highlight.tags.join(' ')}`.toLowerCase().includes(q);
    });
  }, [highlights, selectedTags, query]);

  const groups = useMemo(() => {
    const pageUrl = normalizePageUrl(window.location.href);
    const byKey = new Map<string, HighlightGroup>();
    for (const highlight of [...filtered].sort((a, b) => b.createdAt - a.createdAt)) {
      const key = normalizePageUrl(highlight.url);
      const group = byKey.get(key);
      if (group) {
        group.items.push(highlight);
      } else {
        byKey.set(key, { key, url: highlight.url, title: highlight.pageTitle, isCurrentPage: key === pageUrl, items: [highlight] });
      }
    }
    return [...byKey.values()].sort((a, b) => {
      if (a.isCurrentPage !== b.isCurrentPage) return a.isCurrentPage ? -1 : 1;
      return b.items[0].createdAt - a.items[0].createdAt;
    });
  }, [filtered]);

  const handleDelete = async (highlightId: string): Promise<void> => {
    await storageService.deleteHighlight(highlightId);
  };

  const handleEditHighlight = (highlight: Highlight): void => {
    setAction({
      text: highlight.text,
      url: highlight.url,
      pageTitle: highlight.pageTitle,
      highlightId: highlight.id,
      position: highlight.position,
      color: highlight.color,
      createdAt: highlight.createdAt,
      isEdit: true,
      initial: {
        title: highlight.title ?? '',
        note: highlight.note ?? '',
        tags: highlight.tags.filter((tag) => tag !== 'untagged'),
        linkedIds: highlight.linkedIds ?? []
      }
    });
  };

  const closeSheet = (): void => {
    setAction(null);
    resetCaptureData();
  };

  const handleCancel = (): void => {
    if (action && !action.isEdit && action.highlightId) {
      window.postMessage({ type: 'AUREEN_REMOVE_HIGHLIGHT', highlightId: action.highlightId }, '*');
    }
    closeSheet();
  };

  const handleSave = async (fields: HighlightFormFields): Promise<void> => {
    if (!action) return;
    const highlight: Highlight = {
      id: action.highlightId || `highlight_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      url: action.url,
      pageTitle: action.pageTitle,
      text: action.text,
      tags: fields.tags.length > 0 ? fields.tags : ['untagged'],
      color: action.color || 'yellow',
      position: action.position || { startOffset: 0, endOffset: 0, xpath: '', textContent: action.text },
      title: fields.title.trim() || undefined,
      note: fields.note.trim() || undefined,
      linkedIds: fields.linkedIds.length > 0 ? fields.linkedIds : undefined,
      createdAt: action.createdAt || Date.now(),
      updatedAt: Date.now()
    };
    try {
      await storageService.saveHighlight(highlight);
      await storageService.bumpGlobalTags(highlight.tags);
      closeSheet();
    } catch (error) {
      console.error('Error saving highlight:', error);
      alert('Failed to save highlight. Please try again.');
    }
  };

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#C9A86C]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-2.5 flex flex-col gap-2.5 flex-shrink-0">
        <SearchField value={query} onChange={setQuery} placeholder="Search text, notes, titles" />
        {tagSummaries.length > 0 && (
          <TagChipRow tags={tagSummaries} total={highlights.length} selected={selectedTags} onChange={setSelectedTags} />
        )}
      </div>

      <main className="flex-1 min-h-0 overflow-y-auto px-4 pt-3.5 pb-4">
        {highlights.length === 0 ? (
          <div className="text-center py-12 px-6">
            <p className="text-[#1F1F2E] font-medium mb-1">No highlights yet</p>
            <p className="text-sm text-[#6B6878]">Select text on any page and choose Highlight in the toolbar that appears.</p>
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center py-12 px-6">
            <p className="text-[#1F1F2E] font-medium mb-1">No highlights match</p>
            <button type="button" onClick={() => { setQuery(''); setSelectedTags([]); }} className="text-sm text-[#7E5F25] underline">
              Clear search and filters
            </button>
          </div>
        ) : (
          <HighlightList
            groups={groups}
            onEdit={handleEditHighlight}
            onDelete={handleDelete}
            getLinks={(highlight) => resolveLinks(highlight.id, highlight.linkedIds, highlights, allCaptures)}
            onNavigate={onNavigate}
            focusedId={focusedId}
          />
        )}
      </main>

      <footer className="h-10 flex-shrink-0 px-4 flex items-center justify-between border-t border-[#ECE4D4] bg-white text-xs text-[#6B6878]">
        <span>{filtered.length} of {highlights.length} highlights</span>
        <StorageMeter />
      </footer>

      {action && (
        <HighlightForm
          key={action.highlightId ?? action.text}
          isEdit={action.isEdit}
          selfId={action.highlightId}
          text={action.text}
          pageUrl={action.url}
          initial={action.initial}
          focusNote={Boolean(action.focusNote)}
          suggestions={tagSummaries.map((tag) => tag.name)}
          recentTags={recentTags}
          highlights={highlights}
          captures={allCaptures}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
};
