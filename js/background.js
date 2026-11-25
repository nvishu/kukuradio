/* =========================================================================
   KUKU RADIO — js/background.js
   -------------------------------------------------------------------------
   Crossfading full-page station backgrounds + the ambient starfield.
   Upgrades:
   - Loads & displays the 1st background image immediately while remaining
     images preload in the background.
   - Pauses crossfade timers when the browser tab is hidden to save CPU/GPU.
   ========================================================================= */

const stationBgA = document.getElementById('station-bg-a');
const stationBgB = document.getElementById('station-bg-b');
const stationBgError = document.getElementById('station-bg-error');
const sky = document.getElementById('sky');

const BG_INTERVAL = 10000;
const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
export let prefersReducedMotion = motionQuery.matches;

let bgTimer = null;
let bgIndex = 0;
let bgShowingA = true;
let bgRunId = 0;
let activeImages = [];

motionQuery.addEventListener?.('change', (e) => {
  prefersReducedMotion = e.matches;
  buildSky();
});

export function clearStationBackground() {
  bgRunId++;
  stopCycleTimer();
  activeImages = [];
  bgIndex = 0;
  bgShowingA = true;
  stationBgA.classList.remove('active');
  stationBgB.classList.remove('active');
  stationBgA.style.backgroundImage = '';
  stationBgB.style.backgroundImage = '';
  stationBgError.style.display = 'none';
}

function stopCycleTimer() {
  if (bgTimer) {
    clearInterval(bgTimer);
    bgTimer = null;
  }
}

function startCycleTimer() {
  stopCycleTimer();
  if (activeImages.length <= 1 || prefersReducedMotion || document.hidden) return;

  bgTimer = setInterval(() => {
    bgIndex = (bgIndex + 1) % activeImages.length;
    const incoming = bgShowingA ? stationBgB : stationBgA;
    const outgoing = bgShowingA ? stationBgA : stationBgB;
    incoming.style.backgroundImage = `url("${activeImages[bgIndex]}")`;
    void incoming.offsetWidth;
    incoming.classList.add('active');
    outgoing.classList.remove('active');
    bgShowingA = !bgShowingA;
  }, BG_INTERVAL);
}

// Pause background crossfades when tab is hidden
document.addEventListener('visibilitychange', () => {
  document.hidden ? stopCycleTimer() : startCycleTimer();
});

function preloadImage(src) {
  return new Promise((resolve) => {
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

export async function startStationBackground(station) {
  clearStationBackground();

  const images = Array.isArray(station.backgroundImages)
    ? station.backgroundImages.filter(Boolean)
    : [];

  if (!images.length) return;

  const runId = bgRunId;

  // 1. Load and paint the first image immediately for fast perceived load
  const firstLoaded = await preloadImage(images[0]);
  if (runId !== bgRunId) return;

  if (firstLoaded) {
    activeImages.push(firstLoaded);
    stationBgA.style.backgroundImage = `url("${firstLoaded}")`;
    stationBgA.classList.add('active');
  }

  // 2. Load remaining images in parallel
  if (images.length > 1) {
    const restLoaded = (await Promise.all(images.slice(1).map(preloadImage))).filter(Boolean);
    if (runId !== bgRunId) return;
    activeImages.push(...restLoaded);
  }

  if (!activeImages.length) {
    stationBgError.textContent = `${station.name} background not found. Check picture/ filenames.`;
    stationBgError.style.display = 'block';
    return;
  }

  // If the first image failed but a subsequent one succeeded, display it now
  if (!firstLoaded && activeImages.length > 0) {
    stationBgA.style.backgroundImage = `url("${activeImages[0]}")`;
    stationBgA.classList.add('active');
  }

  startCycleTimer();
}

export function buildSky() {
  if (!sky) return;
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
