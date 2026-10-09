/**
 * Content Script
 * Injected into all webpages to handle text selection, highlighting, and UI interactions
 */

import { injectHighlightStyles, isValidSelection } from '@/utils/dom-helpers';
import { initContentApp } from './content-app';
import { toggleSidebarShadow, mountSidebarWithShadow, isSidebarVisible, hideSidebarShadow } from './sidebar-shadow';
import { highlighter } from './highlighter';
import { startScreenshotCapture } from './screenshot-capture-handler';
import { showFab, isFabVisible } from './fab-bridge';
import type { Highlight } from '@/types';

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

/**
 * Initialize content script
 */
function initialize(): void {

  // Inject highlight styles
  injectHighlightStyles();

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

  if (!currentSelection) {
    return;
  }

  // Remove existing toolbar
  hideToolbar();

  // Create toolbar element
  toolbarElement = document.createElement('div');
  toolbarElement.id = 'highlight-toolbar';
  toolbarElement.className = 'highlight-toolbar toolbar'; // 添加 toolbar class
  toolbarElement.style.cssText = `
    position: fixed;
    z-index: 2147483647;
    background: white;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
    padding: 8px;
    display: flex;
    gap: 8px;
    pointer-events: auto;
  `;

  toolbarElement.innerHTML = `
    <button id="highlight-btn" title="Highlight text" style="
      padding: 8px 16px;
      background: #C9A86C;
      color: #2C2417;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.2s;
    ">
      Highlight
    </button>
  `;

  // Position toolbar above selection
  const range = currentSelection.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  // Position above the selection
  // 使用 fixed 定位，所以不需要加 scroll offset
  const toolbarTop = rect.top - 60; // 在選取上方 60px
  const toolbarLeft = rect.left + (rect.width / 2) - 50; // 水平置中，減 50px（工具列一半寬度）

  toolbarElement.style.top = `${toolbarTop}px`;
  toolbarElement.style.left = `${toolbarLeft}px`;

  document.body.appendChild(toolbarElement);

  // 標記工具列剛創建，防止立即被 click outside 隱藏
  toolbarJustCreated = true;
  setTimeout(() => {
    toolbarJustCreated = false;
  }, 300); // 300ms 保護期

  // Snapshot the range now — Selection is a live object that gets cleared on click
  const capturedRange = currentSelection.rangeCount > 0 ? currentSelection.getRangeAt(0).cloneRange() : null;
  const capturedText = currentSelectionText;

  // Add event listeners to buttons
  const highlightBtn = toolbarElement.querySelector<HTMLButtonElement>('#highlight-btn');

  // Add hover effects
  if (highlightBtn) {
    highlightBtn.addEventListener('mouseenter', () => {
      highlightBtn.style.transform = 'scale(1.05)';
      highlightBtn.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2)';
    });
    highlightBtn.addEventListener('mouseleave', () => {
      highlightBtn.style.transform = 'scale(1)';
      highlightBtn.style.boxShadow = 'none';
    });
    highlightBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!capturedRange || !capturedText) return;
      // Restore the cloned range into the live selection so createHighlight can read it
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(capturedRange);
      }
      const tempHighlight = highlighter.createHighlight(sel!, 'yellow', []);
      if (tempHighlight) {
        toggleSidebar({
          mode: 'highlight',
          text: capturedText,
          url: window.location.href,
          pageTitle: document.title,
          highlightId: tempHighlight.id,
          position: tempHighlight.position,
          color: tempHighlight.color
        });
      }
      hideToolbar();
      setTimeout(() => {
        const s = window.getSelection();
        if (s && s.rangeCount > 0) s.removeAllRanges();
      }, 100);
    });
  }
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
  const tempHighlight = highlighter.createHighlight(currentSelection!, 'yellow', []);

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
