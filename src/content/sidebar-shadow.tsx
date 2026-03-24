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
    background: white;
    border-left: 1px solid #d1d5db;
    box-shadow: -4px 0 24px rgba(0, 0, 0, 0.2);
    overflow-y: auto;
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
      background: 'none', border: 'none', cursor: 'pointer',
      width: '32px', height: '32px', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      borderRadius: '6px', opacity: 0.85, transition: 'opacity 0.15s',
    }}
    onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
    onMouseLeave={e => (e.currentTarget.style.opacity = '0.85')}
  >
    {children}
  </button>
);

const TabButton: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode }> = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    style={{
      flex: 1, height: '36px', border: 'none', cursor: 'pointer',
      fontSize: '13px', fontWeight: 500, transition: 'all 0.15s',
      backgroundColor: active ? '#7C6EAF' : 'transparent',
      color: active ? 'white' : '#9492A8',
      fontFamily: 'inherit',
    }}
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
    onMouseEnter={e => (e.currentTarget.style.background = '#F5F4FA')}
    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
  >
    {label}
  </button>
);

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
        padding: '0 12px', height: '48px', backgroundColor: '#7C6EAF',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#C9A86C', display: 'inline-block' }} />
          <span style={{ fontSize: '16px', fontWeight: 600, color: 'white', letterSpacing: '0.01em' }}>Aureen</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', position: 'relative' }}>
          <HeaderIconButton title="Minimize" onClick={() => hideSidebarShadow(true)}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <line x1="3" y1="8" x2="13" y2="8" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </HeaderIconButton>

          <HeaderIconButton title="Options" onClick={() => setMenuOpen(o => !o)}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="3" r="1.5" fill="white"/>
              <circle cx="8" cy="8" r="1.5" fill="white"/>
              <circle cx="8" cy="13" r="1.5" fill="white"/>
            </svg>
          </HeaderIconButton>

          {menuOpen && (
            <div
              style={{
                position: 'absolute', top: '36px', right: 0,
                background: 'white', border: '1px solid #E2E0EE',
                borderRadius: '8px', boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                minWidth: '160px', zIndex: 10, overflow: 'hidden',
              }}
              onMouseLeave={() => setMenuOpen(false)}
            >
              <MenuAction label="Export JSON" onClick={() => { setMenuOpen(false); handleExport(); }} />
              <MenuAction label="Export by Page" onClick={() => { setMenuOpen(false); handleExportMarkdown('url'); }} />
              <MenuAction label="Export by Tag" onClick={() => { setMenuOpen(false); handleExportMarkdown('tag'); }} />
              <div style={{ height: '1px', background: '#E2E0EE', margin: '4px 0' }} />
              <MenuAction label="Clear All" onClick={() => { setMenuOpen(false); handleClearAll(); }} danger />
            </div>
          )}

          <HeaderIconButton title="Close" onClick={() => hideSidebarShadow(false)}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4l8 8" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </HeaderIconButton>
        </div>
      </div>

      <div style={{ display: 'flex', backgroundColor: '#F5F4FA', borderBottom: '1px solid #E2E0EE', flexShrink: 0 }}>
        <TabButton active={activeTab === 'highlights'} onClick={() => setActiveTab('highlights')}>Highlights</TabButton>
        <TabButton active={activeTab === 'images'} onClick={() => setActiveTab('images')}>Captures</TabButton>
      </div>

      <div style={{ flex: 1, overflow: 'hidden' }}>
        {activeTab === 'highlights' ? (
          <Sidebar initialData={data} />
        ) : (
          <ImageCaptureTab initialData={data} />
        )}
      </div>
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
