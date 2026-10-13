import { launch, reporter, BASE, selectText, sidebarVisible, fabVisible, fabButton } from './helpers.mjs';

const { check, finish } = reporter();
const { page, sw, send, store, errors, close } = await launch();
await page.goto(BASE + 'article.html');
await page.waitForTimeout(1200);
const tagChips = () => page.locator('span:has(> button[aria-label^="Remove tag"])').allInnerTexts().then((a) => a.map((t) => t.trim()));

await selectText(page, '#p1', 4, 19);
check('toolbar shows 4 color dots', (await page.locator('#highlight-toolbar button[data-color]').count()) === 4);
await page.locator('#highlight-toolbar button[data-color="mint"]').click();
await page.waitForTimeout(900);
check('color dot opens New highlight sheet', await page.getByRole('dialog', { name: 'New highlight' }).isVisible());
const tagBox = page.locator('input[aria-label="Tag input"]');
await tagBox.click();
await page.keyboard.insertText('研究，筆記');
await page.waitForTimeout(150);
check('full-width comma splits tags', JSON.stringify(await tagChips()) === JSON.stringify(['#研究']));
await tagBox.evaluate((el) => el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true })));
await page.keyboard.press('Enter'); await page.waitForTimeout(150);
await page.keyboard.press('Enter'); await page.waitForTimeout(150);
check('Enter adds chips and never saves', JSON.stringify(await tagChips()) === JSON.stringify(['#研究', '#筆記']) && await page.getByRole('dialog', { name: 'New highlight' }).isVisible());
await page.keyboard.insertText('pending');
await page.getByRole('button', { name: 'Save highlight' }).click();
await page.waitForTimeout(900);
let hs = await store('highlights');
const first = Object.values(hs || {})[0];
check('Save stores color and pending tag', first && first.color === 'mint' && JSON.stringify(first.tags) === JSON.stringify(['研究', '筆記', 'pending']), JSON.stringify(first && { color: first.color, tags: first.tags }));
check('mark uses mint style', (await page.locator('mark.highlight-mark.mint').count()) > 0);
check('sheet closed after save', !(await page.getByRole('dialog', { name: 'New highlight' }).isVisible().catch(() => false)));

await selectText(page, '#p2', 7, 30);
const mintRing = await page.locator('#highlight-toolbar button[data-color="mint"]').evaluate((el) => el.style.border);
check('last color becomes default', mintRing.includes('solid') && !mintRing.includes('transparent'), mintRing);
await page.locator('#highlight-toolbar button[aria-label="Highlight and add a note"]').click();
await page.waitForTimeout(900);
const focusedId = await page.evaluate(() => document.getElementById('text-highlighter-sidebar-shadow').shadowRoot.activeElement?.id);
check('note button focuses Note field', focusedId === 'hl-note', focusedId);
await page.keyboard.type('A note');
await page.keyboard.press('Meta+Enter');
await page.waitForTimeout(900);
hs = await store('highlights');
check('Cmd+Enter saves with note', Object.values(hs).some((h) => h.note === 'A note'));

await selectText(page, '#p3', 0, 6);
await page.locator('#highlight-btn').click(); await page.waitForTimeout(900);
const tempMarks = await page.locator('mark.highlight-mark').count();
await page.keyboard.press('Escape'); await page.waitForTimeout(500);
check('Esc discards new highlight and its mark', !(await page.getByRole('dialog', { name: 'New highlight' }).isVisible().catch(() => false)) && (await page.locator('mark.highlight-mark').count()) === tempMarks - 1);

await sw.evaluate(async () => {
  const hs = (await chrome.storage.local.get('highlights')).highlights;
  hs.other1 = { id: 'other1', url: 'https://other.example.org/post', pageTitle: 'Other post', text: 'An unrelated quote about cooking', tags: ['food'], color: 'yellow', position: { xpath: '', startOffset: 0, endOffset: 0, textContent: '' }, createdAt: Date.now() + 1000, updatedAt: Date.now() };
  await chrome.storage.local.set({ highlights: hs });
});
await page.waitForTimeout(800);
const groupTitles = await page.locator('section > div .truncate.font-semibold').allInnerTexts();
check('current page group first', groupTitles[0] === 'Article', JSON.stringify(groupTitles));
await page.getByRole('searchbox', { name: 'Search text, notes, titles' }).fill('cooking');
await page.waitForTimeout(200);
check('search filters highlights', (await page.locator('article[data-highlight-id]').count()) === 1);
await page.getByRole('searchbox', { name: 'Search text, notes, titles' }).fill('');
await page.getByRole('button', { name: /^food/ }).click(); await page.waitForTimeout(200);
check('tag chip filters highlights', (await page.locator('article[data-highlight-id]').count()) === 1);
await page.getByRole('button', { name: /^All/ }).click();
const counts = await page.getByRole('tab').allInnerTexts();
check('segmented tabs show counts', counts[0].includes('3') && counts[1].includes('0'), JSON.stringify(counts));

await page.getByRole('button', { name: 'Close' }).first().click(); await page.waitForTimeout(300);
check('Close hides sidebar and leaves floating button', !(await sidebarVisible(page)) && await fabVisible(page));
await fabButton(page).click(); await page.waitForTimeout(300);
const rows = await page.getByRole('menuitem').allInnerTexts();
check('floating menu has labelled rows', rows.length === 4 && rows[0].startsWith('Open library') && rows[3].includes('Hide'), JSON.stringify(rows));
await page.getByRole('menuitem', { name: 'Hide' }).click(); await page.waitForTimeout(300);
check('Hide hides floating button', !(await fabVisible(page)));

