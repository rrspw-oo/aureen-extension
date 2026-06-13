import { createWorker, type Worker } from 'tesseract.js';
import type { OcrResult, OcrWord } from '@/types/image-capture';
import { imageCaptureStorage } from './image-capture-storage';

const DEFAULT_LANG = 'chi_tra+eng';

function localUrl(path: string): string {
  return chrome.runtime.getURL(path);
}

let workerPromise: Promise<Worker> | null = null;
let workerLang = '';

async function getWorker(lang: string): Promise<Worker> {
  if (workerPromise && workerLang === lang) {
    return workerPromise;
  }

  if (workerPromise) {
    const old = await workerPromise;
    await old.terminate();
    workerPromise = null;
  }

  workerLang = lang;
  workerPromise = createWorker(lang, 1, {
    workerPath: localUrl('tesseract/worker.min.js'),
    workerBlobURL: false,
    corePath: localUrl('tesseract/core'),
    langPath: localUrl('tesseract/lang'),
    gzip: true,
    cacheMethod: 'none'
  });

  return workerPromise;
}

export async function recognizeImage(
  imageData: string,
  lang: string = DEFAULT_LANG
): Promise<OcrResult> {
  const worker = await getWorker(lang);
  const { data } = await worker.recognize(imageData, {}, { blocks: true });

  const words: OcrWord[] = [];
  const blocks = data.blocks ?? [];
  for (const block of blocks) {
    for (const paragraph of block.paragraphs ?? []) {
      for (const line of paragraph.lines ?? []) {
        for (const word of line.words ?? []) {
          words.push({
            text: word.text,
            bbox: word.bbox,
            confidence: word.confidence
          });
        }
      }
    }
  }

  return {
    text: data.text.trim(),
    words,
    lang
  };
}

export async function runOcrForCapture(
  captureId: string,
  imageData: string,
  lang: string = DEFAULT_LANG
): Promise<void> {
  await imageCaptureStorage.updateCapture(captureId, { ocrStatus: 'processing' });
  try {
    const result = await recognizeImage(imageData, lang);
    await imageCaptureStorage.updateCapture(captureId, {
      ocrText: result.text,
      ocrWords: result.words,
      ocrLang: result.lang,
      ocrStatus: 'done'
    });
  } catch (error) {
    console.error('OCR failed for capture', captureId, error);
    await imageCaptureStorage.updateCapture(captureId, { ocrStatus: 'failed' });
  }
}

export async function terminateOcr(): Promise<void> {
  if (workerPromise) {
    const worker = await workerPromise;
    await worker.terminate();
    workerPromise = null;
    workerLang = '';
  }
}
