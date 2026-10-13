# End-to-end tests

These scripts load the built extension from `dist/` into the system Chrome through Playwright and drive real pages. Chrome 137 and later ignore `--load-extension`, so the extension is loaded with the DevTools Protocol command `Extensions.loadUnpacked`.

```bash
npm run build
node tests/e2e/interface.test.mjs     # toolbar, sheets, tags, filters, compare, full page
node tests/e2e/i18n.test.mjs          # Traditional Chinese interface and the language switch
node tests/e2e/restore.test.mjs       # highlights come back after reload and layout changes
node tests/e2e/ocr.test.mjs           # offline text recognition
node tests/e2e/delete-all.test.mjs    # Delete all highlights leaves screenshots and settings alone
node tests/e2e/fab-motion.test.mjs    # floating button animates even when the OS reduces motion
```

Each script prints one `PASS` or `FAIL` line per check and ends with `TOTAL FAIL n`; the exit code is non-zero when anything failed. Fixture pages live in `site/` and are served on port 8766 by `helpers.mjs`.

`shots/docs-shots.mjs en` and `shots/docs-shots.mjs zh-TW` regenerate the README screenshots in `docs/images/`.
