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
| `⌘⇧9` | Full-page capture | Shows the extension's bar above the front window: scroll to where the capture should end and click **Capture to here** (or **Whole page** / **Cancel**). Aureen then scrolls from the top with Page Down and stitches frames of that window alone (fixed toolbars kept once) until it reaches your chosen view. While it runs, the bar shows the frame count with **Capture to here** (stop now) and **Cancel**. Esc = cancel while choosing, stop while capturing; `⌘⇧9` again = Capture to here. |

All three are also in the tray menu (right-click) and as buttons at the top of the panel.

**Selection toolbar.** Drag-select (or double-click) text in any app and the extension's toolbar appears next to the pointer: *Highlight* with the default color, the four color dots (which also set the default), and the note button. Picking one opens the highlight form in the panel, like the extension's sidebar. Text is read through the Accessibility API; Firefox and pages that hide their text fall back to ⌘C.

**Floating button.** While Aureen is on, a champagne sun button (the extension's floating button) floats above all windows; drag it anywhere. Click it for *打開面板*, *截取區域*, *截取整頁* and *隱藏* (show it again from the tray menu → *顯示浮動按鈕*). It hides while paused and stays out of region captures.

**Panel.** Drag the header to move the panel anywhere; once moved it stays there and no longer closes when you click elsewhere. Tray menu → *面板回到圖示下方* docks it again.

**Panel controls.** ✕ hides the panel. The ⋯ menu holds language, *暫停 Aureen* / *啟用 Aureen* (shortcuts, selection toolbar and floating button off; Aureen stays in the menu bar and its icon shows Ⅱ; a 已暫停 badge next to the title resumes in one click), *面板回到選單列圖示下方*, *刪除所有重點*, and the build version (`Aureen 0.1.0 (commit)`) so you can tell which build is running. Quitting lives only in the tray menu → *結束 Aureen*.

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
