import { launch, reporter, BASE, fabButton } from './helpers.mjs';

const { check, finish } = reporter();
const { page, send, errors, close } = await launch();
await page.emulateMedia({ reducedMotion: 'reduce' });
await page.goto(BASE + 'article.html');
await page.waitForTimeout(1000);
check('reduced motion emulated', await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches));
await send({ action: 'toggle-ui' });
await page.waitForTimeout(400);

const sun = () => page.evaluate(() => {
  const svg = document.getElementById('aureen-fab-host').shadowRoot.querySelector('.fab-sun');
  return { transform: getComputedStyle(svg).transform, duration: getComputedStyle(svg).transitionDuration };
});
const before = await sun();
await fabButton(page).click();
await page.waitForTimeout(60);
const mid = await sun();
await page.waitForTimeout(700);
const after = await sun();
check('sun has a transition even with reduced motion', parseFloat(after.duration) > 0, after.duration);
check('sun rotates after opening', before.transform !== after.transform && mid.transform !== after.transform, `before=${before.transform} mid=${mid.transform} after=${after.transform}`);
const items = await page.evaluate(() => [...document.getElementById('aureen-fab-host').shadowRoot.querySelectorAll('.fab-item')].map((el) => getComputedStyle(el).animationDuration));
check('menu items animate in', items.length === 4 && items.every((d) => parseFloat(d) > 0), JSON.stringify(items));
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
check('Esc closes menu', (await page.getByRole('menuitem').count()) === 0);
finish(errors);
await close();
