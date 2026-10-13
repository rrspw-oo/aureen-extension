import { launch, reporter, BASE, selectText, fabButton } from './helpers.mjs';

const { check, finish } = reporter();
const { page, sw, send, errors, close } = await launch({ lang: 'zh-TW' });
await page.goto(BASE + 'article.html');
await page.waitForTimeout(1200);
check('browser language is zh-TW', (await page.evaluate(() => navigator.language)) === 'zh-TW');

await selectText(page, '#p1', 4, 19);
check('toolbar in zh-TW', (await page.locator('#highlight-btn').innerText()).trim() === '劃重點');
await page.locator('#highlight-btn').click(); await page.waitForTimeout(900);
check('sheet title in zh-TW', await page.getByRole('dialog', { name: '新增重點' }).isVisible());
await page.getByRole('button', { name: '儲存重點' }).click(); await page.waitForTimeout(900);
const tabs = await page.getByRole('tab').allInnerTexts();
check('tabs in zh-TW', tabs[0].startsWith('重點') && tabs[1].startsWith('截圖'), JSON.stringify(tabs));
check('relative time in zh-TW', (await page.locator('article[data-highlight-id] span').first().innerText()) === '剛剛');
check('plural-free zh footer', (await page.locator('footer span').first().innerText()).includes('則重點'));

await page.getByRole('button', { name: '更多' }).click(); await page.waitForTimeout(200);
await page.getByRole('menuitemradio', { name: 'English' }).click(); await page.waitForTimeout(700);
check('switch to English updates live', (await page.getByRole('tab').allInnerTexts())[0].startsWith('Highlights'));
check('language choice persisted', (await sw.evaluate(async () => (await chrome.storage.sync.get('settings')).settings?.language)) === 'en');
await page.reload(); await page.waitForTimeout(1200);
await send({ action: 'open-sidebar', data: { tab: 'highlights' } }); await page.waitForTimeout(900);
check('English kept after reload', (await page.getByRole('tab').allInnerTexts())[0].startsWith('Highlights'));
await page.getByRole('button', { name: 'More' }).click(); await page.waitForTimeout(200);
await page.getByRole('menuitemradio', { name: 'Match browser' }).click(); await page.waitForTimeout(700);
check('back to auto follows browser (zh-TW)', (await page.getByRole('tab').allInnerTexts())[0].startsWith('重點'));
await page.getByRole('button', { name: '關閉' }).first().click(); await page.waitForTimeout(300);
await fabButton(page).click(); await page.waitForTimeout(300);
const rows = await page.getByRole('menuitem').allInnerTexts();
check('floating menu in zh-TW', rows[0].startsWith('打開側欄') && rows[3] === '隱藏', JSON.stringify(rows));
finish(errors);
await close();
