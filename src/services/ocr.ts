import { imageCaptureStorage } from './image-capture-storage';
import { extractPrice } from '@/utils/price';

export async function runOcrForCapture(captureId: string, imageData: string): Promise<void> {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'ocr-capture', imageData });
    if (!response?.success) {
      throw new Error(response?.error || 'OCR failed');
    }
    const capture = await imageCaptureStorage.getCaptureById(captureId);
    const found = extractPrice(response.text);
    await imageCaptureStorage.updateCapture(captureId, {
      ocrText: response.text,
      ocrLang: response.lang,
      ocrStatus: 'done',
      ...(found && capture?.price?.source !== 'manual' ? { price: { ...found, source: 'ocr' as const } } : {})
    });
  } catch (error) {
    console.error('OCR failed for capture', captureId, error);
    await imageCaptureStorage.updateCapture(captureId, { ocrStatus: 'failed' });
  }
}
