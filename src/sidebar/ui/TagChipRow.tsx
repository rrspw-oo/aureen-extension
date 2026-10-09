import React from 'react';
import { useTranslation } from 'react-i18next';

interface TagChipRowProps {
  tags: { name: string; count: number }[];
  total: number;
  selected: string[];
  onChange: (next: string[]) => void;
  trailing?: React.ReactNode;
}

export const TagChipRow: React.FC<TagChipRowProps> = ({ tags, total, selected, onChange, trailing }) => {
  const { t } = useTranslation();
  const toggle = (name: string): void => {
    onChange(selected.includes(name) ? selected.filter((t) => t !== name) : [...selected, name]);
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <button
        type="button"
        onClick={() => onChange([])}
        aria-pressed={selected.length === 0}
        className={`h-7 px-3 rounded-full text-xs font-semibold ${
          selected.length === 0 ? 'bg-[#1F1F2E] text-white' : 'bg-white border border-[#E2D8C4] text-[#5E5A4E]'
        }`}
      >
        {t('common.all')} {total}
      </button>
      {tags.map((tag) => {
        const active = selected.includes(tag.name);
        return (
          <button
            key={tag.name}
            type="button"
            onClick={() => toggle(tag.name)}
            aria-pressed={active}
            className={`h-7 px-3 rounded-full text-xs font-medium ${
              active ? 'bg-[#C9A86C] text-[#2C2417] font-semibold' : 'bg-white border border-[#E2D8C4] text-[#5E5A4E] hover:bg-[#FBF4E6]'
            }`}
          >
            {tag.name}
            <span className={active ? 'ml-1 text-[#5C4519]' : 'ml-1 text-[#9A958A]'}>{tag.count}</span>
          </button>
        );
      })}
      {trailing && <span className="ml-auto">{trailing}</span>}
    </div>
  );
};
