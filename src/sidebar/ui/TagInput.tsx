/**
 * TagInput Component
 * Input field for adding tags with autocomplete suggestions
 */

import React, { useEffect, useState, useRef } from 'react';
import { sanitizeTagName } from '@/lib/security';

const SEPARATORS = /[,，、;；]/;

export function withPendingTag(tags: string[], pending: string): string[] {
  const sanitized = sanitizeTagName(pending);
  return sanitized && !tags.includes(sanitized) ? [...tags, sanitized] : tags;
}

interface TagInputProps {
  tags: string[];
  suggestions?: { name: string }[];
  onChange: (tags: string[]) => void;
  onSubmit?: (tags: string[]) => void;
  onPendingChange?: (text: string) => void;
  label?: string | null;
  hint?: string;
  placeholder?: string;
  maxTags?: number;
  disabled?: boolean;
}

export const TagInput: React.FC<TagInputProps> = ({
  tags,
  suggestions = [],
  onChange,
  onSubmit,
  onPendingChange,
  label = 'Tags (hashtags)',
  hint,
  placeholder = 'Add tags (space or comma separated)',
  maxTags = 10,
  disabled = false
}) => {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    onPendingChange?.(inputValue);
  }, [inputValue]);

  const filteredSuggestions = suggestions
    .filter(
      (suggestion) =>
        suggestion.name.toLowerCase().includes(inputValue.trim().toLowerCase()) &&
        !tags.includes(suggestion.name)
    )
    .slice(0, 20);

  const commitTags = (values: string[]): string[] => {
    const next = [...tags];
    for (const value of values) {
      const sanitized = sanitizeTagName(value);
      if (sanitized && !next.includes(sanitized) && next.length < maxTags) {
        next.push(sanitized);
      }
    }
    if (next.length !== tags.length) {
      onChange(next);
    }
    return next;
  };

  const commitPending = (): string[] => {
    const next = inputValue.trim() ? commitTags([inputValue]) : tags;
    setInputValue('');
    return next;
  };

  const absorbValue = (value: string): void => {
    if (!SEPARATORS.test(value)) {
      setInputValue(value);
      return;
    }
    const parts = value.split(SEPARATORS);
    const rest = parts.pop() ?? '';
    commitTags(parts);
    setInputValue(rest);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    if ((e.nativeEvent as InputEvent).isComposing) {
      setInputValue(e.target.value);
    } else {
      absorbValue(e.target.value);
    }
    setShowSuggestions(true);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.nativeEvent.isComposing || e.keyCode === 229) {
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const next = commitPending();
      if ((e.metaKey || e.ctrlKey) && onSubmit) {
        e.stopPropagation();
        onSubmit(next);
      }
    } else if (e.key === ' ' && inputValue.trim()) {
      e.preventDefault();
      commitPending();
    } else if (e.key === 'Backspace' && inputValue === '' && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  };

  const removeTag = (index: number): void => {
    const newTags = tags.filter((_, i) => i !== index);
    onChange(newTags);
  };

  const selectSuggestion = (tagName: string): void => {
    commitTags([tagName]);
    setInputValue('');
    inputRef.current?.focus();
  };

  return (
    <div className="tag-input relative">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {label}
        </label>
      )}

      <div className="flex flex-wrap gap-2 p-2 bg-white border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-[#C9A86C] focus-within:border-[#C9A86C]">
        {tags.map((tag, index) => (
          <span
            key={tag}
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
          onCompositionEnd={(e) => absorbValue(e.currentTarget.value)}
          onKeyDown={handleInputKeyDown}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setShowSuggestions(false)}
          placeholder={tags.length === 0 ? placeholder : ''}
          disabled={disabled || tags.length >= maxTags}
          className="flex-1 min-w-[120px] outline-none bg-transparent text-sm"
          aria-label="Tag input"
        />
      </div>

      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}

      {showSuggestions && filteredSuggestions.length > 0 && (
        <div className="mt-1 p-2 bg-white border border-gray-300 rounded-lg shadow-lg max-h-32 overflow-y-auto">
          <p className="text-xs text-gray-400 mb-1">Quick select:</p>
          <div className="flex flex-wrap gap-1">
            {filteredSuggestions.map((suggestion) => (
              <button
                key={suggestion.name}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectSuggestion(suggestion.name)}
                className="px-2 py-0.5 text-xs rounded bg-[#F4ECDD] text-[#7E6332] hover:bg-[#E8DCC2] transition-colors"
              >
                {suggestion.name}
              </button>
            ))}
          </div>
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
