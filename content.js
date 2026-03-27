const api = globalThis.browser ?? globalThis.chrome;

const STYLE_ID = "dark-mode-rgaa-styles";
const FALLBACK_ID = "dark-mode-rgaa-fallback";
const DEFAULTS = {
  enabled: false,
  intensity: 90,
  mode: "auto",
  excludedSites: [],
  textSpacing: false,
  stopAnimations: false,
  textZoom: 100,
  enhancedFocus: false,
  enhancedContrast: false,
  imagesAsText: false,
  underlineLinks: false,
  skipLink: false,
  flagNewWindow: false,
  blockAutoRefresh: false,
  muteAutoplay: false,
  forceMediaControls: false,
  improveReflow: false,
  forceSubtitles: false,
  simplifiedView: false,
};

(function injectFallback() {
  if (!window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return;
  }

  const fallback = document.createElement("style");
  fallback.id = FALLBACK_ID;
  fallback.textContent = `
    html.dark-mode-rgaa-fallback {
      background-color: #1a1a2e !important;
      color-scheme: dark;
    }
  `;
  (document.head || document.documentElement).appendChild(fallback);
  document.documentElement.classList.add("dark-mode-rgaa-fallback");
})();

function removeFallback() {
  document.documentElement.classList.remove("dark-mode-rgaa-fallback");
  const el = document.getElementById(FALLBACK_ID);
  if (el) el.remove();
}

function systemPrefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

window
  .matchMedia("(prefers-color-scheme: dark)")
  .addEventListener("change", () => applyFromStorage());

function siteHasNativeDarkMode() {
  const meta = document.querySelector('meta[name="color-scheme"]');
  if (meta) {
    const content = meta.getAttribute("content") || "";
    if (content.includes("dark") && !content.includes("light")) {
      return true;
    }
  }

  const root = document.documentElement;
  const body = document.body;
  const darkIndicators = [
    () => root.classList.contains("dark"),
    () => root.getAttribute("data-theme") === "dark",
    () => root.getAttribute("data-color-mode") === "dark",
    () => root.getAttribute("data-bs-theme") === "dark",
    () => body && body.classList.contains("dark"),
    () => body && body.getAttribute("data-theme") === "dark",
  ];

  if (darkIndicators.some((check) => check())) {
    return true;
  }

  if (body) {
    const bgColor = getComputedStyle(body).backgroundColor;
    const luminance = parseLuminance(bgColor);
    if (luminance !== null && luminance < 0.2) {
      return true;
    }
  }

  return false;
}

