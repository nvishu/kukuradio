/* =========================================================================
   KUKU RADIO — js/live-count.js
   -------------------------------------------------------------------------
   Real per-station "listening now" counter with AbortController protection
   against overlapping requests when rapidly tuning across frequencies.
   ========================================================================= */

const HEARTBEAT_MS = 30000;
const POLL_MS = 60000;
const MAX_FAILURES = 3;
const ENDPOINT = '/api/listeners';

function safeId(value) {
  return String(value).replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 64);
}

function getSessionId() {
  try {
    let id = sessionStorage.getItem('kuku-session');
    if (!id) {
      id = crypto.randomUUID
        ? crypto.randomUUID()
        : `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem('kuku-session', id);
    }
    return safeId(id);
  } catch {
    return `s-${Date.now().toString(36)}`;
  }
}

export function initLiveCount() {
  const el = document.getElementById('live-count-number');
  if (!el) return;

  const audio = document.getElementById('audio-player');
  const wrap = el.closest('.live-count') || el.parentElement || el;
  const sessionId = getSessionId();

  let stationId = null;
  let activeStationId = null;
  let lastRendered = null;
  let failures = 0;
  let timer = null;
  let currentAbort = null;

  function render(next) {
    if (next === lastRendered) return;
    lastRendered = next;
    el.textContent = String(next);
    el.classList.remove('changed');
    void el.offsetWidth;
    el.classList.add('changed');
  }

  async function send(targetStation, listening, { abortable = true } = {}) {
    if (!targetStation) return;

    if (abortable && currentAbort) {
      currentAbort.abort();
    }
    const controller = abortable ? new AbortController() : null;
    if (abortable) currentAbort = controller;

    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, stationId: targetStation, listening }),
        keepalive: true,
        signal: controller?.signal
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { count } = await res.json();
      if (typeof count !== 'number') throw new Error('bad payload');

      failures = 0;
      wrap.hidden = false;
      if (targetStation === stationId) render(count);
    } catch (err) {
      if (err?.name === 'AbortError') return;
      if (++failures >= MAX_FAILURES) wrap.hidden = true;
    }
  }

  function schedule() {
    clearTimeout(timer);
    if (document.visibilityState === 'hidden' && !activeStationId) return;

    const delay = activeStationId ? HEARTBEAT_MS : POLL_MS;
    timer = setTimeout(async () => {
      if (activeStationId) {
        await send(activeStationId, true);
      } else if (stationId && document.visibilityState !== 'hidden') {
        await send(stationId, false);
      }
      schedule();
    }, delay);
  }

  function start() {
    if (!stationId) return;
    if (activeStationId === stationId) return;
    if (activeStationId) send(activeStationId, false, { abortable: false });
    activeStationId = stationId;
    send(activeStationId, true);
    schedule();
  }

  async function stop() {
    if (!activeStationId) return;
    const leaving = activeStationId;
    activeStationId = null;
    await send(leaving, false, { abortable: false });
    schedule();
  }

  if (audio) {
    audio.addEventListener('playing', start);
    audio.addEventListener('pause', stop);
    audio.addEventListener('ended', stop);
    audio.addEventListener('emptied', stop);
  }

  document.addEventListener('kuku:station-change', (e) => {
    const next = safeId(e.detail.stationId);
    if (next === stationId) return;
    stationId = next;
    lastRendered = null;
    if (activeStationId && activeStationId !== stationId) start();
    else send(stationId, false);
    schedule();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && stationId) {
      send(activeStationId || stationId, Boolean(activeStationId));
      schedule();
    }
  });

  window.addEventListener('pagehide', () => {
    if (!activeStationId) return;
    navigator.sendBeacon?.(
      ENDPOINT,
      new Blob(
        [JSON.stringify({ sessionId, stationId: activeStationId, listening: false })],
        { type: 'application/json' }
      )
    );
  });

  schedule();
}
