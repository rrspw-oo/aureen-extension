/**
 * TagFilter Component
 * Allows filtering highlights by tags with multi-select
 */

import React from 'react';
import { escapeHtml } from '@/utils/security';
import type { Tag } from '@/types';

interface TagFilterProps {
  tags: Tag[];
  selectedTags: string[];
  onSelectionChange: (tags: string[]) => void;
}

export const TagFilter: React.FC<TagFilterProps> = ({
  tags,
  selectedTags,
  onSelectionChange
}) => {
  const toggleTag = (tagName: string): void => {
    if (selectedTags.includes(tagName)) {
      onSelectionChange(selectedTags.filter((t) => t !== tagName));
    } else {
      onSelectionChange([...selectedTags, tagName]);
    }
  };

  const clearAll = (): void => {
    onSelectionChange([]);
  };

  const selectAll = (): void => {
    onSelectionChange(tags.map((tag) => tag.name));
  };

  const sortedTags = [...tags].sort((a, b) => b.highlightCount - a.highlightCount);

  return (
    <div className="tag-filter">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Filter by Tags</h3>
        <div className="flex gap-2">
          {selectedTags.length > 0 && (
            <button
              onClick={clearAll}
              className="text-xs text-gray-500 hover:text-gray-700 font-medium"
            >
              Clear all
            </button>
          )}
          {selectedTags.length < tags.length && tags.length > 0 && (
            <button
              onClick={selectAll}
              className="text-xs text-[#A9863F] hover:text-[#9A7B43] font-medium"
            >
              Select all
            </button>
          )}
        </div>
      </div>

      {tags.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">No tags yet</p>
      ) : (
        <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
          {sortedTags.map((tag) => {
            const isSelected = selectedTags.includes(tag.name);

            return (
              <button
                key={tag.name}
                onClick={() => toggleTag(tag.name)}
                className={`
                  inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium transition-all border
                  ${
                    isSelected
                      ? 'bg-[#C9A86C] text-[#2C2417] border-[#C9A86C]'
                      : 'bg-[#F4ECDD] text-[#9A7B43] border-[#E6DCC6] hover:bg-[#EFE4CE]'
                  }
                `}
              >
                <span dangerouslySetInnerHTML={{ __html: `#${escapeHtml(tag.name)}` }} />
                <span className="text-xs px-2 py-0.5 rounded-full bg-white text-[#9A7B43]">
                  {tag.highlightCount}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