function parseLuminance(color) {
  const match = color.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (!match) return null;

  const r = parseInt(match[1], 10) / 255;
  const g = parseInt(match[2], 10) / 255;
  const b = parseInt(match[3], 10) / 255;

  const toLinear = (c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

function isCurrentSiteExcluded(excludedSites) {
  const hostname = location.hostname;
  return excludedSites.some((pattern) => {
    if (pattern.startsWith("*.")) {
      const domain = pattern.slice(2);
      return hostname === domain || hostname.endsWith("." + domain);
    }
    return hostname === pattern;
  });
}

function shouldActivate(settings) {
  const { enabled, mode, excludedSites } = settings;

  if (isCurrentSiteExcluded(excludedSites || [])) {
    return false;
  }

  switch (mode) {
    case "auto":
      return systemPrefersDark();
    case "always":
      return true;
    case "manual":
      return enabled;
    default:
      return false;
  }
}

function buildDarkCSS(intensity) {
  const pct = Math.max(10, Math.min(100, intensity));
  const brightness = 2 - pct / 100;
  const reinvert = `invert(1) hue-rotate(180deg) brightness(${1 / brightness})`;

  return `
    html.dark-mode-rgaa {
      filter: invert(1) hue-rotate(180deg) brightness(${brightness});
      background-color: #fafafa !important;
      color-scheme: dark;
    }

    html.dark-mode-rgaa img:not(picture img),
    html.dark-mode-rgaa video,
    html.dark-mode-rgaa canvas,
    html.dark-mode-rgaa svg image,
    html.dark-mode-rgaa iframe,
    html.dark-mode-rgaa picture {
      filter: ${reinvert} !important;
    }

    html.dark-mode-rgaa picture img {
      filter: none !important;
    }

    html.dark-mode-rgaa [data-rgaa-has-bg-img] {
      filter: ${reinvert} !important;
    }

    html.dark-mode-rgaa [data-rgaa-has-bg-img] img,
    html.dark-mode-rgaa [data-rgaa-has-bg-img] video,
    html.dark-mode-rgaa [data-rgaa-has-bg-img] canvas {
      filter: none !important;
    }

    html.dark-mode-rgaa *:focus-visible {
      outline: 3px solid #005fcc !important;
      outline-offset: 2px !important;
    }

    html.dark-mode-rgaa ::selection {
      background-color: #b4d7ff !important;
      color: #000000 !important;
    }
  `;
}

function injectDarkMode(intensity) {
  let styleEl = document.getElementById(STYLE_ID);

  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = STYLE_ID;
    styleEl.setAttribute(
      "data-description",
      "Dark Mode RGAA — Accessibility extension",
    );
    const target = document.head || document.documentElement;
    target.appendChild(styleEl);
  }

  if (!styleEl.parentNode) {
    (document.head || document.documentElement).appendChild(styleEl);
  }

  styleEl.textContent = buildDarkCSS(intensity);
  document.documentElement.classList.add("dark-mode-rgaa");
  removeFallback();

  if (document.readyState !== "loading") {
    markBgImageElements();
    injectDarkModeIntoShadowRoots(intensity);
    startBgImageObserver();
  }
}

function markBgImageElements() {
  const mediaTags = new Set([
    "img",
    "picture",
    "video",
    "canvas",
    "iframe",
    "svg",
  ]);
  document.querySelectorAll("*:not([data-rgaa-has-bg-img])").forEach((el) => {
    if (mediaTags.has(el.tagName.toLowerCase())) return;
    if (el.closest("[data-rgaa-has-bg-img]")) return;
    const bg = getComputedStyle(el).backgroundImage;
    if (bg && bg !== "none" && bg.includes("url(")) {
      el.setAttribute("data-rgaa-has-bg-img", "true");
    }
  });
}

function clearBgImageMarks() {
  document.querySelectorAll("[data-rgaa-has-bg-img]").forEach((el) => {
    el.removeAttribute("data-rgaa-has-bg-img");
  });
}

let bgImageObserver = null;
let bgImageScanTimer = null;

function startBgImageObserver() {
  if (bgImageObserver) return;
  bgImageObserver = new MutationObserver(() => {
    if (!document.documentElement.classList.contains("dark-mode-rgaa")) return;
    clearTimeout(bgImageScanTimer);
    bgImageScanTimer = setTimeout(() => markBgImageElements(), 500);
  });
  bgImageObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
}

function stopBgImageObserver() {
  if (bgImageObserver) {
    bgImageObserver.disconnect();
    bgImageObserver = null;
  }
  clearTimeout(bgImageScanTimer);
}

const SHADOW_STYLE_ID = "dark-mode-rgaa-shadow";

function injectDarkModeIntoShadowRoots(intensity) {
  const css = buildDarkCSS(intensity).replace(
    /html\.dark-mode-rgaa/g,
    ":host-context(html.dark-mode-rgaa)",
  );
  walkShadowRoots(document.body, (shadowRoot) => {
    let existing = shadowRoot.getElementById(SHADOW_STYLE_ID);
    if (!existing) {
      existing = document.createElement("style");
      existing.id = SHADOW_STYLE_ID;
      shadowRoot.appendChild(existing);
    }
    existing.textContent = css;
  });
}

function removeDarkModeFromShadowRoots() {
  walkShadowRoots(document.body, (shadowRoot) => {
    const el = shadowRoot.getElementById(SHADOW_STYLE_ID);
    if (el) el.remove();
  });
}

function walkShadowRoots(root, callback) {
  if (!root) return;
  const elements = root.querySelectorAll("*");
  elements.forEach((el) => {
    if (el.shadowRoot) {
      callback(el.shadowRoot);
      walkShadowRoots(el.shadowRoot, callback);
    }
  });
}

function removeDarkMode() {
  const styleEl = document.getElementById(STYLE_ID);
  if (styleEl) styleEl.remove();
  document.documentElement.classList.remove("dark-mode-rgaa");
  stopBgImageObserver();
  clearBgImageMarks();
  removeDarkModeFromShadowRoots();
  removeFallback();
}

function injectFeatureStyle(id, cssText, htmlClass) {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement("style");
    el.id = id;
    (document.head || document.documentElement).appendChild(el);
  }
  if (!el.parentNode) {
    (document.head || document.documentElement).appendChild(el);
  }
  el.textContent = cssText;
  if (htmlClass) document.documentElement.classList.add(htmlClass);
}

