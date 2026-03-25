import { mountSidebarWithShadow } from './sidebar-shadow';

interface SegmentRef {
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

async function captureAndStore(sessionId: string): Promise<void> {
  const response = await chrome.runtime.sendMessage({
    action: 'capture-screenshot',
    sessionId
  });
  if (!response || response.success !== true) {
    throw new Error(response?.error ?? 'captureVisibleTab failed');
  }
}

export async function startFullPageCapture(): Promise<void> {
  const originalScrollX = window.scrollX;
  const originalScrollY = window.scrollY;
  const saved = new Map<HTMLElement, string>();
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

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

    const segmentRefs: SegmentRef[] = [];
    let y = 0;

    while (y < totalHeight) {
      window.scrollTo(0, y);
      await waitFrame();
      await wait(600);
      const actualScrollY = window.scrollY;
      await captureAndStore(sessionId);
      segmentRefs.push({ scrollY: actualScrollY });
      if (actualScrollY === segmentRefs[segmentRefs.length - 2]?.scrollY) {
        break;
      }
      y += viewportHeight;
    }

    const stitchResponse = await chrome.runtime.sendMessage({
      action: 'stitch-segments',
      sessionId,
      segmentRefs,
      viewportWidth,
      viewportHeight,
      totalHeight,
      dpr
    });

    if (!stitchResponse || stitchResponse.success !== true) {
      throw new Error(stitchResponse?.error ?? 'Stitch failed in service worker');
    }

    const finalDataUrl = stitchResponse.dataUrl as string;

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
