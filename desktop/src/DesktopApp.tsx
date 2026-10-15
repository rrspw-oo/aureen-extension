import { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { SidebarApp } from '@/sidebar/shell';

interface HighlightPayload {
  text: string;
  url: string;
  pageTitle: string;
}

const ACTIONS = [
  { command: 'start_selection', label: '儲存選取文字', keys: '⌘⇧1' },
  { command: 'start_capture', label: '截取區域', keys: '⌘⇧2' },
  { command: 'start_full_page', label: '整頁截圖', keys: '⌘⇧9' }
] as const;

/**
 * The menu bar panel: the extension's own sidebar (highlights, captures, export, settings),
 * fed by the native shortcuts instead of a web page.
 */
export function DesktopApp() {
  const bus = useMemo(() => new EventTarget(), []);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const send = (detail: Record<string, unknown>): void => {
      setError(null);
      bus.dispatchEvent(new CustomEvent('sidebar-data', { detail }));
    };
    const capture = (imageData: string, fullPage: boolean): void =>
      send({ mode: 'capture', imageData, fullPage, url: 'aureen://screenshot', timestamp: Date.now(), captureId: `capture_${Date.now()}` });

    const subscriptions = [
      listen<string>('capture-ready', (e) => capture(e.payload, false)),
      listen<string>('fullpage-ready', (e) => capture(e.payload, true)),
      listen<HighlightPayload>('highlight-ready', (e) =>
        send({ mode: 'highlight', text: e.payload.text, url: e.payload.url, pageTitle: e.payload.pageTitle })
      ),
      listen<string>('capture-error', (e) => setError(e.payload))
    ];
    return () => subscriptions.forEach((p) => void p.then((off) => off()));
  }, [bus]);

  useEffect(() => {
    // The shared captures view asks its host page to start a region capture.
    const onMessage = (event: MessageEvent): void => {
      if (event.data?.type === 'AUREEN_START_SCREENSHOT') void invoke('start_capture');
    };
    // Web links (sources, linked pages) open in the default browser.
    const onClick = (event: MouseEvent): void => {
      const link = (event.target as HTMLElement | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (link && /^https?:/.test(link.href) && !link.href.startsWith(window.location.origin)) {
        event.preventDefault();
        void invoke('open_url', { url: link.href });
      }
    };
    window.addEventListener('message', onMessage);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('message', onMessage);
      document.removeEventListener('click', onClick, true);
    };
  }, []);

  const toolbar = (
    <div className="px-4 pt-3 flex-shrink-0">
      <div className="grid grid-cols-3 gap-1.5">
        {ACTIONS.map((action) => (
          <button
            key={action.command}
            type="button"
            onClick={() => void invoke(action.command)}
            className="h-12 rounded-lg border border-[#E2D8C4] bg-white hover:bg-[#FBF5EA] flex flex-col items-center justify-center leading-tight"
          >
            <span className="text-[12px] font-semibold text-[#5E4A22]">{action.label}</span>
            <span className="text-[10px] text-[#9A8F78]">{action.keys}</span>
          </button>
        ))}
      </div>
      {error && (
        <p className="mt-2 rounded-lg bg-[#FBEDE8] px-3 py-2 text-xs text-[#9A3A24]" role="alert">
          {error}
        </p>
      )}
    </div>
  );

  return (
    <div className="h-screen">
      <SidebarApp eventTarget={bus} onClose={() => void invoke('hide_panel')} toolbar={toolbar} />
    </div>
  );
}
