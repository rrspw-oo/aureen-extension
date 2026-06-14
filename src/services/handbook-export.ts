import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import type { ImageCapture, ImageTag } from '@/types/image-capture';
import type { Highlight, Tag } from '@/types';
import { imageCaptureStorage } from './image-capture-storage';
import { storageService } from './storage';
import { downloadFile, generateFilenameWithDate } from '@/utils/download';

const PAGE_WIDTH_PX = 794;
const PAGE_HEIGHT_PX = 1123;
// Higher scale + lossless PNG keeps screenshot text crisp instead of JPEG-blurred.
const RENDER_SCALE = 3;

const ACCENT = '#C9A86C';
const INK = '#1F1F2E';
const MUTED = '#9492A8';
const RULE = '#E2E0EE';

// Show the Contents page only when it actually helps navigation. A handbook
// with a single short chapter does not need a near-empty table of contents.
const TOC_MIN_ITEMS = 4;

const UNTAGGED_KEY = '__untagged__';

// zh-TW labels, matching the wording used in the shipped handbook.
const L = {
  tocHeading: '目錄',
  source: '來源',
  note: '備註',
  untaggedChapter: '未分類',
  chapter: (n: number) => `第 ${n} 章`,
  captureFallback: (n: number) => `截圖 ${n}`,
  highlightFallback: (n: number) => `重點 ${n}`,
  ocrFailed: '此截圖的文字辨識失敗。',
  ocrPending: '此截圖的文字辨識尚未完成。',
  captureUnit: '篇截圖',
  highlightUnit: '則重點',
  handbookTitle: 'Aureen 手冊',
  highlightTitle: 'Aureen 重點'
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

interface Chapter {
  key: string;
  label: string; // e.g. "#shopping" or "未分類"
  items: HandbookItem[];
  earliest: number;
}

// A content page: one item, optionally opening a new chapter.
interface ContentPage {
  item: HandbookItem;
  chapterIndex: number;
  chapterLabel?: string; // set only on the first page of a chapter
}

export interface HandbookOptions {
  includeImage: boolean;
  tag?: string;
  title?: string;
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
          <span style="font-size:14px;font-weight:600;letter-spacing:0.02em;">Aureen</span>
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

/**
 * Contents page grouped by chapter (tag). Each chapter is a heading with its
 * items listed underneath, like a book's table of contents.
 */
function tocHtml(chapters: Chapter[], firstContentPage: number): string {
  let page = firstContentPage;
  const sections = chapters
    .map((chapter, chapterIndex) => {
      const rows = chapter.items
        .map((item) => {
          const pageLabel = String(page).padStart(2, '0');
          page += 1;
          return `
            <div style="display:flex;align-items:baseline;justify-content:space-between;padding:9px 0;border-bottom:1px solid ${RULE};">
              <div style="font-size:14px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding-right:16px;">${escapeHtml(item.heading)}</div>
              <div style="font-size:13px;color:${MUTED};">${pageLabel}</div>
            </div>
          `;
        })
        .join('');
      return `
        <div style="margin-top:${chapterIndex === 0 ? 0 : 22}px;">
          <div style="font-size:13px;font-weight:700;color:${ACCENT};letter-spacing:0.06em;">${L.chapter(chapterIndex + 1)}　${escapeHtml(chapter.label)}</div>
          <div style="margin-top:6px;">${rows}</div>
        </div>
      `;
    })
    .join('');

  const inner = `
    <div style="margin-top:40px;font-size:24px;font-weight:700;">${L.tocHeading}</div>
    <div style="margin-top:18px;flex:1;overflow:hidden;">${sections}</div>
  `;
  return pageShell(inner, 2);
}

function itemHtml(
  page: ContentPage,
  pageNumber: number,
  includeImage: boolean,
  tagColors: Map<string, string>
): string {
  const { item, chapterIndex, chapterLabel } = page;
  const chips = item.tags.length ? tagChips(item.tags, tagColors) : '';

  const chapterEyebrow = chapterLabel
    ? `<div style="font-size:13px;font-weight:600;color:${ACCENT};letter-spacing:0.08em;margin-bottom:8px;">${L.chapter(chapterIndex)}　${escapeHtml(chapterLabel)}</div>`
    : '';

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
      ${chapterEyebrow}
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

/** Group items into chapters by their primary tag, untagged last. */
function buildChapters(items: HandbookItem[]): Chapter[] {
  const map = new Map<string, HandbookItem[]>();
  const order: string[] = [];
  for (const item of items) {
    const key = item.tags[0]?.trim() || UNTAGGED_KEY;
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key)!.push(item);
  }

  const chapters: Chapter[] = order.map((key) => {
    const chapterItems = map.get(key)!.sort((a, b) => a.createdAt - b.createdAt);
    return {
      key,
      label: key === UNTAGGED_KEY ? L.untaggedChapter : `#${key}`,
      items: chapterItems,
      earliest: Math.min(...chapterItems.map((i) => i.createdAt))
    };
  });

  chapters.sort((a, b) => {
    if (a.key === UNTAGGED_KEY) return 1;
    if (b.key === UNTAGGED_KEY) return -1;
    return a.earliest - b.earliest;
  });

  return chapters;
}

function flattenChapters(chapters: Chapter[]): ContentPage[] {
  const pages: ContentPage[] = [];
  chapters.forEach((chapter, chapterIndex) => {
    chapter.items.forEach((item, itemIndex) => {
      pages.push({
        item,
        chapterIndex: chapterIndex + 1,
        chapterLabel: itemIndex === 0 ? chapter.label : undefined
      });
    });
  });
  return pages;
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
  const chapters = buildChapters(items);
  const contentPages = flattenChapters(chapters);

  // Contents page only when it carries navigational value.
  const showToc = contentPages.length >= TOC_MIN_ITEMS;
  const firstContentPage = showToc ? 3 : 2;

  const pages: string[] = [coverHtml(title, items.length, unit)];
  if (showToc) {
    pages.push(tocHtml(chapters, firstContentPage));
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

function captureToItem(capture: ImageCapture, index: number): HandbookItem {
  let bodyEmptyReason: string | undefined;
  if (!capture.ocrText?.trim()) {
    bodyEmptyReason =
      capture.ocrStatus === 'failed' ? L.ocrFailed : L.ocrPending;
  }
  return {
    heading: capture.title?.trim() || L.captureFallback(index + 1),
    tags: capture.tags,
    imageData: capture.imageData,
    note: capture.note,
    body: capture.ocrText,
    bodyEmptyReason,
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

export async function getHandbookCount(tag?: string): Promise<number> {
  const captures = tag
    ? await imageCaptureStorage.getCapturesByTags([tag])
    : await imageCaptureStorage.getAllCaptures();
  return captures.length;
}

export async function getHighlightHandbookCount(tag?: string): Promise<number> {
  const highlights = tag
    ? await storageService.getHighlightsByTags([tag])
    : Object.values(await storageService.getAllHighlights());
  return highlights.length;
}

export async function exportHandbook(options: HandbookOptions): Promise<number> {
  const [captures, tags] = await Promise.all([
    options.tag
      ? imageCaptureStorage.getCapturesByTags([options.tag])
      : imageCaptureStorage.getAllCaptures(),
    imageCaptureStorage.getAllTags()
  ]);

  if (captures.length === 0) {
    throw new Error(options.tag ? `No captures found for tag: ${options.tag}` : 'No captures to export');
  }

  const tagColors = new Map<string, string>(
    (tags as ImageTag[]).map((t) => [t.name.toLowerCase(), t.color])
  );
  const items = captures.map(captureToItem);
  const title = options.title?.trim() || (options.tag ? `${L.handbookTitle} #${options.tag}` : L.handbookTitle);

  const blob = await buildHandbookBlob(items, tagColors, options, title, L.captureUnit);
  const baseName = options.tag ? `aureen-handbook-${options.tag}` : 'aureen-handbook';
  downloadFile(blob, generateFilenameWithDate(baseName, 'pdf'), 'application/pdf');
  return items.length;
}

export async function exportHighlightHandbook(options: HandbookOptions): Promise<number> {
  const [highlights, tags] = await Promise.all([
    options.tag
      ? storageService.getHighlightsByTags([options.tag])
      : storageService.getAllHighlights().then((h) => Object.values(h)),
    storageService.getAllTags()
  ]);

  if (highlights.length === 0) {
    throw new Error(options.tag ? `No highlights found for tag: ${options.tag}` : 'No highlights to export');
  }

  const tagColors = new Map<string, string>(
    Object.values(tags as Record<string, Tag>).map((t) => [t.name.toLowerCase(), t.color])
  );
  const items = highlights.map(highlightToItem);
  const title = options.title?.trim() || (options.tag ? `${L.highlightTitle} #${options.tag}` : L.highlightTitle);

  const blob = await buildHandbookBlob(items, tagColors, options, title, L.highlightUnit);
  const baseName = options.tag ? `aureen-highlights-${options.tag}` : 'aureen-highlights';
  downloadFile(blob, generateFilenameWithDate(baseName, 'pdf'), 'application/pdf');
  return items.length;
}
