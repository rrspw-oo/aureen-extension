import { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { SidebarApp } from '@/sidebar/shell';

interface HighlightPayload {
  text: string;
  url: string;
  pageTitle: string;
  color?: string | null;
  focusNote?: boolean;
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
  const [paused, setPaused] = useState(false);

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
        send({
          mode: 'highlight',
          text: e.payload.text,
          url: e.payload.url,
          pageTitle: e.payload.pageTitle,
          ...(e.payload.color ? { color: e.payload.color } : {}),
          focusNote: Boolean(e.payload.focusNote)
        })
      ),
      listen<boolean>('paused-changed', (e) => setPaused(e.payload)),
      listen<string>('capture-error', (e) => setError(e.payload))
    ];
    void invoke<boolean>('is_paused').then(setPaused);
    return () => subscriptions.forEach((p) => void p.then((off) => off()));
  }, [bus]);

  useEffect(() => {
    // Drag the panel by its header; once moved it stays put (see pin_panel in Rust).
    const onMouseDown = (event: MouseEvent): void => {
      const target = event.target as HTMLElement | null;
      if (event.button !== 0 || !target?.closest('header')) return;
      if (target.closest('button, a, input, select, textarea, [role="menu"]')) return;
      event.preventDefault();
      void getCurrentWindow().startDragging().then(() => invoke('pin_panel'));
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

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

  const quit = (): void => {
    if (confirm('要結束 Aureen 嗎?選單列圖示會消失,快捷鍵也會停止。')) void invoke('quit_app');
  };

  const toolbar = (
    <div className="px-4 pt-3 flex-shrink-0">
      <div className={`grid grid-cols-3 gap-1.5 ${paused ? 'opacity-60' : ''}`}>
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

  // Paused: shortcuts and the selection toolbar are off; the badge resumes in one click.
  const titleBadge = paused ? (
    <button
      type="button"
      onClick={() => void invoke('set_paused', { paused: false })}
      title="點一下重新啟用快捷鍵與選字工具列"
      className="ml-1 h-[22px] px-2 rounded-full bg-[#EFEAE0] text-[11px] font-semibold text-[#7A7263] hover:bg-[#E6DFD1]"
    >
      已暫停
    </button>
  ) : null;

  const moreMenuItems = [
    paused
      ? { label: '啟用 Aureen', onClick: () => void invoke('set_paused', { paused: false }) }
      : { label: '暫停 Aureen(停用快捷鍵與選字工具列)', onClick: () => void invoke('set_paused', { paused: true }) },
    { label: '面板回到圖示下方', onClick: () => void invoke('dock_panel') },
    { label: '結束 Aureen', onClick: quit, danger: true }
  ];

  return (
    <div className="h-screen">
      <SidebarApp
        eventTarget={bus}
        onClose={() => void invoke('hide_panel')}
        toolbar={toolbar}
        titleBadge={titleBadge}
        moreMenuItems={moreMenuItems}
        closeIconOnly
      />
    </div>
  );
}
