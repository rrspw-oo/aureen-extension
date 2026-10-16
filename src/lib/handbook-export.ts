import { t } from '@/i18n/config';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import type { ImageCapture, ImageTag } from '@/types/image-capture';
import type { Highlight, Tag } from '@/types/highlight';
import { imageCaptureStorage } from '@/lib/capture-store';
import { storageService } from '@/lib/highlight-store';
import { downloadFile, generateFilenameWithDate } from '@/lib/download';
import { sourceHost } from '@/lib/url';

const PAGE_WIDTH_PX = 794;
const PAGE_HEIGHT_PX = 1123;
// scale 2 keeps text crisp; scale 3 rendered 2.25x the pixels per page for no
// visible gain and dominated screenshot export time.
const RENDER_SCALE = 2;

// A source screenshot only ever displays inside the page column, capped at
// max-height:680px. Downscaling the bitmap to that footprint (times RENDER_SCALE
// for retina crispness) once, before html2canvas re-rasterizes it on every page,
// is the single biggest win for screenshot-heavy handbooks.
const MAX_IMAGE_WIDTH = (PAGE_WIDTH_PX - 112) * RENDER_SCALE;
const MAX_IMAGE_HEIGHT = 680 * RENDER_SCALE;

const ACCENT = '#C9A86C';
const INK = '#1F1F2E';
const MUTED = '#9492A8';
const RULE = '#E2E0EE';

// Show the Contents page only when it actually helps navigation. A handbook
// with a single short chapter does not need a near-empty table of contents.
const TOC_MIN_ITEMS = 4;

// zh-TW labels, matching the wording used in the shipped handbook.
const L = {
  get tocHeading() { return t('handbook.toc'); },
  get source() { return t('handbook.source'); },
  get note() { return t('handbook.note'); },
  captureFallback: (n: number) => t('handbook.captureFallback', { n }),
  highlightFallback: (n: number) => t('handbook.highlightFallback', { n }),
  get ocrFailed() { return t('handbook.ocrFailed'); },
  get ocrPending() { return t('handbook.ocrPending'); },
  captureUnit: (count: number) => t('handbook.captureUnit', { count }),
  highlightUnit: (count: number) => t('handbook.highlightUnit', { count }),
  get handbookTitle() { return t('handbook.handbookTitle'); },
  get highlightTitle() { return t('handbook.highlightTitle'); }
};

const TAG_HEX: Record<string, string> = {
  yellow: '#DDDDEF',
  mint: '#d1fae5',
  coral: '#fed7d7',
  peach: '#fde68a',
  lavender: '#e9d5ff',
  sky: '#dbeafe'
};

interface HandbookItem {
  heading: string;
  tags: string[];
  imageData?: string;
  note?: string;
  body?: string;
  bodyEmptyReason?: string;
  source?: string;
  createdAt: number;
}

interface ContentPage {
  item: HandbookItem;
}

export interface HandbookOptions {
  includeImage: boolean;
  // Selected tag names to export. Empty or undefined exports everything.
  // Semantics are OR: an item is included if it carries ANY selected tag.
  tags?: string[];
  // Explicit item ids to export, in addition to tag filtering; when set, only these are exported.
  ids?: string[];
  // User-chosen name: used for the cover, the running page header and the file name.
  title?: string;
}

// Label shown in the running header of every page; the user's title when given.
let headerLabel = 'Aureen';

function pickItems<T extends { id: string; tags: string[] }>(all: T[], options: Pick<HandbookOptions, 'tags' | 'ids'>): T[] {
  if (options.ids && options.ids.length > 0) {
    const wanted = new Set(options.ids);
    return all.filter((item) => wanted.has(item.id));
  }
  return all.filter((item) => matchesSelectedTags(item.tags, options.tags ?? []));
}