function removeFeatureStyle(id, htmlClass) {
  const el = document.getElementById(id);
  if (el) el.remove();
  if (htmlClass) document.documentElement.classList.remove(htmlClass);
}

const TEXT_SPACING_ID = "dark-mode-rgaa-text-spacing";

function buildTextSpacingCSS() {
  return `
    html.rgaa-text-spacing * {
      line-height: 1.5 !important;
      letter-spacing: 0.12em !important;
      word-spacing: 0.16em !important;
    }
    html.rgaa-text-spacing p,
    html.rgaa-text-spacing li,
    html.rgaa-text-spacing dd {
      margin-bottom: 2em !important;
    }
  `;
}

function applyTextSpacing(enabled) {
  if (enabled) {
    injectFeatureStyle(
      TEXT_SPACING_ID,
      buildTextSpacingCSS(),
      "rgaa-text-spacing",
    );
  } else {
    removeFeatureStyle(TEXT_SPACING_ID, "rgaa-text-spacing");
  }
}

const STOP_ANIMATIONS_ID = "dark-mode-rgaa-stop-animations";

function buildStopAnimationsCSS() {
  return `
    html.rgaa-stop-animations *,
    html.rgaa-stop-animations *::before,
    html.rgaa-stop-animations *::after {
      animation-duration: 0.001ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.001ms !important;
      scroll-behavior: auto !important;
    }
    html.rgaa-stop-animations img[src$=".gif"],
    html.rgaa-stop-animations img[src*=".gif?"] {
      visibility: hidden;
    }
  `;
}

function applyStopAnimations(enabled) {
  if (enabled) {
    injectFeatureStyle(
      STOP_ANIMATIONS_ID,
      buildStopAnimationsCSS(),
      "rgaa-stop-animations",
    );
  } else {
    removeFeatureStyle(STOP_ANIMATIONS_ID, "rgaa-stop-animations");
  }
}

const TEXT_ZOOM_ID = "dark-mode-rgaa-text-zoom";

function buildTextZoomCSS(zoom) {
  if (zoom <= 100) return "";
  return `
    html.rgaa-text-zoom {
      font-size: ${zoom}% !important;
    }
  `;
}

function applyTextZoom(zoom) {
  const pct = Math.max(100, Math.min(200, zoom));
  if (pct <= 100) {
    removeFeatureStyle(TEXT_ZOOM_ID, "rgaa-text-zoom");
  } else {
    injectFeatureStyle(TEXT_ZOOM_ID, buildTextZoomCSS(pct), "rgaa-text-zoom");
  }
}

const ENHANCED_FOCUS_ID = "dark-mode-rgaa-enhanced-focus";

function buildEnhancedFocusCSS() {
  return `
    html.rgaa-enhanced-focus *:focus,
    html.rgaa-enhanced-focus *:focus-visible {
      outline: 3px solid #005fcc !important;
      outline-offset: 2px !important;
      box-shadow: 0 0 0 5px rgba(0, 95, 204, 0.3) !important;
    }
    html.rgaa-enhanced-focus a:focus,
    html.rgaa-enhanced-focus button:focus,
    html.rgaa-enhanced-focus input:focus,
    html.rgaa-enhanced-focus select:focus,
    html.rgaa-enhanced-focus textarea:focus,
    html.rgaa-enhanced-focus [tabindex]:focus {
      outline: 3px solid #005fcc !important;
      outline-offset: 2px !important;
      box-shadow: 0 0 0 5px rgba(0, 95, 204, 0.3) !important;
    }
  `;
}

function applyEnhancedFocus(enabled) {
  if (enabled) {
    injectFeatureStyle(
      ENHANCED_FOCUS_ID,
      buildEnhancedFocusCSS(),
      "rgaa-enhanced-focus",
    );
  } else {
    removeFeatureStyle(ENHANCED_FOCUS_ID, "rgaa-enhanced-focus");
  }
}

const ENHANCED_CONTRAST_ID = "dark-mode-rgaa-enhanced-contrast";

