/**
 * Content Script
 * Injected into all webpages to handle text selection, highlighting, and UI interactions
 */

import { injectHighlightStyles, isValidSelection } from '@/lib/dom';
import { initContentApp } from '@/page/content-app';
import { toggleSidebarShadow, mountSidebarWithShadow, isSidebarVisible, hideSidebarShadow } from '@/sidebar/shell';
import { highlighter } from '@/page/highlighter';
import { startScreenshotCapture } from '@/page/region-capture';
import { showFab, isFabVisible } from '@/page/fab-bridge';
import { storageService } from '@/lib/highlight-store';
import type { Highlight, HighlightColor } from '@/types/highlight';

const TOOLBAR_COLORS: { color: HighlightColor; swatch: string; label: string }[] = [
  { color: 'yellow', swatch: '#F0DDAE', label: 'Champagne' },
  { color: 'mint', swatch: '#CDEBD8', label: 'Mint' },
  { color: 'coral', swatch: '#F6D0CC', label: 'Rose' },
  { color: 'sky', swatch: '#CFE0F6', label: 'Sky' }
];

declare global {
  interface Window {
    __AUREEN_CONTENT_LOADED__?: boolean;
  }
}

/**
 * Guard against double-injection. Chrome can run the content script twice on a
 * page: once from the manifest `content_scripts` declaration and once from the
 * service worker's `ensureContentScript` fallback (used to re-inject after an
 * extension reload). When both run we would otherwise get two FABs, two
 * sidebars and duplicated listeners. The first instance wires everything up;
 * later instances skip listener/init registration (mounts are also DOM-guarded).
 */
const alreadyLoaded = window.__AUREEN_CONTENT_LOADED__ === true;
window.__AUREEN_CONTENT_LOADED__ = true;

/**
 * State management for content script
 */
let isHighlightMode = false;
let currentSelection: Selection | null = null;
let currentSelectionText: string = ''; // 保存選取的文字內容
let toolbarElement: HTMLElement | null = null;
let selectionTimeout: ReturnType<typeof setTimeout> | null = null;
let toolbarJustCreated = false; // 標記工具列剛剛創建
let defaultColor: HighlightColor = 'yellow';

/**
 * Initialize content script
 */
function initialize(): void {

  // Inject highlight styles
  injectHighlightStyles();

  storageService.getSettings().then((settings) => {
    defaultColor = settings.defaultColor;
  });

  // 保底：確保 overlay shadow host 的 pointer-events 始終為 none
  const protectionStyle = document.createElement('style');
  protectionStyle.textContent = `#overlay-portal-shadow-host{pointer-events:none !important}`;
  document.documentElement.appendChild(protectionStyle);

  // Setup event listeners
  setupEventListeners();

  // Request highlights for current page
  requestHighlightsForPage();

  // Initialize React app for overlays
  initContentApp();

}

/**
 * Setup event listeners
 */
function setupEventListeners(): void {

  // Text selection listener - using selectionchange for better accuracy
  document.addEventListener('selectionchange', handleSelectionChange);

  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeyboardShortcuts);

  // Click outside to close toolbar
  document.addEventListener('click', handleClickOutside);

  // Window message listener for sidebar communications
  window.addEventListener('message', handleWindowMessage);
}

/**
 * Handle window messages from sidebar
 */
function handleWindowMessage(event: MessageEvent): void {
  // Only accept messages from same window
  if (event.source !== window) return;

  const message = event.data;

  if (message.type === 'AUREEN_REMOVE_HIGHLIGHT' && message.highlightId) {
    // Remove temporary highlight from page
    highlighter.removeHighlight(message.highlightId);
  } else if (message.type === 'AUREEN_SCROLL_TO_HIGHLIGHT' && message.highlightId) {
    highlighter.scrollToHighlight(message.highlightId);
  } else if (message.type === 'AUREEN_START_SCREENSHOT') {
    // Start screenshot capture from sidebar
    startScreenshotCapture();
  }
}

/**
 * Handle selection change
 */
function handleSelectionChange(): void {
  // Clear existing timeout to debounce rapid selection changes
  if (selectionTimeout) {
    clearTimeout(selectionTimeout);
  }

  // Debounce to avoid showing toolbar during active selection
  selectionTimeout = setTimeout(() => {
    const selection = window.getSelection();

    if (!selection) {
      // 不要隱藏工具列，因為用戶可能正在與它互動
      if (!toolbarJustCreated && !toolbarElement) {
        hideToolbar();
      }
      return;
    }

    // Check if there's a valid selection
    const selectedText = selection.toString();
    const hasValidSelection = !selection.isCollapsed &&
                             selection.rangeCount > 0 &&
                             selectedText.trim().length > 0;


    if (!hasValidSelection) {
      // 如果工具列存在且剛創建，不要隱藏
      if (!toolbarJustCreated) {
        hideToolbar();
      }
      return;
    }

    // Check if selection is in editable element
    const validResult = isValidSelection(selection);

    if (!validResult) {
      hideToolbar();
      return;
    }

    currentSelection = selection;
    currentSelectionText = selectedText;
    showToolbar();
  }, 150);
}

