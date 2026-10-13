import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { launch, BASE, ROOT, fabButton } from '../helpers.mjs';

const lang = process.argv[2] === 'zh-TW' ? 'zh-TW' : 'en';
const outDir = process.argv[3] || join(ROOT, 'docs/images', lang);
mkdirSync(outDir, { recursive: true });
const zh = lang === 'zh-TW';
const C = zh ? {
  article: 'article-zh.html', title: '睡眠如何塑造記憶',
  t1: '海馬迴會重播白天的經歷，並把它們轉存到大腦皮質', t2: '學習後有睡覺的受試者，比整晚沒睡的人多記住了兩成的單字配對', t3: '小睡也有幫助，只要不超過三十分鐘',
  research: '研究', sleep: '睡眠', lamp: '比價', note1: '報告開頭要用的機制說明', title1: '記憶鞏固', other: '咖啡因的半衰期大約是五小時，下午三點後就不要再喝。', otherTitle: '咖啡因與睡眠', otherHost: 'https://health.example.org/caffeine',
  lampNote: ['可調光，USB-C 供電', '不能調光', '客廳用'], recall: '回想率研究', newTag: '記憶', napTitle: '小睡的上限', compare: '比較', close: '關閉', tagInput: '標籤輸入'
} : {
  article: 'article-en.html', title: 'How sleep shapes memory',
  t1: "During deep sleep the hippocampus replays the day's experiences", t2: 'participants who slept after learning recalled 20% more word pairs than those who stayed awake', t3: 'Short naps helped too, as long as they stayed under 30 minutes',
  research: 'research', sleep: 'sleep', lamp: 'lamp', note1: 'Key mechanism for the essay intro.', title1: 'Memory consolidation', other: 'Caffeine has a half-life of about five hours, so skip coffee after 3 pm.', otherTitle: 'Caffeine and sleep', otherHost: 'https://health.example.org/caffeine',
  lampNote: ['Dimmable, USB-C powered', 'No dimmer', 'For the living room'], recall: 'Recall study', newTag: 'memory', napTitle: 'Nap limit', compare: 'Compare', close: 'Close', tagInput: 'Tag input'
};

const { page, sw, send, close } = await launch({ lang: zh ? 'zh-TW' : 'en-US', height: 900 });
const DEMO = BASE + 'demo/';
const shotOf = async (url, sel) => { await page.goto(DEMO + url); await page.waitForTimeout(500); return 'data:image/png;base64,' + (await page.locator(sel).screenshot()).toString('base64'); };
const lamps = [await shotOf('product-a.html', '#card'), await shotOf('product-b.html', '#card'), await shotOf('product-c.html', '#card')];
const recallImg = await shotOf(C.article, '#p2');
const articleUrl = DEMO + C.article;
await sw.evaluate(async ({ C, lamps, recallImg, articleUrl }) => {
  const now = Date.now();
  const pos = (text) => ({ xpath: '', startOffset: 0, endOffset: 0, textContent: text });
  const highlights = {
    h1: { id: 'h1', url: articleUrl, pageTitle: C.title, text: C.t1, tags: [C.research, C.sleep], color: 'yellow', position: pos(C.t1), title: C.title1, note: C.note1, createdAt: now - 3600e3 * 2, updatedAt: now },
    h2: { id: 'h2', url: articleUrl, pageTitle: C.title, text: C.t2, tags: [C.research], color: 'mint', position: pos(C.t2), linkedIds: ['c4'], createdAt: now - 3600e3, updatedAt: now },
    h3: { id: 'h3', url: C.otherHost, pageTitle: C.otherTitle, text: C.other, tags: [C.sleep], color: 'sky', position: pos(C.other), createdAt: now - 86400e3 * 3, updatedAt: now }
  };
  const cap = (id, img, url, tags, title, note, price, t) => ({ id, imageData: img, url, tags, title, note, createdAt: now - t, ...(price ? { price: { amount: price[0], label: price[1], source: price[2] }, ocrStatus: 'done', ocrText: price[1], ocrLang: 'chi_tra+eng' } : {}) });
  const imageCaptures = {
    c1: cap('c1', lamps[0], 'https://shop.example.com/aurora', [C.lamp], 'Aurora desk lamp', C.lampNote[0], [1290, 'NT$1,290', 'ocr'], 3600e3 * 5),
    c2: cap('c2', lamps[1], 'https://store.example.net/clip', [C.lamp], 'Clip-on reading lamp', C.lampNote[1], [990, 'NT$990', 'ocr'], 3600e3 * 4),
    c3: cap('c3', lamps[2], 'https://home.example.tw/arc', [C.lamp], 'Arc floor lamp', C.lampNote[2], [2450, 'NT$2,450', 'manual'], 3600e3 * 3),
    c4: cap('c4', recallImg, articleUrl, [C.research], C.recall, '', null, 3600e3 * 1.5)
  };
  await chrome.storage.local.set({ highlights, imageCaptures });
}, { C, lamps, recallImg, articleUrl });
await page.goto(articleUrl); await page.waitForTimeout(1500);
const vp = await page.evaluate(() => ({ w: innerWidth, h: innerHeight }));
const side = { x: vp.w - 400, y: 0, width: 400, height: vp.h };

await send({ action: 'open-sidebar', data: { tab: 'highlights' } }); await page.waitForTimeout(1200);
await page.screenshot({ path: `${outDir}/hero.png` });
await page.screenshot({ path: `${outDir}/highlights.png`, clip: side });

await page.evaluate((t3) => {
  const p = document.querySelector('#p3'); const tn = p.firstChild; const i = tn.data.indexOf(t3);
  const r = document.createRange(); r.setStart(tn, i); r.setEnd(tn, i + t3.length);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r); p.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
}, C.t3);
await page.waitForTimeout(700);
const tb = await page.locator('#highlight-toolbar').boundingBox();
const p3 = await page.locator('#p3').boundingBox();
await page.screenshot({ path: `${outDir}/toolbar.png`, clip: { x: 40, y: Math.max(0, tb.y - 30), width: 760, height: p3.y + p3.height - tb.y + 50 } });
await page.locator('#highlight-toolbar button[data-color="mint"]').click(); await page.waitForTimeout(900);
await page.locator('#hl-title').fill(C.napTitle);
const tagBox = page.locator(`input[aria-label="${C.tagInput}"]`);
await tagBox.click(); await page.keyboard.insertText(C.sleep + (zh ? '，' : ',')); await page.keyboard.insertText(C.newTag);
await page.waitForTimeout(300);
await page.screenshot({ path: `${outDir}/sheet.png`, clip: side });
await page.keyboard.press('Escape'); await page.waitForTimeout(500);

await page.getByRole('tab').nth(1).click(); await page.waitForTimeout(900);
await page.screenshot({ path: `${outDir}/captures.png`, clip: side });
await page.getByRole('button', { name: new RegExp('^' + C.lamp) }).click();
await page.getByRole('button', { name: C.compare }).click(); await page.waitForTimeout(700);
await page.screenshot({ path: `${outDir}/compare.png`, clip: side });

await page.getByRole('button', { name: C.close }).first().click(); await page.waitForTimeout(400);
await fabButton(page).click(); await page.waitForTimeout(600);
await page.screenshot({ path: `${outDir}/fab.png`, clip: { x: vp.w - 300, y: vp.h - 330, width: 300, height: 330 } });
console.log('done', lang, outDir);
await close();
