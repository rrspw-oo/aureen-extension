/**
 * Shadow DOM Sidebar Implementation
 * Uses Constructable Stylesheets for CSS isolation
 * Better than iframe: proper HMR, no Context issues, full isolation
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import '@/i18n/config';
import { createRoot } from 'react-dom/client';
import { HighlightsView } from '@/sidebar/highlights/HighlightsView';
import { CapturesView } from '@/sidebar/captures/CapturesView';
import styles from '@/index.css?inline';
import { showFab, hideFab } from '@/page/fab-bridge';
import { exportImportService } from '@/lib/export-import';
import { storageService } from '@/lib/highlight-store';
import { imageCaptureStorage } from '@/lib/capture-store';
import { ExportHandbookDialog } from '@/sidebar/ExportHandbookDialog';
import type { LinkKind } from '@/sidebar/ui/LinkedItems';
import type { LanguageSetting } from '@/types/highlight';
import { confirmAction } from '@/lib/dialogs';

type TabType = 'highlights' | 'images';

let shadowHost: HTMLDivElement | null = null;
let shadowRoot: ShadowRoot | null = null;
let reactRoot: ReturnType<typeof createRoot> | null = null;
let highlightData: Record<string, unknown> = {};
// Set when SidebarApp is hosted outside the page Shadow DOM (the desktop app).
let externalTarget: EventTarget | null = null;

/**
 * Mount sidebar in Shadow DOM with Constructable Stylesheets
 */
export function mountSidebarWithShadow(data?: Record<string, unknown>): void {
  hideFab();

  if (data) {
    highlightData = data;
  }

  if (shadowHost) {
    hideFab();
    shadowHost.style.display = 'block';
    sendDataToSidebar();
    return;
  }

  // Another content-script instance (double injection) may already own a sidebar.
  const existingHost = document.getElementById('text-highlighter-sidebar-shadow');
  if (existingHost) {
    hideFab();
    (existingHost as HTMLElement).style.display = 'block';
    return;
  }

  // Create host element
  shadowHost = document.createElement('div');
  shadowHost.id = 'text-highlighter-sidebar-shadow';

  // Reset all styles on host to prevent inheritance
  shadowHost.style.cssText = `
    all: initial;
    position: fixed;
    top: 0;
    right: 0;
    width: 400px;
    height: 100%;
    z-index: 2147483647;
    pointer-events: auto;
  `;

  document.documentElement.appendChild(shadowHost);

  // Create Shadow DOM
  shadowRoot = shadowHost.attachShadow({
    mode: 'open',
    delegatesFocus: true // Better focus handling
  });

  // Inject CSS using style element
  // Note: Using <style> instead of Constructable Stylesheets to avoid
  // issues with @tailwind/@import directives in Shadow DOM
  const styleEl = document.createElement('style');
  styleEl.textContent = styles;
  shadowRoot.appendChild(styleEl);

  // Create app container
  const appContainer = document.createElement('div');
  appContainer.id = 'sidebar-app';
  appContainer.style.cssText = `
    width: 100%;
    height: 100%;
    background: #FBFAF7;
    border-left: 1px solid #EBE3D3;
    box-shadow: -4px 0 24px rgba(31, 26, 12, 0.12);
    pointer-events: auto;
  `;
  shadowRoot.appendChild(appContainer);

  // Mount React app
  reactRoot = createRoot(appContainer);
  reactRoot.render(<SidebarApp />);

  // Send initial data
  setTimeout(() => sendDataToSidebar(), 100);
}

export function isSidebarVisible(): boolean {
  return !!shadowHost && shadowHost.style.display !== 'none';
}

/**
 * Hide sidebar
 */
export function hideSidebarShadow(minimize = false): void {
  if (shadowHost) {
    shadowHost.style.display = 'none';
  }
  if (minimize) {
    showFab();
  } else {
    hideFab();
  }
}

/**
 * Toggle sidebar visibility
 */
export function toggleSidebarShadow(opts?: { open?: boolean; source?: 'manual' | 'highlight' }): void {
  const { open = true, source = 'manual' } = opts || {};

  if (open) {
    mountSidebarWithShadow();
    // source === 'highlight' 時不要搶焦點，避免清除選取
    if (source === 'highlight' && shadowRoot) {
      // 不自動 focus 到搜尋框或任何輸入
    }
  } else {
    hideSidebarShadow();
  }
}

