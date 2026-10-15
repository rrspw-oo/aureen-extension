/**
 * Download Utility Functions
 * Centralized file download functionality
 */

/**
 * Download data as file
 * @param data - Data to download (string or Blob)
 * @param filename - Name of the downloaded file
 * @param mimeType - MIME type of the file (default: text/plain)
 */
export function downloadFile(
  data: string | Blob,
  filename: string,
  mimeType = 'text/plain'
): void {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType });

  // The desktop (Tauri) shell can't use <a download>; it installs a native saver instead.
  const nativeSave = (globalThis as { __aureenSaveFile?: (blob: Blob, filename: string) => void }).__aureenSaveFile;
  if (nativeSave) {
    nativeSave(blob, filename);
    return;
  }

  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/**
 * Download an image given as a data URL (e.g. a stored screenshot)
 */
export function downloadDataUrl(dataUrl: string, filename: string): void {
  void fetch(dataUrl)
    .then((response) => response.blob())
    .then((blob) => downloadFile(blob, filename, blob.type));
}

/**
 * Download JSON data as file
 * @param data - Object to download as JSON
 * @param filename - Name of the downloaded file (without extension)
 */
export function downloadJSON(data: unknown, filename: string): void {
  const jsonString = JSON.stringify(data, null, 2);
  const fullFilename = filename.endsWith('.json') ? filename : `${filename}.json`;
  downloadFile(jsonString, fullFilename, 'application/json');
}

/**
 * Download markdown as file
 * @param markdown - Markdown content to download
 * @param filename - Name of the downloaded file (without extension)
 */
export function downloadMarkdown(markdown: string, filename: string): void {
  const fullFilename = filename.endsWith('.md') ? filename : `${filename}.md`;
  downloadFile(markdown, fullFilename, 'text/markdown');
}

/**
 * Generate filename with date suffix
 * @param prefix - Filename prefix
 * @param extension - File extension (with or without dot)
 * @returns Filename with date (e.g., "highlights-2025-01-24.json")
 */
export function generateFilenameWithDate(prefix: string, extension: string): string {
  const date = new Date().toISOString().split('T')[0];
  const ext = extension.startsWith('.') ? extension : `.${extension}`;
  return `${prefix}-${date}${ext}`;
}

/**
 * Read file as text
 * @param file - File object to read
 * @returns Promise that resolves to file content as text
 */
export async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      const result = event.target?.result;
      if (typeof result === 'string') {
        resolve(result);
      } else {
        reject(new Error('Failed to read file as text'));
      }
    };

    reader.onerror = () => {
      reject(new Error('Error reading file'));
    };

    reader.readAsText(file);
  });
}