await page.goto(BASE + 'price.html'); await page.waitForTimeout(1000);
const priceImg = 'data:image/png;base64,' + (await page.locator('#t').screenshot()).toString('base64');
await page.goto(BASE + 'article.html'); await page.waitForTimeout(1000);
await sw.evaluate(async (priceImg) => {
  const mk = async (c) => { const cv = new OffscreenCanvas(60, 40); const x = cv.getContext('2d'); x.fillStyle = c; x.fillRect(0, 0, 60, 40); const b = await cv.convertToBlob({ type: 'image/png' }); const u = new Uint8Array(await b.arrayBuffer()); let s = ''; for (const v of u) s += String.fromCharCode(v); return 'data:image/png;base64,' + btoa(s); };
  const now = Date.now();
  await chrome.storage.local.set({ imageCaptures: {
    c_ocr: { id: 'c_ocr', imageData: priceImg, url: 'https://shop.example.com/a', tags: ['比價'], note: '', title: 'Desk lamp', createdAt: now - 3000 },
    c_manual: { id: 'c_manual', imageData: await mk('#6E7F63'), url: 'https://store.example.net/b', tags: ['比價', 'shopping'], note: 'No dimmer', title: 'Clip lamp', createdAt: now - 2000, price: { amount: 990, label: 'NT$990', source: 'manual' } },
    c_none: { id: 'c_none', imageData: await mk('#5B5F7A'), url: 'https://home.example.tw/c', tags: ['shopping'], note: '', title: 'Floor lamp', createdAt: now - 1000 },
    c_other: { id: 'c_other', imageData: await mk('#999999'), url: 'https://x.example/d', tags: ['京都'], note: 'temple', title: 'Kyoto', createdAt: now - 500 }
  } });
}, priceImg);
await send({ action: 'open-sidebar', data: { tab: 'images' } });
await page.waitForTimeout(1200);
await page.getByRole('button', { name: /^比價/ }).click();
await page.getByRole('button', { name: /^shopping/ }).click();
await page.waitForTimeout(200);
check('capture tag filter is OR', (await page.locator('img[alt="Screenshot"]').count()) === 3);
await page.getByRole('button', { name: /^shopping/ }).click();
await page.getByRole('button', { name: 'Compare' }).click(); await page.waitForTimeout(500);
check('Compare view opens', await page.getByText('Compare #比價').isVisible());
await page.getByRole('button', { name: 'Recognize text' }).first().click();
let price = null;
for (let i = 0; i < 40 && !price; i++) { await page.waitForTimeout(500); price = (await store('imageCaptures')).c_ocr.price; }
check('OCR extracts price', price && price.amount === 1290 && price.source === 'ocr', JSON.stringify(price));
await page.waitForTimeout(500);
const order = await page.locator('main article span.line-clamp-2').allInnerTexts();
check('sorted by price ascending', order[0] === 'Clip lamp' && order[1] === 'Desk lamp', JSON.stringify(order));
check('lowest badge on cheapest', await page.locator('main article').first().getByText('Lowest').isVisible());
await page.getByRole('button', { name: 'NT$1,290' }).click();
await page.getByRole('textbox', { name: 'Price' }).fill('850');
await page.keyboard.press('Enter'); await page.waitForTimeout(600);
const edited = (await store('imageCaptures')).c_ocr.price;
check('inline price edit stores manual', edited.amount === 850 && edited.source === 'manual' && edited.label === 'NT$850', JSON.stringify(edited));
check('resorts after edit', (await page.locator('main article span.line-clamp-2').allInnerTexts())[0] === 'Desk lamp');
await page.getByRole('button', { name: 'Back to screenshots' }).click(); await page.waitForTimeout(300);

await page.locator('img[alt="Screenshot"]').first().hover();
await page.locator('button[title="Edit"]').first().click(); await page.waitForTimeout(500);
check('edit sheet opens', await page.getByRole('dialog', { name: 'Edit screenshot' }).isVisible());
await page.locator('#cap-price').fill('abc');
await page.getByRole('button', { name: 'Save screenshot' }).click(); await page.waitForTimeout(300);
check('invalid price blocks save', await page.getByText('Enter a number such as 1290, or a price such as NT$1,290').isVisible());
await page.keyboard.press('Escape'); await page.waitForTimeout(300);

await page.getByRole('button', { name: 'Close' }).first().click(); await page.waitForTimeout(300);
await fabButton(page).click(); await page.waitForTimeout(300);
await page.getByRole('menuitem', { name: 'Capture full page' }).click(); await page.waitForTimeout(400);
await page.evaluate(() => window.scrollTo(0, 0));
await page.getByRole('button', { name: 'Capture to here' }).click();
await page.getByRole('dialog', { name: 'New screenshot' }).waitFor({ timeout: 30000 });
check('full page opens New screenshot sheet with Trim', await page.getByRole('button', { name: 'Trim' }).isVisible());
await page.locator('#cap-price').fill('1290');
await page.locator('input[aria-label="Tag input"]').fill('比價');
await page.getByRole('button', { name: 'Save screenshot' }).click(); await page.waitForTimeout(900);
const caps = await store('imageCaptures');
const newest = Object.values(caps).sort((a, b) => b.createdAt - a.createdAt)[0];
check('new capture saved with manual price and tag', newest.price?.label === 'NT$1,290' && newest.price?.source === 'manual' && newest.tags.includes('比價'), JSON.stringify({ price: newest.price, tags: newest.tags }));
finish(errors);
await close();
