/* =========================================================================
   KUKU RADIO — js/player.js
   -------------------------------------------------------------------------
   Two things changed on purpose from the original sequential player:

   1. Each station keeps a shuffled "bag" of its own track indices
      (Fisher–Yates). Switching stations rebuilds the bag and immediately
      pops the first entry as the opening track — so the opening track is
      never index 0, and it's different every time. When a track ends
      (or Next is pressed) the next index is popped from the bag instead
      of incrementing — unpredictable by design. When the bag empties it
      reshuffles, guaranteed not to hand back the track that just played.
      Picking a song directly from the list below does the same bag
      bookkeeping (removes it from the upcoming bag first) so the auto
      shuffle stays fair afterward instead of replaying it again too soon.

   2. "Previous" does NOT step backward through the underlying list —
      there is no such thing as "backward" in a shuffle. Instead it steps
      back through what was actually just heard this session (a small
      in-memory history), the way shuffle mode works in Spotify/Apple
      Music. Forward always pulls something new from the bag; backward
      only ever replays your own recent history.

   The station's full track list renders below Now Playing — that
   rendering and its click-to-play wiring both live in this file since
   picking a track from the list is a playback action.
   ========================================================================= */

import { updateNeedle, updateDialLabels, updateFrequencyActive } from './dial.js';
import { startStationBackground } from './background.js';

const ICON_PLAY = '<path d="M8 5v14l11-7z"/>';
const ICON_PAUSE = '<path d="M6 5h4v14H6zm8 0h4v14h-4z"/>';

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

function formatTime(sec) {
  if (!isFinite(sec) || isNaN(sec)) return '0:00';
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
  audio.volume = parseFloat(volumeSlider.value);

  let currentStation = 0;
  let currentTrack = null;
  let bag = [];
  let history = [];
  let historyPos = -1;
  let isPlaying = false;

  function refillBag(avoidFirst) {
    const len = stations[currentStation].tracks.length;
    bag = shuffledIndices(len, avoidFirst);
  }

  // Pull the next track forward: replays forward through session history
  // first if the listener had stepped back, otherwise pops a fresh
  // unpredictable pick from the shuffle bag (reshuffling if it's empty).
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
    historyPos = history.length - 1;
    return currentTrack;
  }

  function goBack() {
    if (historyPos > 0) {
      historyPos--;
      currentTrack = history[historyPos];
    }
    return currentTrack;
  }

  function setTitle(text, { empty = false } = {}) {
    npTitle.textContent = text;
    npTitle.classList.toggle('empty', empty);
    npTitle.classList.remove('changed');
    void npTitle.offsetWidth; // restart the reveal animation on every change
    npTitle.classList.add('changed');
  }

  function loadCurrentTrack() {
    const station = stations[currentStation];
    npFreqLabel.textContent = `${station.freq} · ${station.name}`;

    if (station.tracks.length === 0 || currentTrack === null) {
      audio.removeAttribute('src');
      setTitle("This frequency's still quiet", { empty: true });
      npSubtitle.textContent = 'New songs are on the way';
      npSubtitle.hidden = false;
      setControlsEnabled(false);
      updateProgressUI(0, 0);
      renderTracklist();
      return;
    }

    const track = station.tracks[currentTrack];
    // encodeURI preserves the folder structure while safely handling spaces
    // and other common characters in uploaded MP3 filenames.
    audio.src = encodeURI(track.file);
    setTitle(track.title, { empty: false });
    npSubtitle.hidden = true;
    setControlsEnabled(true);
    renderTracklist();
  }

  function renderTracklist() {
    const station = stations[currentStation];
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
      const btn = document.createElement('button');
      const index = document.createElement('span');
      const title = document.createElement('span');

      btn.type = 'button';
      btn.className = i === currentTrack ? 'active' : '';
      btn.setAttribute('aria-label', `Play ${track.title}`);

      index.className = 'track-index';
      index.textContent = String(i + 1).padStart(2, '0');
      title.textContent = track.title;

      btn.append(index, title);
      btn.addEventListener('click', () => selectTrack(i));
      li.appendChild(btn);
      fragment.appendChild(li);
    });
    tracklistEl.appendChild(fragment);
  }

  // Picking a track directly from the list: plays it immediately, and if
  // it was still waiting in the upcoming shuffle bag, pulls it out first
  // so the automatic shuffle doesn't hand you the same song again right
  // after you chose it yourself.
  function selectTrack(index) {
    if (index === currentTrack) {
      playAudio();
      return;
    }
    const bagPos = bag.indexOf(index);
    if (bagPos !== -1) bag.splice(bagPos, 1);
    currentTrack = index;
    history.push(index);
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
    const theme = stations[index] && stations[index].theme ? stations[index].theme : 'rose';
    document.body.setAttribute('data-theme', theme);
  }

  function goToStation(index, autoplay) {
    pauseAudio();
    applyStationTheme(index);
    currentStation = index;
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
      advance(); // pops a random opening track — never track 0
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
    audio.play().catch(() => {});
    isPlaying = true;
    updatePlayUI();
  }

  function pauseAudio() {
    audio.pause();
    isPlaying = false;
    updatePlayUI();
  }

  function togglePlay() {
    isPlaying ? pauseAudio() : playAudio();
  }

  function updatePlayUI() {
    playIcon.innerHTML = isPlaying ? ICON_PAUSE : ICON_PLAY;
    btnPlay.setAttribute('aria-label', isPlaying ? 'Pause' : 'Play');
    eqBars.classList.toggle('playing', isPlaying);
  }

  function updateProgressUI(current, duration) {
    const pct = duration ? (current / duration) * 100 : 0;
    progressFill.style.width = pct + '%';
    progressBar.style.setProperty('--knob-pos', pct + '%');
    progressBar.setAttribute('aria-valuenow', Math.round(pct));
    timeCurrent.textContent = formatTime(current);
    timeDuration.textContent = formatTime(duration);
  }

  audio.addEventListener('timeupdate', () => updateProgressUI(audio.currentTime, audio.duration));
  audio.addEventListener('loadedmetadata', () => updateProgressUI(audio.currentTime, audio.duration));
  audio.addEventListener('ended', nextTrack);

  audio.addEventListener('error', () => {
    const station = stations[currentStation];
    const track = currentTrack !== null ? station.tracks[currentTrack] : null;
    if (!track) return;
    console.warn('[KUKU RADIO] Audio could not be loaded:', track.file);
    npSubtitle.textContent = "Couldn't load that one — skipping ahead";
    npSubtitle.hidden = false;
    isPlaying = false;
    updatePlayUI();
    // Skip the broken file automatically instead of stalling the station.
    if (station.tracks.length > 1) setTimeout(nextTrack, 1100);
  });

  progressBar.addEventListener('click', (e) => {
    if (!audio.duration) return;
    const rect = progressBar.getBoundingClientRect();
    const pct = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    audio.currentTime = pct * audio.duration;
  });

  progressBar.addEventListener('keydown', (e) => {
    if (!audio.duration) return;
    if (e.key === 'ArrowRight') audio.currentTime = Math.min(audio.currentTime + 5, audio.duration);
    if (e.key === 'ArrowLeft') audio.currentTime = Math.max(audio.currentTime - 5, 0);
  });

  btnPlay.addEventListener('click', togglePlay);
  btnNext.addEventListener('click', nextTrack);
  btnPrev.addEventListener('click', prevTrack);
  volumeSlider.addEventListener('input', (e) => {
    audio.volume = parseFloat(e.target.value);
  });

  return { goToStation };
}