function buildEnhancedContrastCSS() {
  const decontrast = `contrast(${1 / 1.3})`;
  return `
    html.rgaa-enhanced-contrast {
      filter: contrast(1.3) !important;
    }
    html.rgaa-enhanced-contrast img:not(picture img),
    html.rgaa-enhanced-contrast video,
    html.rgaa-enhanced-contrast canvas,
    html.rgaa-enhanced-contrast svg image,
    html.rgaa-enhanced-contrast iframe,
    html.rgaa-enhanced-contrast picture {
      filter: ${decontrast} !important;
    }
    html.rgaa-enhanced-contrast picture img {
      filter: none !important;
    }
  `;
}

function buildMergedDarkContrastCSS(intensity) {
  const pct = Math.max(10, Math.min(100, intensity));
  const brightness = 2 - pct / 100;
  const reinvert = `invert(1) hue-rotate(180deg) brightness(${1 / brightness}) contrast(${1 / 1.3})`;

  return `
    html.dark-mode-rgaa.rgaa-enhanced-contrast {
      filter: invert(1) hue-rotate(180deg) brightness(${brightness}) contrast(1.3) !important;
      background-color: #fafafa !important;
      color-scheme: dark;
    }
    html.dark-mode-rgaa.rgaa-enhanced-contrast img:not(picture img),
    html.dark-mode-rgaa.rgaa-enhanced-contrast video,
    html.dark-mode-rgaa.rgaa-enhanced-contrast canvas,
    html.dark-mode-rgaa.rgaa-enhanced-contrast svg image,
    html.dark-mode-rgaa.rgaa-enhanced-contrast iframe,
    html.dark-mode-rgaa.rgaa-enhanced-contrast picture {
      filter: ${reinvert} !important;
    }
    html.dark-mode-rgaa.rgaa-enhanced-contrast picture img {
      filter: none !important;
    }
    html.dark-mode-rgaa.rgaa-enhanced-contrast [data-rgaa-has-bg-img] {
      filter: ${reinvert} !important;
    }
    html.dark-mode-rgaa.rgaa-enhanced-contrast [data-rgaa-has-bg-img] img,
    html.dark-mode-rgaa.rgaa-enhanced-contrast [data-rgaa-has-bg-img] video,
    html.dark-mode-rgaa.rgaa-enhanced-contrast [data-rgaa-has-bg-img] canvas {
      filter: none !important;
    }
  `;
}

const MERGED_FILTER_ID = "dark-mode-rgaa-merged-filter";

function applyEnhancedContrast(enabled, darkModeActive, intensity) {
  if (enabled) {
    if (darkModeActive) {
      removeFeatureStyle(ENHANCED_CONTRAST_ID, null);
      injectFeatureStyle(
        MERGED_FILTER_ID,
        buildMergedDarkContrastCSS(intensity),
        "rgaa-enhanced-contrast",
      );
    } else {
      removeFeatureStyle(MERGED_FILTER_ID, null);
      injectFeatureStyle(
        ENHANCED_CONTRAST_ID,
        buildEnhancedContrastCSS(),
        "rgaa-enhanced-contrast",
      );
    }
  } else {
    removeFeatureStyle(ENHANCED_CONTRAST_ID, "rgaa-enhanced-contrast");
    removeFeatureStyle(MERGED_FILTER_ID, null);
  }
}

const IMAGES_AS_TEXT_ID = "dark-mode-rgaa-images-as-text";
let imageObserver = null;

function buildImagesAsTextCSS() {
  return `
    html.rgaa-images-as-text img[alt]:not([alt=""]) {
      position: relative;
    }
    html.rgaa-images-as-text .rgaa-alt-overlay {
      display: block !important;
      background: #000000 !important;
      color: #ffffff !important;
      font-size: 0.875rem !important;
      line-height: 1.4 !important;
      padding: 0.25em 0.5em !important;
      border: 2px solid #005fcc !important;
      border-radius: 0.25rem !important;
      margin-top: 0.25em !important;
      max-width: 100% !important;
      word-break: break-word !important;
    }
    html.rgaa-images-as-text .rgaa-alt-overlay::before {
      content: "Alt: ";
      font-weight: 700;
    }
  `;
}

function addAltOverlays() {
  const images = document.querySelectorAll(
    'img[alt]:not([alt=""]):not([data-rgaa-alt-shown])',
  );
  images.forEach((img) => {
    const alt = img.getAttribute("alt");
    if (!alt || !alt.trim()) return;

    img.setAttribute("data-rgaa-alt-shown", "true");
    const overlay = document.createElement("span");
    overlay.className = "rgaa-alt-overlay";
    overlay.textContent = alt;
    img.insertAdjacentElement("afterend", overlay);
  });
}

