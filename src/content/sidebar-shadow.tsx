/**
 * Shadow DOM Sidebar Implementation
 * Uses Constructable Stylesheets for CSS isolation
 * Better than iframe: proper HMR, no Context issues, full isolation
 */

import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Sidebar } from '@/sidebar/Sidebar';
import { ImageCaptureTab } from '@/popup/components/ImageCaptureTab';
import styles from '@/index.css?inline';
import { showFab, hideFab } from './fab-bridge';
import { exportImportService } from '@/services/export-import';
import { storageService } from '@/services/storage';
import { ExportHandbookDialog } from '@/popup/components/ExportHandbookDialog';

type TabType = 'highlights' | 'images';

let shadowHost: HTMLDivElement | null = null;
let shadowRoot: ShadowRoot | null = null;
let reactRoot: ReturnType<typeof createRoot> | null = null;
let highlightData: Record<string, unknown> = {};

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
  if (!shadowRoot) return;
  const event = new CustomEvent('sidebar-data', { detail: {} });
  shadowRoot.dispatchEvent(event);
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

const HeaderIconButton: React.FC<{ title: string; onClick: () => void; children: React.ReactNode }> = ({ title, onClick, children }) => (
  <button
    title={title}
    onClick={onClick}
    style={{
      background: 'rgba(0,0,0,0.07)', border: 'none', cursor: 'pointer',
      width: '28px', height: '28px', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      borderRadius: '6px', transition: 'background 0.12s',
    }}
    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.13)')}
    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.07)')}
  >
    {children}
  </button>
);


const MenuAction: React.FC<{ label: string; onClick: () => void; danger?: boolean }> = ({ label, onClick, danger }) => (
  <button
    onClick={onClick}
    style={{
      display: 'block', width: '100%', padding: '8px 14px',
      textAlign: 'left', background: 'none', border: 'none',
      cursor: 'pointer', fontSize: '13px',
      color: danger ? '#C96A6A' : '#1F1F2E', fontFamily: 'inherit',
      transition: 'background 0.1s',
    }}
    onMouseEnter={e => (e.currentTarget.style.background = '#F6EFE2')}
    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
  >
    {label}
  </button>
);

