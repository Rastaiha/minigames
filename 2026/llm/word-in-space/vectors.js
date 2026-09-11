const board = document.querySelector('#board');
const world = document.querySelector('#sheet-content');
const viewport = document.querySelector('#board-viewport');
const axes = document.querySelector('#axes');
const storageKey = 'vazhechin-layout-v2';
const gridUnit = 24;
const positions = {};
const tiles = new Map();
let origin = { x: 0, y: 0 };
let camera = { scale: 1, x: 0, y: 0 };
const pointers = new Map();
let gesture = null;
let suppressClick = false;
const format = value => (Math.abs(value) < 0.005 ? 0 : value).toLocaleString('en-US', {
  maximumFractionDigits: 2, useGrouping: false,
});

// Read the main game's cache without ever changing it, including its camera.
let legacy = null;
try {
  const saved = JSON.parse(localStorage.getItem(storageKey));
  if (saved && typeof saved === 'object') {
    for (const word of words) {
      const point = saved.positions?.[word.id];
      if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) {
        positions[word.id] = { x: point.x, y: point.y };
      }
    }
  } else {
    legacy = JSON.parse(localStorage.getItem('vazhechin-layout-v1'));
  }
} catch { /* An unavailable cache shows the invitation to play the main game. */ }

for (const word of words) {
  const oldPoint = legacy?.[word.id];
  if (!positions[word.id] && !(oldPoint && Number.isFinite(oldPoint.x) && Number.isFinite(oldPoint.y))) continue;
  const tile = document.createElement('button');
  tile.type = 'button';
  tile.className = 'word board-word';
  tile.dataset.id = word.id;
  // Keep the original tile dimensions and cached top-left anchor.
  tile.innerHTML = `<span>${word.text}</span><span class="grip" aria-hidden="true">⠿</span>`;
  tile.setAttribute('aria-pressed', 'false');
  tile.setAttribute('aria-label', `${word.text}؛ نمایش بردار`);
  world.append(tile);
  if (!positions[word.id]) {
    positions[word.id] = {
      x: Math.max(0, Math.min(1, oldPoint.x)) * Math.max(0, board.clientWidth - tile.offsetWidth),
      y: Math.max(0, Math.min(1, oldPoint.y)) * Math.max(0, board.clientHeight - tile.offsetHeight),
    };
  }
  tile.style.left = `${positions[word.id].x}px`;
  tile.style.top = `${positions[word.id].y}px`;
  tiles.set(word.id, tile);
}

const points = Object.values(positions);
if (points.length) {
  origin = {
    x: (Math.min(...points.map(p => p.x)) + Math.max(...points.map(p => p.x))) / 2,
    y: (Math.min(...points.map(p => p.y)) + Math.max(...points.map(p => p.y))) / 2,
  };
} else {
  document.querySelector('#empty').hidden = false;
}

function select(id) {
  for (const [wordId, tile] of tiles) {
    const active = wordId === id;
    tile.classList.toggle('selected', active);
    tile.setAttribute('aria-pressed', String(active));
    tile.querySelector('.word-vector')?.remove();
    if (!active) continue;
    const x = format((positions[id].x - origin.x) / gridUnit * 0.2);
    const y = format((origin.y - positions[id].y) / gridUnit * 0.2);
    const vector = document.createElement('span');
    vector.className = 'word-vector';
    vector.setAttribute('aria-hidden', 'true');
    vector.innerHTML = `<span class="vector-column"><span>${x}</span><span>${y}</span></span>`;
    tile.append(vector);
    document.querySelector('#announcement').textContent = `${words.find(word => word.id === id).text}؛ x = ${x}، y = ${y}`;
    // Keep the annotation visible when selecting a word near the viewport edge.
    const rect = vector.getBoundingClientRect();
    const bounds = board.getBoundingClientRect();
    if (rect.right > bounds.right - 12) camera.x -= rect.right - bounds.right + 12;
    if (rect.left < bounds.left + 12) camera.x += bounds.left + 12 - rect.left;
    if (rect.bottom > bounds.bottom - 12) camera.y -= rect.bottom - bounds.bottom + 12;
    if (rect.top < bounds.top + 12) camera.y += bounds.top + 12 - rect.top;
    applyCamera();
  }
}