function removeAltOverlays() {
  document.querySelectorAll(".rgaa-alt-overlay").forEach((el) => el.remove());
  document.querySelectorAll("[data-rgaa-alt-shown]").forEach((el) => {
    el.removeAttribute("data-rgaa-alt-shown");
  });
}

function applyImagesAsText(enabled) {
  if (enabled) {
    injectFeatureStyle(
      IMAGES_AS_TEXT_ID,
      buildImagesAsTextCSS(),
      "rgaa-images-as-text",
    );
    addAltOverlays();

    if (!imageObserver) {
      imageObserver = new MutationObserver(() => {
        if (
          document.documentElement.classList.contains("rgaa-images-as-text")
        ) {
          addAltOverlays();
        }
      });
      imageObserver.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    }
  } else {
    removeFeatureStyle(IMAGES_AS_TEXT_ID, "rgaa-images-as-text");
    removeAltOverlays();
    if (imageObserver) {
      imageObserver.disconnect();
      imageObserver = null;
    }
  }
}

const UNDERLINE_LINKS_ID = "dark-mode-rgaa-underline-links";

function buildUnderlineLinksCSS() {
  return `
    html.rgaa-underline-links a,
    html.rgaa-underline-links a:visited {
      text-decoration: underline !important;
      text-decoration-thickness: 2px !important;
      text-underline-offset: 0.15em !important;
    }
  `;
}

function applyUnderlineLinks(enabled) {
  if (enabled) {
    injectFeatureStyle(
      UNDERLINE_LINKS_ID,
      buildUnderlineLinksCSS(),
      "rgaa-underline-links",
    );
  } else {
    removeFeatureStyle(UNDERLINE_LINKS_ID, "rgaa-underline-links");
  }
}

const SKIP_LINK_ID = "dark-mode-rgaa-skip-link";
const SKIP_LINK_STYLE_ID = "dark-mode-rgaa-skip-link-style";

function buildSkipLinkCSS() {
  return `
    #dark-mode-rgaa-skip-link {
      position: fixed;
      top: -100%;
      left: 50%;
      transform: translateX(-50%);
      z-index: 2147483647;
      background: #005fcc;
      color: #ffffff;
      font-size: 1rem;
      font-weight: 700;
      padding: 0.75em 1.5em;
      border: 3px solid #ffffff;
      border-radius: 0 0 0.5rem 0.5rem;
      text-decoration: none;
      white-space: nowrap;
      transition: top 0.15s ease;
    }
    #dark-mode-rgaa-skip-link:focus {
      top: 0;
      outline: 3px solid #ffffff;
      outline-offset: 2px;
    }
  `;
}

function findMainTarget() {
  const main = document.querySelector(
    "main, [role='main'], #content, #main, #main-content",
  );
  if (main) {
    if (!main.id) main.id = "rgaa-main-content";
    return main.id;
  }
  return null;
}

function applySkipLink(enabled) {
  if (!enabled) {
    const el = document.getElementById(SKIP_LINK_ID);
    if (el) el.remove();
    removeFeatureStyle(SKIP_LINK_STYLE_ID, null);
    return;
  }
  if (document.readyState === "loading") return;

  const existing = document.getElementById(SKIP_LINK_ID);
  if (existing) return;

  const targetId = findMainTarget();
  if (!targetId) return;

  injectFeatureStyle(SKIP_LINK_STYLE_ID, buildSkipLinkCSS(), null);

  const link = document.createElement("a");
  link.id = SKIP_LINK_ID;
  link.href = `#${targetId}`;
  link.textContent = "Skip to main content";
  document.body.insertBefore(link, document.body.firstChild);
}

const FLAG_NEW_WINDOW_ID = "dark-mode-rgaa-flag-new-window";
let newWindowObserver = null;

function buildFlagNewWindowCSS() {
  return `
    html.rgaa-flag-new-window a[target="_blank"]::after,
    html.rgaa-flag-new-window a[target="blank"]::after {
      content: " \\2197  new window";
      font-size: 0.75em;
      font-weight: 400;
      font-style: italic;
      white-space: nowrap;
    }
  `;
}

