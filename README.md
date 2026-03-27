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

- Chrome / Chromium / Microsoft Edge: Manifest V3 with service worker background
- Firefox: compatible build using `background.scripts`
- Safari: compatible as a Safari Web Extension package via Xcode or App Store Connect

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

### Chrome / Chromium / Microsoft Edge

Open the extensions page, enable developer mode, and load the unpacked extension from this folder.

For Microsoft Edge Add-ons, the current package can be ported with minimal changes because Edge supports the Chrome extension APIs and MV3 manifest format used by this project.

### Safari

Safari Web Extensions use the same HTML, CSS, JavaScript, and manifest files, but Safari packages them as an app extension.

Apple provides two supported paths:

1. Convert this folder into a Safari Web Extension project with Xcode's converter.
2. Package the extension for Safari through App Store Connect.

Relevant Apple documentation:

- Safari Web Extensions: https://developer.apple.com/documentation/safariservices/safari-web-extensions
- Safari extension packaging and conversion: https://developer.apple.com/safari/extensions/

## Notes

RGAA Toolkit is an assistance tool for manual review. It does not replace a full accessibility audit.
