/* =========================================================================
   KUKU RADIO — js/live-count.js
   -------------------------------------------------------------------------
   Ambient "listening now" counter. This is atmosphere, not a real
   presence system — there's no backend behind it. It drifts by small,
   randomly-timed steps around an hour-aware baseline (a little busier in
   the evening, quieter overnight) so it reads as alive rather than
   mechanically incrementing.
   ========================================================================= */

const MIN_COUNT = 6;
const CEILING = 41;
const MAX_STEP = 2;
const TICK_MIN_MS = 4000;
const TICK_MAX_MS = 9500;

function baselineForNow() {
  const hour = new Date().getHours();
  // Gentle bell curve peaking around 9–11pm, quiet in the early morning.
  const eveningBoost = Math.max(0, 6 - Math.abs(hour - 21)) * 2.2;
  return MIN_COUNT + eveningBoost;
}

export function initLiveCount() {
  const el = document.getElementById('live-count-number');
  if (!el) return;

  let count = Math.round(baselineForNow() + Math.random() * 5);
  render(count);
  scheduleNext();

  function render(next) {
    count = next;
    el.textContent = String(count);
    el.classList.remove('changed');
    void el.offsetWidth; // restart the pop animation each time
    el.classList.add('changed');
  }

  function tick() {
    const baseline = baselineForNow();
    const step = Math.floor(Math.random() * (MAX_STEP * 2 + 1)) - MAX_STEP; // -MAX_STEP..+MAX_STEP
    let next = count + step;

    // Pull gently back toward the baseline band instead of drifting freely,
    // so it never wanders somewhere implausible.
    if (next < baseline - 8) next += 2;
    if (next > baseline + 12) next -= 2;

    next = Math.max(MIN_COUNT, Math.min(CEILING, next));
    if (next !== count) render(next);
    scheduleNext();
  }

  function scheduleNext() {
    const delay = TICK_MIN_MS + Math.random() * (TICK_MAX_MS - TICK_MIN_MS);
    setTimeout(tick, delay);
  }
}
