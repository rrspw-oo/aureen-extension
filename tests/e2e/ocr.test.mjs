import { launch, reporter, BASE } from './helpers.mjs';

const { check, finish } = reporter();
const { page, sw, send, store, errors, close } = await launch();
await page.goto(BASE + 'ocr.html'); await page.waitForTimeout(800);
const imageData = 'data:image/png;base64,' + (await page.locator('#t').screenshot()).toString('base64');
await page.goto(BASE + 'article.html'); await page.waitForTimeout(800);
await sw.evaluate(async (imageData) => {
  const capture = { id: 'cap-test-1', imageData, url: 'http://127.0.0.1:8766/article.html', tags: ['ocrtest'], note: '', createdAt: Date.now() };
  await chrome.storage.local.set({ imageCaptures: { [capture.id]: capture } });
}, imageData);
await send({ action: 'open-sidebar', data: { tab: 'images' } }); await page.waitForTimeout(1200);
const thumb = page.locator('img[alt="Screenshot"]').first();
await thumb.hover();
await page.locator('button[title="Recognize text"]').click();
check('running badge visible', await page.getByText('OCR...', { exact: true }).isVisible());
let stored;
for (let i = 0; i < 180; i++) {
  await page.waitForTimeout(500);
  stored = (await store('imageCaptures'))['cap-test-1'];
  if (stored.ocrStatus) break;
}
check('OCR finished', stored.ocrStatus === 'done', stored.ocrStatus);
check('recognized Chinese and English', stored.ocrText === 'Aureen OCR Test 12345\n離線文字辨識測試', JSON.stringify(stored.ocrText));
check('no per-word boxes stored', !('ocrWords' in stored));
await page.mouse.move(0, 0); await page.waitForTimeout(400);
check('done badge visible', await page.getByText('text', { exact: true }).isVisible());
await thumb.hover();
check('recognize button hidden after done', (await page.locator('button[title="Recognize text"]').count()) === 0);
await page.locator('button[title="View"]').click(); await page.waitForTimeout(300);
check('preview shows recognized text', await page.getByText('Recognized text').isVisible());
const contexts = await sw.evaluate(async () => (await chrome.runtime.getContexts({})).map((c) => c.contextType));
check('offscreen document used', contexts.includes('OFFSCREEN_DOCUMENT'), JSON.stringify(contexts));
finish(errors);
await close();
