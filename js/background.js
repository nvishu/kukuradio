/* =========================================================================
   KUKU RADIO — crossfading backgrounds + ambient starfield
   ========================================================================= */

const stationBgA       = document.getElementById('station-bg-a');
const stationBgB       = document.getElementById('station-bg-b');
const stationBgOverlay = document.querySelector('.station-bg-overlay');
const stationBgError   = document.getElementById('station-bg-error');
const sky              = document.getElementById('sky');

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

[stationBgA, stationBgB].forEach((layer) => {
  if (!layer) return;
  layer.addEventListener('transitionend', (e) => {
    if (e.propertyName === 'opacity') layer.style.willChange = 'auto';
  }, { passive: true });
});

if (stationBgOverlay) {
  stationBgOverlay.addEventListener('animationend', () => {
    stationBgOverlay.classList.remove('blooming');
  }, { passive: true });
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
  [stationBgA, stationBgB].forEach((layer) => {
    if (!layer) return;
    layer.classList.remove('active');
    layer.style.backgroundImage = '';
    layer.style.willChange = 'auto';
  });
  if (stationBgError) stationBgError.hidden = true;
}

function stopCycleTimer() {
  if (bgTimer) { clearInterval(bgTimer); bgTimer = null; }
}

function startCycleTimer() {
  stopCycleTimer();
  if (activeImages.length <= 1 || prefersReducedMotion || document.hidden) return;

  bgTimer = setInterval(() => {
    bgIndex = (bgIndex + 1) % activeImages.length;
    const incoming = bgShowingA ? stationBgB : stationBgA;
    const outgoing = bgShowingA ? stationBgA : stationBgB;
    if (!incoming || !outgoing) return;

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
  if (document.hidden) stopCycleTimer();
  else startCycleTimer();
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
  const frag = document.createDocumentFragment();
  for (let i = 0; i < count; i++) {
    const star = document.createElement('div');
    star.className = 'star';
    star.style.cssText =
      `width:${(Math.random() * 2 + 1).toFixed(1)}px;` +
      `height:${(Math.random() * 2 + 1).toFixed(1)}px;` +
      `left:${(Math.random() * 100).toFixed(2)}%;` +
      `top:${(Math.random() * 100).toFixed(2)}%;` +
      `--twinkle-dur:${(Math.random() * 3 + 2.5).toFixed(1)}s;` +
      `--twinkle-delay:${(Math.random() * 4).toFixed(1)}s;`;
    frag.appendChild(star);
  }
  sky.replaceChildren(frag);
}
