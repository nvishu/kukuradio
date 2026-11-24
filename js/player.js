/* =========================================================================
   KUKU RADIO — js/player.js
   -------------------------------------------------------------------------
   Fully wired to all CSS hooks in components.css & animations.css:
   - Toggles .is-playing and .is-buffering on #btn-play
   - Sets --i on #tracklist li for first-paint stagger, then body.is-rendered
   - Syncs <meta name="theme-color"> with the active station's --bg-deep
   - Full ARIA slider support (aria-valuetext + Arrow/Home/End keys)
   ========================================================================= */

import { updateNeedle, updateDialLabels, updateFrequencyActive } from './dial.js';
import { startStationBackground } from './background.js';

const ICON_PLAY = '<path d="M8 5v14l11-7z"/>';
const ICON_PAUSE = '<path d="M6 5h4v14H6zm8 0h4v14h-4z"/>';
const STORAGE_VOL_KEY = 'kuku-volume';
const STORAGE_STATION_KEY = 'kuku-station';
const MAX_HISTORY = 50;

const THEME_META_COLORS = {
  rose: '#170812',
  original: '#0a141f',
  sky: '#160b24',
  funky: '#0f0e1a',
  party: '#051a1c',
  brown: '#150f0c'
};

const audio = document.getElementById('audio-player');
const npFreqLabel = document.getElementById('np-freq-label');
const npTitle = document.getElementById('np-title');
const npSubtitle = document.getElementById('np-subtitle');
const eqBars = document.getElementById('eq-bars');
const progressBar = document.getElementById('progress-bar');
const progressFill = document.getElementById('progress-fill');
const timeCurrent = document.getElementById('time-current');
const timeDuration = document.getElementById('time-duration');
const btnPlay = document.getElementById('btn-play');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
const playIcon = document.getElementById('play-icon');
const volumeSlider = document.getElementById('volume-slider');
const tracklistEl = document.getElementById('tracklist');
const tracklistHeading = document.querySelector('.tracklist-heading');
const themeMeta = document.querySelector('meta[name="theme-color"]');

const preloadAudio = new Audio();
preloadAudio.preload = 'metadata';