const BottomTabBar: React.FC<{ activeTab: TabType; onTabChange: (tab: TabType) => void }> = ({ activeTab, onTabChange }) => {
  const GOLD = '#C9A86C';
  const MUTED = '#9492A8';

  return (
    <div style={{ display: 'flex', borderTop: '1px solid #EFE7D8', background: 'white', flexShrink: 0 }}>
      <button
        onClick={() => onTabChange('highlights')}
        style={{
          flex: 1, padding: '9px 0', display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: '3px', border: 'none', background: 'none',
          cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
          stroke={activeTab === 'highlights' ? GOLD : MUTED}
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
        </svg>
        <span style={{
          fontSize: '10px',
          color: activeTab === 'highlights' ? GOLD : MUTED,
          fontWeight: activeTab === 'highlights' ? 600 : 400,
        }}>
          Highlights
        </span>
      </button>

      <button
        onClick={() => onTabChange('images')}
        style={{
          flex: 1, padding: '9px 0', display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: '3px', border: 'none', background: 'none',
          cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
          stroke={activeTab === 'images' ? GOLD : MUTED}
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <rect x="2" y="6" width="20" height="14" rx="2"/>
          <circle cx="12" cy="13" r="3"/>
          <path d="M8 6l1.5-2.5h5L16 6"/>
        </svg>
        <span style={{
          fontSize: '10px',
          color: activeTab === 'images' ? GOLD : MUTED,
          fontWeight: activeTab === 'images' ? 600 : 400,
        }}>
          Captures
        </span>
      </button>
    </div>
  );
};

/**
 * Sidebar App Component (wraps the main Sidebar with Tab switching)
 */
const SidebarApp: React.FC = () => {
  const [data, setData] = useState<Record<string, unknown>>({});
  const [activeTab, setActiveTab] = useState<TabType>('highlights');

  useEffect(() => {
    const handleData = (event: Event): void => {
      const customEvent = event as CustomEvent;
      const eventData = customEvent.detail || {};
      setData(eventData);

      if (eventData.tab) {
        setActiveTab(eventData.tab as TabType);
      } else if (eventData.mode === 'capture') {
        setActiveTab('images');
      }
    };

    if (shadowRoot) {
      shadowRoot.addEventListener('sidebar-data', handleData);
    }

    const handleClose = (event: Event): void => {
      if ((event as CustomEvent).detail?.type === 'CLOSE_SIDEBAR') {
        hideSidebarShadow();
      }
    };

    if (shadowRoot) {
      shadowRoot.addEventListener('sidebar-action', handleClose);
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        hideSidebarShadow();
      }
    };

    if (shadowRoot) {
      shadowRoot.addEventListener('keydown', handleKeyDown as EventListener);
    }

    return () => {
      if (shadowRoot) {
        shadowRoot.removeEventListener('sidebar-data', handleData);
        shadowRoot.removeEventListener('sidebar-action', handleClose);
        shadowRoot.removeEventListener('keydown', handleKeyDown as EventListener);
      }
    };
  }, []);

  const [menuOpen, setMenuOpen] = useState(false);
  const [handbookOpen, setHandbookOpen] = useState(false);

  const handleExport = async (): Promise<void> => {
    const data = await exportImportService.exportAll();
    exportImportService.downloadAsJson(data);
  };

  const handleExportMarkdown = async (groupBy: 'url' | 'tag'): Promise<void> => {
    await exportImportService.downloadAsMarkdown({ groupBy });
  };

  const handleClearAll = async (): Promise<void> => {
    const confirmed = confirm('Delete ALL highlights? This cannot be undone.');
    if (!confirmed) return;
    const confirmed2 = confirm('Are you absolutely sure?');
    if (!confirmed2) return;
    await storageService.clearAllData();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      <div style={{
        padding: '0 12px', height: '48px', backgroundColor: '#F6EFE2',
        borderBottom: '1px solid #ECE2CF',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
        position: 'relative',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
          <span style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: '#C9A86C', display: 'inline-block' }} />
          <span style={{ fontSize: '16px', fontWeight: 600, color: '#1F1F2E', letterSpacing: '0.03em' }}>Aureen</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <HeaderIconButton title="Minimize" onClick={() => hideSidebarShadow(true)}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <line x1="3" y1="8" x2="13" y2="8" stroke="#9A8A6A" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </HeaderIconButton>

          <HeaderIconButton title="Close" onClick={() => hideSidebarShadow(false)}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4l8 8" stroke="#9A8A6A" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </HeaderIconButton>

          <HeaderIconButton title="Options" onClick={() => setMenuOpen(o => !o)}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="3" r="1.5" fill="#9A8A6A"/>
              <circle cx="8" cy="8" r="1.5" fill="#9A8A6A"/>
              <circle cx="8" cy="13" r="1.5" fill="#9A8A6A"/>
            </svg>
          </HeaderIconButton>
        </div>

        {menuOpen && (
          <div
            style={{
              position: 'absolute', top: '48px', right: '12px',
              background: 'white', border: '1px solid #EBE3D3',
              borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              minWidth: '160px', zIndex: 100, overflow: 'hidden',
            }}
            onMouseLeave={() => setMenuOpen(false)}
          >
            <MenuAction
              label={activeTab === 'images' ? 'Export Handbook PDF' : 'Export Highlights PDF'}
              onClick={() => { setMenuOpen(false); setHandbookOpen(true); }}
            />
            <div style={{ height: '1px', background: '#EBE3D3', margin: '4px 0' }} />
            <MenuAction label="Export JSON" onClick={() => { setMenuOpen(false); handleExport(); }} />
            <MenuAction label="Export by Page" onClick={() => { setMenuOpen(false); handleExportMarkdown('url'); }} />
            <MenuAction label="Export by Tag" onClick={() => { setMenuOpen(false); handleExportMarkdown('tag'); }} />
            <div style={{ height: '1px', background: '#EBE3D3', margin: '4px 0' }} />
            <MenuAction label="Clear All" onClick={() => { setMenuOpen(false); handleClearAll(); }} danger />
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflow: 'hidden', background: '#FBFAF7' }}>
        {activeTab === 'highlights' ? (
          <Sidebar initialData={data} />
        ) : (
          <ImageCaptureTab initialData={data} />
        )}
      </div>

      <BottomTabBar activeTab={activeTab} onTabChange={setActiveTab} />

      {handbookOpen && (
        <ExportHandbookDialog
          kind={activeTab === 'images' ? 'capture' : 'highlight'}
          onClose={() => setHandbookOpen(false)}
        />
      )}
    </div>
  );
};

/**
 * Cleanup function
 */
export function unmountSidebarShadow(): void {
  if (reactRoot) {
    reactRoot.unmount();
    reactRoot = null;
  }
  if (shadowHost) {
    shadowHost.remove();
    shadowHost = null;
  }
  shadowRoot = null;
}
