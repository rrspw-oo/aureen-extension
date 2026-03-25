/**
 * Sidebar Injector
 * Creates and manages an iframe sidebar that displays sidebar.html
 */

let sidebarFrame: HTMLIFrameElement | null = null;
let currentData: {
  mode?: 'highlight';
  text?: string;
  url?: string;
  pageTitle?: string;
} = {};

/**
 * Initialize and show sidebar
 */
export function showSidebar(data?: {
  mode?: 'highlight';
  text?: string;
  url?: string;
  pageTitle?: string;
}): void {
  if (data) {
    currentData = data;
  }

  if (sidebarFrame) {
    // Sidebar already exists, just show it
    sidebarFrame.style.display = 'block';

    // Send data to sidebar
    setTimeout(() => sendDataToSidebar(), 200);
    return;
  }

  // No overlay needed - sidebar should not block page interaction

  // Get extension ID safely
  let sidebarUrl: string;
  try {
    sidebarUrl = chrome.runtime.getURL('sidebar.html');
  } catch (error) {
    console.error('Extension context invalidated. Please reload the page.');
    alert('Extension was reloaded. Please refresh this page to use the highlighter.');
    return;
  }

  // Create iframe
  sidebarFrame = document.createElement('iframe');
  sidebarFrame.id = 'text-highlighter-sidebar';
  sidebarFrame.src = sidebarUrl;
  sidebarFrame.style.cssText = `
    position: fixed;
    top: 0;
    right: 0;
    width: 400px;
    height: 100%;
    border: none;
    border-left: 1px solid #d1d5db;
    z-index: 2147483647;
    background: white;
    box-shadow: -4px 0 24px rgba(0, 0, 0, 0.2);
  `;

  // Append to document
  document.body.appendChild(sidebarFrame);

  // Send data to sidebar after it loads
  sidebarFrame.addEventListener('load', () => {
    setTimeout(() => sendDataToSidebar(), 200);
  });
}

/**
 * Hide sidebar
 */
export function hideSidebar(): void {
  if (sidebarFrame) {
    sidebarFrame.style.display = 'none';
  }
}

/**
 * Remove sidebar completely
 */
export function removeSidebar(): void {
  if (sidebarFrame) {
    sidebarFrame.remove();
    sidebarFrame = null;
  }
}

/**
 * Toggle sidebar visibility
 */
export function toggleSidebar(): void {
  if (sidebarFrame && sidebarFrame.style.display !== 'none') {
    hideSidebar();
  } else {
    showSidebar();
  }
}

/**
 * Check if sidebar is currently visible
 */
export function isSidebarVisible(): boolean {
  return sidebarFrame !== null && sidebarFrame.style.display !== 'none';
}

/**
 * Send data to sidebar iframe
 */
function sendDataToSidebar(): void {
  if (!sidebarFrame || !sidebarFrame.contentWindow) {
    return;
  }

  // Post message to iframe
  const message = {
    type: 'TEXT_HIGHLIGHTER_DATA',
    data: currentData
  };

  try {
    // Use extension URL as targetOrigin for security
    const extensionUrl = chrome.runtime.getURL('');
    sidebarFrame.contentWindow.postMessage(message, extensionUrl);
  } catch (error) {
    console.error('Error sending message to sidebar:', error);
  }
}

/**
 * Listen for messages from sidebar
 */
window.addEventListener('message', (event) => {
  // Only accept messages from our extension
  if (!event.origin.startsWith('chrome-extension://')) {
    return;
  }

  if (event.data.type === 'CLOSE_SIDEBAR') {
    hideSidebar();
  } else if (event.data.type === 'REQUEST_DATA') {
    sendDataToSidebar();
  }
});
