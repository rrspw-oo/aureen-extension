import React from 'react';

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}

export const SearchField: React.FC<SearchFieldProps> = ({ value, onChange, placeholder }) => (
  <label className="w-full h-[38px] flex-shrink-0 flex items-center gap-2 px-3 bg-white border border-[#E2D8C4] rounded-[9px] focus-within:border-[#C9A86C]">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7A7568" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4-4" />
    </svg>
    <input
      type="search"
      aria-label={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="flex-1 min-w-0 border-none outline-none bg-transparent text-[13px] text-[#1F1F2E]"
    />
  </label>
);
