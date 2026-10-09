import React from 'react';
import { useTranslation } from 'react-i18next';
import { t as translate } from '@/i18n/config';

export type LinkKind = 'highlight' | 'capture';

export interface LinkEntry {
  kind: LinkKind;
  id: string;
  label: string;
  thumb?: string;
}

interface LinkableHighlight {
  id: string;
  text: string;
  title?: string;
  linkedIds?: string[];
}

interface LinkableCapture {
  id: string;
  imageData: string;
  title?: string;
  linkedIds?: string[];
}

export function resolveLinks(
  selfId: string,
  selfLinkedIds: string[] | undefined,
  highlights: LinkableHighlight[],
  captures: LinkableCapture[]
): LinkEntry[] {
  const own = new Set(selfLinkedIds ?? []);
  const entries: LinkEntry[] = [];
  for (const h of highlights) {
    if (h.id !== selfId && (own.has(h.id) || h.linkedIds?.includes(selfId))) {
      entries.push({ kind: 'highlight', id: h.id, label: h.title || h.text.slice(0, 60) });
    }
  }
  for (const c of captures) {
    if (c.id !== selfId && (own.has(c.id) || c.linkedIds?.includes(selfId))) {
      entries.push({ kind: 'capture', id: c.id, label: c.title || translate('common.screenshot'), thumb: c.imageData });
    }
  }
  return entries;
}

interface LinkedItemsProps {
  links: LinkEntry[];
  onNavigate: (kind: LinkKind, id: string) => void;
  dark?: boolean;
}

export const LinkedItems: React.FC<LinkedItemsProps> = ({ links, onNavigate, dark = false }) => {
  const { t } = useTranslation();
  return (
  <div>
    <p className={`text-xs font-semibold mb-1 ${dark ? 'text-[#E0CFA0]' : 'text-[#9A7B43]'}`}>{t('link.linkedItems')}</p>
    <div className="space-y-1">
      {links.map((link) => (
        <button
          key={link.id}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(link.kind, link.id);
          }}
          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs transition-colors ${
            dark ? 'bg-white bg-opacity-10 hover:bg-opacity-20 text-white' : 'bg-[#FBF5EA] hover:bg-[#F4ECDD] text-gray-700'
          }`}
        >
          {link.thumb ? (
            <img src={link.thumb} alt="" className="w-8 h-6 object-cover rounded flex-shrink-0" />
          ) : (
            <span className="w-8 text-center flex-shrink-0 text-[10px] font-semibold uppercase opacity-70">{t('common.text')}</span>
          )}
          <span className="truncate">{link.label}</span>
        </button>
      ))}
    </div>
  </div>
);
};
