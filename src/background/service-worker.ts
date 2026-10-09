/**
 * Background Service Worker
 * Handles extension lifecycle, context menus, and communication between components
 */

import { storageService } from '@/services/storage';
import { captureVisibleTab } from '@/services/screenshot';
import type { SelectionRect } from '@/types/image-capture';

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, b64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/png';
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('FileReader failed'));
    reader.readAsDataURL(blob);
  });
}

interface Segment { dataUrl: string; scrollY: number; }
interface SegmentRef { scrollY: number; }

const captureSessionStore = new Map<string, string[]>();

async function stitchSegmentsInWorker(
  segments: Segment[],
  viewportWidth: number,
  viewportHeight: number,
  totalHeight: number,
  dpr: number
): Promise<string> {
  const canvas = new OffscreenCanvas(
    Math.round(viewportWidth * dpr),
    Math.round(totalHeight * dpr)
  );
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('OffscreenCanvas 2D context unavailable');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const blob = dataUrlToBlob(seg.dataUrl);
    const bitmap = await createImageBitmap(blob);

    const isClamped = seg.scrollY > 0 && seg.scrollY + viewportHeight > totalHeight;
    if (!isClamped) {
      ctx.drawImage(bitmap, 0, Math.round(seg.scrollY * dpr));
    } else {
      const lastVisibleHeight = totalHeight - seg.scrollY;
      const srcY = Math.round((viewportHeight - lastVisibleHeight) * dpr);
      const srcH = Math.round(lastVisibleHeight * dpr);
      ctx.drawImage(
        bitmap,
        0, srcY, Math.round(viewportWidth * dpr), srcH,
        0, Math.round(seg.scrollY * dpr), Math.round(viewportWidth * dpr), srcH
      );
    }
    bitmap.close();
  }

  // Full-page captures can be extremely tall, so keep them as JPEG (PNG would
  // blow the storage quota) but use a high quality to reduce text fogging.
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.95 });
  return blobToDataUrl(blob);
}

async function cropAndCompressInWorker(
  fullDataUrl: string,
  rect: SelectionRect,
  dpr: number,
  _quality: number
): Promise<string> {
  const blob = dataUrlToBlob(fullDataUrl);
  const actualX = Math.round(rect.x * dpr);
  const actualY = Math.round(rect.y * dpr);
  const actualWidth = Math.round(rect.width * dpr);
  const actualHeight = Math.round(rect.height * dpr);
  const cropped = await createImageBitmap(blob, actualX, actualY, actualWidth, actualHeight);
  const canvas = new OffscreenCanvas(actualWidth, actualHeight);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('OffscreenCanvas 2D context unavailable');
  ctx.drawImage(cropped, 0, 0);
  cropped.close();
  // Region captures are bounded by the selection, so store them as lossless
  // PNG — JPEG ringing is what made screenshot text look foggy. (_quality is
  // kept in the signature for backward compatibility but no longer used.)
  const resultBlob = await canvas.convertToBlob({ type: 'image/png' });
  return blobToDataUrl(resultBlob);
}

/**
 * Extension installation handler
 */
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    // First time installation

    // Initialize default settings
    await storageService.saveSettings({
      defaultColor: 'yellow',
      interfaceLanguage: 'en'
    });
  } else if (details.reason === 'update') {
    // Extension updated
  }
});

let offscreenCreating: Promise<void> | null = null;

async function ensureOffscreenDocument(): Promise<void> {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT]
  });
  if (contexts.length > 0) {
    return;
  }
  if (!offscreenCreating) {
    offscreenCreating = chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: [chrome.offscreen.Reason.WORKERS],
      justification: 'Run offline OCR on saved screenshots'
    }).finally(() => {
      offscreenCreating = null;
    });
  }
  await offscreenCreating;
}

