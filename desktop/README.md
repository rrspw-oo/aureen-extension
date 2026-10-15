# Aureen for Mac (menu bar prototype)

Minimal feasibility build: **global shortcut → region screenshot → OCR → panel under the menu bar icon.**

## Run (on a Mac)

Requires Xcode Command Line Tools, Rust (`rustup`) and Node 20+.

```bash
cd desktop
npm install
npm run tauri dev
```

First launch: macOS asks for **Screen Recording** permission for the terminal (dev) or Aureen (built app). Grant it, then restart the app.

## What to check

1. A sun icon appears in the menu bar and there is no Dock icon.
2. Click it: a panel opens right under the icon; click elsewhere: it closes.
3. Press `⌘⇧2`, drag a region: the panel opens with the screenshot, OCR text (zh-TW + en) and the price found by `src/lib/price.ts`.
4. Right-click the icon for the capture / quit menu.

## How it works

- `src-tauri/src/lib.rs` – tray icon (template image), popover placement, global shortcut, and `screencapture -i -x` for the region picker.
- `src/chrome-shim.ts` – a tiny `chrome.storage` / `chrome.runtime` replacement (IndexedDB-backed), so the extension's own captures UI (`../src/sidebar/captures`, tags, compare, handbook export) runs unchanged in the desktop panel.
- `src/native-save.ts` + `save_download` (Rust) – exports (PDF / JSON / Markdown / images) are written to `~/Downloads` and revealed in Finder, because WKWebView ignores `<a download>`.
- OCR is the extension's Tesseract setup (`../public/tesseract`).

## Not done yet

- Native Vision OCR (faster, better zh-TW) instead of Tesseract.js.
- Highlights tab (needs a web page DOM; stays in the extension).
- Storage meter still shows the extension's 10 MB quota text.
- Free-tier limits and license key activation.