function fileBaseName(title: string | undefined, fallback: string): string {
  const cleaned = (title ?? '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '')
    .trim()
    .slice(0, 80);
  return cleaned || fallback;
}

/** True when the item carries at least one of the selected tags (OR match). */
function matchesSelectedTags(itemTags: string[], selected: string[]): boolean {
  if (selected.length === 0) return true;
  const lower = new Set(selected.map((t) => t.toLowerCase()));
  return itemTags.some((t) => lower.has(t.toLowerCase()));
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function tagColor(tagName: string, tagColors: Map<string, string>): string {
  return TAG_HEX[tagColors.get(tagName.toLowerCase()) || ''] || RULE;
}

function tagChips(tags: string[], tagColors: Map<string, string>): string {
  return tags
    .map((tag) => {
      const bg = tagColor(tag, tagColors);
      return `<span style="display:inline-block;background:${bg};color:${INK};font-size:13px;padding:3px 10px;border-radius:999px;margin:0 6px 6px 0;">#${escapeHtml(tag)}</span>`;
    })
    .join('');
}

function sourceLabel(url: string): string {
  if (!url) return '';
  if (!/^https?:/.test(url)) return sourceHost(url);
  return url.replace(/^https?:\/\//, '').split(/[?#]/)[0].slice(0, 80);
}

/** True when the item carries real readable content (text or image). */
function itemHasBody(item: HandbookItem): boolean {
  return Boolean(item.body?.trim());
}

/**
 * Decide whether to render the image for an item. We always show the image when
 * there is no body text, so a page is never reduced to a lone "recognition
 * failed" note — every page must carry meaning.
 */
function shouldShowImage(item: HandbookItem, includeImage: boolean): boolean {
  if (!item.imageData) return false;
  return includeImage || !itemHasBody(item);
}

function pageShell(inner: string, pageNumber: number): string {
  return `
    <div style="width:${PAGE_WIDTH_PX}px;height:${PAGE_HEIGHT_PX}px;box-sizing:border-box;padding:56px 56px 48px;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans TC','PingFang TC','Microsoft JhengHei',sans-serif;color:${INK};display:flex;flex-direction:column;">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="width:9px;height:9px;border-radius:50%;background:${ACCENT};display:inline-block;"></span>
          <span style="font-size:14px;font-weight:600;letter-spacing:0.02em;">${escapeHtml(headerLabel)}</span>
        </div>
        <span style="font-size:13px;color:${MUTED};">${String(pageNumber).padStart(2, '0')}</span>
      </div>
      ${inner}
    </div>
  `;
}

function coverHtml(title: string, count: number, unit: string): string {
  const inner = `
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;">
      <div style="width:48px;height:4px;background:${ACCENT};margin-bottom:28px;"></div>
      <div style="font-size:46px;font-weight:700;line-height:1.2;">${escapeHtml(title)}</div>
      <div style="font-size:16px;color:${MUTED};margin-top:20px;">${formatDate(Date.now())}</div>
      <div style="font-size:16px;color:${MUTED};margin-top:6px;">${count} ${unit}</div>
    </div>
  `;
  return pageShell(inner, 1);
}

/** Flat contents page: one row per item, in the order they appear. */
function tocHtml(contentPages: ContentPage[], firstContentPage: number): string {
  const rows = contentPages
    .map((page, index) => {
      const pageLabel = String(firstContentPage + index).padStart(2, '0');
      return `
        <div style="display:flex;align-items:baseline;justify-content:space-between;padding:9px 0;border-bottom:1px solid ${RULE};">
          <div style="font-size:14px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding-right:16px;">${escapeHtml(page.item.heading)}</div>
          <div style="font-size:13px;color:${MUTED};">${pageLabel}</div>
        </div>
      `;
    })
    .join('');

  const inner = `
    <div style="margin-top:40px;font-size:24px;font-weight:700;">${L.tocHeading}</div>
    <div style="margin-top:18px;flex:1;overflow:hidden;">${rows}</div>
  `;
  return pageShell(inner, 2);
}

function itemHtml(
  page: ContentPage,
  pageNumber: number,
  includeImage: boolean,
  tagColors: Map<string, string>
): string {
  const { item } = page;
  const chips = item.tags.length ? tagChips(item.tags, tagColors) : '';

  const showImage = shouldShowImage(item, includeImage);
  const imageBlock = showImage
    ? `<div style="margin-top:18px;border:1px solid ${RULE};border-radius:10px;overflow:hidden;text-align:center;background:#fafafb;">
         <img src="${item.imageData}" style="max-width:100%;max-height:680px;display:inline-block;image-rendering:auto;" />
       </div>`
    : '';

  const noteBlock = item.note?.trim()
    ? `<div style="margin-top:20px;font-size:14px;line-height:1.7;color:${INK};">
         <span style="color:${ACCENT};font-weight:600;">${L.note}</span>　${escapeHtml(item.note.trim())}
       </div>`
    : '';

  let textBlock = '';
  if (item.body?.trim()) {
    textBlock = `<div style="margin-top:18px;font-size:14px;line-height:1.85;color:#3a3a4a;white-space:pre-wrap;">${escapeHtml(item.body.trim())}</div>`;
  } else if (!showImage && item.bodyEmptyReason) {
    // Only reachable when there is genuinely nothing else to show.
    textBlock = `<div style="margin-top:18px;font-size:14px;color:${MUTED};font-style:italic;">${item.bodyEmptyReason}</div>`;
  }

  const sourceBlock = item.source
    ? `<div style="margin-top:auto;padding-top:20px;font-size:12px;color:${MUTED};">${L.source}　${escapeHtml(item.source)}</div>`
    : '';

  const inner = `
    <div style="margin-top:34px;flex:1;display:flex;flex-direction:column;overflow:hidden;">
      <div style="font-size:24px;font-weight:700;line-height:1.3;">${escapeHtml(item.heading)}</div>
      ${chips ? `<div style="margin-top:12px;">${chips}</div>` : ''}
      <div style="height:1px;background:${RULE};margin-top:16px;"></div>
      ${imageBlock}
      ${noteBlock}
      ${textBlock}
      ${sourceBlock}
    </div>
  `;
  return pageShell(inner, pageNumber);
}

/**
 * Collect items into a single time-ordered sequence. Every item appears exactly
 * ONCE regardless of how many tags it carries; its full tag set is shown as
 * chips on its own page. There is no per-tag chapter duplication.
 */
function buildContentPages(items: HandbookItem[]): ContentPage[] {
  return items
    .slice()
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((item) => ({ item }));
}

function addTextPage(
  doc: jsPDF,
  page: ContentPage,
  pageNumber: number
): void {
  const { item } = page;
  const left = 56;
  const right = PAGE_WIDTH_PX - 56;
  const maxWidth = right - left;
  let y = 68;

  doc.setFillColor(201, 168, 108);
  doc.circle(left + 4, y - 4, 4, 'F');
  doc.setTextColor(31, 31, 46);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(headerLabel, left + 18, y);
  doc.setTextColor(148, 146, 168);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'normal');
  doc.text(String(pageNumber).padStart(2, '0'), right, y, { align: 'right' });

  y = 130;

  doc.setTextColor(31, 31, 46);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  const heading = doc.splitTextToSize(item.heading, maxWidth) as string[];
  doc.text(heading, left, y);
  y += heading.length * 31 + 12;

  if (item.tags.length) {
    doc.setFontSize(13);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(31, 31, 46);
    const tags = item.tags.map((tag) => `#${tag}`).join('  ');
    doc.text(tags, left, y);
    y += 24;
  }

  doc.setDrawColor(226, 224, 238);
  doc.line(left, y, right, y);
  y += 30;

  doc.setTextColor(58, 58, 74);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  const body = doc.splitTextToSize(item.body?.trim() || item.note?.trim() || '', maxWidth) as string[];
  doc.text(body, left, y, { lineHeightFactor: 1.85 });
  y += body.length * 26 + 24;

  if (item.note?.trim() && item.body?.trim()) {
    doc.setTextColor(31, 31, 46);
    const note = doc.splitTextToSize(`${L.note}  ${item.note.trim()}`, maxWidth) as string[];
    doc.text(note, left, y, { lineHeightFactor: 1.7 });
    y += note.length * 24 + 20;
  }

  if (item.source) {
    doc.setTextColor(148, 146, 168);
    doc.setFontSize(12);
    doc.text(`${L.source}  ${item.source}`, left, PAGE_HEIGHT_PX - 52);
  }
}

function buildTextHandbookBlob(
  items: HandbookItem[],
  title: string,
  unit: string
): Blob {
  const contentPages = buildContentPages(items);
  const showToc = contentPages.length >= TOC_MIN_ITEMS;
  const firstContentPage = showToc ? 3 : 2;
  const doc = new jsPDF({ unit: 'px', format: [PAGE_WIDTH_PX, PAGE_HEIGHT_PX], compress: true });

  doc.setTextColor(31, 31, 46);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(46);
  doc.text(title, 56, 520, { maxWidth: PAGE_WIDTH_PX - 112 });
  doc.setTextColor(148, 146, 168);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(16);
  doc.text(formatDate(Date.now()), 56, 570);
  doc.text(`${items.length} ${unit}`, 56, 598);

  if (showToc) {
    doc.addPage([PAGE_WIDTH_PX, PAGE_HEIGHT_PX], 'portrait');
    doc.setTextColor(31, 31, 46);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    doc.text(L.tocHeading, 56, 110);
    let y = 150;
    doc.setFontSize(14);
    contentPages.forEach((page, index) => {
      doc.setTextColor(31, 31, 46);
      const lines = doc.splitTextToSize(page.item.heading, PAGE_WIDTH_PX - 160) as string[];
      doc.text(lines[0], 72, y);
      doc.setTextColor(148, 146, 168);
      doc.text(String(firstContentPage + index).padStart(2, '0'), PAGE_WIDTH_PX - 56, y, { align: 'right' });
      y += 24;
    });
  }

  contentPages.forEach((page, index) => {
    doc.addPage([PAGE_WIDTH_PX, PAGE_HEIGHT_PX], 'portrait');
    addTextPage(doc, page, firstContentPage + index);
  });
  return doc.output('blob');
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Shrink an oversized source screenshot to the footprint it actually renders at.
 * Returns the original data URL unchanged when it already fits. JPEG at 0.9
 * keeps photographic screenshots small; the page still rasterizes to PNG.
 */
async function downscaleImage(dataUrl: string): Promise<string> {
  const img = await loadImage(dataUrl);
  const ratio = Math.min(
    1,
    MAX_IMAGE_WIDTH / img.naturalWidth,
    MAX_IMAGE_HEIGHT / img.naturalHeight
  );
  if (ratio >= 1) return dataUrl;

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * ratio);
  canvas.height = Math.round(img.naturalHeight * ratio);
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.9);
}

async function downscaleItems(items: HandbookItem[]): Promise<void> {
  await Promise.all(
    items.map(async (item) => {
      if (item.imageData) {
        item.imageData = await downscaleImage(item.imageData);
      }
    })
  );
}

async function rasterize(html: string): Promise<string> {
  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-10000px';
  host.style.top = '0';
  host.style.width = `${PAGE_WIDTH_PX}px`;
  host.innerHTML = html;
  document.body.appendChild(host);

  try {
    const canvas = await html2canvas(host.firstElementChild as HTMLElement, {
      scale: RENDER_SCALE,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
      width: PAGE_WIDTH_PX,
      height: PAGE_HEIGHT_PX
    });
    // Lossless PNG keeps text edges sharp; jsPDF `compress` deflates it.
    return canvas.toDataURL('image/png');
  } finally {
    document.body.removeChild(host);
  }
}

async function buildHandbookBlob(
  items: HandbookItem[],
  tagColors: Map<string, string>,
  options: HandbookOptions,
  title: string,
  unit: string
): Promise<Blob> {
  const contentPages = buildContentPages(items);

  // Contents page only when it carries navigational value.
  const showToc = contentPages.length >= TOC_MIN_ITEMS;
  const firstContentPage = showToc ? 3 : 2;

  const pages: string[] = [coverHtml(title, items.length, unit)];
  if (showToc) {
    pages.push(tocHtml(contentPages, firstContentPage));
  }
  contentPages.forEach((page, index) => {
    pages.push(itemHtml(page, firstContentPage + index, options.includeImage, tagColors));
  });

  const doc = new jsPDF({ unit: 'px', format: [PAGE_WIDTH_PX, PAGE_HEIGHT_PX], compress: true });
  for (let i = 0; i < pages.length; i++) {
    const dataUrl = await rasterize(pages[i]);
    if (i > 0) {
      doc.addPage([PAGE_WIDTH_PX, PAGE_HEIGHT_PX], 'portrait');
    }
    doc.addImage(dataUrl, 'PNG', 0, 0, PAGE_WIDTH_PX, PAGE_HEIGHT_PX);
  }
  return doc.output('blob');
}

function hasRenderableImages(items: HandbookItem[], includeImage: boolean): boolean {
  return items.some((item) => shouldShowImage(item, includeImage));
}

function captureToItem(capture: ImageCapture, index: number): HandbookItem {
  // OCR is disabled — captures are presented as their original screenshot
  // (plus title/tags/note), with no recognised-text body.
  return {
    heading: capture.title?.trim() || L.captureFallback(index + 1),
    tags: capture.tags,
    imageData: capture.imageData,
    note: capture.note,
    source: sourceLabel(capture.url),
    createdAt: capture.createdAt
  };
}

function highlightToItem(highlight: Highlight, index: number): HandbookItem {
  return {
    heading: highlight.title?.trim() || highlight.pageTitle || L.highlightFallback(index + 1),
    tags: highlight.tags,
    note: highlight.note,
    body: highlight.text,
    source: sourceLabel(highlight.url),
    createdAt: highlight.createdAt
  };
}

function tagScopeLabel(tags?: string[]): string {
  if (!tags || tags.length === 0) return '';
  return tags.map((t) => `#${t}`).join(' ');
}

function tagScopeSlug(tags?: string[]): string {
  if (!tags || tags.length === 0) return '';
  return tags.join('-');
}

export async function getHandbookCount(tags?: string[], ids?: string[]): Promise<number> {
  if (ids && ids.length > 0) return pickItems(await imageCaptureStorage.getAllCaptures(), { ids }).length;
  const captures = await imageCaptureStorage.getAllCaptures();
  const selected = tags ?? [];
  return captures.filter((c) => matchesSelectedTags(c.tags, selected)).length;
}

export async function getHighlightHandbookCount(tags?: string[]): Promise<number> {
  const highlights = Object.values(await storageService.getAllHighlights());
  const selected = tags ?? [];
  return highlights.filter((h) => matchesSelectedTags(h.tags, selected)).length;
}

export async function exportHandbook(options: HandbookOptions): Promise<number> {
  const [allCaptures, tags] = await Promise.all([
    imageCaptureStorage.getAllCaptures(),
    imageCaptureStorage.getAllTags()
  ]);

  const selected = options.tags ?? [];
  const captures = pickItems(allCaptures, options);

  if (captures.length === 0) {
    throw new Error(selected.length ? 'No captures found for the selected tags' : 'No captures to export');
  }

  const tagColors = new Map<string, string>(
    (tags as ImageTag[]).map((t) => [t.name.toLowerCase(), t.color])
  );
  const items = captures.map(captureToItem);
  const scopeLabel = tagScopeLabel(selected);
  const title = options.title?.trim() || (scopeLabel ? `${L.handbookTitle} ${scopeLabel}` : L.handbookTitle);

  headerLabel = options.title?.trim() || 'Aureen';
  let blob: Blob;
  if (hasRenderableImages(items, options.includeImage)) {
    await downscaleItems(items);
    blob = await buildHandbookBlob(items, tagColors, options, title, L.captureUnit(items.length));
  } else {
    blob = buildTextHandbookBlob(items, title, L.captureUnit(items.length));
  }
  const slug = tagScopeSlug(selected);
  const baseName = fileBaseName(options.title, slug ? `aureen-handbook-${slug}` : 'aureen-handbook');
  downloadFile(blob, generateFilenameWithDate(baseName, 'pdf'), 'application/pdf');
  return items.length;
}

export async function exportHighlightHandbook(options: HandbookOptions): Promise<number> {
  const [allHighlights, tags] = await Promise.all([
    storageService.getAllHighlights().then((h) => Object.values(h)),
    storageService.getAllTags()
  ]);

  const selected = options.tags ?? [];
  const highlights = pickItems(allHighlights, options);

  if (highlights.length === 0) {
    throw new Error(selected.length ? 'No highlights found for the selected tags' : 'No highlights to export');
  }

  const tagColors = new Map<string, string>(
    Object.values(tags as Record<string, Tag>).map((t) => [t.name.toLowerCase(), t.color])
  );
  const items = highlights.map(highlightToItem);
  const scopeLabel = tagScopeLabel(selected);
  const title = options.title?.trim() || (scopeLabel ? `${L.highlightTitle} ${scopeLabel}` : L.highlightTitle);

  const highlightOptions: HandbookOptions = { ...options, includeImage: false };
  headerLabel = options.title?.trim() || 'Aureen';
  const blob = hasRenderableImages(items, highlightOptions.includeImage)
    ? await buildHandbookBlob(items, tagColors, highlightOptions, title, L.highlightUnit(items.length))
    : buildTextHandbookBlob(items, title, L.highlightUnit(items.length));
  const slug = tagScopeSlug(selected);
  const baseName = fileBaseName(options.title, slug ? `aureen-highlights-${slug}` : 'aureen-highlights');
  downloadFile(blob, generateFilenameWithDate(baseName, 'pdf'), 'application/pdf');
  return items.length;
}
