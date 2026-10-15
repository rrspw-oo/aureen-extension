import { createWorker, type Worker } from 'tesseract.js';

const LANG = 'chi_tra+eng';
let workerPromise: Promise<Worker> | null = null;

function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = createWorker(LANG, 1, {
      workerPath: '/tesseract/worker.min.js',
      workerBlobURL: false,
      corePath: '/tesseract/core',
      langPath: '/tesseract/lang',
      gzip: true,
      cacheMethod: 'none'
    });
  }
  return workerPromise;
}

export async function recognize(imageData: string): Promise<string> {
  const worker = await getWorker();
  const { data } = await worker.recognize(imageData);
  return data.text.trim();
}
