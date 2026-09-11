const board = document.querySelector('#board');
const list = document.querySelector('#word-list');
const world = document.querySelector('#sheet-content');
const viewport = document.querySelector('#board-viewport');
const touches = new Map();
let camera = { scale: 1, x: 0, y: 0 };
let pinch = null;
let touchGesture = false;
let placementTap = null;
const storageKey = 'vazhechin-layout-v2';
let legacyPositions = null;
const fa = number => number.toLocaleString('fa-IR');
let positions = {};
let selected = null;
let drag = null;
let boardSelection = new Set();
try {
  const saved = JSON.parse(localStorage.getItem(storageKey));
  if (saved && typeof saved === 'object') {
    for (const word of words) {
      const point = saved.positions?.[word.id];
      if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) positions[word.id] = { x: point.x, y: point.y };
    }
    const view = saved.camera;
    if (view && Number.isFinite(view.scale) && Number.isFinite(view.x) && Number.isFinite(view.y)) {
      camera = { scale: Math.max(0.5, Math.min(4, view.scale)), x: view.x, y: view.y };
    }
  } else {
    legacyPositions = JSON.parse(localStorage.getItem('vazhechin-layout-v1'));
  }
} catch { /* Storage may be unavailable; the board still works. */ }

function tile(word, onBoard = false) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `word${onBoard ? ' board-word' : ''}`;
  button.dataset.id = word.id;
  button.innerHTML = `<span>${word.text}</span><span class="grip" aria-hidden="true">⠿</span>`;
  button.setAttribute('aria-label', onBoard ? `${word.text}؛ با کلیدهای جهت جابه‌جا کن، با Delete برگردان` : `${word.text}؛ انتخاب برای قرار دادن روی صفحه`);
  return button;
}
list.className = 'words';
for (const word of words) list.append(tile(word));

function save() { try { localStorage.setItem(storageKey, JSON.stringify({ positions, camera })); } catch {} }
function announce(text) { document.querySelector('#announcement').textContent = text; }
function render() {
  board.querySelectorAll('.board-word').forEach(element => element.remove());
  for (const word of words) {
    const source = list.querySelector(`[data-id="${word.id}"]`);
    source.classList.toggle('placed-source', Boolean(positions[word.id]));
    source.classList.toggle('selected', selected === word.id);
    source.setAttribute('aria-pressed', String(selected === word.id));
    // Convert the previous bounded layout once, using the actual tile size.
    const legacy = legacyPositions?.[word.id];
    if (legacy && Number.isFinite(legacy.x) && Number.isFinite(legacy.y)) {
      positions[word.id] = {
        x: Math.max(0, Math.min(1, legacy.x)) * Math.max(0, board.clientWidth - source.offsetWidth),
        y: Math.max(0, Math.min(1, legacy.y)) * Math.max(0, board.clientHeight - source.offsetHeight),
      };
      source.classList.add('placed-source');
    }
    if (!positions[word.id]) continue;
    const element = tile(word, true);
    element.classList.toggle('selected', boardSelection.has(word.id));
    element.setAttribute('aria-pressed', String(boardSelection.has(word.id)));
    world.append(element);
    element.style.left = `${positions[word.id].x}px`;
    element.style.top = `${positions[word.id].y}px`;
  }
  if (legacyPositions) { legacyPositions = null; save(); }
  updateSelection();
  board.classList.toggle('target', Boolean(selected));
}
function place(id, clientX, clientY, width, height) {
  const point = boardPoint({ clientX, clientY });
  positions[id] = { x: point.x - width / 2, y: point.y - height / 2 };
  selected = null;
  save(); render();
  announce(`${words.find(word => word.id === id).text} روی صفحه قرار گرفت.`);
}