function annotateNewWindowLinks() {
  const links = document.querySelectorAll(
    'a[target="_blank"]:not([data-rgaa-nw]), a[target="blank"]:not([data-rgaa-nw])',
  );
  links.forEach((a) => {
    const originalLabel = a.getAttribute("aria-label");
    if (originalLabel) {
      a.setAttribute("data-rgaa-nw-original-label", originalLabel);
    }
    a.setAttribute("data-rgaa-nw", "true");
    const currentLabel = originalLabel || a.textContent || "";
    if (
      !currentLabel.includes("new window") &&
      !currentLabel.includes("nouvelle fenêtre")
    ) {
      const text = (a.textContent || "").trim();
      if (text) {
        a.setAttribute("aria-label", `${text} (opens in a new window)`);
      }
    }
  });
}

function removeNewWindowAnnotations() {
  document.querySelectorAll("[data-rgaa-nw]").forEach((el) => {
    const originalLabel = el.getAttribute("data-rgaa-nw-original-label");
    if (originalLabel) {
      el.setAttribute("aria-label", originalLabel);
      el.removeAttribute("data-rgaa-nw-original-label");
    } else {
      el.removeAttribute("aria-label");
    }
    el.removeAttribute("data-rgaa-nw");
  });
}

function applyFlagNewWindow(enabled) {
  if (enabled) {
    injectFeatureStyle(
      FLAG_NEW_WINDOW_ID,
      buildFlagNewWindowCSS(),
      "rgaa-flag-new-window",
    );
    if (document.readyState !== "loading") {
      annotateNewWindowLinks();
    }

    if (!newWindowObserver) {
      newWindowObserver = new MutationObserver(() => {
        if (
          document.documentElement.classList.contains("rgaa-flag-new-window")
        ) {
          annotateNewWindowLinks();
        }
      });
      newWindowObserver.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    }
  } else {
    removeFeatureStyle(FLAG_NEW_WINDOW_ID, "rgaa-flag-new-window");
    removeNewWindowAnnotations();
    if (newWindowObserver) {
      newWindowObserver.disconnect();
      newWindowObserver = null;
    }
  }
}

function applyBlockAutoRefresh(enabled) {
  if (!enabled) return;
  if (document.readyState === "loading") return;

  document.querySelectorAll('meta[http-equiv="refresh"]').forEach((meta) => {
    meta.remove();
  });
}

function applyStopMovingContent(enabled) {
  if (!enabled) {
    document.querySelectorAll("marquee[data-rgaa-stopped]").forEach((el) => {
      el.removeAttribute("data-rgaa-stopped");
      el.style.removeProperty("overflow");
      el.style.removeProperty("white-space");
      if (typeof el.start === "function") el.start();
    });
    document.querySelectorAll("blink[data-rgaa-stopped]").forEach((el) => {
      el.removeAttribute("data-rgaa-stopped");
      el.style.removeProperty("text-decoration");
      el.style.removeProperty("animation");
    });
    return;
  }
  if (document.readyState === "loading") return;

  document
    .querySelectorAll("marquee:not([data-rgaa-stopped])")
    .forEach((el) => {
      el.setAttribute("data-rgaa-stopped", "true");
      if (typeof el.stop === "function") el.stop();
      el.style.setProperty("overflow", "visible", "important");
      el.style.setProperty("white-space", "normal", "important");
    });
  document.querySelectorAll("blink:not([data-rgaa-stopped])").forEach((el) => {
    el.setAttribute("data-rgaa-stopped", "true");
    el.style.setProperty("text-decoration", "none", "important");
    el.style.setProperty("animation", "none", "important");
  });
}

let autoplayObserver = null;

function muteAutoplayElements() {
  const media = document.querySelectorAll(
    "video[autoplay]:not([data-rgaa-muted]), audio[autoplay]:not([data-rgaa-muted])",
  );
  media.forEach((el) => {
    el.setAttribute("data-rgaa-muted", "true");
    el.muted = true;
    el.pause();
  });
}

function restoreMutedElements() {
  document.querySelectorAll("[data-rgaa-muted]").forEach((el) => {
    el.removeAttribute("data-rgaa-muted");
    el.muted = false;
  });
}

function applyMuteAutoplay(enabled) {
  if (!enabled) {
    if (autoplayObserver) {
      autoplayObserver.disconnect();
      autoplayObserver = null;
    }
    restoreMutedElements();
    return;
  }
  if (document.readyState === "loading") return;

  muteAutoplayElements();

  if (!autoplayObserver) {
    autoplayObserver = new MutationObserver(() => muteAutoplayElements());
    autoplayObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }
}

let mediaControlsObserver = null;

