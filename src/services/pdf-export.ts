import { jsPDF } from 'jspdf';
import type { ImageCapture } from '@/types/image-capture';
import { imageCaptureStorage } from './image-capture-storage';
import { downloadFile, downloadMarkdown, generateFilenameWithDate } from '@/utils/download';

interface ImageSize {
  width: number;
  height: number;
}

function loadImageSize(dataUrl: string): Promise<ImageSize> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('Failed to load capture image'));
    img.src = dataUrl;
  });
}

function detectFormat(dataUrl: string): 'JPEG' | 'PNG' {
  return dataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
}

async function addCapturePage(doc: jsPDF, capture: ImageCapture, isFirst: boolean): Promise<void> {
  const { width: pxW, height: pxH } = await loadImageSize(capture.imageData);
  const orientation = pxW >= pxH ? 'landscape' : 'portrait';

  if (isFirst) {
    doc.deletePage(1);
  }
  doc.addPage([pxW, pxH], orientation);
  doc.addImage(capture.imageData, detectFormat(capture.imageData), 0, 0, pxW, pxH);
}

async function buildPdfBlob(captures: ImageCapture[]): Promise<Blob> {
  const doc = new jsPDF({ unit: 'px', compress: true });
  for (let i = 0; i < captures.length; i++) {
    await addCapturePage(doc, captures[i], i === 0);
  }
  return doc.output('blob');
}

function buildMarkdown(captures: ImageCapture[], title: string): string {
  let md = `# ${title}\n\n`;
  md += `Generated: ${new Date().toLocaleString()}\n\n`;
  md += `Total captures: ${captures.length}\n\n---\n\n`;

  captures.forEach((capture, index) => {
    const heading = capture.title?.trim() || `Capture ${index + 1}`;
    md += `## ${heading}\n\n`;
    if (capture.url) {
      md += `Source: ${capture.url}\n\n`;
    }
    if (capture.note?.trim()) {
      md += `Note: ${capture.note.trim()}\n\n`;
    }
    if (capture.ocrText?.trim()) {
      md += `${capture.ocrText.trim()}\n\n`;
    } else if (capture.ocrStatus === 'failed') {
      md += `_OCR failed for this capture._\n\n`;
    } else if (capture.ocrStatus !== 'done') {
      md += `_OCR not finished yet for this capture._\n\n`;
    }
    md += `---\n\n`;
  });

  return md;
}

async function exportPair(captures: ImageCapture[], baseName: string, mdTitle: string): Promise<void> {
  const ordered = [...captures].sort((a, b) => a.createdAt - b.createdAt);
  const pdfBlob = await buildPdfBlob(ordered);
  downloadFile(pdfBlob, generateFilenameWithDate(baseName, 'pdf'), 'application/pdf');
  downloadMarkdown(buildMarkdown(ordered, mdTitle), generateFilenameWithDate(baseName, 'md'));
}

export async function exportTagAsPdf(tagName: string): Promise<number> {
  const captures = await imageCaptureStorage.getCapturesByTags([tagName]);
  if (captures.length === 0) {
    throw new Error(`No captures found for tag: ${tagName}`);
  }
  await exportPair(captures, `aureen-${tagName}`, `Aureen Captures: #${tagName}`);
  return captures.length;
}

export async function exportAllCapturesAsPdf(): Promise<number> {
  const captures = await imageCaptureStorage.getAllCaptures();
  if (captures.length === 0) {
    throw new Error('No captures to export');
  }
  await exportPair(captures, 'aureen-captures', 'Aureen Captures');
  return captures.length;
}
