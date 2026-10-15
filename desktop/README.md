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
- `src/` – React panel. Reuses `../src/lib/price.ts` and the Tesseract assets in `../public/tesseract` (same OCR as the extension).

## Not done yet

- Native Vision OCR (faster, better zh-TW) instead of Tesseract.js.
- Persistence, tags, compare view, PDF export (needs `chrome.storage` abstracted out of `src/lib`).
- Free-tier limits and license key activation.
