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

let cachedTickLabels = [];
let cachedTickMajors = [];
let cachedFreqButtons = [];

function angleForIndex(i, total) {
  if (total <= 1) return (ANGLE_START + ANGLE_END) / 2;
  const step = (ANGLE_START - ANGLE_END) / (total - 1);
  return ANGLE_START - step * i;
}

function polar(cx, cy, r, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy - r * Math.sin(rad) };
}

export function buildDial(stations, onSelect) {
  if (!ticksGroup) return;

  let svg = '';
  const minorCount = 23;
  for (let i = 0; i < minorCount; i++) {
    const a = ANGLE_START - (i * (ANGLE_START - ANGLE_END)) / (minorCount - 1);
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
    svg += `<text class="tick-label" data-idx="${i}" style="cursor:pointer" x="${lp.x.toFixed(1)}" y="${(lp.y + 4).toFixed(1)}">${s.freq}</text>`;
  });

  ticksGroup.innerHTML = svg;
  cachedTickLabels = Array.from(ticksGroup.querySelectorAll('.tick-label'));
  cachedTickMajors = Array.from(ticksGroup.querySelectorAll('.tick-major'));

  // Allow clicking directly on dial frequency labels to tune
  if (typeof onSelect === 'function') {
    ticksGroup.onclick = (e) => {
      const target = e.target.closest('[data-idx]');
      if (target) onSelect(Number(target.dataset.idx));
    };
  }
}

export function buildFrequencyButtons(stations, onSelect) {
  if (!freqRow) return;
  freqRow.replaceChildren();
  cachedFreqButtons = [];

  const fragment = document.createDocumentFragment();
  stations.forEach((station, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'freq-btn';
    btn.dataset.idx = String(i);
    btn.setAttribute('aria-label', `Tune to ${station.freq} ${station.name}`);

    const freqSpan = document.createElement('span');
    freqSpan.className = 'freq-num';
    freqSpan.textContent = station.freq;

    const nameSpan = document.createElement('span');
    nameSpan.className = 'freq-name';
    nameSpan.textContent = station.name;

    btn.append(freqSpan, nameSpan);
    btn.addEventListener('click', () => onSelect(i));

    cachedFreqButtons.push(btn);
    fragment.appendChild(btn);
  });

  freqRow.appendChild(fragment);
}

export function updateNeedle(index, total) {
  if (!needleGroup) return;
  const a = angleForIndex(index, total);
  const rotation = 90 - a;
  needleGroup.style.transform = `rotate(${rotation}deg)`;
}

export function jumpNeedle(index, total) {
  if (!needleGroup) return;
  needleGroup.style.transition = 'none';
  updateNeedle(index, total);
  void needleGroup.offsetWidth;
  needleGroup.style.transition = '';
}

export function updateDialLabels(activeIndex) {
  cachedTickLabels.forEach((el, idx) => {
    el.classList.toggle('active', idx === activeIndex);
  });
  cachedTickMajors.forEach((el, idx) => {
    el.classList.toggle('active', idx === activeIndex);
  });
}

export function updateFrequencyActive(activeIndex) {
  cachedFreqButtons.forEach((btn, idx) => {
    const isActive = idx === activeIndex;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', String(isActive));
  });
}