/**
 * Reset capture data — call this when the user navigates away from a pending capture
 * so stale imageData does NOT bleed into future NEW-tab visits.
 */
export function resetCaptureData(): void {
  highlightData = {};
  const target = shadowRoot ?? externalTarget;
  if (!target) return;
  const event = new CustomEvent('sidebar-data', { detail: {} });
  target.dispatchEvent(event);
}

/**
 * Send data to sidebar (simulates message passing)
 */
function sendDataToSidebar(): void {
  if (!shadowRoot) return;

  // Dispatch custom event inside Shadow DOM
  const event = new CustomEvent('sidebar-data', {
    detail: highlightData
  });
  shadowRoot.dispatchEvent(event);
}

const MenuAction: React.FC<{ label: string; onClick: () => void; danger?: boolean }> = ({ label, onClick, danger }) => (
  <button
    type="button"
    role="menuitem"
    onClick={onClick}
    className={`block w-full px-3.5 py-2 text-left text-[13px] hover:bg-[#F6EFE2] ${danger ? 'text-[#B5533F]' : 'text-[#1F1F2E]'}`}
  >
    {label}
  </button>
);

const IconButton: React.FC<{ label: string; onClick: () => void; children: React.ReactNode; expanded?: boolean }> = ({ label, onClick, children, expanded }) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    aria-expanded={expanded}
    onClick={onClick}
    className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#F4F1EA]"
  >
    {children}
  </button>
);

const LANGUAGE_OPTIONS: { value: LanguageSetting; label: string }[] = [
  { value: 'auto', label: 'shell.languageAuto' },
  { value: 'en', label: 'English' },
  { value: 'zh-TW', label: '繁體中文' }
];

interface SidebarAppProps {
  // Where 'sidebar-data' / 'sidebar-action' events arrive; defaults to the page's Shadow DOM.
  eventTarget?: EventTarget;
  // Replaces the default "hide sidebar, show floating button" close behaviour.
  onClose?: () => void;
  // Extra row rendered under the header (the desktop app's capture actions).
  toolbar?: React.ReactNode;
  // Shown next to the "Aureen" title (e.g. a paused badge).
  titleBadge?: React.ReactNode;
  // App-level items appended to the "more" menu (e.g. pause / quit).
  moreMenuItems?: { label: string; onClick: () => void; danger?: boolean }[];
  // Render the close button as a bare ✕ icon.
  closeIconOnly?: boolean;
}

