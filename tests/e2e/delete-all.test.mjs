import { launch, reporter, BASE } from './helpers.mjs';

const { check, finish } = reporter();
const { page, sw, send, errors, close } = await launch();
await page.goto(BASE + 'article.html'); await page.waitForTimeout(1000);
await sw.evaluate(async () => {
  const now = Date.now();
  await chrome.storage.local.set({
    highlights: { h1: { id: 'h1', url: 'http://127.0.0.1:8766/article.html', pageTitle: 'Article', text: 'quick brown fox', tags: ['research'], color: 'yellow', position: { xpath: '', startOffset: 0, endOffset: 0, textContent: 'quick brown fox' }, createdAt: now, updatedAt: now } },
    tags: { research: { name: 'research', color: 'yellow', highlightCount: 1, createdAt: now } },
    globalTags: ['research'],
    imageCaptures: { c1: { id: 'c1', imageData: 'data:image/png;base64,iVBORw0KGgo=', url: 'https://shop.example.com', tags: ['lamp'], note: '', createdAt: now } },
    imageTags: { lamp: { name: 'lamp', color: 'yellow', captureCount: 1, createdAt: now } },
    fabPosition: { top: 100, left: 100 }
  });
  await chrome.storage.sync.set({ settings: { defaultColor: 'mint', language: 'en' } });
});
await page.reload(); await page.waitForTimeout(1200);
const marksBefore = await page.locator('mark.highlight-mark').count();
await send({ action: 'open-sidebar' }); await page.waitForTimeout(900);
page.on('dialog', (d) => d.accept());
await page.getByRole('button', { name: 'More' }).click();
await page.getByRole('menuitem', { name: /Delete all highlights/ }).click();
await page.waitForTimeout(1200);
const local = await sw.evaluate(async () => chrome.storage.local.get(null));
const sync = await sw.evaluate(async () => chrome.storage.sync.get(null));
check('highlights deleted', !local.highlights || Object.keys(local.highlights).length === 0);
check('highlight tags deleted', (!local.tags || Object.keys(local.tags).length === 0) && (!local.globalTags || local.globalTags.length === 0));
check('screenshots kept', !!local.imageCaptures?.c1);
check('screenshot tags kept', !!local.imageTags?.lamp);
check('floating button position kept', local.fabPosition?.top === 100);
check('settings kept', sync.settings?.defaultColor === 'mint' && sync.settings?.language === 'en', JSON.stringify(sync.settings));
check('page marks removed', marksBefore > 0 && (await page.locator('mark.highlight-mark').count()) === 0, `before=${marksBefore}`);
finish(errors);
await close();
