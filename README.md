# RGAA Toolkit

RGAA Toolkit is a browser extension designed to support manual accessibility checks on web pages.

It provides quick visual and behavioral adjustments inspired by common RGAA review needs, directly from the browser popup.

## Main Features

- Dark mode with adjustable intensity
- Enhanced contrast
- Text spacing
- Text zoom
- Stronger visible focus styles
- Stop animations and moving content
- Display image alternative text
- Underline links
- Add a skip link when possible
- Flag links that open in a new window
- Block auto-refresh
- Mute autoplay media
- Force media controls
- Improve reflow on narrow layouts
- Enable subtitles when available
- Simplified reading view

## Compatibility

- Chrome / Chromium: Manifest V3 with service worker background
- Firefox: compatible build using `background.scripts`

## Privacy

The extension does not collect, transmit, or sell user data.

## Project Structure

- `manifest.json`: extension manifest
- `background.js`: background event handling
- `content.js`: page-side accessibility features
- `popup.html`, `popup.js`, `popup.css`: extension UI
- `icons/`: extension icons

## Installation

### Firefox

Load the packaged zip through AMO, or temporarily load the extension from the project directory during development.

### Chrome / Chromium

Open the extensions page, enable developer mode, and load the unpacked extension from this folder.

## Notes

RGAA Toolkit is an assistance tool for manual review. It does not replace a full accessibility audit.
