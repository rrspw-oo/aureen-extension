import { launch, reporter, BASE, selectText } from './helpers.mjs';

const { check, finish } = reporter();
const { page, sw, store, errors, close } = await launch();
const ARTICLE = BASE + 'article.html';
await page.goto(ARTICLE); await page.waitForTimeout(1200);
const marksById = () => page.evaluate(() => {
  const out = {};
  for (const m of document.querySelectorAll('mark.highlight-mark')) out[m.dataset.highlightId] = (out[m.dataset.highlightId] || '') + m.textContent;
  return out;
});
const byText = (m, t) => Object.values(m).includes(t);
async function highlightAndSave(selector, start, end) {
  await selectText(page, selector, start, end);
  await page.locator('#highlight-btn').click(); await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'Save highlight' }).click(); await page.waitForTimeout(800);
}

await highlightAndSave('#p1', 4, 19);
await highlightAndSave('#p2', 7, 30);
let m = await marksById();
check('cross-element selection marks the full text on creation', byText(m, 'paragraph with bold wor'), JSON.stringify(m));
await page.reload(); await page.waitForTimeout(2000);
m = await marksById();
check('highlights restored after reload', byText(m, 'quick brown fox') && byText(m, 'paragraph with bold wor') && Object.keys(m).length === 2, JSON.stringify(m));
await page.goto(ARTICLE + '?utm_source=news&utm_medium=x#section'); await page.waitForTimeout(2000);
check('restored on URL with utm params and hash', Object.keys(await marksById()).length === 2);

await page.route(ARTICLE, async (route) => {
  const res = await route.fetch(); let body = await res.text();
  body = body.replace('<body style="font:20px sans-serif;padding:40px">', '<body style="font:20px sans-serif;padding:40px"><div class="ad"><p>Sponsored banner</p><p>Another ad</p></div>');
  body = body.replace('The quick brown fox', 'The <i>quick</i> brown fox');
  await route.fulfill({ response: res, body });
});
await page.goto(ARTICLE); await page.waitForTimeout(2000);
m = await marksById();
check('restored via text fallback after page structure changed', byText(m, 'quick brown fox') && byText(m, 'paragraph with bold wor'), JSON.stringify(m));
await page.unroute(ARTICLE);

await sw.evaluate(async (url) => {
  const hs = (await chrome.storage.local.get('highlights')).highlights;
  hs.legacy_ok = { id: 'legacy_ok', url, pageTitle: 'Article', text: 'river bank', tags: ['untagged'], color: 'yellow', position: { xpath: '//html[1]/body[1]/p[1]/text()[1]', startOffset: 52, endOffset: 62, textContent: 'river bank' }, createdAt: 1, updatedAt: 1 };
  hs.legacy_stale = { id: 'legacy_stale', url, pageTitle: 'Article', text: 'inside the sentence', tags: ['untagged'], color: 'yellow', position: { xpath: '//html[1]/body[1]/div[9]/text()[1]', startOffset: 0, endOffset: 5, textContent: 'x' }, createdAt: 2, updatedAt: 2 };
  await chrome.storage.local.set({ highlights: hs });
}, ARTICLE);
await page.goto(ARTICLE); await page.waitForTimeout(2000);
m = await marksById();
check('legacy single-node highlight restores by position', m.legacy_ok === 'river bank');
check('legacy stale highlight restores by text fallback', m.legacy_stale === 'inside the sentence');
check('no overlap corruption: all 4 present', Object.keys(m).length === 4, JSON.stringify(m));

await sw.evaluate(async () => { const hs = (await chrome.storage.local.get('highlights')).highlights; delete hs.legacy_ok; await chrome.storage.local.set({ highlights: hs }); });
await page.waitForTimeout(1500);
m = await marksById();
check('deleting a highlight removes its mark without reload', !m.legacy_ok && Object.keys(m).length === 3);
check('page text intact after unwrap', (await page.locator('#p1').innerText()) === 'The quick brown fox jumps over the lazy dog near the river bank.');

await selectText(page, '#p3', 0, 6);
await page.locator('#highlight-btn').click(); await page.waitForTimeout(800);
const storedNow = await store('highlights');
const tempIds = Object.keys(await marksById()).filter((k) => !(k in storedNow));
await sw.evaluate(async () => chrome.storage.local.set({ unrelatedKey: Date.now() }));
await page.waitForTimeout(1500);
m = await marksById();
check('unsaved temp highlight survives storage change', tempIds.length === 1 && m[tempIds[0]] === 'Footer');
await page.getByRole('button', { name: 'Save highlight' }).click(); await page.waitForTimeout(1000);

await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(300);
await page.locator('article[data-highlight-id]').filter({ hasText: 'Footer' }).first().getByRole('button', { name: 'Show on page' }).click();
await page.waitForTimeout(1200);
const scrollY = await page.evaluate(() => window.scrollY);
const markTop = await page.evaluate(() => document.querySelector('#p3 mark').getBoundingClientRect().top);
check('Show on page scrolls to the highlight', scrollY > 1500 && markTop > 0 && markTop < 800, `scrollY=${scrollY} markTop=${markTop}`);
finish(errors);
await close();
