import { imageCaptureStorage } from './image-capture-storage';

export async function runOcrForCapture(captureId: string, imageData: string): Promise<void> {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'ocr-capture', imageData });
    if (!response?.success) {
      throw new Error(response?.error || 'OCR failed');
    }
    await imageCaptureStorage.updateCapture(captureId, {
      ocrText: response.text,
      ocrLang: response.lang,
      ocrStatus: 'done'
    });
  } catch (error) {
    console.error('OCR failed for capture', captureId, error);
    await imageCaptureStorage.updateCapture(captureId, { ocrStatus: 'failed' });
  }
}
