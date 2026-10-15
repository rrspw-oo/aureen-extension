import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { storageService } from '@/lib/highlight-store';
import { TOOLBAR_COLORS } from '@/page/toolbar-colors';
import type { HighlightColor } from '@/types/highlight';

/**
 * The floating toolbar shown next to a text selection in any app — the desktop twin of the
 * extension's selection toolbar (same buttons, same default-color behaviour).
 */
export function SelectionToolbar() {
  const { t } = useTranslation();
  const [defaultColor, setDefaultColor] = useState<HighlightColor>('yellow');

  useEffect(() => {
    const load = (): void => {
      void storageService.getSettings().then((s) => setDefaultColor(s.defaultColor ?? 'yellow'));
    };
    load();
    const off = listen('toolbar-show', load);
    return () => void off.then((fn) => fn());
  }, []);

  const pick = (color: HighlightColor, focusNote: boolean): void => {
    void invoke('toolbar_pick', { color, focusNote });
  };

  const swatch = TOOLBAR_COLORS.find((c) => c.color === defaultColor)?.swatch ?? TOOLBAR_COLORS[0].swatch;
  const divider = <span className="w-px h-[22px] bg-[#E2D8C4] mx-1" />;

  return (
    <div className="h-screen w-screen flex items-center justify-center select-none">
      <div
        role="toolbar"
        aria-label={t('toolbar.aria')}
        className="flex items-center gap-1 p-[5px] bg-white border border-[#E2D8C4] rounded-xl shadow-[0_6px_18px_rgba(31,26,12,0.18)] text-[13px] font-semibold"
      >
        <button
          type="button"
          title={t('toolbar.highlightTitle')}
          onClick={() => pick(defaultColor, false)}
          className="h-9 px-3 flex items-center gap-2 rounded-lg bg-[#C9A86C] text-[#2C2417]"
        >
          <span className="w-3 h-3 rounded-full shadow-[0_0_0_1px_rgba(44,36,23,0.35)]" style={{ background: swatch }} />
          {t('toolbar.highlight')}
        </button>
        {divider}
        {TOOLBAR_COLORS.map((item) => (
          <button
            key={item.color}
            type="button"
            title={t('toolbar.colorLabel', { color: t(item.label) })}
            aria-label={t('toolbar.colorLabel', { color: t(item.label) })}
            onClick={() => {
              setDefaultColor(item.color);
              void storageService.saveSettings({ defaultColor: item.color });
              pick(item.color, false);
            }}
            className="w-[22px] h-[22px] mx-0.5 rounded-full shadow-[inset_0_0_0_1px_rgba(44,36,23,0.12)]"
            style={{ background: item.swatch, border: item.color === defaultColor ? '2px solid #A9863F' : '2px solid transparent' }}
          />
        ))}
        {divider}
        <button
          type="button"
          title={t('toolbar.note')}
          aria-label={t('toolbar.note')}
          onClick={() => pick(defaultColor, true)}
          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#FBF5EA]"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#6E5428" strokeWidth="1.8" strokeLinejoin="round">
            <path d="M4 5h16v11H9l-5 4z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
