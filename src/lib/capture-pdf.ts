import { jsPDF } from 'jspdf';
import { downloadFile, generateFilenameWithDate } from '@/lib/download';

const MARGIN_PX = 24;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

function safeFilename(title: string | undefined): string {
  const cleaned = (title ?? '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim();
  return (cleaned || 'aureen-capture').slice(0, 80);
}

/**
 * Save a screenshot as an A4 portrait PDF. The image is scaled to the page
 * width (minus margins); tall images are sliced into as many pages as needed.
 */
export async function saveCaptureAsPdf(imageData: string, title?: string): Promise<void> {
  const img = await loadImage(imageData);
  const doc = new jsPDF({ unit: 'px', format: 'a4', orientation: 'portrait', compress: true });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const contentW = pageW - MARGIN_PX * 2;
  const contentH = pageH - MARGIN_PX * 2;

  const scale = contentW / img.naturalWidth;
  const sliceSrcH = Math.max(1, Math.floor(contentH / scale));
  const isJpeg = imageData.startsWith('data:image/jpeg');

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  for (let y = 0, page = 0; y < img.naturalHeight; y += sliceSrcH, page++) {
    const h = Math.min(sliceSrcH, img.naturalHeight - y);
    canvas.width = img.naturalWidth;
    canvas.height = h;
    ctx.clearRect(0, 0, canvas.width, h);
    ctx.drawImage(img, 0, y, img.naturalWidth, h, 0, 0, img.naturalWidth, h);
    if (page > 0) doc.addPage();
    const slice = isJpeg ? canvas.toDataURL('image/jpeg', 0.95) : canvas.toDataURL('image/png');
    doc.addImage(slice, isJpeg ? 'JPEG' : 'PNG', MARGIN_PX, MARGIN_PX, contentW, h * scale);
  }

  downloadFile(doc.output('blob'), generateFilenameWithDate(safeFilename(title), 'pdf'), 'application/pdf');
}
