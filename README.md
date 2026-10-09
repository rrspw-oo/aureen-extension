# Aureen - Reading Assistant Extension

## The Problem We Solve

When browsing articles or shopping online, you often need to:
- Keep multiple browser tabs open
- Copy text to external tools for organization
- Remember which website had that product you liked

But after closing tabs or switching tasks, you often forget:
- Where did I save that content?
- Why did I copy this text?
- Which website had that product?

**Aureen** provides a simple solution: highlight text and capture screenshots directly in your browser, organize everything with tags, then quickly review all items with the same tag for price comparison, research, or note-taking.

---

## Core Features

### Text Highlighting

- Highlight text on any webpage with one click, in champagne, mint, rose or sky. The color you pick last becomes the default
- Saved highlights are marked again when you revisit the page, including selections that span bold text or links. If the page layout changed, Aureen finds the text again by its content. Links that differ only by `#section` or `utm_*` tracking parameters count as the same page
- On a highlight card for the current page, click "Show on page" to scroll to that text
- Automatically save source URL and page title
- Organize with tags (e.g., `#shopping`, `#research`, `#todo`)
- Export to Markdown or JSON format

### Region Screenshot Capture

- Select any region on a webpage to capture
- Capture a full page, or stop at a point you choose so ads and comments below the article are left out, then trim the top and bottom before saving
- Automatically save screenshot source
- Organize with tags (e.g., `#product`, `#reference`)
- Recognize text in a saved screenshot offline (Traditional Chinese and English): hover a screenshot, click "Recognize text", then copy the result from the preview
- Compare screenshots that share a tag side by side, sorted by price. Prices are read from recognized text automatically and can be edited

### Sidebar Management

- Press `Alt+S` to open sidebar
- Switch between Highlights and Captures at the top; each shows its count
- Search text, titles, notes and recognized text; filter with tag chips (an item matches if it has any selected tag)
- Highlights are grouped by page, with the page you are on listed first
- Delete or export data with one click
- Link related highlights and screenshots, then jump between them

---

## Installation

### Manual Installation (Developer Mode)

1. Clone or download this project:

   ```bash
   git clone <repository-url>
   cd readingAssistant
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Build the extension:

   ```bash
   npm run build
   ```

4. Load into Chrome:
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `dist` folder from the project

---

## Usage Guide

### Highlighting Text

1. Select text on any webpage. A dark toolbar appears above it
2. Click "Highlight", or a color dot to highlight in that color, or the note button to highlight and jump straight to the note field
3. A form slides up in the sidebar - type a tag and press Enter, a comma (`,` `，` `、`), or a space to turn it into a tag chip. Enter never saves the form, so confirming a Zhuyin candidate is safe. Recently used tags are one click away under the field
4. Click "Save highlight" (or press Cmd/Ctrl + Enter) to save. Text still in the tag field is saved as a tag. Esc discards the new highlight

Each form field has a short note next to its label saying where it shows up (card, PDF handbook, filters).

### Capturing Screenshots

1. Click the extension icon to show the floating button, then choose "Capture region" (or use the "Capture a region" tile in the Captures tab)
2. Drag to select the region you want to capture
3. A form slides up - enter a title, tags, an optional price and notes
4. Click "Save screenshot" to save

### Comparing Prices

1. In the Captures tab, select one or more tags and click "Compare"
2. Screenshots with those tags are listed side by side, cheapest first, with the lowest marked
3. A price comes from the screenshot's recognized text; click "Recognize text" on a row without a price. Click any price to correct it. A price you type always wins over the recognized one
4. Highlights with the same tags are listed below for context

### Capturing a Full Page

1. Choose "Capture full page" from the floating button
2. A bar appears at the top. Scroll until the dashed "Capture ends here" line sits where the capture should stop, then click "Capture to here". Click "Whole page" to capture everything, or "Cancel" (or Esc) to stop
3. In the new screenshot form, click "Trim" to drag the top and bottom lines and cut off anything else, then "Apply"
4. Click "Save screenshot"

### Linking Related Items

1. In a highlight or screenshot form, open "Link related items" and tick the related items. Items from the same page are listed first
2. Links show on both sides: on a highlight card they are listed under the text; on a screenshot, open its preview
3. Click a linked item to jump to it: highlights scroll into view and flash, screenshots open their preview

### Showing and Hiding Aureen

- Click the extension icon to show the floating button. Click it again to hide the floating button and the sidebar
- "Close" in the sidebar header (or Esc) folds the sidebar back into the floating button. Esc does nothing while you type in a field or while a preview or form is open
- Use "Hide" in the floating button menu to hide the button too

### Managing and Filtering

1. Press `Alt+S` to open sidebar
2. Switch between "Highlights" and "Captures" at the top
3. Search, or click tag chips to filter
4. Use the export button in the header for the PDF handbook, JSON or Markdown (JSON and Markdown cover highlights), or "Export handbook" at the bottom of the Captures tab

---

## Use Case Examples

### Product Price Comparison

When browsing similar products across multiple shopping websites:

- Capture product images with tags like `#3C #comparison #laptop`
- Highlight price and specifications
- Later, select `#comparison` in the Captures tab and click "Compare" to see every product sorted by price

### Research and Note-taking

When reading multiple articles for research:

- Highlight important passages with tags like `#paper #AI #references`
- Capture important charts and diagrams with the same tags
- Filter by specific tags to view all related content
- Export to Markdown to create organized notes

### Travel Planning

When browsing travel information:

- Capture photos of attractions with tags like `#Japan #Kyoto #sightseeing`
- Highlight opening hours, ticket prices, and other details
- Organize information by city using tags
- Plan your itinerary with ease

---

## Development Commands

```bash
npm run dev    # Development mode (with HMR support)
npm run build  # Production build
```

---

## License

MIT License

---

## Future Plans

- Cloud synchronization
- Custom highlight colors
- Mobile companion app
