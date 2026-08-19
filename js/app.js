/* =========================================================================
   KUKU RADIO — js/app.js
   -------------------------------------------------------------------------
   Entry point. Loads data/stations.json, then wires dial + player +
   background + live-count + PWA together and runs the opening needle
   sweep — same choreography as the original: needle jumps to the last
   station instantly, the tuning veil appears, then a moment later it
   sweeps down to station 0 and the veil clears.
   ========================================================================= */

import { buildDial, buildFrequencyButtons, updateNeedle, jumpNeedle } from './dial.js';
import { buildSky, prefersReducedMotion } from './background.js';
import { initPlayer } from './player.js';
import { initLiveCount } from './live-count.js';
import { initInstallPrompt, initServiceWorker, initSongRequestLink } from './pwa.js';

const dialConsole = document.getElementById('dial-console');

async function loadStations() {
  const res = await fetch('data/stations.json');
  if (!res.ok) throw new Error(`stations.json responded ${res.status}`);
  return res.json();
}

async function tuneIn() {
  let stations;
  try {
    stations = await loadStations();
  } catch (err) {
    console.error('[KUKU RADIO] Could not load station data:', err);
    const title = document.getElementById('np-title');
    title.textContent = "Couldn't load the stations — refresh to try again";
    title.classList.add('empty');
    return;
  }

  buildSky(prefersReducedMotion);
  initSongRequestLink();
  initInstallPrompt();
  initServiceWorker();
  initLiveCount();

  const player = initPlayer(stations);
  buildDial(stations);
  buildFrequencyButtons(stations, (i) => player.goToStation(i, true));

  if (!prefersReducedMotion) {
    jumpNeedle(stations.length - 1, stations.length);
    dialConsole.classList.add('tuning');
    setTimeout(() => {
      player.goToStation(0, false);
      setTimeout(() => dialConsole.classList.remove('tuning'), 500);
    }, 250);
  } else {
    player.goToStation(0, false);
  }
}

tuneIn();