/**
 * Show floating toolbar near selection
 */
function showToolbar(): void {
  if (!currentSelection || currentSelection.rangeCount === 0) {
    return;
  }

  hideToolbar();

  const capturedRange = currentSelection.getRangeAt(0).cloneRange();
  const capturedText = currentSelectionText;

  const create = (color: HighlightColor, focusNote: boolean): void => {
    const sel = window.getSelection();
    if (!sel) return;
    sel.removeAllRanges();
    sel.addRange(capturedRange);
    const tempHighlight = highlighter.createHighlight(sel, color, []);
    if (tempHighlight) {
      toggleSidebar({
        mode: 'highlight',
        text: capturedText,
        url: window.location.href,
        pageTitle: document.title,
        highlightId: tempHighlight.id,
        position: tempHighlight.position,
        color,
        focusNote
      });
    }
    hideToolbar();
    setTimeout(() => {
      const s = window.getSelection();
      if (s && s.rangeCount > 0) s.removeAllRanges();
    }, 100);
  };

  const toolbar = document.createElement('div');
  toolbar.id = 'highlight-toolbar';
  toolbar.className = 'highlight-toolbar toolbar';
  toolbar.setAttribute('role', 'toolbar');
  toolbar.setAttribute('aria-label', 'Aureen highlight');
  toolbar.style.cssText = `
    position: fixed;
    z-index: 2147483647;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 5px;
    background: #1F1F2E;
    border-radius: 12px;
    box-shadow: 0 10px 28px rgba(31, 31, 46, 0.28);
    pointer-events: auto;
    font: 600 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  `;
  toolbar.addEventListener('mousedown', (e) => e.preventDefault());

  const divider = (): HTMLElement => {
    const line = document.createElement('span');
    line.style.cssText = 'width: 1px; height: 22px; background: #3A3A4C; margin: 0 4px;';
    return line;
  };

  const swatchOf = (color: HighlightColor): string =>
    TOOLBAR_COLORS.find((item) => item.color === color)?.swatch ?? TOOLBAR_COLORS[0].swatch;

  const highlightBtn = document.createElement('button');
  highlightBtn.id = 'highlight-btn';
  highlightBtn.type = 'button';
  highlightBtn.title = 'Highlight text';
  highlightBtn.style.cssText = `
    height: 36px;
    padding: 0 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    border: none;
    border-radius: 8px;
    background: #C9A86C;
    color: #2C2417;
    font: inherit;
    cursor: pointer;
  `;
  const currentSwatch = document.createElement('span');
  currentSwatch.style.cssText = `width: 12px; height: 12px; border-radius: 50%; background: ${swatchOf(defaultColor)}; box-shadow: 0 0 0 1px rgba(44, 36, 23, 0.35);`;
  highlightBtn.append(currentSwatch, document.createTextNode('Highlight'));
  highlightBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    create(defaultColor, false);
  });

  toolbar.append(highlightBtn, divider());

  for (const item of TOOLBAR_COLORS) {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.dataset.color = item.color;
    dot.title = `Highlight in ${item.label}`;
    dot.setAttribute('aria-label', `Highlight in ${item.label}`);
    dot.style.cssText = `
      width: 22px;
      height: 22px;
      margin: 0 2px;
      border-radius: 50%;
      border: ${item.color === defaultColor ? '2px solid #FFFFFF' : 'none'};
      background: ${item.swatch};
      cursor: pointer;
    `;
    dot.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      defaultColor = item.color;
      storageService.saveSettings({ defaultColor: item.color });
      create(item.color, false);
    });
    toolbar.appendChild(dot);
  }

  const noteBtn = document.createElement('button');
  noteBtn.type = 'button';
  noteBtn.title = 'Highlight and add a note';
  noteBtn.setAttribute('aria-label', 'Highlight and add note');
  noteBtn.style.cssText = `
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 8px;
    background: transparent;
    cursor: pointer;
  `;
  const svgNs = 'http://www.w3.org/2000/svg';
  const noteIcon = document.createElementNS(svgNs, 'svg');
  noteIcon.setAttribute('width', '17');
  noteIcon.setAttribute('height', '17');
  noteIcon.setAttribute('viewBox', '0 0 24 24');
  noteIcon.setAttribute('fill', 'none');
  noteIcon.setAttribute('stroke', '#E8E6F0');
  noteIcon.setAttribute('stroke-width', '1.8');
  noteIcon.setAttribute('stroke-linejoin', 'round');
  const notePath = document.createElementNS(svgNs, 'path');
  notePath.setAttribute('d', 'M4 5h16v11H9l-5 4z');
  noteIcon.appendChild(notePath);
  noteBtn.appendChild(noteIcon);
  noteBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    create(defaultColor, true);
  });

  toolbar.append(divider(), noteBtn);
  document.body.appendChild(toolbar);
  toolbarElement = toolbar;

  const rect = capturedRange.getBoundingClientRect();
  const width = toolbar.offsetWidth;
  const height = toolbar.offsetHeight;
  const left = Math.min(Math.max(8, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - 8);
  const top = rect.top - height - 10 >= 8 ? rect.top - height - 10 : rect.bottom + 10;
  toolbar.style.left = `${left}px`;
  toolbar.style.top = `${top}px`;

  toolbarJustCreated = true;
  setTimeout(() => {
    toolbarJustCreated = false;
  }, 300);
}

