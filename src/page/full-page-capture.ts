import { mountSidebarWithShadow } from '@/sidebar/shell';
import { showFab } from '@/page/fab-bridge';
import { t } from '@/i18n/config';

const RANGE_BAR_CSS = `
  .bar {
    position: fixed; top: 16px; left: 50%; transform: translateX(-50%);
    display: flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: center;
    max-width: calc(100vw - 32px); padding: 10px 14px; box-sizing: border-box;
    background: #FFFFFF; border: 1px solid #EBE3D3; border-radius: 12px;
    box-shadow: 0 8px 28px rgba(31,26,12,0.18); pointer-events: auto;
    font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #1F1F2E;
  }
  .bar button {
    font: inherit; font-weight: 600; padding: 6px 12px; border-radius: 8px;
    border: 1px solid #E2D6BE; background: #FBF5EA; color: #7E6332; cursor: pointer;
  }
  .bar button.primary { background: #C9A86C; border-color: #C9A86C; color: #2C2417; }
  .end-line {
    position: fixed; left: 0; right: 0; bottom: 0; height: 0;
    border-top: 3px dashed #C9A86C; pointer-events: none;
  }
  .end-line span {
    position: absolute; right: 16px; bottom: 6px; padding: 2px 8px; border-radius: 6px;
    background: #C9A86C; color: #2C2417;
    font: 600 11px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
`;

interface RangeChoice {
  endY: number | null;
}

function chooseCaptureRange(): Promise<RangeChoice | null> {
  return new Promise((resolve) => {
    const host = document.createElement('div');
    host.style.cssText = 'all: initial; position: fixed; inset: 0; z-index: 2147483647; pointer-events: none;';
    const root = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = RANGE_BAR_CSS;
    root.appendChild(style);

    const bar = document.createElement('div');
    bar.className = 'bar';
    const text = document.createElement('span');
    text.textContent = t('fullPage.instruction');
    bar.appendChild(text);
    const buttons: [string, string, boolean][] = [
      ['here', t('fullPage.here'), true],
      ['whole', t('fullPage.whole'), false],
      ['cancel', t('fullPage.cancel'), false]
    ];
    for (const [action, label, primary] of buttons) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.action = action;
      button.textContent = label;
      if (primary) button.className = 'primary';
      bar.appendChild(button);
    }
    root.appendChild(bar);

    const line = document.createElement('div');
    line.className = 'end-line';
    const lineLabel = document.createElement('span');
    lineLabel.textContent = t('fullPage.endsHere');
    line.appendChild(lineLabel);
    root.appendChild(line);

    document.documentElement.appendChild(host);

    const finish = (choice: RangeChoice | null): void => {
      document.removeEventListener('keydown', handleKeyDown, true);
      host.remove();
      resolve(choice);
    };

    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') finish(null);
    };
    document.addEventListener('keydown', handleKeyDown, true);

    bar.addEventListener('click', (e) => {
      const action = (e.target as HTMLElement).closest('button')?.dataset.action;
      if (action === 'here') finish({ endY: window.scrollY + window.innerHeight });
      if (action === 'whole') finish({ endY: null });
      if (action === 'cancel') finish(null);
    });
  });
}

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
  const choice = await chooseCaptureRange();
  if (!choice) {
    showFab();
    return;
  }

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

    const pageHeight     = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
    const totalHeight    = choice.endY === null ? pageHeight : Math.min(choice.endY, pageHeight);
    const viewportHeight = window.innerHeight;
    const viewportWidth  = window.innerWidth;
    const dpr            = window.devicePixelRatio || 1;

    const segmentRefs: SegmentRef[] = [];
    let y = 0;

    while (y < totalHeight) {
      window.scrollTo(0, Math.max(0, Math.min(y, totalHeight - viewportHeight)));
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
      fullPage: true,
      url: window.location.href,
      pageTitle: document.title,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Full page capture error:', error);
    alert(t('fullPage.failed'));
  } finally {
    restoreFixedElements(saved);
    window.scrollTo(originalScrollX, originalScrollY);
  }
}