function formatTime(sec) {
  if (!isFinite(sec) || isNaN(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function shuffledIndices(length, avoidFirst) {
  const arr = Array.from({ length }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  if (avoidFirst !== undefined && arr.length > 1 && arr[0] === avoidFirst) {
    const swapWith = 1 + Math.floor(Math.random() * (arr.length - 1));
    [arr[0], arr[swapWith]] = [arr[swapWith], arr[0]];
  }
  return arr;
}

export function initPlayer(stations) {
  const savedVol = localStorage.getItem(STORAGE_VOL_KEY);
  if (savedVol !== null && !isNaN(parseFloat(savedVol))) {
    volumeSlider.value = savedVol;
  }
  audio.volume = parseFloat(volumeSlider.value);

  let currentStation = 0;
  let currentTrack = null;
  let renderedStationIdx = -1;
  let hasCompletedFirstPaint = false;
  let trackButtons = [];
  let bag = [];
  let history = [];
  let historyPos = -1;
  let isPlaying = false;
  let isScrubbing = false;
  let consecutiveErrors = 0;
  let errorSkipTimer = null;

  function refillBag(avoidFirst) {
    const len = stations[currentStation].tracks.length;
    bag = shuffledIndices(len, avoidFirst);
  }

  function advance() {
    const len = stations[currentStation].tracks.length;
    if (len === 0) return null;

    if (historyPos > -1 && historyPos < history.length - 1) {
      historyPos++;
      currentTrack = history[historyPos];
      return currentTrack;
    }

    if (bag.length === 0) refillBag(currentTrack);
    currentTrack = bag.shift();
    history.push(currentTrack);
    if (history.length > MAX_HISTORY) history.shift();
    historyPos = history.length - 1;
    return currentTrack;
  }

  function goBack() {
    if (historyPos > 0) {
      historyPos--;
      currentTrack = history[historyPos];
    } else if (audio.currentTime > 3) {
      audio.currentTime = 0;
    }
    return currentTrack;
  }

  function setTitle(text, { empty = false } = {}) {
    if (npTitle.textContent === text && npTitle.classList.contains('empty') === empty) return;
    npTitle.textContent = text;
    npTitle.classList.toggle('empty', empty);
    npTitle.classList.remove('changed');
    void npTitle.offsetWidth;
    npTitle.classList.add('changed');
  }

  function setSubtitle(text) {
    npSubtitle.textContent = text;
    npSubtitle.hidden = false;
    npSubtitle.classList.remove('changed');
    void npSubtitle.offsetWidth;
    npSubtitle.classList.add('changed');
  }

  function syncMediaSession(station, track) {
    if (!('mediaSession' in navigator)) return;
    if (!track) {
      navigator.mediaSession.metadata = null;
      return;
    }
    const artworkUrl = station.backgroundImages?.[0] || '';
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: `${station.freq} · ${station.name}`,
      album: 'KUKU RADIO',
      artwork: artworkUrl ? [{ src: artworkUrl, sizes: '512x512', type: 'image/jpeg' }] : []
    });
  }

  function preloadNextInBag() {
    const station = stations[currentStation];
    if (!station || !station.tracks.length || !bag.length) return;
    const nextTrackObj = station.tracks[bag[0]];
    if (nextTrackObj?.file) {
      preloadAudio.src = encodeURI(nextTrackObj.file);
    }
  }

  function loadCurrentTrack() {
    clearTimeout(errorSkipTimer);
    btnPlay.classList.remove('is-buffering');
    const station = stations[currentStation];
    npFreqLabel.textContent = `${station.freq} · ${station.name}`;

    if (station.tracks.length === 0 || currentTrack === null) {
      audio.removeAttribute('src');
      audio.load();
      setTitle("This frequency's still quiet", { empty: true });
      setSubtitle('New songs are on the way');
      setControlsEnabled(false);
      updateProgressUI(0, 0);
      syncMediaSession(station, null);
      renderOrUpdateTracklist(true);
      return;
    }

    const track = station.tracks[currentTrack];
    audio.src = encodeURI(track.file);
    setTitle(track.title, { empty: false });
    npSubtitle.hidden = true;
    setControlsEnabled(true);
    updateProgressUI(0, 0);
    syncMediaSession(station, track);
    renderOrUpdateTracklist(false);
    preloadNextInBag();
  }

  function renderOrUpdateTracklist(forceRebuild = false) {
    const station = stations[currentStation];

    if (!forceRebuild && renderedStationIdx === currentStation && trackButtons.length === station.tracks.length) {
      trackButtons.forEach((btn, i) => {
        const isActive = i === currentTrack;
        btn.classList.toggle('active', isActive);
        if (isActive) {
          btn.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      });
      return;
    }

    renderedStationIdx = currentStation;
    trackButtons = [];
    tracklistEl.replaceChildren();

    if (tracklistHeading) {
      tracklistHeading.textContent = station.tracks.length
        ? `On this frequency · ${station.tracks.length} songs`
        : 'On this frequency';
    }

    if (station.tracks.length === 0) {
      const note = document.createElement('p');
      note.className = 'empty-note';
      note.textContent = `Nothing on ${station.freq} yet — new songs are on the way.`;
      tracklistEl.appendChild(note);
      return;
    }

    const fragment = document.createDocumentFragment();
    station.tracks.forEach((track, i) => {
      const li = document.createElement('li');
      li.style.setProperty('--i', String(i));

      const btn = document.createElement('button');
      const index = document.createElement('span');
      const title = document.createElement('span');

      btn.type = 'button';
      btn.className = i === currentTrack ? 'active' : '';
      btn.dataset.trackIdx = String(i);
      btn.setAttribute('aria-label', `Play ${track.title}`);

      index.className = 'track-index';
      index.textContent = String(i + 1).padStart(2, '0');
      title.className = 'track-name';
      title.textContent = track.title;

      btn.append(index, title);
      li.appendChild(btn);
      trackButtons.push(btn);
      fragment.appendChild(li);
    });

    tracklistEl.appendChild(fragment);

    // Disable entrance stagger on subsequent station switches (animations.css §5)
    if (!hasCompletedFirstPaint) {
      hasCompletedFirstPaint = true;
      setTimeout(() => document.body.classList.add('is-rendered'), 800);
    }
  }

  tracklistEl.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-track-idx]');
    if (!btn) return;
    selectTrack(Number(btn.dataset.trackIdx));
  });

  function selectTrack(index) {
    if (index === currentTrack) {
      togglePlay();
      return;
    }
    const bagPos = bag.indexOf(index);
    if (bagPos !== -1) bag.splice(bagPos, 1);
    currentTrack = index;
    history.push(index);
    if (history.length > MAX_HISTORY) history.shift();
    historyPos = history.length - 1;
    loadCurrentTrack();
    playAudio();
  }

  function setControlsEnabled(enabled) {
    const len = stations[currentStation].tracks.length;
    btnPlay.disabled = !enabled;
    btnPrev.disabled = !enabled || len < 2;
    btnNext.disabled = !enabled || len < 2;
  }

  function applyStationTheme(index) {
    const theme = stations[index]?.theme || 'rose';
    document.body.setAttribute('data-theme', theme);
    if (themeMeta && THEME_META_COLORS[theme]) {
      themeMeta.setAttribute('content', THEME_META_COLORS[theme]);
    }
  }

  function goToStation(index, autoplay) {
    if (index < 0 || index >= stations.length) index = 0;
    clearTimeout(errorSkipTimer);
    consecutiveErrors = 0;

    pauseAudio();
    applyStationTheme(index);
    currentStation = index;
    localStorage.setItem(STORAGE_STATION_KEY, String(index));

    document.dispatchEvent(new CustomEvent('kuku:station-change', {
      detail: { stationId: stations[index].freq ?? String(index), index }
    }));

    history = [];
    historyPos = -1;
    bag = [];
    renderedStationIdx = -1;

    updateNeedle(index, stations.length);
    updateDialLabels(index);
    updateFrequencyActive(index);

    const len = stations[index].tracks.length;
    currentTrack = null;
    if (len > 0) {
      refillBag();
      advance();
    }

    loadCurrentTrack();
    startStationBackground(stations[index]);

    if (autoplay && len > 0) playAudio();
  }

  function nextTrack() {
    if (stations[currentStation].tracks.length === 0) return;
    advance();
    loadCurrentTrack();
    playAudio();
  }

  function prevTrack() {
    if (stations[currentStation].tracks.length === 0) return;
    goBack();
    loadCurrentTrack();
    playAudio();
  }

  function playAudio() {
    if (stations[currentStation].tracks.length === 0) return;
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          consecutiveErrors = 0;
          isPlaying = true;
          updatePlayUI();
        })
        .catch(() => {
          isPlaying = false;
          updatePlayUI();
        });
    }
  }

  function pauseAudio() {
    audio.pause();
    isPlaying = false;
    btnPlay.classList.remove('is-buffering');
    updatePlayUI();
  }

  function togglePlay() {
    isPlaying ? pauseAudio() : playAudio();
  }

  function updatePlayUI() {
    playIcon.innerHTML = isPlaying ? ICON_PAUSE : ICON_PLAY;
    btnPlay.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
    btnPlay.classList.toggle('is-playing', isPlaying);
    eqBars.classList.toggle('playing', isPlaying);
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    }
  }

  function updateProgressUI(current, duration) {
    const pct = duration ? Math.min(Math.max((current / duration) * 100, 0), 100) : 0;
    const curText = formatTime(current);
    const durText = formatTime(duration);

    progressFill.style.width = `${pct}%`;
    progressBar.style.setProperty('--knob-pos', `${pct}%`);
    progressBar.setAttribute('aria-valuenow', String(Math.round(pct)));
    progressBar.setAttribute('aria-valuetext', `${curText} of ${durText}`);
    timeCurrent.textContent = curText;
    timeDuration.textContent = durText;
  }

  // --- Audio Element Listeners ---
  audio.addEventListener('timeupdate', () => {
    if (!isScrubbing) updateProgressUI(audio.currentTime, audio.duration);
  });
  audio.addEventListener('loadedmetadata', () => updateProgressUI(audio.currentTime, audio.duration));
  audio.addEventListener('ended', nextTrack);
  audio.addEventListener('play', () => { isPlaying = true; updatePlayUI(); });
  audio.addEventListener('playing', () => {
    isPlaying = true;
    btnPlay.classList.remove('is-buffering');
    updatePlayUI();
  });
  audio.addEventListener('waiting', () => {
    if (isPlaying) btnPlay.classList.add('is-buffering');
  });
  audio.addEventListener('pause', () => {
    isPlaying = false;
    btnPlay.classList.remove('is-buffering');
    updatePlayUI();
  });

  audio.addEventListener('error', () => {
    const station = stations[currentStation];
    const track = currentTrack !== null ? station.tracks[currentTrack] : null;
    if (!track) return;

    console.warn('[KUKU RADIO] Audio could not be loaded:', track.file);
    consecutiveErrors++;
    isPlaying = false;
    btnPlay.classList.remove('is-buffering');
    updatePlayUI();

    if (consecutiveErrors >= station.tracks.length) {
      setSubtitle('Unable to load tracks right now — check your connection');
      return;
    }

    setSubtitle("Couldn't load that one — skipping ahead");
    if (station.tracks.length > 1) {
      clearTimeout(errorSkipTimer);
      errorSkipTimer = setTimeout(nextTrack, 1100);
    }
  });

  // --- Pointer Drag Scrubbing ---
  function seekFromPointer(clientX) {
    if (!audio.duration) return;
    const rect = progressBar.getBoundingClientRect();
    const pct = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    updateProgressUI(pct * audio.duration, audio.duration);
    return pct * audio.duration;
  }

  progressBar.addEventListener('pointerdown', (e) => {
    if (!audio.duration) return;
    isScrubbing = true;
    progressBar.setPointerCapture(e.pointerId);
    seekFromPointer(e.clientX);
  });

  progressBar.addEventListener('pointermove', (e) => {
    if (!isScrubbing) return;
    seekFromPointer(e.clientX);
  });

  progressBar.addEventListener('pointerup', (e) => {
    if (!isScrubbing) return;
    isScrubbing = false;
    const targetTime = seekFromPointer(e.clientX);
    if (typeof targetTime === 'number') audio.currentTime = targetTime;
  });

  progressBar.addEventListener('keydown', (e) => {
    if (!audio.duration) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      audio.currentTime = Math.min(audio.currentTime + 5, audio.duration);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      audio.currentTime = Math.max(audio.currentTime - 5, 0);
    } else if (e.key === 'Home') {
      e.preventDefault();
      audio.currentTime = 0;
    } else if (e.key === 'End') {
      e.preventDefault();
      audio.currentTime = audio.duration;
    }
  });

  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', playAudio);
    navigator.mediaSession.setActionHandler('pause', pauseAudio);
    navigator.mediaSession.setActionHandler('previoustrack', prevTrack);
    navigator.mediaSession.setActionHandler('nexttrack', nextTrack);
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime !== undefined && audio.duration) {
        audio.currentTime = details.seekTime;
      }
    });
  }

  document.addEventListener('keydown', (e) => {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON') return;
    if (e.code === 'Space') {
      e.preventDefault();
      togglePlay();
    } else if (e.key === 'm' || e.key === 'M') {
      audio.muted = !audio.muted;
    }
  });

  btnPlay.addEventListener('click', togglePlay);
  btnNext.addEventListener('click', nextTrack);
  btnPrev.addEventListener('click', prevTrack);
  volumeSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    audio.volume = val;
    audio.muted = false;
    localStorage.setItem(STORAGE_VOL_KEY, String(val));
  });

  const savedStation = parseInt(localStorage.getItem(STORAGE_STATION_KEY) || '0', 10);
  const initialStation = (!isNaN(savedStation) && savedStation >= 0 && savedStation < stations.length)
    ? savedStation
    : 0;

  return { goToStation, initialStation };
}
