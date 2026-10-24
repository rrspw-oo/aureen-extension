import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

interface BarState {
  phase: 'choose' | 'running';
  count: number;
}

/**
 * The bar shown during a full-page capture — the extension's "Capture to here / Whole page /
 * Cancel" bar. While choosing, the user scrolls the window to where the capture should end.
 */
export function FullPageBar() {
  const { t } = useTranslation();
  const [state, setState] = useState<BarState>({ phase: 'choose', count: 0 });

  useEffect(() => {
    const off = listen<BarState>('fullbar-state', (e) => setState(e.payload));
    return () => void off.then((fn) => fn());
  }, []);

  const choose = (choice: string): void => void invoke('full_page_choice', { choice });
  const button = 'h-8 px-3 rounded-lg border text-[13px] font-semibold whitespace-nowrap';

  return (
    <div className="h-screen w-screen flex items-center justify-center select-none">
      <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-white border border-[#EBE3D3] rounded-xl shadow-[0_6px_20px_rgba(31,26,12,0.18)] text-[13px] text-[#1F1F2E]">
        {state.phase === 'choose' ? (
          <>
            <span className="max-w-[290px] leading-snug">{t('fullPage.instruction')}</span>
            <button type="button" onClick={() => choose('here')} className={`${button} bg-[#C9A86C] border-[#C9A86C] text-[#2C2417]`}>
              {t('fullPage.here')}
            </button>
            <button type="button" onClick={() => choose('whole')} className={`${button} bg-[#FBF5EA] border-[#E2D6BE] text-[#7E6332]`}>
              {t('fullPage.whole')}
            </button>
          </>
        ) : (
          <>
            <span className="w-2 h-2 rounded-full bg-[#C9A86C] animate-pulse" />
            <span className="whitespace-nowrap">{t('fullPage.capturing', { count: state.count })}</span>
            <button type="button" onClick={() => choose('stop')} className={`${button} bg-[#C9A86C] border-[#C9A86C] text-[#2C2417]`}>
              {t('fullPage.stop')}
            </button>
          </>
        )}
        <span className="text-[10px] text-[#B0A894] whitespace-nowrap" title="Aureen build">
          {__AUREEN_BUILD__}
        </span>
        <button type="button" onClick={() => choose('cancel')} className={`${button} bg-[#FBF5EA] border-[#E2D6BE] text-[#7E6332]`}>
          {t('fullPage.cancel')}
        </button>
      </div>
    </div>
  );
}
