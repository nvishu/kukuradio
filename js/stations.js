/* =========================================================================
   KUKU RADIO — station loading + schema validation
   ========================================================================= */

import { safeMediaUrl, safeText, safeTheme } from './utils.js';

const MAX_STATIONS = 40;
const MAX_TRACKS_PER_STATION = 500;

function normalizeStation(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const freq = safeText(raw.freq, 12);
  const name = safeText(raw.name, 80);
  if (!freq || !name) return null;

  const theme = safeTheme(raw.theme);

  const backgroundImages = Array.isArray(raw.backgroundImages)
    ? raw.backgroundImages
        .map((url) => safeMediaUrl(url))
        .filter(Boolean)
        .slice(0, 8)
    : [];

  const tracks = Array.isArray(raw.tracks)
    ? raw.tracks
        .slice(0, MAX_TRACKS_PER_STATION)
        .map((t) => {
          if (!t || typeof t !== 'object') return null;
          const title = safeText(t.title, 200);
          const file = safeMediaUrl(t.file);
          if (!title || !file) return null;
          return { title, file };
        })
        .filter(Boolean)
    : [];

  return { freq, name, theme, backgroundImages, tracks };
}

export async function loadStations() {
  const res = await fetch('data/stations.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(`stations.json responded ${res.status}`);

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error('stations.json is not valid JSON');
  }

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('stations.json is empty or malformed');
  }

  const stations = data.slice(0, MAX_STATIONS).map(normalizeStation).filter(Boolean);

  if (stations.length === 0) {
    throw new Error('No valid stations found in stations.json');
  }

  return stations;
}