function applyCamera() {
  world.style.transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})`;
  const x = origin.x * camera.scale + camera.x;
  const y = origin.y * camera.scale + camera.y;
  const major = gridUnit * 5 * camera.scale, minor = gridUnit * camera.scale;
  board.style.backgroundSize = `${major}px ${major}px, ${major}px ${major}px, ${minor}px ${minor}px, ${minor}px ${minor}px`;
  board.style.backgroundPosition = `${x}px ${y}px`;
  const width = board.clientWidth, height = board.clientHeight;
  axes.setAttribute('viewBox', `0 0 ${width} ${height}`);
  axes.innerHTML = points.length ? `
    <defs><marker id="axis-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L8 4 L0 8" fill="none" stroke="#8991a2"/></marker></defs>
    <line class="axis-line" x1="0" y1="${y}" x2="${width - 12}" y2="${y}" marker-end="url(#axis-arrow)"/>
    <line class="axis-line" x1="${x}" y1="${height}" x2="${x}" y2="12" marker-end="url(#axis-arrow)"/>
    <text class="axis-label" x="${width - 26}" y="${y - 10}">x</text>
    <text class="axis-label" x="${x + 10}" y="25">y</text>
    <circle class="origin-dot" cx="${x}" cy="${y}" r="3"/>` : '';
}

function fit() {
  if (!points.length) return;
  const left = Math.min(...points.map(p => p.x));
  const top = Math.min(...points.map(p => p.y));
  const right = Math.max(...[...tiles].map(([id, tile]) => positions[id].x + tile.offsetWidth + 120));
  const bottom = Math.max(...[...tiles].map(([id, tile]) => positions[id].y + tile.offsetHeight));
  camera.scale = Math.min(1, Math.max(0.05, Math.min((board.clientWidth - 64) / (right - left), (board.clientHeight - 80) / (bottom - top))));
  camera.x = (board.clientWidth - (right + left) * camera.scale) / 2;
  camera.y = (board.clientHeight - (bottom + top) * camera.scale) / 2;
  applyCamera();
}

board.addEventListener('click', event => {
  if (suppressClick) return;
  const tile = event.target.closest('.board-word');
  select(tile ? tile.dataset.id : null);
});
board.addEventListener('keydown', event => {
  if (event.key === 'Escape') select(null);
  // Native buttons provide Enter/Space selection. Movement/deletion has no handler.
});

function gesturePoint() {
  const [a, b = a] = [...pointers.values()];
  const rect = board.getBoundingClientRect();
  return { x: (a.x + b.x) / 2 - rect.left, y: (a.y + b.y) / 2 - rect.top,
    distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)) };
}
function beginGesture() {
  const point = gesturePoint();
  gesture = { ...point, camera: { ...camera }, count: pointers.size };
}
board.addEventListener('pointerdown', event => {
  if (event.button !== 0) return;
  if (!pointers.size) suppressClick = false;
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  beginGesture();
  if (pointers.size > 1) suppressClick = true;
});
window.addEventListener('pointermove', event => {
  if (!pointers.has(event.pointerId)) return;
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  const point = gesturePoint();
  if (!suppressClick && Math.hypot(point.x - gesture.x, point.y - gesture.y) < 5) return;
  suppressClick = true;
  const start = gesture.camera;
  camera.scale = gesture.count > 1 ? Math.max(0.05, Math.min(4, start.scale * point.distance / gesture.distance)) : start.scale;
  camera.x = point.x - (gesture.x - start.x) / start.scale * camera.scale;
  camera.y = point.y - (gesture.y - start.y) / start.scale * camera.scale;
  applyCamera();
});
function finishPointer(event) {
  if (!pointers.delete(event.pointerId)) return;
  if (pointers.size) beginGesture();
  else {
    gesture = null;
    // A synthesized pointer click follows pointerup; keep it from selecting after a pan.
    setTimeout(() => { suppressClick = false; }, 0);
  }
}
window.addEventListener('pointerup', finishPointer);
window.addEventListener('pointercancel', finishPointer);
viewport.addEventListener('wheel', event => {
  event.preventDefault();
  if (event.ctrlKey) {
    const rect = board.getBoundingClientRect();
    const x = event.clientX - rect.left, y = event.clientY - rect.top;
    const next = Math.max(0.05, Math.min(4, camera.scale * Math.exp(-event.deltaY * 0.01)));
    camera.x = x - (x - camera.x) * next / camera.scale;
    camera.y = y - (y - camera.y) * next / camera.scale;
    camera.scale = next;
  } else {
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? board.clientHeight : 1;
    camera.x -= (event.shiftKey ? event.deltaY : event.deltaX) * unit;
    camera.y -= (event.shiftKey ? event.deltaX : event.deltaY) * unit;
  }
  applyCamera();
}, { passive: false });
new ResizeObserver(fit).observe(viewport);
fit();
document.fonts.ready.then(fit);
