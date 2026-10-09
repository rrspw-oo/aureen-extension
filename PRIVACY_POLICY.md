# Privacy Policy for Aureen

[English](PRIVACY_POLICY.md) | [繁體中文](PRIVACY_POLICY.zh-TW.md)

**Last Updated: October 9, 2026**

## Introduction

Aureen ("the Extension") is committed to protecting your privacy. This Privacy Policy explains how we handle your data when you use our Chrome extension for text highlighting and screenshot capture.

## Data Collection and Storage

### What Data We Collect

The Extension stores the following data on your device. The only exception is noted under "How Data is Stored".

1. **Text Highlights**
   - Selected text from webpages
   - Source URL and page title
   - User-created tags
   - Highlight color
   - Optional title and notes
   - Links to other saved items you choose to connect
   - Highlight position on the page
   - Timestamp of creation and modification

2. **Screenshots (region and full-page)**
   - Screenshot images (stored as Base64-encoded PNG for region screenshots and JPEG for full-page screenshots)
   - Source webpage URL
   - User-created tags
   - Optional title and notes
   - Links to other saved items you choose to connect
   - Timestamp of creation
   - Recognized text, only when you choose "Recognize text" on a screenshot (processed offline on your device)
   - An optional price, read from the recognized text or typed by you, used to sort the compare view

3. **User Preferences**
   - Default highlight color (the color you picked last) and interface language
   - Position of the floating button on the page

### How Data is Stored

- Highlights, screenshots, tags, recognized text, prices and the floating button position are stored with Chrome's local storage (`chrome.storage.local`) and stay on your device
- Your two preferences, the default highlight color and the interface language, are stored with Chrome's sync storage (`chrome.storage.sync`). If you are signed in to Chrome with sync turned on, Chrome copies these two values to your other Chrome browsers through your Google account. Aureen itself never sends them anywhere
- The Extension makes **no network requests** and has no server of its own
- Data is **never shared** with third parties
- We do not collect any analytics, usage statistics, or telemetry data

## Data Usage

The collected data is used exclusively for:

- Displaying your saved highlights and screenshots
- Organizing content with tags
- Filtering and searching your saved items
- Comparing screenshots that share a tag, sorted by price
- Exporting your data as JSON, Markdown, or PDF files saved to your device

## Data Access

- Only you have access to your data
- The Extension does not transmit any data outside your browser, apart from Chrome's own sync of the two preferences described above
- No remote servers are contacted for data storage or processing; text recognition runs offline with files bundled in the Extension
- Your data remains entirely under your control

## Data Retention and Deletion

- Data is retained indefinitely until you choose to delete it
- You can delete individual highlights or screenshots at any time through the Extension's interface
- You can completely remove all data by uninstalling the Extension or clearing Chrome's local storage for the Extension

## Permissions Explanation

The Extension requires the following permissions:

- **storage**: To save your highlights, screenshots, and preferences locally
- **activeTab**: To capture the visible area of the tab you are viewing when you take a screenshot
- **scripting**: To add the Extension's page script to tabs that were already open before the Extension was installed or updated, so highlighting and capturing work without reloading them
- **host_permissions (<all_urls>)**: To allow you to use highlighting and screenshot features on any website you visit
- **offscreen**: To run offline text recognition (OCR) on a saved screenshot in a hidden extension page; the image never leaves your device

These permissions are used **exclusively** for the functionality described above and do not enable any data collection or transmission.

## Third-Party Services

The Extension does **not** use any third-party services, analytics tools, or advertising networks.

## Changes to Privacy Policy

We may update this Privacy Policy from time to time. Any changes will be reflected in the "Last Updated" date at the top of this document. Continued use of the Extension after changes constitutes acceptance of the updated policy.

## Children's Privacy

The Extension does not knowingly collect any data from children under 13 years of age.

## Data Security

While we take reasonable precautions to protect your data through Chrome's built-in storage mechanisms, please be aware that:

- Data is stored locally on your device
- Security depends on your device's security and Chrome browser security
- We recommend keeping your browser and operating system updated

## Your Rights

As a user, you have the right to:

- Access all your stored data through the Extension interface
- Export your data as JSON, Markdown, or PDF files
- Delete any or all of your data at any time
- Uninstall the Extension, which removes all associated local data

## Contact Information

If you have any questions or concerns about this Privacy Policy, please contact us:

- GitHub Issues: https://github.com/rrspw-oo/Aureen/issues

## Compliance

This Extension complies with:

- Chrome Web Store Developer Program Policies
- General Data Protection Regulation (GDPR) principles
- California Consumer Privacy Act (CCPA) principles

## Consent

By installing and using the Aureen Extension, you consent to this Privacy Policy.
