import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

interface SheetProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  footer: React.ReactNode;
  children: React.ReactNode;
}

export const Sheet: React.FC<SheetProps> = ({ title, subtitle, onClose, footer, children }) => {
  const { t } = useTranslation();
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !e.isComposing) onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div data-aureen-modal className="absolute inset-0 z-[1000]">
      <div className="absolute inset-0 bg-[rgba(31,31,46,0.38)]" onClick={onClose} />
      <section
        role="dialog"
        aria-label={title}
        className="absolute left-0 right-0 bottom-0 top-[84px] flex flex-col bg-white rounded-t-2xl shadow-[0_-8px_30px_rgba(31,26,12,0.18)]"
      >
        <div className="flex justify-center pt-2">
          <span className="w-9 h-1 rounded-full bg-[#DCD3C2]" />
        </div>
        <div className="flex items-center justify-between px-5 pt-2.5">
          <div className="min-w-0">
            <h2 className="m-0 text-[17px] font-semibold text-[#1F1F2E]">{title}</h2>
            {subtitle && <div className="mt-0.5 text-xs text-[#6B6878] truncate">{subtitle}</div>}
          </div>
          <button
            type="button"
            aria-label={t('common.discard')}
            title={t('common.discardTitle')}
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#F4F1EA] hover:bg-[#ECE6DA]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5E5A4E" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        {/* Sections keep their natural height and the body scrolls; nothing gets squeezed. */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 pt-3.5 pb-4 flex flex-col gap-4 [&>*]:flex-none [&>.contents>*]:flex-none">{children}</div>
        <div className="px-5 pt-3 pb-4 border-t border-[#ECE4D4] flex items-center gap-2.5">{footer}</div>
      </section>
    </div>
  );
};

export const SaveHint: React.FC = () => {
  const { t } = useTranslation();
  return (
  <span className="flex items-center gap-1 text-xs text-[#6B6878]">
    <kbd className="px-1.5 py-px border border-[#DCD3C2] border-b-2 rounded text-[11px] font-medium text-[#5E5A4E]">Cmd</kbd>
    <kbd className="px-1.5 py-px border border-[#DCD3C2] border-b-2 rounded text-[11px] font-medium text-[#5E5A4E]">Enter</kbd>
    {t('common.toSave')}
  </span>
  );
};

export const FieldLabel: React.FC<{ htmlFor?: string; label: string; hint: string }> = ({ htmlFor, label, hint }) => (
  <label htmlFor={htmlFor} className="flex items-baseline justify-between text-[13px] font-semibold text-[#1F1F2E]">
    {label}
    <span className="text-[11px] font-normal text-[#6B6878]">{hint}</span>
  </label>
);
