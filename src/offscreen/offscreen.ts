import { createWorker, type Worker } from 'tesseract.js';

const DEFAULT_LANG = 'chi_tra+eng';

let workerPromise: Promise<Worker> | null = null;

function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker(DEFAULT_LANG, 1, {
      workerPath: chrome.runtime.getURL('tesseract/worker.min.js'),
      workerBlobURL: false,
      corePath: chrome.runtime.getURL('tesseract/core'),
      langPath: chrome.runtime.getURL('tesseract/lang'),
      gzip: true,
      cacheMethod: 'none'
    });
  }
  return workerPromise;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.target !== 'offscreen' || message.action !== 'ocr-recognize') {
    return false;
  }

  getWorker()
    .then((worker) => worker.recognize(message.imageData))
    .then(({ data }) => sendResponse({ success: true, text: data.text.trim(), lang: DEFAULT_LANG }))
    .catch((error) => sendResponse({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }));

  return true;
});
