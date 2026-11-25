/* =========================================================================
   KUKU RADIO — js/app.js
   -------------------------------------------------------------------------
   Entry point. Loads data/stations.json, wires all modules together,
   and runs the opening needle sweep to the user's last-visited station.
   ========================================================================= */

import { buildDial, buildFrequencyButtons, jumpNeedle } from './dial.js';
import { buildSky, prefersReducedMotion } from './background.js';
import { initPlayer } from './player.js';
import { initLiveCount } from './live-count.js';
import { initInstallPrompt, initServiceWorker, initSongRequestLink } from './pwa.js';

const dialConsole = document.getElementById('dial-console');

async function loadStations() {
  const res = await fetch('data/stations.json');
  if (!res.ok) throw new Error(`stations.json responded ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('stations.json is empty or malformed');
  }
  return data;
}

async function tuneIn() {
  buildSky();
  initSongRequestLink();
  initInstallPrompt();
  initServiceWorker();

  let stations;
  try {
    stations = await loadStations();
  } catch (err) {
    console.error('[KUKU RADIO] Could not load station data:', err);
    const title = document.getElementById('np-title');
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
}

tuneIn();
/* =========================================================================
   KUKU RADIO — js/app.js
   -------------------------------------------------------------------------
   Entry point. Loads data/stations.json, wires all modules together,
   and runs the opening needle sweep to the user's last-visited station.
   ========================================================================= */

import { buildDial, buildFrequencyButtons, jumpNeedle } from './dial.js';
import { buildSky, prefersReducedMotion } from './background.js';
import { initPlayer } from './player.js';
import { initLiveCount } from './live-count.js';
import { initInstallPrompt, initServiceWorker, initSongRequestLink } from './pwa.js';

const dialConsole = document.getElementById('dial-console');

async function loadStations() {
  const res = await fetch('data/stations.json');
  if (!res.ok) throw new Error(`stations.json responded ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('stations.json is empty or malformed');
  }
  return data;
}

async function tuneIn() {
  buildSky();
  initSongRequestLink();
  initInstallPrompt();
  initServiceWorker();

  let stations;
  try {
    stations = await loadStations();
  } catch (err) {
    console.error('[KUKU RADIO] Could not load station data:', err);
    const title = document.getElementById('np-title');
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
}

tuneIn();
