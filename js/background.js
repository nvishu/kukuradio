/* =========================================================================
   KUKU RADIO — js/background.js
   -------------------------------------------------------------------------
   Crossfading full-page station backgrounds + the ambient starfield.
   ========================================================================= */

const stationBgA = document.getElementById('station-bg-a');
const stationBgB = document.getElementById('station-bg-b');
const stationBgError = document.getElementById('station-bg-error');
const sky = document.getElementById('sky');

const BG_INTERVAL = 10000; // 10 seconds

let bgTimer = null;
let bgIndex = 0;
let bgShowingA = true;
let bgRunId = 0;

export const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function clearStationBackground() {
  bgRunId++;
  if (bgTimer) {
    clearInterval(bgTimer);
    bgTimer = null;
  }
  bgIndex = 0;
  bgShowingA = true;
  stationBgA.classList.remove('active');
  stationBgB.classList.remove('active');
  stationBgA.style.backgroundImage = '';
  stationBgB.style.backgroundImage = '';
  stationBgError.style.display = 'none';
}

function preloadImage(src) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(src);
    img.onerror = () => {
      console.error('[KUKU RADIO] Background image failed:', src);
      resolve(null);
    };
    img.src = src;
  });
}

export async function startStationBackground(station) {
  clearStationBackground();

  const images = Array.isArray(station.backgroundImages)
    ? station.backgroundImages.filter(Boolean)
    : [];

  if (!images.length) return;

  const runId = bgRunId;
  const loaded = (await Promise.all(images.map(preloadImage))).filter(Boolean);

  if (runId !== bgRunId) return; // station changed again while images were loading

  if (!loaded.length) {
    stationBgError.textContent = `${station.name} background not found. Check picture/ filenames.`;
    stationBgError.style.display = 'block';
    return;
  }

  bgIndex = 0;
  bgShowingA = true;
  stationBgA.style.backgroundImage = `url("${loaded[0]}")`;
  stationBgA.classList.add('active');

  if (loaded.length === 1) return;

  bgTimer = setInterval(() => {
    bgIndex = (bgIndex + 1) % loaded.length;
    const incoming = bgShowingA ? stationBgB : stationBgA;
    const outgoing = bgShowingA ? stationBgA : stationBgB;
    incoming.style.backgroundImage = `url("${loaded[bgIndex]}")`;
    void incoming.offsetWidth; // force reflow so the fade-in transition is picked up
    incoming.classList.add('active');
    outgoing.classList.remove('active');
    bgShowingA = !bgShowingA;
  }, BG_INTERVAL);
}

export function buildSky() {
  const count = prefersReducedMotion ? 18 : 34;
  let html = '';
  for (let i = 0; i < count; i++) {
    const size = (Math.random() * 2 + 1).toFixed(1);
    const left = (Math.random() * 100).toFixed(2);
    const top = (Math.random() * 100).toFixed(2);
    const dur = (Math.random() * 3 + 2.5).toFixed(1);
    const delay = (Math.random() * 4).toFixed(1);
    html += `<div class="star" style="width:${size}px;height:${size}px;left:${left}%;top:${top}%;animation-duration:${dur}s;animation-delay:${delay}s;"></div>`;
  }
  sky.innerHTML = html;
}
