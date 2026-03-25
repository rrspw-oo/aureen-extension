/**
 * Screenshot service
 * Handles screenshot capture, cropping, and compression
 */

import type { SelectionRect } from '@/types/image-capture';

/**
 * Capture visible tab using Chrome API
 * Must be called from background script context
 */
export async function captureVisibleTab(): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.tabs.captureVisibleTab(
      null as any,
      { format: 'png' },  // First capture as PNG (lossless)
      (dataUrl) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (dataUrl) {
          resolve(dataUrl);
        } else {
          reject(new Error('Failed to capture screenshot'));
        }
      }
    );
  });
}

/**
 * Crop and compress image
 * @param fullScreenDataUrl - Full screenshot data URL
 * @param rect - Selection rectangle coordinates (in CSS pixels)
 * @param quality - JPEG quality (0-1), default 0.85
 * @returns Cropped and compressed image as data URL
 */
export async function cropAndCompressImage(
  fullScreenDataUrl: string,
  rect: SelectionRect,
  quality: number = 0.85
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      try {
        // Account for device pixel ratio (e.g., Retina displays)
        // Chrome's captureVisibleTab captures at actual pixel resolution
        const dpr = window.devicePixelRatio || 1;

        // Convert CSS pixels to actual pixels
        const actualX = rect.x * dpr;
        const actualY = rect.y * dpr;
        const actualWidth = rect.width * dpr;
        const actualHeight = rect.height * dpr;

        // Create canvas with actual pixel size
        const canvas = document.createElement('canvas');
        canvas.width = actualWidth;
        canvas.height = actualHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        // Draw cropped region
        ctx.drawImage(
          img,
          actualX, actualY, actualWidth, actualHeight,  // Source region (actual pixels)
          0, 0, actualWidth, actualHeight                // Destination region
        );

        // Compress to JPEG
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.src = fullScreenDataUrl;
  });
}

/**
 * Calculate data URL size in bytes
 * @param dataUrl - Base64 data URL
 * @returns Size in bytes
 */
export function getDataUrlSize(dataUrl: string): number {
  // Remove data URL prefix to get base64 string
  const base64 = dataUrl.split(',')[1];
  if (!base64) {
    return 0;
  }

  // Calculate size: base64 length * 3/4 (accounting for padding)
  const padding = (base64.match(/=/g) || []).length;
  return (base64.length * 3) / 4 - padding;
}

/**
 * Format bytes to human-readable string
 * @param bytes - Size in bytes
 * @returns Formatted string (e.g., "2.5 MB")
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}
