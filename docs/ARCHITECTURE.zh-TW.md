# 架構說明

[English](ARCHITECTURE.md) | [繁體中文](ARCHITECTURE.zh-TW.md)

這份文件說明 Aureen 的程式碼怎麼組成，給想閱讀或修改程式碼的人。建議先看「程式在哪裡執行」那張表，再挑一個下面的流程往下讀。

## 程式在哪裡執行

Chrome 擴充功能會在好幾個彼此隔離的環境裡執行，`src/` 底下的資料夾就是照這個分的。

| 資料夾 | 執行環境 | 負責的事 |
|---|---|---|
| `src/background/` | Service worker | 截圖（`captureVisibleTab`）、用 `OffscreenCanvas` 裁切與拼接、轉送訊息、開啟 offscreen document 做 OCR、在分頁載入完成時把已存的重點送過去 |
| `src/offscreen/` | Offscreen document（`offscreen.html`） | 在 Web Worker 裡執行 Tesseract。它在擴充功能自己的 origin 底下，所以網頁的 Content Security Policy 擋不到它 |
| `src/page/` | 注入每個網頁的 content script | 標記重點、顯示選取工具列、浮動按鈕，以及區域與整頁截圖的畫面 |
| `src/sidebar/` | 網頁裡的 Shadow DOM | React 側欄。Shadow DOM 讓網頁的 CSS 影響不到側欄，側欄的 CSS 也不會外洩 |
| `src/lib/` | 被 import 到哪裡就在哪裡執行 | 儲存、匯出、OCR 呼叫、價格解析、DOM 工具。這裡沒有任何介面 |

側欄不是擴充功能頁面，而是由 content script 直接畫進網頁裡。所以它讀得到網頁網址，也能透過 `window.postMessage` 直接和負責標記重點的程式溝通。

## 檔案

```
src/background/service-worker.ts   訊息轉送、截圖、拼接、離線 OCR
src/offscreen/offscreen.ts         Tesseract worker（chi_tra + eng）
src/page/content-script.ts         進入點：選取工具列、訊息處理、觸發還原
src/page/highlighter.ts            建立、套用、還原、移除重點標記
src/page/content-app.tsx           網頁上浮層的 React 根節點，也負責載入浮動按鈕
src/page/fab.tsx                   浮動按鈕與選單
src/page/fab-bridge.ts             顯示或隱藏浮動按鈕，避免互相 import 形成循環
src/page/region-capture.ts         區域截圖流程
src/page/region-overlay.tsx        拖曳框選畫面
src/page/full-page-capture.ts      「截到這裡」提示列、捲動並分段截圖
src/page/index.ts                  重新注入時使用的獨立打包檔進入點
src/sidebar/shell.tsx              Shadow DOM 容器、標題列、分頁、語言選單
src/sidebar/highlights/            HighlightsView、HighlightList、HighlightCard、HighlightForm
src/sidebar/captures/              CapturesView、CaptureCard、CaptureForm、CompareView、TrimImageModal
src/sidebar/ui/                    Sheet、TagInput、TagChipRow、SearchField、LinkPicker、LinkedItems、StorageMeter
src/sidebar/ExportHandbookDialog.tsx
src/lib/highlight-store.ts         重點、標籤、設定的 chrome.storage 存取
src/lib/capture-store.ts           截圖與截圖標籤的存取
src/lib/dom.ts                     選取位置、文字搜尋備援、包上標記
src/lib/handbook-export.ts         把 HTML 頁面用 html2canvas 與 jsPDF 轉成 PDF
src/lib/export-import.ts           重點的 JSON 與 Markdown 匯出
src/lib/ocr.ts                     請 service worker 辨識截圖文字
src/lib/price.ts                   extractPrice 與 parsePriceInput
src/lib/url.ts                     normalizePageUrl（去掉 #hash 與 utm_* 參數）
src/i18n/                          i18next 設定、en.json、zh-TW.json
src/types/                         Highlight、ImageCapture、Settings
tests/price.test.ts                價格解析的單元測試
```

## 流程

### 儲存一則重點

1. `content-script.ts` 偵測到選取文字後顯示工具列，並立刻把選取範圍複製下來，因為點按鈕的瞬間，瀏覽器會清掉目前的選取。
2. 點「劃重點」、顏色或備註按鈕時，會呼叫 `highlighter.createHighlight`，記下位置並用 `<mark>` 包住文字。在儲存之前，這個標記都是暫時的。
3. content script 把文字和位置傳給側欄，`HighlightForm` 從下方滑出。
4. 儲存時，`highlight-store.saveHighlight` 寫入 `chrome.storage.local`。所有開著的分頁都會收到 storage 變動，並重新還原各自的標記。

### 把重點標回網頁

