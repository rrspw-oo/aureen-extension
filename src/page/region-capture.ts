/**
 * Screenshot Capture Handler
 * Orchestrates the screenshot capture workflow
 */

import { t } from '@/i18n/config';
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { SelectionRect } from '@/types/image-capture';
import { mountSidebarWithShadow } from '@/sidebar/shell';

let overlayContainer: HTMLDivElement | null = null;
let overlayRoot: Root | null = null;

/**
 * Start screenshot capture process
 */
export async function startScreenshotCapture(): Promise<void> {
  // Create overlay container
  overlayContainer = document.createElement('div');
  overlayContainer.id = 'aureen-screenshot-overlay-root';
  document.body.appendChild(overlayContainer);

  // Dynamically import React component
  const { ScreenshotOverlay } = await import('@/page/region-overlay');

  // Render overlay
  overlayRoot = createRoot(overlayContainer);
  overlayRoot.render(
    React.createElement(ScreenshotOverlay, {
      onCapture: handleCapture,
      onCancel: handleCancel
    })
  );
}

/**
 * Handle screenshot capture
 */
async function handleCapture(rect: SelectionRect): Promise<void> {
  try {
    // Remove overlay immediately
    cleanup();

    // Capture and crop in background service worker (avoids page CSP taint)
    const cropResponse = await chrome.runtime.sendMessage({
      action: 'capture-screenshot-crop',
      rect,
      dpr: window.devicePixelRatio || 1,
      quality: 0.85
    });

    if (!cropResponse?.success) {
      throw new Error(cropResponse?.error ?? 'Capture/crop failed in service worker');
    }

    const croppedDataUrl = cropResponse.dataUrl as string;

    // Open sidebar with capture data (instead of showing dialog)
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    mountSidebarWithShadow({
      mode: 'capture',
      captureId: tempId,
      imageData: croppedDataUrl,
      url: window.location.href,
      pageTitle: document.title,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Screenshot capture error:', error);
    alert(t('fullPage.regionFailed'));
  }
}

/**
 * Handle cancel
 */
function handleCancel(): void {
  cleanup();
}

/**
 * Clean up overlay
 */
function cleanup(): void {
  // First unmount React component to trigger useEffect cleanup (restores scroll position)
  if (overlayRoot) {
    overlayRoot.unmount();
    overlayRoot = null;
  }

  // Then remove DOM element
  if (overlayContainer && overlayContainer.parentNode) {
    overlayContainer.parentNode.removeChild(overlayContainer);
    overlayContainer = null;
  }
}