function forceControlsOnMedia() {
  const media = document.querySelectorAll(
    "video:not([controls]):not([data-rgaa-controls]), audio:not([controls]):not([data-rgaa-controls])",
  );
  media.forEach((el) => {
    el.setAttribute("data-rgaa-controls", "true");
    el.setAttribute("controls", "");
  });
}

function removeForceControls() {
  document.querySelectorAll("[data-rgaa-controls]").forEach((el) => {
    el.removeAttribute("data-rgaa-controls");
    el.removeAttribute("controls");
  });
}

function applyForceMediaControls(enabled) {
  if (!enabled) {
    if (mediaControlsObserver) {
      mediaControlsObserver.disconnect();
      mediaControlsObserver = null;
    }
    removeForceControls();
    return;
  }
  if (document.readyState === "loading") return;

  forceControlsOnMedia();

  if (!mediaControlsObserver) {
    mediaControlsObserver = new MutationObserver(() => forceControlsOnMedia());
    mediaControlsObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }
}

const IMPROVE_REFLOW_ID = "dark-mode-rgaa-improve-reflow";

function buildImproveReflowCSS() {
  return `
    html.rgaa-improve-reflow img,
    html.rgaa-improve-reflow video,
    html.rgaa-improve-reflow iframe,
    html.rgaa-improve-reflow object,
    html.rgaa-improve-reflow embed,
    html.rgaa-improve-reflow svg,
    html.rgaa-improve-reflow table {
      max-width: 100% !important;
      height: auto !important;
    }
    html.rgaa-improve-reflow pre,
    html.rgaa-improve-reflow code {
      white-space: pre-wrap !important;
      word-break: break-word !important;
    }
    html.rgaa-improve-reflow * {
      overflow-wrap: break-word !important;
      word-wrap: break-word !important;
    }
    html.rgaa-improve-reflow body {
      overflow-x: hidden !important;
    }
  `;
}

function applyImproveReflow(enabled) {
  if (enabled) {
    injectFeatureStyle(
      IMPROVE_REFLOW_ID,
      buildImproveReflowCSS(),
      "rgaa-improve-reflow",
    );
  } else {
    removeFeatureStyle(IMPROVE_REFLOW_ID, "rgaa-improve-reflow");
  }
}

let subtitleObserver = null;

function enableExistingSubtitles() {
  const videos = document.querySelectorAll("video:not([data-rgaa-subtitles])");
  videos.forEach((video) => {
    video.setAttribute("data-rgaa-subtitles", "true");
    const tracks = video.textTracks;
    if (!tracks) return;

    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      if (track.kind === "subtitles" || track.kind === "captions") {
        track.mode = "showing";
        break;
      }
    }
  });
}

function disableForceSubtitles() {
  document.querySelectorAll("[data-rgaa-subtitles]").forEach((video) => {
    video.removeAttribute("data-rgaa-subtitles");
    const tracks = video.textTracks;
    if (!tracks) return;
    for (let i = 0; i < tracks.length; i++) {
      const track = tracks[i];
      if (track.kind === "subtitles" || track.kind === "captions") {
        track.mode = "disabled";
      }
    }
  });
}

function applyForceSubtitles(enabled) {
  if (!enabled) {
    if (subtitleObserver) {
      subtitleObserver.disconnect();
      subtitleObserver = null;
    }
    disableForceSubtitles();
    return;
  }
  if (document.readyState === "loading") return;

  enableExistingSubtitles();

  if (!subtitleObserver) {
    subtitleObserver = new MutationObserver(() => enableExistingSubtitles());
    subtitleObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }
}

const SIMPLIFIED_VIEW_ID = "dark-mode-rgaa-simplified-view";

