import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, resolve, extname, normalize } from 'node:path';
import { tmpdir } from 'node:os';
import { connect } from 'node:net';

export const ROOT = resolve(import.meta.dirname, '../..');
export const DIST = join(ROOT, 'dist');
export const SITE = join(import.meta.dirname, 'site');
export const PORT = 8766;
export const BASE = `http://127.0.0.1:${PORT}/`;

const MIME = { '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.css': 'text/css', '.js': 'text/javascript' };

function portInUse() {
  return new Promise((done) => {
    const socket = connect(PORT, '127.0.0.1');
    socket.once('connect', () => { socket.destroy(); done(true); });
    socket.once('error', () => done(false));
  });
}

export async function serveFixtures() {
  if (await portInUse()) return null;
  const server = createServer(async (req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, BASE).pathname));
    try {
      const body = await readFile(join(SITE, path));
      res.writeHead(200, { 'Content-Type': MIME[extname(path)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise((done) => server.listen(PORT, '127.0.0.1', done));
  return server;
}

export async function launch({ lang = 'en-US', width = 1280, height = 860, viewport = null } = {}) {
  const server = await serveFixtures();
  const ctx = await chromium.launchPersistentContext(join(tmpdir(), `aureen-e2e-${Date.now()}-${Math.random().toString(36).slice(2)}`), {
    ...(process.env.AUREEN_CHROME ? { executablePath: process.env.AUREEN_CHROME } : { channel: 'chrome' }),
    headless: true,
    ignoreDefaultArgs: ['--disable-extensions'],
    locale: lang,
    args: ['--enable-unsafe-extension-debugging', `--window-size=${width},${height}`, `--lang=${lang}`],
    viewport
  });
  const session = await ctx.browser().newBrowserCDPSession();
  const { id } = await session.send('Extensions.loadUnpacked', { path: DIST });
  const sw = ctx.serviceWorkers().find((w) => w.url().includes(id)) || await ctx.waitForEvent('serviceworker', { predicate: (w) => w.url().includes(id) });
  const page = ctx.pages()[0] || await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const send = (msg) => sw.evaluate(async (msg) => {
    const [tab] = await chrome.tabs.query({ url: 'http://127.0.0.1:8766/*' });
    await chrome.tabs.sendMessage(tab.id, msg);
  }, msg);
  const store = (key) => sw.evaluate(async (key) => (await chrome.storage.local.get(key))[key], key);
  const close = async () => {
    await ctx.close();
    server?.close();
  };
  return { ctx, sw, page, id, errors, send, store, close };
}

export function reporter() {
  let fails = 0;
  const check = (name, ok, detail = '') => {
    if (!ok) fails++;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' :: ' + detail : ''}`);
  };
  const finish = (errors = []) => {
    console.log('page errors:', errors.length ? errors.join('\n') : 'none');
    console.log(`TOTAL FAIL ${fails}`);
    process.exitCode = fails ? 1 : 0;
  };
  return { check, finish };
}

export async function selectText(page, selector, start, end) {
  await page.locator(selector).scrollIntoViewIfNeeded();
  await page.evaluate(([selector, start, end]) => {
    const p = document.querySelector(selector);
    const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    const locate = (pos) => { let acc = 0; for (const n of nodes) { if (pos <= acc + n.length) return [n, pos - acc]; acc += n.length; } };
    const r = document.createRange();
    const [sn, so] = locate(start); const [en, eo] = locate(end);
    r.setStart(sn, so); r.setEnd(en, eo);
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
    p.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  }, [selector, start, end]);
  await page.waitForTimeout(600);
}

export const sidebarVisible = (page) => page.evaluate(() => { const h = document.getElementById('text-highlighter-sidebar-shadow'); return !!h && h.style.display !== 'none'; });
export const fabVisible = (page) => page.evaluate(() => { const h = document.getElementById('aureen-fab-host'); return !!h && getComputedStyle(h).display !== 'none'; });
export const fabButton = (page) => page.getByRole('button', { name: /Aureen menu|Aureen 選單/ });
