/**
 * Screenshot service
 * Handles screenshot capture, cropping, and compression
 */

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
