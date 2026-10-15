import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { CapturesView } from '@/sidebar/captures/CapturesView';
import { ExportHandbookDialog } from '@/sidebar/ExportHandbookDialog';
import { storageService } from '@/lib/highlight-store';
import type { LanguageSetting } from '@/types/highlight';

const LANGUAGES: { value: LanguageSetting; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'en', label: 'English' },
  { value: 'zh-TW', label: '繁體中文' }
];

export function DesktopApp() {
  const { t } = useTranslation();
  const [data, setData] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [language, setLanguage] = useState<LanguageSetting>('auto');

  useEffect(() => {
    void storageService.getSettings().then((s) => setLanguage(s.language ?? 'auto'));
  }, []);

  const handleCapture = useCallback((imageData: string) => {
    setError(null);
    setData({ mode: 'capture', imageData, url: 'aureen://screenshot', timestamp: Date.now(), captureId: `capture_${Date.now()}` });
  }, []);

  useEffect(() => {
    const ready = listen<string>('capture-ready', (e) => handleCapture(e.payload));
    const failed = listen<string>('capture-error', (e) => setError(e.payload));
    return () => {
      void ready.then((off) => off());
      void failed.then((off) => off());
    };
  }, [handleCapture]);

  return (
    <div className="flex flex-col h-screen bg-[#FBFAF7] text-[#1F1F2E]">
      <header className="h-[52px] flex-shrink-0 pl-4 pr-3 flex items-center justify-between bg-white border-b border-[#ECE4D4]">
        <span className="text-base font-semibold tracking-[0.02em]">Aureen</span>
        <div className="flex items-center gap-2">
          <select
            aria-label={t('shell.language')}
            value={language}
            onChange={(e) => {
              const value = e.target.value as LanguageSetting;
              setLanguage(value);
              void storageService.saveSettings({ language: value });
            }}
            className="h-8 rounded-lg border border-[#E2D8C4] bg-white px-2 text-xs text-[#5E5A4E]"
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setExportOpen(true)}
            className="h-8 px-3 rounded-lg border border-[#E2D8C4] bg-white text-xs font-medium text-[#5E5A4E] hover:bg-[#F4F1EA]"
          >
            {t('shell.export')}
          </button>
          <button
            type="button"
            onClick={() => void invoke('start_capture')}
            className="h-8 px-3 rounded-lg border border-[#D9B377] text-xs font-semibold text-[#4A3A1C] bg-gradient-to-b from-[#F6DFB2] to-[#D9B377]"
          >
            {t('common.capture', { defaultValue: '截圖' })} ⌘⇧2
          </button>
        </div>
      </header>

      {error && <p className="m-3 text-xs text-[#B3402A]">{error}</p>}

      <div className="flex-1 min-h-0">
        <CapturesView initialData={data} />
      </div>

      {exportOpen && <ExportHandbookDialog kind="capture" onClose={() => setExportOpen(false)} />}
    </div>
  );
}
