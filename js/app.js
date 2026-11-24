/* =========================================================================
   KUKU RADIO — entry point
   ========================================================================= */

import { buildDial, buildFrequencyButtons, jumpNeedle } from './dial.js';
import { buildSky, prefersReducedMotion } from './background.js';
import { initPlayer } from './player.js';
import { initLiveCount } from './live-count.js';
import { initInstallPrompt, initServiceWorker, initSongRequestLink } from './pwa.js';
import { loadStations } from './stations.js';
import { $, $$, onIdle } from './utils.js';

const dialConsole = $('#dial-console');

function setupIconFallbacks() {
  $$('.quick-icon-img').forEach((img) => {
    img.addEventListener('error', () => {
      const span = document.createElement('span');
      span.className = 'quick-icon-fallback';
      span.textContent = img.dataset.fallback || '●';
      img.replaceWith(span);
    }, { once: true });
  });
}

async function tuneIn() {
  buildSky();
  setupIconFallbacks();
  initSongRequestLink();
  initInstallPrompt();
  initServiceWorker();

  let stations;
  try {
    stations = await loadStations();
  } catch (err) {
    console.error('[KUKU RADIO] Could not load station data:', err);
    const title = $('#np-title');
    if (title) {
      title.textContent = "Couldn't load the stations — refresh to try again";
      title.classList.add('empty');
    }
    return;
  }

  initLiveCount();

  const player = initPlayer(stations);
  const handleSelectStation = (i) => player.goToStation(i, true);

  buildDial(stations, handleSelectStation);
  buildFrequencyButtons(stations, handleSelectStation);

  const startIdx = player.initialStation ?? 0;

  if (!prefersReducedMotion && dialConsole) {
    const parkIdx = startIdx === stations.length - 1 ? 0 : stations.length - 1;
    jumpNeedle(parkIdx, stations.length);
    dialConsole.classList.add('tuning');
    setTimeout(() => {
      player.goToStation(startIdx, false);
      setTimeout(() => dialConsole.classList.remove('tuning'), 500);
    }, 250);
  } else {
    player.goToStation(startIdx, false);
  }

  // Non-critical work after first paint
  onIdle(() => {
    // Warm SW cache for next station images (best-effort)
    const next = stations[(startIdx + 1) % stations.length];
    if (next?.backgroundImages?.[0]) {
      const img = new Image();
      img.decoding = 'async';
      img.src = next.backgroundImages[0];
    }
  });
}

tuneIn();
