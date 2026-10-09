import React, { useEffect, useRef, useState } from 'react';
import { LinkedItems, type LinkEntry, type LinkKind } from '@/components/LinkedItems';
import { getRelativeTime } from '@/utils/date';
import type { Highlight, HighlightColor } from '@/types';

const MARK_TINT: Record<HighlightColor, { bg: string; line: string }> = {
  yellow: { bg: '#F5E6BF', line: '#D9BC7E' },
  mint: { bg: '#D3EEDD', line: '#86C29C' },
  coral: { bg: '#F8D6D2', line: '#E09A92' },
  peach: { bg: '#FBE3C8', line: '#E3AE73' },
  lavender: { bg: '#E7DDF6', line: '#AE98D6' },
  sky: { bg: '#D6E6F8', line: '#8FB3DE' }
};

const LONG_TEXT = 220;

interface HighlightCardProps {
  highlight: Highlight;
  onEdit?: (highlight: Highlight) => void;
  onDelete?: (highlightId: string) => void;
  links?: LinkEntry[];
  onNavigate?: (kind: LinkKind, id: string) => void;
  focused?: boolean;
  onThisPage?: boolean;
}

export const HighlightCard: React.FC<HighlightCardProps> = ({
  highlight,
  onEdit,
  onDelete,
  links = [],
  onNavigate,
  focused = false,
  onThisPage = false
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const cardRef = useRef<HTMLElement>(null);
  const tint = MARK_TINT[highlight.color] ?? MARK_TINT.yellow;
  const isLong = highlight.text.length > LONG_TEXT;
  const tags = highlight.tags.filter((tag) => tag !== 'untagged');

  useEffect(() => {
    if (focused) {
      cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [focused]);

  const handleDelete = (): void => {
    if (onDelete && confirm('Are you sure you want to delete this highlight?')) onDelete(highlight.id);
  };

  return (
    <article
      ref={cardRef}
      data-highlight-id={highlight.id}
      className="bg-white border border-[#ECE4D4] rounded-xl p-3.5 flex flex-col gap-2.5"
      style={{ outline: focused ? '2px solid #A9863F' : 'none', outlineOffset: '2px' }}
    >
      <div className="flex items-start justify-between gap-2">
        {highlight.title ? (
          <h3 className="m-0 text-[15px] font-semibold leading-snug text-[#1F1F2E] line-clamp-2">{highlight.title}</h3>
        ) : (
          <span className="text-[11px] text-[#6B6878] pt-0.5">{getRelativeTime(highlight.createdAt)}</span>
        )}
        <div className="flex items-center gap-0.5 flex-shrink-0 -mr-1 -mt-1">
          {highlight.title && <span className="text-[11px] text-[#6B6878] mr-1">{getRelativeTime(highlight.createdAt)}</span>}
          {onEdit && (
            <button
              type="button"
              title="Edit"
              aria-label="Edit highlight"
              onClick={() => onEdit(highlight)}
              className="w-7 h-7 flex items-center justify-center rounded-md text-[#9A958A] hover:bg-[#F4F1EA] hover:text-[#1F1F2E]"
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              title="Delete"
              aria-label="Delete highlight"
              onClick={handleDelete}
              className="w-7 h-7 flex items-center justify-center rounded-md text-[#9A958A] hover:bg-[#FDF0EE] hover:text-[#B5533F]"
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          )}
        </div>
      </div>

      <p className={`m-0 text-sm leading-relaxed text-[#2E2A22] whitespace-pre-line ${isExpanded ? '' : 'line-clamp-4'}`}>
        <span style={{ background: tint.bg, boxShadow: `inset 0 -2px 0 ${tint.line}`, padding: '1px 0' }}>{highlight.text}</span>
      </p>
      {isLong && (
        <button type="button" onClick={() => setIsExpanded((v) => !v)} className="self-start -mt-1 text-xs font-medium text-[#7E5F25] hover:underline">
          {isExpanded ? 'Less' : 'More'}
        </button>
      )}

      {highlight.note && (
        <p className="m-0 text-[13px] leading-normal text-[#5E5A4E] line-clamp-3">
          <span className="font-semibold text-[#7E5F25]">Note </span>
          {highlight.note}
        </p>
      )}

      {links.length > 0 && onNavigate && <LinkedItems links={links} onNavigate={onNavigate} />}

      {(tags.length > 0 || onThisPage) && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {tags.map((tag) => (
            <span key={tag} className="h-[22px] px-2 rounded-full bg-[#F4ECDD] text-[#6E5428] text-xs font-medium inline-flex items-center">
              {tag}
            </span>
          ))}
          {onThisPage && (
            <button
              type="button"
              onClick={() => window.postMessage({ type: 'AUREEN_SCROLL_TO_HIGHLIGHT', highlightId: highlight.id }, '*')}
              title="Scroll to this highlight on the page"
              className="ml-auto h-7 px-2.5 rounded-md bg-[#FBF4E6] hover:bg-[#F4ECDD] text-[#6E5428] text-xs font-semibold"
            >
              Show on page
            </button>
          )}
        </div>
      )}
    </article>
  );
};