/**
 * Message handler for communication with content scripts and popup
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    try {
      switch (message.action) {
        case 'save-highlight':
          await storageService.saveHighlight(message.highlight);
          sendResponse({ success: true });
          break;

        case 'delete-highlight':
          await storageService.deleteHighlight(message.highlightId);
          sendResponse({ success: true });
          break;

        case 'get-highlights':
          const highlights = await storageService.getHighlightsByUrl(message.url);
          sendResponse({ success: true, highlights });
          break;

        case 'get-settings':
          const settings = await storageService.getSettings();
          sendResponse({ success: true, settings });
          break;

        case 'save-settings':
          await storageService.saveSettings(message.settings);
          sendResponse({ success: true });
          break;

        case 'search-highlights':
          const searchResults = await storageService.searchHighlights(message.query);
          sendResponse({ success: true, results: searchResults });
          break;

        case 'get-storage-stats':
          const stats = await storageService.getStorageStats();
          sendResponse({ success: true, stats });
          break;

        case 'open-sidebar-in-tab': {
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          const targetTab = tabs[0];
          if (!targetTab?.id) { sendResponse({ success: false }); break; }
          const tabId = targetTab.id;
          const ready = await ensureContentScript(tabId);
          if (ready) {
            try {
              await chrome.tabs.sendMessage(tabId, { action: 'open-sidebar', data: message.data });
            } catch { /* ignore */ }
          }
          sendResponse({ success: true });
          break;
        }

        case 'start-screenshot-in-tab': {
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          const targetTab = tabs[0];
          if (!targetTab?.id) { sendResponse({ success: false }); break; }
          const tabId = targetTab.id;
          const ready = await ensureContentScript(tabId);
          if (ready) {
            try {
              await chrome.tabs.sendMessage(tabId, { action: 'start-screenshot' });
            } catch { /* ignore */ }
          }
          sendResponse({ success: ready });
          break;
        }

        case 'capture-screenshot': {
          try {
            const dataUrl = await captureVisibleTab();
            if (message.sessionId) {
              const arr = captureSessionStore.get(message.sessionId) ?? [];
              arr.push(dataUrl);
              captureSessionStore.set(message.sessionId, arr);
              sendResponse({ success: true });
            } else {
              sendResponse({ success: true, dataUrl });
            }
          } catch (error) {
            console.error('Screenshot capture error:', error);
            sendResponse({
              success: false,
              error: error instanceof Error ? error.message : 'Screenshot failed'
            });
          }
          break;
        }

        case 'stitch-segments': {
          try {
            const sessionId = message.sessionId as string;
            const segmentRefs = message.segmentRefs as SegmentRef[];
            const storedUrls = captureSessionStore.get(sessionId);
            captureSessionStore.delete(sessionId);

            if (!storedUrls || storedUrls.length === 0) {
              throw new Error('No captured segments found for session');
            }

            const segments: Segment[] = storedUrls.map((dataUrl, i) => ({
              dataUrl,
              scrollY: segmentRefs[i]?.scrollY ?? 0
            }));

            const finalDataUrl = await stitchSegmentsInWorker(
              segments,
              message.viewportWidth,
              message.viewportHeight,
              message.totalHeight,
              message.dpr
            );
            sendResponse({ success: true, dataUrl: finalDataUrl });
          } catch (error) {
            console.error('Stitch error:', error);
            sendResponse({ success: false, error: error instanceof Error ? error.message : 'Stitch failed' });
          }
          break;
        }

        case 'capture-screenshot-crop': {
          try {
            const dataUrl = await captureVisibleTab();
            const croppedUrl = await cropAndCompressInWorker(
              dataUrl,
              message.rect,
              message.dpr,
              message.quality ?? 0.85
            );
            sendResponse({ success: true, dataUrl: croppedUrl });
          } catch (error) {
            console.error('Crop error:', error);
            sendResponse({ success: false, error: error instanceof Error ? error.message : 'Crop failed' });
          }
          break;
        }

        case 'ocr-capture': {
          await ensureOffscreenDocument();
          const result = await chrome.runtime.sendMessage({
            target: 'offscreen',
            action: 'ocr-recognize',
            imageData: message.imageData
          });
          sendResponse(result);
          break;
        }

        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Message handler error:', error);
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  })();

  // Return true to indicate async response
  return true;
});

/**
 * Storage change listener
 */
chrome.storage.onChanged.addListener((changes, areaName) => {

  // Notify all tabs about storage changes
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, {
          action: 'storage-changed',
          changes,
          areaName
        }).catch(() => {
          // Ignore errors for tabs without content script
        });
      }
    }
  });
});

/**
 * Tab update listener - restore highlights when page loads
 */
async function ensureContentScript(tabId: number): Promise<boolean> {
  try {
    await chrome.tabs.sendMessage(tabId, { action: 'ping' });
    return true;
  } catch {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['assets/content-script.js']
      });
      for (let i = 0; i < 10; i++) {
        await new Promise(r => setTimeout(r, 200));
        try {
          await chrome.tabs.sendMessage(tabId, { action: 'ping' });
          return true;
        } catch { /* not ready yet */ }
      }
    } catch {
      // tab may not allow scripting (chrome://, extension pages, etc.)
    }
  }
  return false;
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    if (!tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
      await ensureContentScript(tabId);
    }
    try {
      // Get highlights for this URL
      const highlights = await storageService.getHighlightsByUrl(tab.url);

      if (highlights.length > 0) {
        // Send highlights to content script
        chrome.tabs.sendMessage(tabId, {
          action: 'restore-highlights',
          highlights
        }).catch(() => {
          // Content script might not be ready yet
        });
      }
    } catch (error) {
      console.error('Error restoring highlights:', error);
    }
  }
});

/**
 * Keyboard shortcut commands
 */
chrome.commands.onCommand.addListener(async (command, tab) => {
  if (!tab?.id) {
    return;
  }
  const tabId = tab.id;
  const ready = await ensureContentScript(tabId);
  if (!ready) {
    return; // restricted page (chrome://, web store, etc.)
  }

  switch (command) {
    case 'toggle-highlight':
      chrome.tabs
        .sendMessage(tabId, { action: 'toggle-highlight-mode' })
        .catch(() => {});
      break;

    case 'open-sidebar':
      chrome.tabs.sendMessage(tabId, { action: 'open-sidebar' }).catch(() => {});
      break;
  }
});

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) {
    return;
  }
  const tabId = tab.id;
  const ready = await ensureContentScript(tabId);
  if (!ready) {
    return;
  }
  chrome.tabs.sendMessage(tabId, { action: 'toggle-ui' }).catch(() => {});
});

