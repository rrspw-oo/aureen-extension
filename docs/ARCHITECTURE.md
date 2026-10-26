# Architecture

[English](ARCHITECTURE.md) | [繁體中文](ARCHITECTURE.zh-TW.md)

How Aureen is put together, for anyone who wants to read or change the code. Start with the table of contexts, then follow one of the flows below.

## Where code runs

A Chrome extension runs in several isolated places. The `src/` folders follow them.

| Folder | Runs in | Job |
|---|---|---|
| `src/background/` | Service worker | Takes screenshots (`captureVisibleTab`), crops and stitches them with `OffscreenCanvas`, routes messages, opens the offscreen document for OCR, sends saved highlights to a tab when it finishes loading |
| `src/offscreen/` | Offscreen document (`offscreen.html`) | Runs Tesseract in a Web Worker. It lives in the extension's own origin, so the page's Content Security Policy cannot block it |
| `src/page/` | Content script in every page | Marks highlights, shows the selection toolbar, the floating button, and the region and full-page capture overlays |
| `src/sidebar/` | Inside the page, in a Shadow DOM | The React sidebar. The Shadow DOM keeps the page's CSS out and ours in |
| `src/lib/` | Wherever it is imported | Storage, export, OCR client, price parsing, DOM helpers. No UI |

The sidebar is not an extension page. It is rendered by the content script into the page itself, so it can read the page URL and talk to the highlighter directly through `window.postMessage`.

## Files

```
src/background/service-worker.ts   message router, screenshots, stitching, offscreen OCR
src/offscreen/offscreen.ts         Tesseract worker (chi_tra + eng)
src/page/content-script.ts         entry: selection toolbar, message handling, restore trigger
src/page/highlighter.ts            create, apply, restore and remove highlight marks
src/page/content-app.tsx           React root for in-page overlays; loads the floating button
src/page/fab.tsx                   floating button and its menu
src/page/fab-bridge.ts             show and hide the floating button without import cycles
src/page/region-capture.ts         region screenshot flow
src/page/region-overlay.tsx        drag-to-select overlay
src/page/full-page-capture.ts      "capture to here" bar, scroll and capture segments
src/page/index.ts                  entry for the self-contained bundle used for re-injection
src/sidebar/shell.tsx              Shadow DOM host, header, tabs, language menu
src/sidebar/highlights/            HighlightsView, HighlightList, HighlightCard, HighlightForm
src/sidebar/captures/              CapturesView, CaptureCard, CaptureForm, CompareView, TrimImageModal
src/sidebar/ui/                    Sheet, TagInput, TagChipRow, SearchField, LinkPicker, LinkedItems, StorageMeter
src/sidebar/ExportHandbookDialog.tsx
src/lib/highlight-store.ts         highlights, tags and settings in chrome.storage
src/lib/capture-store.ts           screenshots and their tags
src/lib/dom.ts                     selection positions, text search fallback, wrapping marks
src/lib/handbook-export.ts         HTML pages rendered to a PDF with html2canvas and jsPDF
src/lib/capture-pdf.ts             one screenshot as an A4 PDF, sliced into pages
src/lib/export-import.ts           JSON and Markdown export of highlights
src/lib/ocr.ts                     asks the service worker to recognize a screenshot
src/lib/price.ts                   extractPrice and parsePriceInput
src/lib/url.ts                     normalizePageUrl (drops #hash and utm_* parameters)
src/i18n/                          i18next setup, en.json, zh-TW.json
src/types/                         Highlight, ImageCapture, Settings
tests/price.test.ts                unit tests for price parsing
```

## Flows

### Saving a highlight

1. `content-script.ts` waits for a selection and shows the toolbar. It snapshots the selected range right away, because clicking a button clears the live selection.
2. Clicking **Highlight**, a color, or the note button calls `highlighter.createHighlight`, which records the position and wraps the text in `<mark>` elements. The mark is temporary until it is saved.
3. The content script opens the sidebar with the text and position. `HighlightForm` slides up.
4. On save, `highlight-store.saveHighlight` writes to `chrome.storage.local`. Every open tab hears the storage change and restores its marks.

### Putting highlights back on a page

A page asks for its highlights when the content script starts, when the service worker reports the tab finished loading, and after every storage change. `highlighter.restoreHighlights` is incremental: it removes marks whose highlight was deleted, adds marks that are missing, and never touches a temporary mark that has not been saved yet.

A highlight position stores, for both ends of the selection, the XPath of the nearest element and a character offset inside that element's text. Marks do not change an element's text, so positions stay valid while other highlights are on the page. To place a mark, `restoreRangeFromPosition` builds a range from the position and checks that its text matches the saved text, ignoring whitespace. If it does not match (the page changed), it searches the page for the saved text instead.

