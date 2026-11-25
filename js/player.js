/* =========================================================================
   KUKU RADIO — js/player.js (Studio Edition)
   -------------------------------------------------------------------------
   Includes:
   - Fisher-Yates shuffle bag + session history
   - Rotating Vinyl Platter & Tonearm sync
   - Favorites persistence (localStorage) + Favorites filter
   - Live tracklist search filter (/)
   - Repeat One toggle (R)
   - Sleep Timer (15m / 30m / 45m / 60m)
   - Up Next preview pill
   ========================================================================= */

import { updateNeedle, updateDialLabels, updateFrequencyActive } from './dial.js';
import { startStationBackground } from './background.js';

const ICON_PLAY = '<path d="M8 5v14l11-7z"/>';
const ICON_PAUSE = '<path d="M6 5h4v14H6zm8 0h4v14h-4z"/>';
const ICON_VOL_ON = '<path d="M3 10v4h4l5 5V5L7 10H3zm13.5 2c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>';
const ICON_VOL_MUTE = '<path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>';

const STORAGE_VOL_KEY = 'kuku-volume';
const STORAGE_STATION_KEY = 'kuku-station';
const STORAGE_FAV_KEY = 'kuku-favorites';
const MAX_HISTORY = 50;
const SLEEP_PRESETS = [0, 15, 30, 45, 60]; // minutes

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
const vinylPlatter = document.getElementById('vinyl-platter');
const vinylLabel = document.getElementById('vinyl-label');
const vinylFreq = document.getElementById('vinyl-freq');
const progressBar = document.getElementById('progress-bar');
const progressFill = document.getElementById('progress-fill');
const timeCurrent = document.getElementById('time-current');
const timeDuration = document.getElementById('time-duration');
const btnPlay = document.getElementById('btn-play');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
const btnRepeat = document.getElementById('btn-repeat');
const repeatBadge = document.getElementById('repeat-badge');
const btnSleep = document.getElementById('btn-sleep');
const sleepLabel = document.getElementById('sleep-label');
const btnFavorite = document.getElementById('btn-favorite');
const btnShare = document.getElementById('btn-share');
const btnMute = document.getElementById('btn-mute');
const volumeIcon = document.getElementById('volume-icon');
const playIcon = document.getElementById('play-icon');
const volumeSlider = document.getElementById('volume-slider');
const upNextBtn = document.getElementById('up-next-btn');
const upNextTitle = document.getElementById('up-next-title');
const tracklistEl = document.getElementById('tracklist');
const tracklistHeading = document.getElementById('tracklist-heading');
const trackSearch = document.getElementById('track-search');
const btnFilterFav = document.getElementById('btn-filter-fav');
const favCountEl = document.getElementById('fav-count');
const toastNotice = document.getElementById('toast-notice');
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

  let favorites = new Set();
  try {
    const rawFavs = JSON.parse(localStorage.getItem(STORAGE_FAV_KEY) || '[]');
    if (Array.isArray(rawFavs)) favorites = new Set(rawFavs);
  } catch { /* ignore */ }

  let currentStation = 0;
  let currentTrack = null;
  let bag = [];
  let history = [];
  let historyPos = -1;
  let isPlaying = false;
  let isScrubbing = false;
  let repeatOne = false;
  let showFavsOnly = false;
  let searchQuery = '';
  let sleepPresetIndex = 0;
  let sleepTimer = null;
  let toastTimer = null;
  let consecutiveErrors = 0;
  let errorSkipTimer = null;

  function showToast(msg) {
    if (!toastNotice) return;
    toastNotice.textContent = msg;
    toastNotice.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toastNotice.hidden = true; }, 3200);
  }

  function saveFavorites() {
    try {
      localStorage.setItem(STORAGE_FAV_KEY, JSON.stringify(Array.from(favorites)));
    } catch { /* ignore */ }
    if (favCountEl) favCountEl.textContent = String(favorites.size);
  }

  saveFavorites();

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

  function updateVinylArtwork(station) {
    if (vinylFreq) vinylFreq.textContent = station.freq || '';
    if (!vinylLabel) return;
    const art = station.backgroundImages?.[0];
    vinylLabel.style.backgroundImage = art
      ? `url("${art}")`
      : 'linear-gradient(135deg, var(--accent), var(--accent-2))';
  }

  function updateUpNextUI() {
    const station = stations[currentStation];
    if (!station || station.tracks.length < 2) {
      if (upNextBtn) upNextBtn.hidden = true;
      return;
    }
    if (bag.length === 0) refillBag(currentTrack);
    const nextIdx = bag[0];
    const nextTrackObj = station.tracks[nextIdx];
    if (nextTrackObj && upNextBtn && upNextTitle) {
      upNextTitle.textContent = nextTrackObj.title;
      upNextBtn.hidden = false;
      preloadAudio.src = encodeURI(nextTrackObj.file);
    }
  }

  function updateFavButtonUI() {
    const station = stations[currentStation];
    const track = currentTrack !== null ? station?.tracks[currentTrack] : null;
    if (!btnFavorite || !track) return;
    const isFav = favorites.has(track.file);
    btnFavorite.classList.toggle('is-fav', isFav);
    btnFavorite.setAttribute('aria-pressed', String(isFav));
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

  function loadCurrentTrack() {
    clearTimeout(errorSkipTimer);
    btnPlay.classList.remove('is-buffering');
    const station = stations[currentStation];
    npFreqLabel.textContent = `${station.freq} · ${station.name}`;
    updateVinylArtwork(station);

    if (station.tracks.length === 0 || currentTrack === null) {
      audio.removeAttribute('src');
      audio.load();
      setTitle("This frequency's still quiet", { empty: true });
      setSubtitle('New songs are on the way');
      setControlsEnabled(false);
      updateProgressUI(0, 0);
      if (upNextBtn) upNextBtn.hidden = true;
      syncMediaSession(station, null);
      renderTracklist();
      return;
    }

    const track = station.tracks[currentTrack];
    audio.src = encodeURI(track.file);
    setTitle(track.title, { empty: false });
    npSubtitle.hidden = true;
    setControlsEnabled(true);
    updateProgressUI(0, 0);
    updateFavButtonUI();
    updateUpNextUI();
    syncMediaSession(station, track);
    renderTracklist();
  }

  function renderTracklist() {
    const station = stations[currentStation];
    tracklistEl.replaceChildren();

    const q = searchQuery.toLowerCase().trim();
    const filtered = station.tracks
      .map((t, idx) => ({ ...t, idx }))
      .filter((t) => {
        if (showFavsOnly && !favorites.has(t.file)) return false;
        if (q && !t.title.toLowerCase().includes(q)) return false;
        return true;
      });

    if (tracklistHeading) {
      tracklistHeading.textContent = `${station.freq} · ${filtered.length} of ${station.tracks.length} songs`;
    }

    if (filtered.length === 0) {
      const note = document.createElement('p');
      note.className = 'empty-note';
      note.textContent = station.tracks.length === 0
        ? `Nothing on ${station.freq} yet — new songs are on the way.`
        : 'No matching songs found.';
      tracklistEl.appendChild(note);
      return;
    }

    const fragment = document.createDocumentFragment();
    filtered.forEach((item) => {
      const li = document.createElement('li');
      li.className = 'track-row';

      const playBtn = document.createElement('button');
      playBtn.type = 'button';
      playBtn.className = `track-play-btn${item.idx === currentTrack ? ' active' : ''}`;
      playBtn.dataset.trackIdx = String(item.idx);

      const indexSpan = document.createElement('span');
      indexSpan.className = 'track-index';
      indexSpan.textContent = String(item.idx + 1).padStart(2, '0');

      const titleSpan = document.createElement('span');
      titleSpan.className = 'track-name';
      titleSpan.textContent = item.title;

      playBtn.append(indexSpan, titleSpan);

      const favBtn = document.createElement('button');
      favBtn.type = 'button';
      const isFav = favorites.has(item.file);
      favBtn.className = `row-fav-btn${isFav ? ' is-fav' : ''}`;
      favBtn.dataset.favFile = item.file;
      favBtn.setAttribute('aria-label', isFav ? 'Remove from favorites' : 'Add to favorites');
      favBtn.textContent = '♥';

      li.append(playBtn, favBtn);
      fragment.appendChild(li);
    });

    tracklistEl.appendChild(fragment);
  }

  tracklistEl.addEventListener('click', (e) => {
    const favBtn = e.target.closest('button[data-fav-file]');
    if (favBtn) {
      const file = favBtn.dataset.favFile;
      if (favorites.has(file)) {
        favorites.delete(file);
        showToast('Removed from Favorites');
      } else {
        favorites.add(file);
        showToast('Saved to Favorites ♥');
      }
      saveFavorites();
      updateFavButtonUI();
      renderTracklist();
      return;
    }

    const playBtn = e.target.closest('button[data-track-idx]');
    if (playBtn) {
      selectTrack(Number(playBtn.dataset.trackIdx));
    }
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
    audio.play()
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
    if (vinylPlatter) vinylPlatter.classList.toggle('playing', isPlaying);
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

  // --- Audio Events ---
  audio.addEventListener('timeupdate', () => {
    if (!isScrubbing) updateProgressUI(audio.currentTime, audio.duration);
  });
  audio.addEventListener('loadedmetadata', () => updateProgressUI(audio.currentTime, audio.duration));
  audio.addEventListener('ended', () => {
    if (repeatOne) {
      audio.currentTime = 0;
      playAudio();
    } else {
      nextTrack();
    }
  });
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
    consecutiveErrors++;
    isPlaying = false;
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

  // --- Scrubbing ---
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
    if (isScrubbing) seekFromPointer(e.clientX);
  });
  progressBar.addEventListener('pointerup', (e) => {
    if (!isScrubbing) return;
    isScrubbing = false;
    const targetTime = seekFromPointer(e.clientX);
    if (typeof targetTime === 'number') audio.currentTime = targetTime;
  });

  // --- Repeat, Sleep Timer, Favorite, Share & Search ---
  function toggleRepeat() {
    repeatOne = !repeatOne;
    btnRepeat?.classList.toggle('active', repeatOne);
    if (repeatBadge) repeatBadge.hidden = !repeatOne;
    showToast(repeatOne ? 'Repeat One: ON' : 'Repeat: OFF');
  }

  function cycleSleepTimer() {
    clearTimeout(sleepTimer);
    sleepPresetIndex = (sleepPresetIndex + 1) % SLEEP_PRESETS.length;
    const mins = SLEEP_PRESETS[sleepPresetIndex];

    if (mins === 0) {
      btnSleep?.classList.remove('active');
      if (sleepLabel) sleepLabel.hidden = true;
      showToast('Sleep Timer: OFF');
      return;
    }

    btnSleep?.classList.add('active');
    if (sleepLabel) {
      sleepLabel.textContent = `${mins}m`;
      sleepLabel.hidden = false;
    }
    showToast(`Sleep Timer set for ${mins} minutes`);

    sleepTimer = setTimeout(() => {
      pauseAudio();
      sleepPresetIndex = 0;
      btnSleep?.classList.remove('active');
      if (sleepLabel) sleepLabel.hidden = true;
      showToast('Sleep Timer ended — Goodnight 🌙');
    }, mins * 60000);
  }

  function toggleCurrentFavorite() {
    const station = stations[currentStation];
    const track = currentTrack !== null ? station?.tracks[currentTrack] : null;
    if (!track) return;
    if (favorites.has(track.file)) {
      favorites.delete(track.file);
      showToast('Removed from Favorites');
    } else {
      favorites.add(track.file);
      showToast('Saved to Favorites ♥');
    }
    saveFavorites();
    updateFavButtonUI();
    renderTracklist();
  }

  btnRepeat?.addEventListener('click', toggleRepeat);
  btnSleep?.addEventListener('click', cycleSleepTimer);
  btnFavorite?.addEventListener('click', toggleCurrentFavorite);
  upNextBtn?.addEventListener('click', nextTrack);

  btnShare?.addEventListener('click', async () => {
    const station = stations[currentStation];
    const track = currentTrack !== null ? station?.tracks[currentTrack] : null;
    const shareText = track
      ? `Listening to "${track.title}" on KUKU RADIO (${station.freq} · ${station.name})`
      : `Tuning into KUKU RADIO (${station.freq})`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'KUKU RADIO', text: shareText, url: location.href });
      } else {
        await navigator.clipboard.writeText(`${shareText} — ${location.href}`);
        showToast('Track link copied to clipboard!');
      }
    } catch { /* user cancelled */ }
  });

  trackSearch?.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderTracklist();
  });

  btnFilterFav?.addEventListener('click', () => {
    showFavsOnly = !showFavsOnly;
    btnFilterFav.setAttribute('aria-pressed', String(showFavsOnly));
    renderTracklist();
  });

  btnMute?.addEventListener('click', () => {
    audio.muted = !audio.muted;
    if (volumeIcon) {
      volumeIcon.innerHTML = audio.muted ? ICON_VOL_MUTE : ICON_VOL_ON;
    }
  });

  btnPlay.addEventListener('click', togglePlay);
  btnNext.addEventListener('click', nextTrack);
  btnPrev.addEventListener('click', prevTrack);
  volumeSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    audio.volume = val;
    audio.muted = val === 0;
    if (volumeIcon) volumeIcon.innerHTML = audio.muted ? ICON_VOL_MUTE : ICON_VOL_ON;
    localStorage.setItem(STORAGE_VOL_KEY, String(val));
  });

  // Global Keyboard Shortcuts
  document.addEventListener('keydown', (e) => {
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') {
      if (e.key === 'Escape') document.activeElement.blur();
      return;
    }
    if (e.code === 'Space') {
      e.preventDefault();
      togglePlay();
    } else if (e.key === '/') {
      e.preventDefault();
      trackSearch?.focus();
    } else if (e.key === 'm' || e.key === 'M') {
      btnMute?.click();
    } else if (e.key === 'f' || e.key === 'F') {
      toggleCurrentFavorite();
    } else if (e.key === 'r' || e.key === 'R') {
      toggleRepeat();
    }
  });

  const savedStation = parseInt(localStorage.getItem(STORAGE_STATION_KEY) || '0', 10);
  const initialStation = (!isNaN(savedStation) && savedStation >= 0 && savedStation < stations.length)
    ? savedStation
    : 0;

  return { goToStation, initialStation };
}