function buildSimplifiedViewCSS() {
  return `
    html.rgaa-simplified-view body * {
      float: none !important;
      position: static !important;
      display: revert !important;
      width: auto !important;
      min-width: 0 !important;
      max-width: 100% !important;
      margin-left: auto !important;
      margin-right: auto !important;
      padding-left: revert !important;
      padding-right: revert !important;
      background: none !important;
      border: revert !important;
      box-shadow: none !important;
      transform: none !important;
      columns: auto !important;
      flex: revert !important;
      grid: revert !important;
    }
    html.rgaa-simplified-view body {
      max-width: 45em !important;
      margin: 1em auto !important;
      padding: 1em !important;
      font-family: system-ui, sans-serif !important;
      font-size: 1.125rem !important;
      line-height: 1.6 !important;
      color: #1a1a1a !important;
      background: #ffffff !important;
    }
    html.rgaa-simplified-view img {
      max-width: 100% !important;
      height: auto !important;
    }
    html.rgaa-simplified-view a {
      color: #005fcc !important;
      text-decoration: underline !important;
    }
    html.rgaa-simplified-view h1, html.rgaa-simplified-view h2,
    html.rgaa-simplified-view h3, html.rgaa-simplified-view h4,
    html.rgaa-simplified-view h5, html.rgaa-simplified-view h6 {
      margin-top: 1.5em !important;
      margin-bottom: 0.5em !important;
      line-height: 1.3 !important;
      color: #1a1a1a !important;
    }
    html.rgaa-simplified-view p,
    html.rgaa-simplified-view li,
    html.rgaa-simplified-view dd {
      margin-bottom: 0.75em !important;
    }
    html.rgaa-simplified-view ul,
    html.rgaa-simplified-view ol {
      padding-left: 1.5em !important;
    }
    html.rgaa-simplified-view table {
      border-collapse: collapse !important;
      width: 100% !important;
    }
    html.rgaa-simplified-view td,
    html.rgaa-simplified-view th {
      border: 1px solid #ccc !important;
      padding: 0.5em !important;
    }
  `;
}

function applySimplifiedView(enabled) {
  if (enabled) {
    injectFeatureStyle(
      SIMPLIFIED_VIEW_ID,
      buildSimplifiedViewCSS(),
      "rgaa-simplified-view",
    );
  } else {
    removeFeatureStyle(SIMPLIFIED_VIEW_ID, "rgaa-simplified-view");
  }
}

function isContextValid() {
  try {
    return !!api.runtime.id;
  } catch {
    return false;
  }
}

let pendingApply = null;

async function applyFromStorage() {
  if (!isContextValid()) return;

  if (pendingApply) {
    pendingApply.rerun = true;
    return;
  }

  const state = { rerun: false };
  pendingApply = state;

  try {
    let settings;
    try {
      settings = await api.storage.sync.get(DEFAULTS);
    } catch (err) {
      if (!isContextValid()) return;
      console.warn("Dark Mode RGAA: unable to read storage", err);
      settings = { ...DEFAULTS };
    }

    let darkActive = false;
    try {
      darkActive =
        shouldActivate(settings) &&
        !(document.readyState !== "loading" && siteHasNativeDarkMode());
    } catch {
      darkActive = false;
    }

    if (darkActive) {
      injectDarkMode(settings.intensity);
    } else {
      removeDarkMode();
    }

    applyTextSpacing(settings.textSpacing);
    applyStopAnimations(settings.stopAnimations);
    applyTextZoom(settings.textZoom || 100);
    applyEnhancedFocus(settings.enhancedFocus);
    applyEnhancedContrast(
      settings.enhancedContrast,
      darkActive,
      settings.intensity,
    );

    applyUnderlineLinks(settings.underlineLinks);
    applyFlagNewWindow(settings.flagNewWindow);
    applyImproveReflow(settings.improveReflow);
    applySimplifiedView(settings.simplifiedView);

    if (document.readyState !== "loading") {
      applyImagesAsText(settings.imagesAsText);
      applySkipLink(settings.skipLink);
      applyBlockAutoRefresh(settings.blockAutoRefresh);
      applyStopMovingContent(settings.stopAnimations);
      applyMuteAutoplay(settings.muteAutoplay);
      applyForceMediaControls(settings.forceMediaControls);
      applyForceSubtitles(settings.forceSubtitles);
    }
  } catch (err) {
    console.warn("Dark Mode RGAA: error in applyFromStorage", err);
  } finally {
    const shouldRerun = state.rerun;
    pendingApply = null;
    if (shouldRerun) {
      applyFromStorage();
    }
  }
}

try {
  api.storage.onChanged.addListener((changes, area) => {
    if (area === "sync") {
      applyFromStorage();
    }
  });
} catch (err) {
  console.warn("Dark Mode RGAA: unable to listen to storage.onChanged", err);
}

try {
  api.runtime.onMessage.addListener((message) => {
    if (message.action === "applySettings") {
      applyFromStorage();
    }
  });
} catch (err) {
  console.warn("Dark Mode RGAA: unable to listen to runtime.onMessage", err);
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && isContextValid()) {
    applyFromStorage();
  }
});

applyFromStorage();

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    () => {
      applyFromStorage();
    },
    { once: true },
  );
}
