const board = document.querySelector('#board');
const list = document.querySelector('#word-list');
const pins = document.querySelector('#pins');
const preview = document.querySelector('#preview');
const storageKey = 'word-in-line-layout-v1';
let positions = {};
let camera = { x: 0, scale: 1 };
let selected = null;
let active = null;
let drag = null;
let suppressClick = false;
const finite = value => Number.isFinite(value) && Math.abs(value) < 1e9;
try {
  const saved = JSON.parse(localStorage.getItem(storageKey));
  for (const word of words) {
    if (finite(saved?.positions?.[word.id])) positions[word.id] = saved.positions[word.id];
  }
  if (finite(saved?.camera?.x) && finite(saved?.camera?.scale)) {
    camera = { x: saved.camera.x, scale: Math.max(.25, Math.min(4, saved.camera.scale)) };
  }
} catch { /* The game also works without browser storage. */ }
function save() {
  try { localStorage.setItem(storageKey, JSON.stringify({ positions, camera })); } catch {}
}
function announce(message) { document.querySelector('#announcement').textContent = message; }
function screenX(x) { return board.clientWidth / 2 + camera.x + x * camera.scale; }
function worldX(clientX) { return (clientX - board.getBoundingClientRect().left - board.clientWidth / 2 - camera.x) / camera.scale; }
function inside(element, event) {
  const rect = element.getBoundingClientRect();
  return event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
}
for (const word of words) {
  const source = document.createElement('button');
  source.type = 'button';
  source.className = 'word source';
  source.dataset.id = word.id;
  source.textContent = word.text;
  list.append(source);
}
function render() {
  const focusId = pins.contains(document.activeElement) ? document.activeElement.dataset.id : null;
  pins.replaceChildren();
  for (const word of words) {
    const placed = Object.hasOwn(positions, word.id);
    const source = list.querySelector(`[data-id="${word.id}"]`);
    source.classList.toggle('placed', placed);
    source.classList.toggle('selected', selected === word.id);
    source.setAttribute('aria-pressed', String(selected === word.id));
    if (!placed) continue;
    const pin = document.createElement('div');
    pin.className = 'pin';
    pin.dataset.id = word.id;
    const head = document.createElement('button');
    head.type = 'button';
    head.className = 'word pin-head';
    head.dataset.id = word.id;
    head.textContent = word.text;
    pin.append(head);
    pins.append(pin);
  }
  layout();
  if (focusId) pins.querySelector(`[data-id="${focusId}"] button`)?.focus({ preventScroll: true });
}
function layout() {
  document.querySelector('#origin').style.left = `${screenX(0)}px`;
  board.classList.toggle('target', selected !== null);
  // Label lanes are presentation only: every stored word has just one scalar X.
  const lanes = [];
  const ordered = [...pins.children].sort((a, b) => positions[a.dataset.id] - positions[b.dataset.id]);
  for (const pin of ordered) {
    const x = screenX(positions[pin.dataset.id]);
    const head = pin.firstElementChild;
    const half = head.offsetWidth / 2 + 7;
    let lane = lanes.findIndex(right => right < x - half);
    if (lane < 0) lane = lanes.length;
    lanes[lane] = x + half;
    pin.classList.toggle('below', lane % 2 === 1);
    pin.style.setProperty('--stem', `${28 + Math.floor(lane / 2) * 49}px`);
    pin.style.left = `${x}px`;
    pin.classList.toggle('selected', active === pin.dataset.id);
    head.setAttribute('aria-pressed', String(active === pin.dataset.id));
    head.setAttribute('aria-label', `${head.textContent}؛ x = ${(positions[pin.dataset.id] / 24).toFixed(2)}؛ حرکت با چپ و راست، بازگشت با Delete`);
  }
  // Grow the interaction area if many labels share the same point.
  board.style.minHeight = `${Math.max(480, (28 + Math.ceil(lanes.length / 2) * 49 + 32) / .42)}px`;
}
function place(id, x) {
  positions[id] = x;
  selected = null;
  active = id;
  save(); render();
  announce(`${words.find(word => word.id === id).text} روی خط قرار گرفت.`);
}
function remove(id) {
  delete positions[id];
  active = null;
  save(); render();
  list.querySelector(`[data-id="${id}"]`).focus();
  announce('واژه به فهرست برگشت.');
}
document.addEventListener('pointerdown', event => {
  if (event.button !== 0 || !event.isPrimary || drag) return;
  const word = event.target.closest('.word');
  if (!word && !board.contains(event.target)) return;
  const kind = word ? (list.contains(word) ? 'source' : 'pin') : 'pan';
  if (kind === 'pin') { active = word.dataset.id; selected = null; layout(); }
  const capture = word && kind === 'source' ? list : board;
  drag = { kind, id: word?.dataset.id, pointerId: event.pointerId, startX: event.clientX,
    startY: event.clientY, x: word ? positions[word.dataset.id] : camera.x, moved: false, capture, ghost: null };
  capture.setPointerCapture(event.pointerId);
});
document.addEventListener('pointermove', event => {
  if (!drag || event.pointerId !== drag.pointerId) return;
  const dx = event.clientX - drag.startX;
  if (!drag.moved && Math.hypot(dx, event.clientY - drag.startY) < 5) return;
  drag.moved = true;
  if (drag.kind === 'pin') {
    positions[drag.id] = drag.x + dx / camera.scale;
    layout();
  } else if (drag.kind === 'pan' && !selected) {
    camera.x = drag.x + dx;
    layout();
  } else if (drag.kind === 'source') {
    if (!drag.ghost) {
      drag.ghost = list.querySelector(`[data-id="${drag.id}"]`).cloneNode(true);
      drag.ghost.className = 'word source drag-ghost';
      drag.ghost.removeAttribute('data-id');
      drag.ghost.setAttribute('aria-hidden', 'true');
      drag.ghost.tabIndex = -1;
      document.body.append(drag.ghost);
    }
    drag.ghost.style.left = `${event.clientX}px`;
    drag.ghost.style.top = `${event.clientY}px`;
    preview.hidden = !inside(board, event);
    preview.style.left = `${event.clientX - board.getBoundingClientRect().left}px`;
  }
});
function finish(event, cancelled = false) {
  if (!drag || drag.pointerId !== event.pointerId) return;
  const current = drag;
  drag = null;
  current.ghost?.remove();
  preview.hidden = true;
  if (current.capture.hasPointerCapture(current.pointerId)) current.capture.releasePointerCapture(current.pointerId);
  if (cancelled) {
    if (current.kind === 'pin') positions[current.id] = current.x;
    if (current.kind === 'pan') camera.x = current.x;
  } else if (current.moved) {
    if (current.kind === 'source' && inside(board, event)) place(current.id, worldX(event.clientX));
    if (current.kind === 'pin' && inside(document.querySelector('.sidebar'), event)) remove(current.id);
  } else {
    if (current.kind === 'source') { selected = selected === current.id ? null : current.id; active = null; }
    if (current.kind === 'pan' && selected) place(selected, worldX(event.clientX));
    else if (current.kind === 'pan') active = null;
    if (current.kind === 'pin') pins.querySelector(`[data-id="${current.id}"] button`).focus({ preventScroll: true });
  }
  suppressClick = true;
  setTimeout(() => { suppressClick = false; }, 0);
  save(); render();
}
document.addEventListener('pointerup', event => finish(event));
document.addEventListener('pointercancel', event => finish(event, true));
document.addEventListener('lostpointercapture', event => finish(event, true));
// Click activation covers keyboards and assistive technology; pointer taps are handled above.
list.addEventListener('click', event => {
  if (suppressClick) return;
  const word = event.target.closest('.source');
  if (!word) return;
  selected = selected === word.dataset.id ? null : word.dataset.id;
  active = null; render();
});
pins.addEventListener('click', event => {
  if (suppressClick) return;
  const word = event.target.closest('.pin-head');
  if (word) { active = word.dataset.id; selected = null; layout(); }
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    if (drag) finish({ pointerId: drag.pointerId }, true);
    selected = null; active = null; render(); return;
  }
  if (event.target === board && selected && ['Enter', ' '].includes(event.key)) {
    event.preventDefault();
    place(selected, -camera.x / camera.scale);
    pins.querySelector(`[data-id="${active}"] button`).focus({ preventScroll: true });
    return;
  }
  const id = event.target.closest('.pin-head')?.dataset.id;
  if (!id || drag) return;
  if (['ArrowUp', 'ArrowDown'].includes(event.key)) { event.preventDefault(); return; }
  if (['ArrowLeft', 'ArrowRight'].includes(event.key)) {
    event.preventDefault();
    positions[id] += (event.key === 'ArrowLeft' ? -1 : 1) * (event.shiftKey ? 24 : 6);
    active = id; save(); layout();
  }
  if (['Delete', 'Backspace'].includes(event.key)) { event.preventDefault(); remove(id); }
});
function zoom(factor, anchor = board.clientWidth / 2) {
  const x = (anchor - board.clientWidth / 2 - camera.x) / camera.scale;
  camera.scale = Math.max(.25, Math.min(4, camera.scale * factor));
  camera.x = anchor - board.clientWidth / 2 - x * camera.scale;
  save(); layout();
}
board.addEventListener('wheel', event => {
  event.preventDefault();
  if (drag) return;
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? board.clientWidth : 1;
  if (event.ctrlKey || event.metaKey) zoom(Math.exp(-event.deltaY * unit * .005), event.clientX - board.getBoundingClientRect().left);
  else { camera.x -= (event.deltaX || event.deltaY) * unit; save(); layout(); }
}, { passive: false });
document.querySelector('#zoom-in').onclick = () => zoom(1.25);
document.querySelector('#zoom-out').onclick = () => zoom(.8);
document.querySelector('#home').onclick = () => { camera.x = 0; save(); layout(); };
document.querySelector('#fit').onclick = () => {
  const values = [0, ...Object.values(positions)];
  const min = Math.min(...values), max = Math.max(...values);
  camera.scale = Math.max(.25, Math.min(1, (board.clientWidth - 160) / Math.max(1, max - min)));
  camera.x = -(min + max) / 2 * camera.scale;
  save(); layout();
};
document.querySelector('#reset').onclick = () => {
  if (drag) finish({ pointerId: drag.pointerId }, true);
  positions = {}; selected = null; active = null; camera = { x: 0, scale: 1 };
  save(); render(); announce('خط پاک شد. دوباره شروع کن.');
};
new ResizeObserver(layout).observe(board);
document.fonts.ready.then(layout);
render();
