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

## Shortcuts

| Shortcut | Extension equivalent | What it does |
|---|---|---|
| `⌘⇧1` | Select text → highlight | Copies the selection of the frontmost app, adds the browser tab URL/title (Safari, Chrome, Arc, Brave, Edge, Vivaldi, Opera) or the app/window name, and opens the highlight form. Your text clipboard is restored. |
| `⌘⇧2` | Capture a region | macOS region picker → capture form (trim, tags, price, PDF). |
| `⌘⇧9` | Full-page capture | Scrolls the frontmost window from the top with Page Down and stitches the frames (fixed toolbars kept once). Press **Esc** (or `⌘⇧9` again) to stop at what is on screen — "capture to here". The menu bar shows the frame count meanwhile. |

All three are also in the tray menu (right-click) and as buttons at the top of the panel.

## Permissions

- **Screen Recording** – region and full-page capture.
- **Accessibility** – `⌘⇧1` (sends ⌘C) and `⌘⇧9` (window position, Page Down).
- **Automation** – macOS asks once per browser the first time a highlight reads its tab URL.

In development these are granted to your terminal app; quit and reopen it after granting.

## What to check

1. Menu bar icon, no Dock icon; click → panel under the icon (the extension's full sidebar: Highlights / Captures tabs, export menu, language, delete all).
2. Select text in Safari/Chrome → `⌘⇧1` → highlight form with the page title; saved highlights are grouped by page.
3. `⌘⇧2` → region → capture form; trim, tags, price, Download / Save as PDF (files go to `~/Downloads`).
4. Open a long page → `⌘⇧9` → wait or press Esc → one tall capture you can trim.
5. Export handbook: pick items, name the PDF.

## How it works

- `src-tauri/src/lib.rs` – tray icon, popover placement, shortcuts, flows, `save_download`, `open_url`.
- `src-tauri/src/mac.rs` – osascript / screencapture / pbcopy glue (selection, window bounds, scrolling capture).
- `src-tauri/src/stitch.rs` – pure image stitching, unit-tested (`cargo test` works on any OS).
- `src/DesktopApp.tsx` – hosts the extension's `SidebarApp` (`../src/sidebar/shell.tsx`) and feeds it native events.
- `src/chrome-shim.ts` – `chrome.storage` / `chrome.runtime` replacement backed by IndexedDB, so the shared UI runs unchanged.
- `src/native-save.ts` – downloads go through Rust because WKWebView ignores `<a download>`.

## Differences from the extension

- Highlights are not painted back onto web pages (the app cannot draw inside other apps); "Show on page" is therefore never offered.
- Full-page capture drives the window with Page Down; apps where Page Down moves a text cursor instead of scrolling capture only one screen.
- Only the text part of the clipboard is restored after `⌘⇧1`.
- OCR still uses Tesseract.js (Vision OCR is a planned upgrade).
