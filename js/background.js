/* =========================================================================
   KUKU RADIO — js/background.js
   -------------------------------------------------------------------------
   Crossfading full-page station backgrounds + the ambient starfield.
   Fully wired to components.css & animations.css hooks:
   - Uses [hidden] for .station-bg-error
   - Triggers .station-bg-overlay.blooming on station change
   - Applies will-change only during active transitions to save mobile VRAM
   ========================================================================= */

const stationBgA = document.getElementById('station-bg-a');
const stationBgB = document.getElementById('station-bg-b');
const stationBgOverlay = document.querySelector('.station-bg-overlay');
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

// Clean up GPU layer promotion once transition finishes
[stationBgA, stationBgB].forEach((layer) => {
  if (!layer) return;
  layer.addEventListener('transitionend', (e) => {
    if (e.propertyName === 'opacity') {
      layer.style.willChange = 'auto';
    }
  });
});

if (stationBgOverlay) {
  stationBgOverlay.addEventListener('animationend', () => {
    stationBgOverlay.classList.remove('blooming');
  });
}

function triggerBloom() {
  if (!stationBgOverlay || prefersReducedMotion) return;
  stationBgOverlay.classList.remove('blooming');
  void stationBgOverlay.offsetWidth;
  stationBgOverlay.classList.add('blooming');
}

export function clearStationBackground() {
  bgRunId++;
  stopCycleTimer();
  activeImages = [];
  bgIndex = 0;
  bgShowingA = true;
  if (stationBgA) {
    stationBgA.classList.remove('active');
    stationBgA.style.backgroundImage = '';
    stationBgA.style.willChange = 'auto';
  }
  if (stationBgB) {
    stationBgB.classList.remove('active');
    stationBgB.style.backgroundImage = '';
    stationBgB.style.willChange = 'auto';
  }
  if (stationBgError) {
    stationBgError.hidden = true;
  }
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

    incoming.style.willChange = 'opacity, transform';
    outgoing.style.willChange = 'opacity, transform';
    incoming.style.backgroundImage = `url("${activeImages[bgIndex]}")`;
    void incoming.offsetWidth;
    incoming.classList.add('active');
    outgoing.classList.remove('active');
    bgShowingA = !bgShowingA;
  }, BG_INTERVAL);
}

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
  triggerBloom();

  const images = Array.isArray(station.backgroundImages)
    ? station.backgroundImages.filter(Boolean)
    : [];

  if (!images.length) return;

  const runId = bgRunId;

  const firstLoaded = await preloadImage(images[0]);
  if (runId !== bgRunId) return;

  if (firstLoaded && stationBgA) {
    activeImages.push(firstLoaded);
    stationBgA.style.willChange = 'opacity, transform';
    stationBgA.style.backgroundImage = `url("${firstLoaded}")`;
    stationBgA.classList.add('active');
  }

  if (images.length > 1) {
    const restLoaded = (await Promise.all(images.slice(1).map(preloadImage))).filter(Boolean);
    if (runId !== bgRunId) return;
    activeImages.push(...restLoaded);
  }

  if (!activeImages.length) {
    if (stationBgError) {
      stationBgError.textContent = `${station.name} background not found. Check picture/ filenames.`;
      stationBgError.hidden = false;
    }
    return;
  }

  if (!firstLoaded && activeImages.length > 0 && stationBgA) {
    stationBgA.style.willChange = 'opacity, transform';
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
    html += `<div class="star" style="width:${size}px;height:${size}px;left:${left}%;top:${top}%;--twinkle-dur:${dur}s;--twinkle-delay:${delay}s;"></div>`;
  }
  sky.innerHTML = html;
}
