/**
 * Content App
 * React application for content script overlays
 */

import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { storageService } from '@/services/storage';
import { highlighter } from './highlighter';
import { toggleSidebarShadow } from './sidebar-shadow';
import type { HighlightColor } from '@/types';
import styles from '@/index.css?inline';
import '@/content/fab';

type Tag = { name: string; count: number; lastUsedAt: number };

interface OverlayState {
  show: boolean;
  selectedText: string;
  selection: Selection | null;
}

const ContentApp: React.FC = () => {
  const [overlayState, setOverlayState] = useState<OverlayState>({
    show: false,
    selectedText: '',
    selection: null
  });
  const [tagInput, setTagInput] = useState<string>('');
  const [quickTags, setQuickTags] = useState<Tag[]>([]);
  const [saving, setSaving] = useState(false);

  const portalContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Create Shadow DOM container for Overlay
    const shadowHost = document.createElement('div');
    shadowHost.id = 'overlay-portal-shadow-host';

    // 容器覆蓋全畫面但不攔截事件
    Object.assign(shadowHost.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '2147483646',
      pointerEvents: 'none', // 關鍵：Host 不攔截事件
    });

    document.documentElement.appendChild(shadowHost);

    // 移除 delegatesFocus 避免搶焦點導致選取被清除
    const shadowRoot = shadowHost.attachShadow({ mode: 'open' });

    // 防呆：確保 pointer-events 不被其他程式碼改回 auto
    new MutationObserver(() => {
      if (shadowHost.style.pointerEvents !== 'none') {
        shadowHost.style.pointerEvents = 'none';
      }
    }).observe(shadowHost, { attributes: true, attributeFilter: ['style'] });

    // CSS Reset + pointer-events 策略
    const styleReset = document.createElement('style');
    styleReset.textContent = `
      :host {
        all: initial !important;
        user-select: text !important;
      }
      .portal-root {
        position: fixed;
        inset: 0;
        pointer-events: none;
        user-select: text !important;
      }
      .toolbar, .panel, .btn, .popover, .bubble {
        pointer-events: auto;
      }
    `;
    shadowRoot.appendChild(styleReset);

    // Inject CSS using Constructable Stylesheets
    try {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(styles);
      shadowRoot.adoptedStyleSheets = [sheet];
    } catch (error) {
      const styleEl = document.createElement('style');
      styleEl.textContent = styles;
      shadowRoot.appendChild(styleEl);
    }

    // Create container for Portal
    const container = document.createElement('div');
    container.className = 'portal-root';
    container.style.cssText = `
      width: 100%;
      height: 100%;
      pointer-events: none;
    `;
    shadowRoot.appendChild(container);

    portalContainerRef.current = container;

    return () => {
      shadowHost.remove();
    };
  }, []);

  // 載入全域快速 Tag（MRU）
  useEffect(() => {
    (async () => {
      const tags = await storageService.getGlobalTags();
      setQuickTags(tags.slice(0, 8));
    })();
  }, []);

  useEffect(() => {
    // 監聽來自 content-script 的 window message
    const handleWindowMessage = (event: MessageEvent): void => {
      if (event.source !== window) return;

      const message = event.data;

      if (message.type === 'AUREEN_OPEN_OVERLAY' && message.action === 'open-highlight-overlay') {

        let selection = window.getSelection();
        const text = message.text || '';

        setOverlayState({
          show: true,
          selectedText: text,
          selection: selection
        });
        setTagInput('');
      } else if (message.type === 'AUREEN_CLOSE_OVERLAY') {
        setOverlayState({ show: false, selectedText: '', selection: null });
      }
    };

    window.addEventListener('message', handleWindowMessage);

    // 保留 chrome.runtime.onMessage 以便從其他地方觸發
    const handleChromeMessage = (
      message: { action: string; text?: string },
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response: { success: boolean }) => void
    ): boolean => {
      if (message.action === 'open-highlight-overlay') {
        const selection = window.getSelection();
        if (selection && !selection.isCollapsed) {
          setOverlayState({
            show: true,
            selectedText: message.text || selection.toString().trim(),
            selection
          });
        }
        sendResponse({ success: true });
      } else if (message.action === 'close-highlight-overlay') {
        setOverlayState({ show: false, selectedText: '', selection: null });
        sendResponse({ success: true });
      }
      return true;
    };

    chrome.runtime.onMessage.addListener(handleChromeMessage);

    return () => {
      window.removeEventListener('message', handleWindowMessage);
      chrome.runtime.onMessage.removeListener(handleChromeMessage);
    };
  }, []);

  async function handleSave() {
    if (!overlayState.selectedText || !overlayState.selectedText.trim()) return;
    if (!overlayState.selection) {
      console.error('No selection available');
      return;
    }

    const raw = tagInput.trim();
    // 解析 tags：用空白或逗號分隔，自動補 #，過濾空字串與重複
    const tags = Array.from(new Set(
      raw.split(/[,\s]+/)
        .map(t => t.trim())
        .filter(Boolean)
        .map(t => (t.startsWith('#') ? t : `#${t}`))
    ));

    setSaving(true);
    try {
      const url = window.location.href;

      // 立即打亮（使用專案現有的 highlighter 模組）
      const color: HighlightColor = 'yellow';
      const highlight = highlighter.createHighlight(overlayState.selection, color, tags);

      if (!highlight) {
        throw new Error('Failed to create highlight');
      }

      // 寫入 storage
      await storageService.addHighlight(url, highlight);
      await storageService.bumpGlobalTags(tags);

      // 更新快速 tags 顯示
      const mru = await storageService.getGlobalTags();
      setQuickTags(mru.slice(0, 8));

      // 關 overlay、開 sidebar（來源：highlight）
      setOverlayState({ show: false, selectedText: '', selection: null });

      // 清除 DOM 選取
      const sel = window.getSelection();
      if (sel) sel.removeAllRanges();

      toggleSidebarShadow({ open: true, source: 'highlight' });

    } catch (e) {
      console.error('Save highlight failed', e);
      alert('Failed to save highlight. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function addQuickTag(name: string) {
    const withHash = name.startsWith('#') ? name : `#${name}`;
    const parts = new Set(
      tagInput.trim()
        .split(/[,\s]+/)
        .filter(Boolean)
        .map(t => (t.startsWith('#') ? t : `#${t}`))
    );
    parts.add(withHash);
    setTagInput(Array.from(parts).join(' '));
  }

  function handleCancel() {
    setOverlayState({ show: false, selectedText: '', selection: null });

    // 清除 DOM 選取
    const sel = window.getSelection();
    if (sel) sel.removeAllRanges();
  }

  if (!portalContainerRef.current) {
    return null;
  }

  return (
    <>
      {overlayState.show && (
        <div className="panel" style={{
          position: 'fixed',
          right: '16px',
          bottom: '16px',
          padding: '16px',
          borderRadius: '8px',
          boxShadow: '0 6px 24px rgba(0,0,0,0.12)',
          background: '#fff',
          maxWidth: '360px',
          pointerEvents: 'auto',
          zIndex: 2147483647
        }}>
          <div style={{ fontWeight: 600, marginBottom: '8px', fontSize: '14px' }}>建立 Highlight</div>
          <div style={{
            fontSize: '12px',
            opacity: 0.7,
            marginBottom: '12px',
            whiteSpace: 'pre-wrap',
            maxHeight: '60px',
            overflow: 'auto'
          }}>
            {overlayState.selectedText}
          </div>
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            placeholder="輸入 tag（空白或逗號分隔），自動補 #"
            style={{
              width: '100%',
              padding: '8px 10px',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              marginBottom: '8px',
              fontSize: '14px'
            }}
            onKeyDown={(e) => {
              if (e.nativeEvent.isComposing) return;
              if (e.key === 'Enter' && !saving) {
                e.preventDefault();
                handleSave();
              }
            }}
          />
          {!!quickTags.length && (
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '6px',
              marginBottom: '12px'
            }}>
              {quickTags.map(t => (
                <button
                  key={t.name}
                  className="btn"
                  style={{
                    padding: '4px 8px',
                    borderRadius: '999px',
                    border: '1px solid #e5e7eb',
                    background: '#fafafa',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                  onClick={() => addQuickTag(t.name)}
                >
                  {t.name}
                </button>
              ))}
            </div>
          )}
          <div style={{
            display: 'flex',
            gap: '8px',
            justifyContent: 'flex-end'
          }}>
            <button
              className="btn"
              onClick={handleCancel}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid #e5e7eb',
                background: '#fff',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              取消
            </button>
            <button
              className="btn"
              disabled={saving}
              onClick={handleSave}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                background: saving ? '#9ca3af' : '#10b981',
                color: '#fff',
                cursor: saving ? 'not-allowed' : 'pointer',
                fontSize: '14px'
              }}
            >
              {saving ? '儲存中…' : '儲存'}
            </button>
          </div>
        </div>
      )}
    </>
  );
};

let contentAppRoot: ReturnType<typeof createRoot> | null = null;

function initContentApp(): void {
  const containerId = 'highlight-extension-root';
  const existing = document.getElementById(containerId);

  // If another content-script instance already mounted the overlay (double
  // injection: manifest content script + service-worker fallback), don't mount
  // a second React root onto the page.
  if (existing && !contentAppRoot) {
    return;
  }

  const container = existing ?? document.createElement('div');
  if (!existing) {
    container.id = containerId;
    document.body.appendChild(container);
  }

  if (!contentAppRoot) {
    contentAppRoot = createRoot(container);
  }

  contentAppRoot.render(<ContentApp />);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initContentApp);
} else {
  initContentApp();
}

export { initContentApp };