function updateSelection() {
  board.querySelectorAll('.board-word').forEach(element => {
    element.classList.toggle('selected', boardSelection.has(element.dataset.id));
    element.setAttribute('aria-pressed', String(boardSelection.has(element.dataset.id)));
  });
}
function snapshotSelection() {
  return [...boardSelection].map(id => {
    const element = board.querySelector(`[data-id="${id}"]`);
    return { id, element, x: positions[id].x, y: positions[id].y, width: element.offsetWidth, height: element.offsetHeight };
  });
}
// World coordinates have no sheet-edge limits; groups keep their spacing.
function moveTogether(items, dx, dy) {
  for (const item of items) {
    item.element.style.left = `${item.x + dx}px`;
    item.element.style.top = `${item.y + dy}px`;
    positions[item.id] = { x: item.x + dx, y: item.y + dy };
  }
}
function boardPoint(event) {
  const rect = board.getBoundingClientRect();
  return { x: (event.clientX - rect.left - board.clientLeft - camera.x) / camera.scale,
    y: (event.clientY - rect.top - board.clientTop - camera.y) / camera.scale };
}
// Pinch coordinates are relative to the fixed viewport, in CSS pixels.
function pinchPoints() {
  const [a, b] = [...touches.values()];
  const rect = board.getBoundingClientRect();
  return { x: (a.x + b.x) / 2 - rect.left - board.clientLeft, y: (a.y + b.y) / 2 - rect.top - board.clientTop,
    distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)) };
}
function beginPinch() {
  const point = pinchPoints();
  pinch = { scale: camera.scale, distance: point.distance,
    x: (point.x - camera.x) / camera.scale, y: (point.y - camera.y) / camera.scale };
}
function applyCamera() {
  world.style.transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})`;
  const major = 120 * camera.scale, minor = 24 * camera.scale;
  board.style.backgroundSize = `${major}px ${major}px, ${major}px ${major}px, ${minor}px ${minor}px, ${minor}px ${minor}px`;
  board.style.backgroundPosition = `${camera.x - 17 * camera.scale}px ${camera.y - 23 * camera.scale}px`;
}
// Trackpads and mouse wheels pan the same infinite sheet on desktop.
viewport.addEventListener('wheel', event => {
  if (event.ctrlKey || drag || touches.size) return;
  event.preventDefault();
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1;
  camera.x -= (event.shiftKey ? event.deltaY : event.deltaX) * unit;
  camera.y -= (event.shiftKey ? event.deltaX : event.deltaY) * unit;
  applyCamera();
  save();
}, { passive: false });
document.addEventListener('pointerdown', event => {
  if (!touches.size) touchGesture = false;
  if (event.pointerType === 'touch' && viewport.contains(event.target)) {
    touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (touches.size === 1 && selected && !event.target.closest('.word')) {
      placementTap = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, id: selected };
    }
    if (touches.size >= 2) {
      placementTap = null;
      // Capture the stable viewport only for a pinch; single taps keep their
      // original target so browsers can still dispatch the placement click.
      for (const pointerId of touches.keys()) viewport.setPointerCapture(pointerId);
      if (drag) finishDrag({ pointerId: drag.pointerId }, true);
      touchGesture = true;
      beginPinch();
      return;
    }
    if (touchGesture) return;
  }
  // Additional fingers must never start a word drag.
  if (event.button !== 0 || drag || (event.pointerType === 'touch' && !event.isPrimary)) return;
  const source = event.target.closest('.word');
  if (source && board.contains(source)) {
    selected = null;
    const id = source.dataset.id;
    if (event.shiftKey) {
      if (boardSelection.has(id)) boardSelection.delete(id); else boardSelection.add(id);
    } else if (!boardSelection.has(id)) boardSelection = new Set([id]);
    updateSelection();
    if (!boardSelection.has(id)) return;
    drag = { kind: 'group', source, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, items: snapshotSelection(), before: structuredClone(positions), moved: false };
  } else if (!source && board.contains(event.target) && !selected) {
    // Some mobile browsers report mouse-like events; require a desktop pointer
    // before claiming empty-board gestures for rectangle selection.
    if (event.pointerType !== 'mouse' || navigator.maxTouchPoints > 0 || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    event.preventDefault();
    board.focus({ preventScroll: true });
    const base = event.shiftKey ? new Set(boardSelection) : new Set();
    boardSelection = new Set(base);
    updateSelection();
    const marquee = document.createElement('div');
    marquee.className = 'selection-box';
    marquee.hidden = true;
    world.append(marquee);
    drag = { kind: 'marquee', source: board, pointerId: event.pointerId, start: boardPoint(event), base, marquee, moved: false };
  } else if (source && list.contains(source)) {
    const rect = source.getBoundingClientRect();
    drag = { kind: 'source', id: source.dataset.id, source, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, width: rect.width, height: rect.height, ghost: null };
  } else return;
  if (!touches.has(event.pointerId)) drag.source.setPointerCapture(event.pointerId);
});
document.addEventListener('pointermove', event => {
  if (placementTap?.pointerId === event.pointerId && Math.hypot(event.clientX - placementTap.x, event.clientY - placementTap.y) > 5) placementTap = null;
  if (touches.has(event.pointerId)) {
    touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pinch) {
      const gesture = pinchPoints();
      camera.scale = Math.max(0.5, Math.min(4, pinch.scale * gesture.distance / pinch.distance));
      camera.x = gesture.x - pinch.x * camera.scale;
      camera.y = gesture.y - pinch.y * camera.scale;
      applyCamera();
    }
    if (touchGesture) return;
  }
  if (!drag || event.pointerId !== drag.pointerId) return;
  if (drag.kind === 'marquee') {
    const point = boardPoint(event);
    if (!drag.moved && Math.hypot(point.x - drag.start.x, point.y - drag.start.y) < 5) return;
    drag.moved = true;
    const left = Math.min(point.x, drag.start.x), top = Math.min(point.y, drag.start.y);
    const right = Math.max(point.x, drag.start.x), bottom = Math.max(point.y, drag.start.y);
    Object.assign(drag.marquee.style, { left: `${left}px`, top: `${top}px`, width: `${right - left}px`, height: `${bottom - top}px` });
    drag.marquee.hidden = false;
    boardSelection = new Set(drag.base);
    board.querySelectorAll('.board-word').forEach(element => {
      if (element.offsetLeft < right && element.offsetLeft + element.offsetWidth > left && element.offsetTop < bottom && element.offsetTop + element.offsetHeight > top) boardSelection.add(element.dataset.id);
    });
    updateSelection();
    return;
  }
  const dx = event.clientX - drag.startX, dy = event.clientY - drag.startY;
  if (Math.hypot(dx, dy) < 5 && !drag.moved && !drag.ghost) return;
  if (drag.kind === 'group') {
    drag.moved = true;
    moveTogether(drag.items, dx / camera.scale, dy / camera.scale);
    return;
  }
  if (!drag.ghost) {
    drag.ghost = drag.source.cloneNode(true);
    drag.ghost.className = 'word drag-ghost';
    drag.ghost.removeAttribute('data-id');
    drag.ghost.setAttribute('aria-hidden', 'true');
    drag.ghost.style.width = `${drag.width}px`;
    document.body.append(drag.ghost);
    drag.source.classList.add('dragging-original');
  }
  drag.ghost.style.left = `${event.clientX - drag.width / 2}px`;
  drag.ghost.style.top = `${event.clientY - drag.height / 2}px`;
  const rect = viewport.getBoundingClientRect();
  board.classList.toggle('target', event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom);
});
let suppressClick = false;
function finishDrag(event, cancelled = false) {
  if (!drag || event.pointerId !== drag.pointerId) return;
  const current = drag;
  drag = null;
  current.source.classList.remove('dragging-original');
  if (current.source.hasPointerCapture(event.pointerId)) current.source.releasePointerCapture(event.pointerId);
  if (current.kind === 'marquee' || current.kind === 'group') {
    if (current.moved) {
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 0);
    }
    if (current.kind === 'marquee') {
      current.marquee.remove();
      if (cancelled) boardSelection = current.base;
      updateSelection();
      announce(`${fa(boardSelection.size)} واژه انتخاب شد.`);
    } else {
      if (cancelled) positions = current.before;
      else if (current.moved) {
        const rect = list.getBoundingClientRect();
        if (event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) {
          for (const item of current.items) delete positions[item.id];
          boardSelection.clear();
        }
        save();
      }
      render();
    }
    return;
  }
  if (current.ghost) {
    current.ghost.remove();
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 0);
    if (!cancelled) {
      const rect = viewport.getBoundingClientRect();
      const sidebarRect = list.getBoundingClientRect();
      if (event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom) {
        place(current.id, event.clientX, event.clientY, current.width, current.height);
      } else if (event.clientX >= sidebarRect.left && event.clientX <= sidebarRect.right && event.clientY >= sidebarRect.top && event.clientY <= sidebarRect.bottom) {
        delete positions[current.id]; save(); render();
      }
    }
  }
  board.classList.toggle('target', Boolean(selected));
}
function finishPointer(event, cancelled = false) {
  touches.delete(event.pointerId);
  if (touches.size < 2) pinch = null;
  else beginPinch();
  finishDrag(event, cancelled || touchGesture);
  if (touchGesture && !touches.size) save();
  if (placementTap?.pointerId === event.pointerId) {
    const tap = placementTap;
    placementTap = null;
    if (!cancelled && !touchGesture && selected === tap.id) {
      const source = list.querySelector(`[data-id="${tap.id}"]`);
      place(tap.id, event.clientX, event.clientY, source.offsetWidth, source.offsetHeight);
    }
  }
}
document.addEventListener('pointerup', event => finishPointer(event));
document.addEventListener('pointercancel', event => finishPointer(event, true));
document.addEventListener('click', event => {
  if (suppressClick || touchGesture) return;
  const source = event.target.closest('.word');
  if (source && list.contains(source)) {
    boardSelection.clear();
    selected = selected === source.dataset.id ? null : source.dataset.id;
    render();
    if (selected) announce('واژه انتخاب شد. روی صفحه کلیک کن یا با Tab به صفحه برو و Enter بزن.');
  } else if (selected && viewport.contains(event.target) && !source) {
    const element = list.querySelector(`[data-id="${selected}"]`);
    place(selected, event.clientX, event.clientY, element.offsetWidth, element.offsetHeight);
  }
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') { if (drag) finishDrag({ pointerId: drag.pointerId }, true); selected = null; boardSelection.clear(); render(); return; }
  if (event.target === board && selected && (event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault();
    const rect = viewport.getBoundingClientRect();
    const id = selected;
    const source = list.querySelector(`[data-id="${id}"]`);
    place(id, rect.left + rect.width / 2, rect.top + rect.height / 2, source.offsetWidth, source.offsetHeight);
    board.querySelector(`[data-id="${id}"]`).focus();
    return;
  }
  const element = event.target.closest('.board-word');
  if (!element && event.target !== board) return;
  if (element && (event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault();
    const id = element.dataset.id;
    if (event.shiftKey) {
      if (boardSelection.has(id)) boardSelection.delete(id); else boardSelection.add(id);
    } else boardSelection = new Set([id]);
    selected = null;
    updateSelection();
    return;
  }
  if (!['Delete', 'Backspace', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
  if (element && !boardSelection.has(element.dataset.id)) boardSelection = new Set([element.dataset.id]);
  if (!boardSelection.size) return;
  const focusId = element?.dataset.id;
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    for (const id of boardSelection) delete positions[id];
    boardSelection.clear(); save(); render();
    board.focus(); announce('واژه‌های انتخاب‌شده به فهرست برگشتند.');
  } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
    event.preventDefault();
    const step = event.shiftKey ? 24 : 6;
    moveTogether(snapshotSelection(), event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0, event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0);
    save(); render();
    if (focusId) board.querySelector(`[data-id="${focusId}"]`).focus();
  }
});
document.querySelector('#reset').addEventListener('click', () => { positions = {}; selected = null; boardSelection.clear(); camera = { scale: 1, x: 0, y: 0 }; applyCamera(); save(); render(); announce('صفحه پاک شد. دوباره شروع کن.'); });
new ResizeObserver(() => { applyCamera(); if (!drag) render(); }).observe(viewport);
applyCamera();
render();
