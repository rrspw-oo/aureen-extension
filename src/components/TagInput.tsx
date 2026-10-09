/**
 * TagInput Component
 * Input field for adding tags with autocomplete suggestions
 */

import React, { useState, useRef, useEffect } from 'react';
import { sanitizeTagName } from '@/utils/security';
import type { Tag } from '@/types';

interface TagInputProps {
  tags: string[];
  suggestions?: Tag[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  maxTags?: number;
  disabled?: boolean;
}

export const TagInput: React.FC<TagInputProps> = ({
  tags,
  suggestions = [],
  onChange,
  placeholder = 'Add tags (space or comma separated)',
  maxTags = 10,
  disabled = false
}) => {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredSuggestions = suggestions.filter(
    (suggestion) =>
      suggestion.name.toLowerCase().includes(inputValue.toLowerCase()) &&
      !tags.includes(suggestion.name)
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const value = e.target.value;
    setInputValue(value);
    setShowSuggestions(value.length > 0);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.nativeEvent.isComposing) {
      return;
    }
    if (e.key === 'Enter' || e.key === ' ' || e.key === ',') {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === 'Backspace' && inputValue === '' && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  };

  const addTag = (value: string): void => {
    const sanitized = sanitizeTagName(value);

    if (sanitized.length === 0) {
      return;
    }

    if (tags.includes(sanitized)) {
      setInputValue('');
      return;
    }

    if (tags.length >= maxTags) {
      return;
    }

    const newTags = [...tags, sanitized];
    onChange(newTags);
    setInputValue('');
    setShowSuggestions(false);
  };

  const removeTag = (index: number): void => {
    const newTags = tags.filter((_, i) => i !== index);
    onChange(newTags);
  };

  const selectSuggestion = (tagName: string): void => {
    addTag(tagName);
    inputRef.current?.focus();
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent): void => {
      if (inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="tag-input relative">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Tags (hashtags)
      </label>

      <div className="flex flex-wrap gap-2 p-2 border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-[#C9A86C] focus-within:border-[#C9A86C]">
        {tags.map((tag, index) => (
          <span
            key={index}
            className="inline-flex items-center gap-1 px-3 py-1 bg-[#F4ECDD] text-[#7E6332] rounded-full text-sm font-medium"
          >
            #{tag}
            <button
              type="button"
              onClick={() => removeTag(index)}
              disabled={disabled}
              className="hover:bg-[#E8DCC2] rounded-full p-1 transition-colors"
              aria-label={`Remove tag ${tag}`}
            >
              <svg
                className="w-3 h-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </span>
        ))}

        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleInputKeyDown}
          placeholder={tags.length === 0 ? placeholder : ''}
          disabled={disabled || tags.length >= maxTags}
          className="flex-1 min-w-[120px] outline-none bg-transparent text-sm"
          aria-label="Tag input"
        />
      </div>

      {showSuggestions && filteredSuggestions.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {filteredSuggestions.map((suggestion) => (
            <button
              key={suggestion.name}
              type="button"
              onClick={() => selectSuggestion(suggestion.name)}
              className="w-full px-4 py-2 text-left hover:bg-[#FAF4E9] transition-colors flex items-center justify-between"
            >
              <span className="text-sm font-medium text-gray-900">
                #{suggestion.name}
              </span>
              <span className="text-xs text-gray-500">
                {suggestion.highlightCount} highlights
              </span>
            </button>
          ))}
        </div>
      )}

      {tags.length >= maxTags && (
        <p className="mt-1 text-xs text-amber-600">
          Maximum {maxTags} tags reached
        </p>
      )}
    </div>
  );
};