/**
 * Hide floating toolbar
 */
function hideToolbar(): void {
  if (toolbarElement) {
    toolbarElement.remove();
    toolbarElement = null;
    toolbarJustCreated = false;
  }
  // 注意：不要在這裡清空 currentSelectionText，因為點擊按鈕後會先隱藏工具列再使用文字
}

/**
 * Handle highlight button click
 */
function handleHighlightClick(event?: Event): void {

  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  if (!currentSelection || !currentSelectionText) {
    return;
  }

  // 立即打亮（不儲存，只在頁面顯示）
  const tempHighlight = highlighter.createHighlight(currentSelection!, defaultColor, []);

  if (tempHighlight) {

    // 開啟 Sidebar 並傳遞資料（不儲存到 storage）
    toggleSidebar({
      mode: 'highlight',
      text: currentSelectionText, // 使用保存的文字
      url: window.location.href,
      pageTitle: document.title,
      highlightId: tempHighlight.id,
      position: tempHighlight.position,
      color: tempHighlight.color
    });

    // 清空保存的文字（已經傳遞給 sidebar）
    currentSelectionText = '';
  }

  // Hide toolbar
  hideToolbar();

  // 清除視覺選取
  setTimeout(() => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      sel.removeAllRanges();
    }
  }, 100);
}

/**
 * Handle keyboard shortcuts
 */
function handleKeyboardShortcuts(event: KeyboardEvent): void {
  // Escape key to close toolbar
  if (event.key === 'Escape') {
    hideToolbar();
  }

  // Alt+H to toggle highlight mode
  if (event.altKey && event.key === 'h') {
    event.preventDefault();
    isHighlightMode = !isHighlightMode;
  }

  // Alt+S to open sidebar
  if (event.altKey && event.key === 's') {
    event.preventDefault();
    toggleSidebar();
  }
}

/**
 * Handle click outside toolbar
 */
function handleClickOutside(event: MouseEvent): void {
  // 如果工具列剛創建，忽略 click outside
  if (toolbarJustCreated) {
    return;
  }

  // 檢查是否有選取文字，如果有就不關閉工具列
  const selection = window.getSelection();
  if (selection && !selection.isCollapsed && selection.toString().trim().length > 0) {
    return;
  }

  if (toolbarElement && !toolbarElement.contains(event.target as Node)) {
    // 延遲關閉，避免干擾選取
    setTimeout(() => {
      hideToolbar();
      currentSelectionText = '';
    }, 100);
  }
}

/**
 * Toggle sidebar
 */
function toggleSidebar(data?: Record<string, unknown>): void {
  if (data) {
    mountSidebarWithShadow(data);
  } else {
    toggleSidebarShadow();
  }
}

/**
 * Request highlights for current page from background
 */
function requestHighlightsForPage(): void {
  chrome.runtime.sendMessage({
    action: 'get-highlights',
    url: window.location.href
  }, (response) => {
    if (chrome.runtime.lastError) return;
    if (response && response.success && response.highlights) {
      restoreHighlights(response.highlights);
    }
  });
}

/**
 * Restore highlights on page
 */
function restoreHighlights(highlights: Highlight[]): void {
  highlighter.restoreHighlights(highlights);
}

/**
 * Message listener from background script
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // A duplicate-injected instance still keeps a (harmless) ping responder so the
  // service worker sees the page as ready, but does not act on other messages.
  if (alreadyLoaded) {
    sendResponse({ success: true });
    return true;
  }

  switch (message.action) {
    case 'ping':
      sendResponse({ success: true });
      break;

    case 'highlight-selection':
      handleHighlightClick();
      break;

    case 'open-sidebar':
      toggleSidebar(message.data);
      break;

    case 'toggle-sidebar':
      toggleSidebar();
      break;

    case 'toggle-ui':
      if (isSidebarVisible() || isFabVisible()) {
        hideSidebarShadow();
      } else {
        showFab();
      }
      break;

    case 'toggle-highlight-mode':
      isHighlightMode = !isHighlightMode;
      break;

    case 'restore-highlights':
      restoreHighlights(message.highlights);
      break;

    case 'remove-highlight':
      // Remove highlight from page
      if (message.highlightId) {
        highlighter.removeHighlight(message.highlightId);
      }
      break;

    case 'storage-changed':
      // Refresh highlights when storage changes
      requestHighlightsForPage();
      break;

    case 'start-screenshot':
      // Start screenshot capture process
      startScreenshotCapture();
      break;
  }

  sendResponse({ success: true });
  return true;
});

/**
 * Initialize on load
 */
if (!alreadyLoaded) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
}
