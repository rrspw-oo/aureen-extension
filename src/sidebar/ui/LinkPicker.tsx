import React, { useState } from 'react';
import { normalizePageUrl } from '@/lib/url';

interface PickHighlight {
  id: string;
  text: string;
  title?: string;
  tags: string[];
  url: string;
}

interface PickCapture {
  id: string;
  title?: string;
  note: string;
  tags: string[];
  imageData: string;
  url: string;
}

interface LinkPickerProps {
  selfId?: string;
  pageUrl: string;
  highlights: PickHighlight[];
  captures: PickCapture[];
  value: string[];
  onChange: (next: string[]) => void;
}

interface Entry {
  id: string;
  label: string;
  thumb?: string;
  haystack: string;
  samePage: boolean;
}

export const LinkPicker: React.FC<LinkPickerProps> = ({ selfId, pageUrl, highlights, captures, value, onChange }) => {
  const [open, setOpen] = useState(value.length > 0);
  const [query, setQuery] = useState('');
  const page = normalizePageUrl(pageUrl);

  const entries: Entry[] = [
    ...highlights.map((h) => ({
      id: h.id,
      label: h.title || h.text.slice(0, 60),
      haystack: `${h.title ?? ''} ${h.text} ${h.tags.join(' ')}`.toLowerCase(),
      samePage: normalizePageUrl(h.url) === page
    })),
    ...captures.map((c) => ({
      id: c.id,
      label: c.title || 'Screenshot',
      thumb: c.imageData,
      haystack: `${c.title ?? ''} ${c.note} ${c.tags.join(' ')}`.toLowerCase(),
      samePage: normalizePageUrl(c.url) === page
    }))
  ].filter((entry) => entry.id !== selfId);

  const q = query.trim().toLowerCase();
  const matches = entries.filter((entry) => !q || entry.haystack.includes(q));
  const samePage = matches.filter((entry) => entry.samePage);
  const others = matches.filter((entry) => !entry.samePage).slice(0, 12);

  const toggle = (id: string, checked: boolean): void => {
    onChange(checked ? [...value, id] : value.filter((v) => v !== id));
  };

  const row = (entry: Entry): React.ReactNode => (
    <label key={entry.id} className="flex items-center gap-2.5 px-3 py-2 text-[13px] text-[#1F1F2E] hover:bg-[#FBF8F1] cursor-pointer">
      <input
        type="checkbox"
        checked={value.includes(entry.id)}
        onChange={(e) => toggle(entry.id, e.target.checked)}
        className="w-4 h-4 accent-[#A9863F] flex-shrink-0"
      />
      {entry.thumb ? (
        <img src={entry.thumb} alt="" className="w-9 h-[26px] object-cover rounded flex-shrink-0" />
      ) : (
        <span className="w-9 text-center text-[10px] font-semibold uppercase text-[#9A958A] flex-shrink-0">Text</span>
      )}
      <span className="truncate">{entry.label}</span>
    </label>
  );

  return (
    <div className="border border-[#ECE4D4] rounded-[10px]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-3 py-2.5 text-[13px] font-semibold text-[#1F1F2E]"
      >
        <span>
          Link related items
          {value.length > 0 && <span className="ml-2 px-1.5 py-0.5 rounded-full bg-[#F4ECDD] text-[#6E5428] text-[11px]">{value.length}</span>}
        </span>
        <span className="text-[11px] font-normal text-[#6B6878]">Each side lists the other</span>
      </button>
      {open && (
        <div className="border-t border-[#ECE4D4]">
          <div className="p-2">
            <input
              type="search"
              aria-label="Search items to link"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search highlights or screenshots"
              className="w-full h-8 px-2.5 bg-[#FBFAF7] border border-[#ECE4D4] rounded-md text-xs outline-none focus:border-[#C9A86C]"
            />
          </div>
          <div className="max-h-48 overflow-y-auto pb-1">
            {samePage.length > 0 && <div className="px-3 pt-1 pb-0.5 text-[11px] font-semibold text-[#6B6878]">Same page</div>}
            {samePage.map(row)}
            {others.length > 0 && <div className="px-3 pt-1 pb-0.5 text-[11px] font-semibold text-[#6B6878]">Other pages</div>}
            {others.map(row)}
            {matches.length === 0 && <p className="px-3 py-3 text-xs text-[#6B6878] text-center">No saved items match</p>}
          </div>
        </div>
      )}
    </div>
  );
};
