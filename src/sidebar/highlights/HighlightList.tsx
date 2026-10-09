import React from 'react';
import { HighlightCard } from '@/sidebar/highlights/HighlightCard';
import type { Highlight } from '@/types/highlight';
import type { LinkEntry, LinkKind } from '@/sidebar/ui/LinkedItems';

export interface HighlightGroup {
  key: string;
  url: string;
  title: string;
  isCurrentPage: boolean;
  items: Highlight[];
}

interface HighlightListProps {
  groups: HighlightGroup[];
  onEdit: (highlight: Highlight) => void;
  onDelete: (highlightId: string) => void;
  getLinks: (highlight: Highlight) => LinkEntry[];
  onNavigate?: (kind: LinkKind, id: string) => void;
  focusedId: string | null;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export const HighlightList: React.FC<HighlightListProps> = ({ groups, onEdit, onDelete, getLinks, onNavigate, focusedId }) => (
  <div className="flex flex-col gap-4">
    {groups.map((group) => {
      const host = hostOf(group.url);
      return (
        <section key={group.key} className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2 px-0.5">
            <span className="w-5 h-5 rounded-[5px] bg-[#EEE7DA] text-[#6E5428] text-[11px] font-semibold flex items-center justify-center flex-shrink-0">
              {(host[0] ?? '#').toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold truncate text-[#1F1F2E]">{group.title || host || group.url}</div>
              <div className="text-[11px] text-[#6B6878] truncate">
                {host || group.url} · {group.items.length} {group.items.length === 1 ? 'highlight' : 'highlights'}
                {group.isCurrentPage && <span className="text-[#7E5F25] font-semibold"> · this page</span>}
              </div>
            </div>
          </div>
          {group.items.map((highlight) => (
            <HighlightCard
              key={highlight.id}
              highlight={highlight}
              onEdit={onEdit}
              onDelete={onDelete}
              links={getLinks(highlight)}
              onNavigate={onNavigate}
              focused={focusedId === highlight.id}
              onThisPage={group.isCurrentPage}
            />
          ))}
        </section>
      );
    })}
  </div>
);
