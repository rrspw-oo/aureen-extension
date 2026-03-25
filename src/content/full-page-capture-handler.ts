import { mountSidebarWithShadow } from './sidebar-shadow';

interface Segment {
  dataUrl: string;
  scrollY: number;
}

function hideFixedElements(): Map<HTMLElement, string> {
  const saved = new Map<HTMLElement, string>();
  const all = Array.from(document.querySelectorAll<HTMLElement>('*'));
  for (const el of all) {
    const pos = getComputedStyle(el).position;
    if (pos === 'fixed' || pos === 'sticky') {
      saved.set(el, el.style.visibility);
      el.style.visibility = 'hidden';
    }
  }
  return saved;
}

function restoreFixedElements(saved: Map<HTMLElement, string>): void {
  for (const [el, original] of saved) {
    el.style.visibility = original;
  }
}

function waitFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function captureSegment(): Promise<string> {
  const response = await chrome.runtime.sendMessage({ action: 'capture-screenshot' });
  if (!response || response.success !== true) {
    throw new Error(response?.error ?? 'captureVisibleTab failed');
  }
  return response.dataUrl as string;
}

async function stitchSegments(
  segments: Segment[],
  viewportWidth: number,
  viewportHeight: number,
  totalHeight: number,
  dpr: number
): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width  = viewportWidth  * dpr;
  canvas.height = totalHeight    * dpr;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  ctx.scale(dpr, dpr);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, viewportWidth, totalHeight);

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    await new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const isClamped = seg.scrollY > 0 && seg.scrollY + viewportHeight > totalHeight;
        if (!isClamped) {
          ctx.drawImage(img, 0, seg.scrollY);
        } else {
          const lastVisibleHeight = totalHeight - seg.scrollY;
          const srcY = (viewportHeight - lastVisibleHeight) * dpr;
          const srcH = lastVisibleHeight * dpr;
          ctx.drawImage(
            img,
            0, srcY, viewportWidth * dpr, srcH,
            0, seg.scrollY, viewportWidth, lastVisibleHeight
          );
        }
        resolve();
      };
      img.onerror = () => reject(new Error(`Failed to load segment ${i}`));
      img.src = seg.dataUrl;
    });
  }

  return canvas.toDataURL('image/jpeg', 0.85);
}

export async function startFullPageCapture(): Promise<void> {
  const originalScrollX = window.scrollX;
  const originalScrollY = window.scrollY;
  const saved = new Map<HTMLElement, string>();

  try {
    const fixedSaved = hideFixedElements();
    fixedSaved.forEach((v, k) => saved.set(k, v));

    window.scrollTo(0, 0);
    await waitFrame();
    await wait(600);

    const totalHeight    = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
    const viewportHeight = window.innerHeight;
    const viewportWidth  = window.innerWidth;
    const dpr            = window.devicePixelRatio || 1;

    const segments: Segment[] = [];
    let y = 0;

    while (y < totalHeight) {
      window.scrollTo(0, y);
      await waitFrame();
      await wait(600);
      const actualScrollY = window.scrollY;
      const dataUrl = await captureSegment();
      segments.push({ dataUrl, scrollY: actualScrollY });
      if (actualScrollY === segments[segments.length - 2]?.scrollY) {
        break;
      }
      y += viewportHeight;
    }

    const finalDataUrl = await stitchSegments(segments, viewportWidth, viewportHeight, totalHeight, dpr);

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    mountSidebarWithShadow({
      mode: 'capture',
      captureId: tempId,
      imageData: finalDataUrl,
      url: window.location.href,
      pageTitle: document.title,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Full page capture error:', error);
    alert('Failed to capture full page. Please try again.');
  } finally {
    restoreFixedElements(saved);
    window.scrollTo(originalScrollX, originalScrollY);
  }
}
