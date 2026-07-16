/**
 * Image Tag Filter Component
 * Allows filtering screenshots by tags
 */

import React from 'react';
import type { ImageTag } from '@/types/image-capture';
import { COLORS } from '@/constants/theme';

interface ImageTagFilterProps {
  tags: ImageTag[];
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
}

export const ImageTagFilter: React.FC<ImageTagFilterProps> = ({
  tags,
  selectedTags,
  onTagsChange
}) => {
  const handleTagClick = (tagName: string) => {
    if (selectedTags.includes(tagName)) {
      // Remove tag
      onTagsChange(selectedTags.filter(t => t !== tagName));
    } else {
      // Add tag
      onTagsChange([...selectedTags, tagName]);
    }
  };

  const handleClearAll = () => {
    onTagsChange([]);
  };

  if (tags.length === 0) {
    return null;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-700">Filter by Tags</h3>
        {selectedTags.length > 0 && (
          <button
            onClick={handleClearAll}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Clear all
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => {
          const isSelected = selectedTags.includes(tag.name);

          return (
            <button
              key={tag.name}
              onClick={() => handleTagClick(tag.name)}
              className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200"
              style={{
                backgroundColor: isSelected ? COLORS.primary : COLORS.goldChip,
                color: isSelected ? COLORS.onGold : COLORS.goldChipText,
                border: `1px solid ${isSelected ? COLORS.primary : COLORS.goldBorderStrong}`
              }}
            >
              {tag.name}
              <span
                className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs"
                style={{
                  backgroundColor: '#ffffff',
                  color: COLORS.goldChipText
                }}
              >
                {tag.captureCount}
              </span>
            </button>
          );
        })}
      </div>

      {selectedTags.length > 0 && (
        <div className="mt-3 text-sm text-gray-600">
          Showing screenshots with:{' '}
          <span className="font-medium">{selectedTags.join(', ')}</span>
        </div>
      )}
    </div>
  );
};