export const SidebarApp: React.FC<SidebarAppProps> = ({ eventTarget, onClose, toolbar, titleBadge, moreMenuItems, closeIconOnly }) => {
  const { t } = useTranslation();
  const [language, setLanguage] = useState<LanguageSetting>('auto');
  const [data, setData] = useState<Record<string, unknown>>({});
  const [activeTab, setActiveTab] = useState<TabType>('highlights');
  const [focusTarget, setFocusTarget] = useState<{ kind: LinkKind; id: string } | null>(null);
  const [counts, setCounts] = useState({ highlights: 0, captures: 0 });
  const [openMenu, setOpenMenu] = useState<'export' | 'more' | null>(null);
  const [handbookOpen, setHandbookOpen] = useState(false);

  const handleNavigate = (kind: LinkKind, id: string): void => {
    setActiveTab(kind === 'highlight' ? 'highlights' : 'images');
    setFocusTarget({ kind, id });
  };

  useEffect(() => {
    storageService.getSettings().then((settings) => setLanguage(settings.language ?? 'auto'));
  }, []);

  const chooseLanguage = (value: LanguageSetting): void => {
    setLanguage(value);
    storageService.saveSettings({ language: value });
  };

  useEffect(() => {
    const loadCounts = async (): Promise<void> => {
      const [highlights, captures] = await Promise.all([
        storageService.getAllHighlights(),
        imageCaptureStorage.getAllCaptures()
      ]);
      setCounts({ highlights: Object.keys(highlights).length, captures: captures.length });
    };
    loadCounts();
    chrome.storage.onChanged.addListener(loadCounts);
    return () => chrome.storage.onChanged.removeListener(loadCounts);
  }, []);

  const close = (): void => (onClose ? onClose() : hideSidebarShadow(true));

  useEffect(() => {
    const target: EventTarget | null = eventTarget ?? shadowRoot;
    if (eventTarget) externalTarget = eventTarget;
    const handleData = (event: Event): void => {
      const customEvent = event as CustomEvent;
      const eventData = customEvent.detail || {};
      setData(eventData);

      if (eventData.tab) {
        setActiveTab(eventData.tab as TabType);
      } else if (eventData.mode === 'capture') {
        setActiveTab('images');
      } else if (eventData.mode === 'highlight') {
        setActiveTab('highlights');
      }
    };

    target?.addEventListener('sidebar-data', handleData);

    const handleClose = (event: Event): void => {
      if ((event as CustomEvent).detail?.type === 'CLOSE_SIDEBAR') {
        close();
      }
    };

    target?.addEventListener('sidebar-action', handleClose);

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || event.isComposing) return;
      const origin = event.composedPath()[0] as HTMLElement | undefined;
      if (origin && (origin.tagName === 'INPUT' || origin.tagName === 'TEXTAREA' || origin.isContentEditable)) return;
      if ((shadowRoot ?? document).querySelector('[data-aureen-modal]')) return;
      close();
    };

    const keyTarget: EventTarget = shadowRoot && !eventTarget ? shadowRoot : window;
    keyTarget.addEventListener('keydown', handleKeyDown as EventListener);

    return () => {
      target?.removeEventListener('sidebar-data', handleData);
      target?.removeEventListener('sidebar-action', handleClose);
      keyTarget.removeEventListener('keydown', handleKeyDown as EventListener);
    };
  }, []);

  const runMenu = (action: () => void): void => {
    setOpenMenu(null);
    action();
  };

  const handleClearAll = async (): Promise<void> => {
    const confirmed = await confirmAction(t('shell.confirmDeleteAll'), { danger: true });
    if (!confirmed) return;
    const confirmed2 = await confirmAction(t('shell.confirmDeleteAll2'), { danger: true });
    if (!confirmed2) return;
    await storageService.clearHighlights();
  };

  const tabClass = (tab: TabType): string =>
    `h-[34px] rounded-[7px] text-[13px] ${
      activeTab === tab ? 'bg-white shadow-[0_1px_2px_rgba(31,26,12,0.08)] font-semibold text-[#1F1F2E]' : 'font-medium text-[#5E5A4E] hover:text-[#1F1F2E]'
    }`;

  return (
    <div className="relative flex flex-col h-full bg-[#FBFAF7] text-[#1F1F2E]">
      <header className="relative h-[52px] flex-shrink-0 pl-4 pr-3 flex items-center justify-between bg-white border-b border-[#ECE4D4]">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#C9A86C]" />
          <span className="text-base font-semibold tracking-[0.02em]">Aureen</span>
          {titleBadge}
        </div>
        <div className="flex items-center gap-1">
          <IconButton label={t('shell.export')} expanded={openMenu === 'export'} onClick={() => setOpenMenu(openMenu === 'export' ? null : 'export')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5E5A4E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M4 19h16" /></svg>
          </IconButton>
          <IconButton label={t('shell.more')} expanded={openMenu === 'more'} onClick={() => setOpenMenu(openMenu === 'more' ? null : 'more')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#5E5A4E"><circle cx="5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="19" cy="12" r="1.7" /></svg>
          </IconButton>
          {closeIconOnly ? (
            <IconButton label={t('common.close')} onClick={close}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5E5A4E" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </IconButton>
          ) : (
          <button
            type="button"
            title={t('shell.closeTitle')}
            onClick={close}
            className="h-8 px-2.5 flex items-center gap-1.5 border border-[#E2D8C4] rounded-lg bg-white text-xs font-medium text-[#5E5A4E] hover:bg-[#F4F1EA]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5E5A4E" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            {t('common.close')}
          </button>
          )}
        </div>

        {openMenu && (
          <div
            role="menu"
            className="absolute top-12 right-3 z-[100] min-w-[220px] py-1 bg-white border border-[#ECE4D4] rounded-lg shadow-[0_4px_16px_rgba(0,0,0,0.12)]"
            onMouseLeave={() => setOpenMenu(null)}
          >
            {openMenu === 'export' ? (
              <>
                <MenuAction
                  label={activeTab === 'images' ? t('shell.handbookCaptures') : t('shell.handbookHighlights')}
                  onClick={() => runMenu(() => setHandbookOpen(true))}
                />
                <div className="h-px bg-[#ECE4D4] my-1" />
                <MenuAction label={t('shell.highlightsJson')} onClick={() => runMenu(async () => exportImportService.downloadAsJson(await exportImportService.exportAll()))} />
                <MenuAction label={t('shell.highlightsMdPage')} onClick={() => runMenu(() => exportImportService.downloadAsMarkdown({ groupBy: 'url' }))} />
                <MenuAction label={t('shell.highlightsMdTag')} onClick={() => runMenu(() => exportImportService.downloadAsMarkdown({ groupBy: 'tag' }))} />
              </>
            ) : (
              <>
                <div className="px-3.5 pt-1.5 pb-1 text-[11px] font-semibold text-[#6B6878]">{t('shell.language')}</div>
                {LANGUAGE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="menuitemradio"
                    aria-checked={language === option.value}
                    onClick={() => runMenu(() => chooseLanguage(option.value))}
                    className="flex items-center justify-between w-full px-3.5 py-2 text-left text-[13px] text-[#1F1F2E] hover:bg-[#F6EFE2]"
                  >
                    {option.value === 'auto' ? t(option.label) : option.label}
                    {language === option.value && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A9863F" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-10" /></svg>
                    )}
                  </button>
                ))}
                <div className="h-px bg-[#ECE4D4] my-1" />
                {/* App controls first, destructive actions last. */}
                {moreMenuItems?.filter((item) => !item.danger).map((item) => (
                  <MenuAction key={item.label} label={item.label} onClick={() => runMenu(item.onClick)} />
                ))}
                {moreMenuItems?.some((item) => !item.danger) && <div className="h-px bg-[#ECE4D4] my-1" />}
                <MenuAction label={t('shell.deleteAll')} onClick={() => runMenu(handleClearAll)} danger />
                {moreMenuItems?.filter((item) => item.danger).map((item) => (
                  <MenuAction key={item.label} label={item.label} onClick={() => runMenu(item.onClick)} danger />
                ))}
              </>
            )}
          </div>
        )}
      </header>

      {toolbar}

      <div className="px-4 pt-3 flex-shrink-0">
        <div role="tablist" className="grid grid-cols-2 gap-1 p-1 bg-[#F1EBDF] rounded-[10px]">
          <button type="button" role="tab" aria-selected={activeTab === 'highlights'} onClick={() => setActiveTab('highlights')} className={tabClass('highlights')}>
            {t('shell.highlights')} <span className={activeTab === 'highlights' ? 'text-[#7E5F25]' : ''}>{counts.highlights}</span>
          </button>
          <button type="button" role="tab" aria-selected={activeTab === 'images'} onClick={() => setActiveTab('images')} className={tabClass('images')}>
            {t('shell.captures')} <span className={activeTab === 'images' ? 'text-[#7E5F25]' : ''}>{counts.captures}</span>
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        {activeTab === 'highlights' ? (
          <HighlightsView
            initialData={data}
            focusHighlightId={focusTarget?.kind === 'highlight' ? focusTarget.id : null}
            onNavigate={handleNavigate}
            onFocusHandled={() => setFocusTarget(null)}
          />
        ) : (
          <CapturesView
            initialData={data}
            focusCaptureId={focusTarget?.kind === 'capture' ? focusTarget.id : null}
            onNavigate={handleNavigate}
            onFocusHandled={() => setFocusTarget(null)}
          />
        )}
      </div>

      {handbookOpen && (
        <ExportHandbookDialog
          kind={activeTab === 'images' ? 'capture' : 'highlight'}
          onClose={() => setHandbookOpen(false)}
        />
      )}
    </div>
  );
};