網頁會在三個時機索取自己的重點：content script 啟動時、service worker 回報分頁載入完成時，以及每次 storage 有變動時。`highlighter.restoreHighlights` 採用增量更新：重點被刪掉就移除標記，缺少的標記就補上，而還沒儲存的暫時標記一律不碰。

每則重點會記錄選取範圍兩端各自的資訊：最近元素的 XPath，以及在該元素文字中的字元位置。加上 `<mark>` 不會改變元素的文字內容，所以頁面上已經有其他重點時，位置依然準確。要標記時，`restoreRangeFromPosition` 先用位置建立範圍，再比對文字是否和存下的一致（忽略空白）。如果對不上，代表網頁改版了，就改用存下的文字在整頁搜尋。

網頁比對使用 `normalizePageUrl`，所以 `#段落` 和 `utm_*` 參數不會讓同一頁被當成好幾頁。

### 截圖

- **區域：** `region-overlay.tsx` 讓你拖出一個框，接著用 `capture-screenshot-crop` 請 service worker 截下目前畫面並裁切。
- **整頁：** `full-page-capture.ts` 先顯示「截到這裡」提示列，隱藏固定定位和 sticky 的元素，一次捲一個畫面高度，每段送一次 `capture-screenshot`，最後送 `stitch-segments` 拼接。最後一段會捲到剛好結束在你選的位置。

兩種方式最後都會在側欄打開 `CaptureForm`。整頁截圖可以在儲存前裁切。

### 辨識文字與讀出價格

`lib/ocr.ts` 送出 `ocr-capture` 給 service worker；service worker 在需要時建立 `offscreen.html`，再把圖片轉過去。offscreen 頁面會保留一個載入 `chi_tra+eng` 的 Tesseract worker。文字回來後，`extractPrice` 會找第一個貨幣符號旁邊的金額存成價格；如果你已經手動輸入過價格，就不會覆蓋。

## 資料

| Key | 儲存區 | 內容 |
|---|---|---|
| `highlights` | local | 依 id 存放的重點 |
| `tags`、`globalTags` | local | 重點標籤的統計 |
| `imageCaptures` | local | 依 id 存放的截圖，包含 data URL 圖片、OCR 文字與價格 |
| `imageTags` | local | 截圖標籤的統計 |
| `fabPosition` | local | 浮動按鈕被拖曳到的位置 |
| `settings` | sync | 預設劃記顏色與介面語言 |

沒有 `unlimitedStorage` 權限時，`chrome.storage.local` 上限是 10 MB，大部分空間都會被截圖佔用。

## 建置

`npm run build` 會執行兩次 Vite 建置：

1. `vite.config.crxjs.ts` 用 CRXJS 依 `manifest.json` 建置整個擴充功能，包含 `offscreen.html`。
2. `vite.config.content.ts` 再把 `src/page/index.ts` 單獨打包成一個完整檔案 `dist/assets/content-script.js`。安裝或更新擴充功能前就已經開著的分頁，service worker 會把這個檔案注入進去。`chrome.scripting.executeScript` 無法載入第一次建置產生的模組分塊，所以即使 manifest 沒有提到，這份打包檔還是必要的。

Tesseract 的 worker、WebAssembly 核心與語言資料，都是從 `public/tesseract/` 直接複製過去。

## 語言

字串放在 `src/i18n/locales/en.json` 和 `zh-TW.json`，兩份的 key 必須一致。React 元件用 `useTranslation()`；React 以外的程式從 `src/i18n/config.ts` import `t`。語言由 `settings.language` 決定（`auto`、`en` 或 `zh-TW`）。`auto` 會在瀏覽器語言是 `zh` 開頭時顯示繁體中文，其他情況一律顯示英文。

## 開發慣例

- 會處理 Enter 的輸入框，在輸入法選字期間（`event.nativeEvent.isComposing`）必須忽略 Enter，因為使用者會用注音輸入法，並用 Enter 確認選字。
- 在標籤欄按 Enter 只會加入標籤。表單只能用儲存按鈕或 `Cmd/Ctrl+Enter` 儲存，單獨按 Enter 永遠不會送出。
- 對話框、面板與預覽都要加上 `data-aureen-modal`，這樣按 `Esc` 會先關掉它們，而不是直接收起側欄。
- 程式碼裡不寫註解，靠命名和小而專一的檔案表達意圖。

## 測試

- `node --test tests/*.test.ts` 執行單元測試。
- 介面測試是用 Playwright 把 `dist` 載入 Chrome，在真實網頁上操作：劃重點、重新整理與版面改變後的還原、輸入法選字時的標籤輸入、截圖、裁切、OCR、比價，以及兩種語言。Chrome 137 之後會忽略 `--load-extension`，所以測試腳本改用 DevTools Protocol 的 `Extensions.loadUnpacked` 指令，搭配 `--enable-unsafe-extension-debugging` 參數載入擴充功能。
