/**
 * ColorPicker Component
 * Allows users to select highlight colors from predefined palette
 */

import React from 'react';
import type { HighlightColor } from '@/types';

interface ColorPickerProps {
  selectedColor: HighlightColor;
  onChange: (color: HighlightColor) => void;
  disabled?: boolean;
}

const COLORS: Array<{ name: HighlightColor; bg: string; label: string }> = [
  { name: 'yellow', bg: 'bg-highlight-yellow', label: 'Soft Yellow' },
  { name: 'mint', bg: 'bg-highlight-mint', label: 'Mint Green' },
  { name: 'coral', bg: 'bg-highlight-coral', label: 'Coral' },
  { name: 'peach', bg: 'bg-highlight-peach', label: 'Peach' },
  { name: 'lavender', bg: 'bg-highlight-lavender', label: 'Lavender' },
  { name: 'sky', bg: 'bg-highlight-sky', label: 'Sky Blue' }
];

export const ColorPicker: React.FC<ColorPickerProps> = ({
  selectedColor,
  onChange,
  disabled = false
}) => {
  return (
    <div className="color-picker">
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Highlight Color
      </label>
      <div className="flex flex-wrap gap-2">
        {COLORS.map((color) => (
          <button
            key={color.name}
            type="button"
            onClick={() => onChange(color.name)}
            disabled={disabled}
            className={`
              w-10 h-10 rounded-lg border-2 transition-all
              ${color.bg}
              ${
                selectedColor === color.name
                  ? 'border-[#A9863F] ring-2 ring-[#E8DCC2]'
                  : 'border-gray-300 hover:border-[#D8BC85]'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-110'}
            `}
            title={color.label}
            aria-label={`Select ${color.label}`}
          />
        ))}
      </div>
    </div>
  );
};
