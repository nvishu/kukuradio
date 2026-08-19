/* =========================================================================
   KUKU RADIO — js/dial.js
   -------------------------------------------------------------------------
   Builds and updates the SVG tuning dial and the frequency-button row.
   Pure presentation: it never touches audio or track state directly —
   player.js calls into these functions when the active station changes.
   ========================================================================= */

const CX = 200, CY = 210, R_OUTER = 150, R_MINOR_IN = 145, R_MAJOR_IN = 130, R_LABEL = 113;
const ANGLE_START = 165, ANGLE_END = 15;

const ticksGroup = document.getElementById('ticks-group');
const needleGroup = document.getElementById('needle-group');
const freqRow = document.getElementById('frequency-row');

function angleForIndex(i, total) {
  if (total === 1) return (ANGLE_START + ANGLE_END) / 2;
  const step = (ANGLE_START - ANGLE_END) / (total - 1);
  return ANGLE_START - step * i;
}

function polar(cx, cy, r, angleDeg) {
  const rad = angleDeg * Math.PI / 180;
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
}

export function buildDial(stations) {
  let svg = '';
  const minorCount = 23;
  for (let i = 0; i < minorCount; i++) {
    const a = ANGLE_START - (i * (ANGLE_START - ANGLE_END) / (minorCount - 1));
    const p1 = polar(CX, CY, R_MINOR_IN, a);
    const p2 = polar(CX, CY, R_OUTER, a);
    svg += `<line class="tick-minor" x1="${p1.x.toFixed(1)}" y1="${p1.y.toFixed(1)}" x2="${p2.x.toFixed(1)}" y2="${p2.y.toFixed(1)}"/>`;
  }
  stations.forEach((s, i) => {
    const a = angleForIndex(i, stations.length);
    const p1 = polar(CX, CY, R_MAJOR_IN, a);
    const p2 = polar(CX, CY, R_OUTER, a);
    const lp = polar(CX, CY, R_LABEL, a);
    svg += `<line class="tick-major" data-idx="${i}" x1="${p1.x.toFixed(1)}" y1="${p1.y.toFixed(1)}" x2="${p2.x.toFixed(1)}" y2="${p2.y.toFixed(1)}"/>`;
    svg += `<text class="tick-label" data-idx="${i}" x="${lp.x.toFixed(1)}" y="${(lp.y + 4).toFixed(1)}">${s.freq}</text>`;
  });
  ticksGroup.innerHTML = svg;
}

export function updateNeedle(index, total) {
  const a = angleForIndex(index, total);
  const rotation = 90 - a;
  needleGroup.style.transform = `rotate(${rotation}deg)`;
}

/** Position the needle with no transition, for the opening sweep: the
 *  needle starts already parked at the last station, then updateNeedle()
 *  to station 0 a moment later animates as one continuous sweep instead
 *  of two stacked animations. */
export function jumpNeedle(index, total) {
  needleGroup.style.transition = 'none';
  updateNeedle(index, total);
  void needleGroup.offsetWidth; // force reflow before re-enabling the transition
  needleGroup.style.transition = '';
}

export function updateDialLabels(activeIndex) {
  document.querySelectorAll('.tick-label').forEach(el => {
    el.classList.toggle('active', Number(el.dataset.idx) === activeIndex);
  });
}

export function buildFrequencyButtons(stations, onSelect) {
  freqRow.innerHTML = '';
  stations.forEach((s, i) => {
    const btn = document.createElement('button');
    btn.className = 'freq-btn';
    btn.type = 'button';
    btn.innerHTML = `<span class="num">${s.freq}</span><span>${s.name}</span>`;
    btn.setAttribute('aria-label', `Tune to ${s.freq}, ${s.name}`);
    btn.addEventListener('click', () => onSelect(i));
    freqRow.appendChild(btn);
  });
}

export function updateFrequencyActive(index) {
  [...freqRow.children].forEach((btn, i) => btn.classList.toggle('active', i === index));
}
