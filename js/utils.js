/* =========================================================================
   KUKU RADIO — shared utilities
   ========================================================================= */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function clamp(n, min, max) {
  return Math.min(Math.max(n, min), max);
}

export function throttle(fn, wait) {
  let last = 0;
  let timer = null;
  return function throttled(...args) {
    const now = Date.now();
    const remaining = wait - (now - last);
    if (remaining <= 0) {
      last = now;
      fn.apply(this, args);
    } else if (!timer) {
      timer = setTimeout(() => {
        last = Date.now();
        timer = null;
        fn.apply(this, args);
      }, remaining);
    }
  };
}

export function debounce(fn, wait) {
  let timer = null;
  return function debounced(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}

/**
 * Validate and normalize a URL string.
 * Rejects javascript:, data:, vbscript: schemes.
 * Returns absolute URL or null.
 */
export function safeMediaUrl(raw, base = location.href) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed, base);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.href;
  } catch {
    return null;
  }
}

/**
 * Safe short text (max length) — collapses whitespace.
 */
export function safeText(value, maxLen = 200) {
  if (value == null) return '';
  const str = String(value).replace(/\s+/g, ' ').trim();
  return str.length > maxLen ? str.slice(0, maxLen) : str;
}

/**
 * Async preload image, resolves to url or null.
 */
export function preloadImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(src);
    img.onerror = () => {
      console.warn('[KUKU RADIO] Background image failed:', src);
      resolve(null);
    };
    img.src = src;
  });
}

/**
 * Runs a callback when the main thread is idle (or after a short timeout).
 */
export function onIdle(cb) {
  if ('requestIdleCallback' in window) {
    return window.requestIdleCallback(cb, { timeout: 1200 });
  }
  return setTimeout(cb, 200);
}

export const SAFE_THEMES = new Set(['rose', 'original', 'sky', 'funky', 'party', 'brown']);

export function safeTheme(theme) {
  return SAFE_THEMES.has(theme) ? theme : 'rose';
}