Pages are matched with `normalizePageUrl`, so `#section` and `utm_*` parameters do not split one page into many.

### Taking a screenshot

- **Region:** `region-overlay.tsx` lets you drag a box, then `capture-screenshot-crop` asks the service worker to capture the visible tab and crop it.
- **Full page:** `full-page-capture.ts` shows the "capture to here" bar, hides fixed and sticky elements, scrolls one viewport at a time and sends `capture-screenshot` for each segment, then `stitch-segments`. The last segment is scrolled so it ends exactly at the chosen point.

Either way the sidebar opens `CaptureForm` with the image. `TrimImageModal` cuts any of the four edges, both for a new capture and when editing a saved one; `CapturesView` writes the new image on save. `capture-pdf.ts` saves one screenshot as an A4 portrait PDF: the image is scaled to the page width minus 24 px margins and tall images are sliced into as many pages as needed.

### Recognizing text and reading prices

`lib/ocr.ts` sends `ocr-capture` to the service worker, which creates `offscreen.html` if needed and forwards the image. The offscreen page keeps one Tesseract worker loaded with `chi_tra+eng`. When text comes back, `extractPrice` looks for the first amount next to a currency sign and stores it as the screenshot's price, unless you typed a price yourself.

## Desktop app

`desktop/` is a Tauri menu bar app for macOS that mounts the same `SidebarApp` from `src/sidebar/shell.tsx`. `desktop/src/chrome-shim.ts` stands in for `chrome.storage` and `chrome.runtime` on top of IndexedDB, `desktop/src-tauri/src/mac.rs` drives screenshots and the selected text through macOS, and `desktop/src-tauri/src/stitch.rs` stitches scrolling captures. It is a prototype and is documented in `desktop/README.md`.

## Data

| Key | Area | Content |
|---|---|---|
| `highlights` | local | Highlights by id |
| `tags`, `globalTags` | local | Highlight tag stats |
| `imageCaptures` | local | Screenshots by id, including the image as a data URL, OCR text and price |
| `imageTags` | local | Screenshot tag stats |
| `fabPosition` | local | Where you dragged the floating button |
| `settings` | sync | Default highlight color and interface language |

`chrome.storage.local` is limited to 10 MB without the `unlimitedStorage` permission. Screenshots take most of it.

## Build

`npm run build` runs two Vite builds:

1. `vite.config.crxjs.ts` builds the extension with CRXJS from `manifest.json`, including `offscreen.html`.
2. `vite.config.content.ts` builds `src/page/index.ts` again as one self-contained file, `dist/assets/content-script.js`. The service worker injects this file into tabs that were open before the extension was installed or updated. `chrome.scripting.executeScript` cannot load the module chunks from the first build, so this second bundle is required even though the manifest does not mention it.

The Tesseract worker, WebAssembly cores and language data are copied from `public/tesseract/`.

## Language

Strings live in `src/i18n/locales/en.json` and `zh-TW.json`, which must have the same keys. React components use `useTranslation()`; code outside React imports `t` from `src/i18n/config.ts`. The language comes from `settings.language` (`auto`, `en` or `zh-TW`). `auto` shows Traditional Chinese for any browser language that starts with `zh`, and English for everything else.

## Conventions

- Inputs that accept Enter must ignore it while an input method is composing (`event.nativeEvent.isComposing`). Users type with Zhuyin and confirm characters with Enter.
- Enter in a tag field adds a tag. Forms save with the Save button or `Cmd/Ctrl+Enter`, never with a plain Enter.
- Dialogs, sheets and previews carry `data-aureen-modal`, so `Esc` closes them before it closes the sidebar.
- No comments in code. Names and small files carry the meaning.

## Testing

- `node --test tests/*.test.ts` runs the unit tests.
- `tests/e2e/*.test.mjs` load `dist` into Chrome through Playwright and drive the fixture pages in `tests/e2e/site`: highlighting, restoring after reload and after layout changes, tag input with composition events, capture, trim, OCR, compare, the language switch, the delete-all action and the floating button animation. Chrome 137 and later ignore `--load-extension`, so `helpers.mjs` loads the extension with the DevTools Protocol command `Extensions.loadUnpacked` and the `--enable-unsafe-extension-debugging` flag, and serves the fixtures on port 8766. Run the suites one at a time; they share that port.
- `tests/e2e/shots/docs-shots.mjs en|zh-TW` regenerates the README screenshots.
