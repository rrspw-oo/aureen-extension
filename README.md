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

- Highlight text on any webpage with one click
- Automatically save source URL and page title
- Organize with tags (e.g., `#shopping`, `#research`, `#todo`)
- Export to Markdown or JSON format

### Region Screenshot Capture

- Select any region on a webpage to capture
- Automatically save screenshot source
- Organize with tags (e.g., `#product`, `#reference`)
- Recognize text in a saved screenshot offline (Traditional Chinese and English): hover a screenshot, click "Recognize text", then copy the result from the preview
- Compare product images and prices across different websites

### Sidebar Management

- Press `Alt+S` to open sidebar
- Filter and group by tags
- View all highlights and screenshots
- Delete or export data with one click

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

1. Select text on any webpage
2. Click the highlight button in the floating toolbar
3. Sidebar opens - enter tags (separated by comma or space)
4. Click "Save Highlight" to save

### Capturing Screenshots

1. Click extension icon or use keyboard shortcut to enter capture mode
2. Drag to select the region you want to capture
3. Sidebar opens - enter tags and optional notes
4. Click "Save Screenshot" to save

### Managing and Filtering

1. Press `Alt+S` to open sidebar
2. Switch between "Highlights" and "Captures" tabs
3. Click any tag to filter related content
4. Use export function to download all data

---

## Use Case Examples

### Product Price Comparison

When browsing similar products across multiple shopping websites:

- Capture product images with tags like `#3C #comparison #laptop`
- Highlight price and specifications
- Later, open sidebar and filter by `#comparison` to view all products at once
- Quickly compare specifications and prices

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
- Edit saved highlights
- Mobile companion app
