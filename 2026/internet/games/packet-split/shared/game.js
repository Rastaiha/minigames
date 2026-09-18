// Shared packet-split game engine. Each version's main.js imports initGame
// and passes a config for its interaction model, packet sizes, and copy.
export function completedStopwatchTime(firstDeliveredAt, secondDeliveredAt, stopwatchTime) {
  if (firstDeliveredAt === null || secondDeliveredAt === null) return null;
  return stopwatchTime;
}

export function packetWireBits(payloadBits, headerBits = 0) {
  return payloadBits + headerBits;
}

export function initGame(config) {
  const NS = 'http://www.w3.org/2000/svg';
  const BITS_PER_SECOND = 8;
  const BIT_TIME = 1 / BITS_PER_SECOND;
  const HEADER_BITS = Math.max(0, config.headerBits || 0);
  const configuredPackets = Array.isArray(config.initialPackets) ? config.initialPackets : null;
  const GREEN_BITS = config.greenBits ?? configuredPackets
    ?.filter(packet => packet.color === 'green')
    .reduce((sum, packet) => sum + packet.size, 0);
  const ORANGE_BITS = config.orangeBits ?? configuredPackets
    ?.filter(packet => packet.color === 'orange')
    .reduce((sum, packet) => sum + packet.size, 0);
  const SPLITTING = config.splitting !== false;
  const EVENT_PAUSES = config.eventPauses === true;
  const ITEM_NOUN = config.itemNoun || 'بسته';
  const ITEM_NOUN_WITH_EZAFE = config.itemNounWithEzafe || 'بستهٔ';
  const GREEN_AVAILABLE_AT = EVENT_PAUSES ? (config.greenAvailableAt || 0) : 0;
  const SHOW_MEMORY = config.showMemory === true;
  const PACKET_COLORS = {
    green:   { base: '#35afb8', soft: '#e5f6f6', onBase: '#2c2318', name: 'فیروزه‌ای' },
    orange: { base: '#b82a31', soft: '#f9e9e9', onBase: '#fcfaf4', name: 'زرشکی' },
  };
  const DEVICES = {
    PC1: { x: 100, y: 130, kind: 'pc', num: 1, color: 'green'   },
    PC2: { x: 100, y: 370, kind: 'pc', num: 2, color: 'orange' },
    A:   { x: 340, y: 250, kind: 'switch', label: 'A' },
    B:   { x: 560, y: 250, kind: 'switch', label: 'B' },
    PC3: { x: 800, y: 130, kind: 'pc', num: 3, color: 'green'   },
    PC4: { x: 800, y: 370, kind: 'pc', num: 4, color: 'orange' },
  };
  // Cubic-Bezier paths give the topology gentle curves like the reference sketch.
  const WIRES = {
    'PC1-A': { d: 'M 150 150 C 220 150 240 235 300 235', sx: 150, sy: 150, ex: 300, ey: 235 },
    'PC2-A': { d: 'M 150 350 C 220 350 240 265 300 265', sx: 150, sy: 350, ex: 300, ey: 265 },
    'A-B':   { d: 'M 380 250 C 420 218 480 218 520 250', sx: 380, sy: 250, ex: 520, ey: 250 },
    'B-PC3': { d: 'M 600 235 C 660 235 680 150 750 150', sx: 600, sy: 235, ex: 750, ey: 150 },
    'B-PC4': { d: 'M 600 265 C 660 265 680 350 750 350', sx: 600, sy: 265, ex: 750, ey: 350 },
  };
  // dy is per-row offset; negative = stack rows upward from base y
  const DOCK = {
    PC1: { x: 100, y: 62,  dx: 36, dy: -28 },
    PC2: { x: 100, y: 442, dx: 36, dy:  28 },
    A:   { x: 340, y: 198, dx: 36, dy: -28 },
    B:   { x: 560, y: 198, dx: 36, dy: -28 },
    PC3: { x: 800, y: 62,  dx: 36, dy: -28 },
    PC4: { x: 800, y: 442, dx: 36, dy:  28 },
  };
  const MAX_PER_ROW = 5;
  const ROUTE = {
    green:   { PC1: { link: 'PC1-A', to: 'A' }, A: { link: 'A-B', to: 'B' }, B: { link: 'B-PC3', to: 'PC3' } },
    orange: { PC2: { link: 'PC2-A', to: 'A' }, A: { link: 'A-B', to: 'B' }, B: { link: 'B-PC4', to: 'PC4' } },
  };
  const DEST = { green: 'PC3', orange: 'PC4' };

  function el(name, attrs = {}, ...children) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    for (const c of children) {
      if (c === null || c === undefined) continue;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return e;
  }

  const wiresG    = document.getElementById('wires');
  const portsG    = document.getElementById('ports');
  const devicesG  = document.getElementById('devices');
  const labelsG   = document.getElementById('labels');
  const packetsAtRestG = document.getElementById('packetsAtRest');
  const packetAnimG    = document.getElementById('packetAnim');
  const progressG      = document.getElementById('progress');
  const availabilityTooltipG = el('g', { class: 'availability-tooltip', 'aria-hidden': 'true' });
  document.getElementById('topology').appendChild(availabilityTooltipG);

  // --- Wires (curved paths) ---
  const wireEls = {};
  const wireLens = {};
  for (const key in WIRES) {
    const w = WIRES[key];
    const path = el('path', { d: w.d, class: 'wire' });
    wiresG.appendChild(path);
    wireEls[key] = path;
    wireLens[key] = path.getTotalLength();
    // Little port dots at each end for visual polish
    portsG.appendChild(el('circle', { cx: w.sx, cy: w.sy, r: 4, class: 'port-dot' }));
    portsG.appendChild(el('circle', { cx: w.ex, cy: w.ey, r: 4, class: 'port-dot' }));
  }

  // --- Devices ---
  for (const id in DEVICES) {
    const d = DEVICES[id];
    if (d.kind === 'switch') {
      devicesG.appendChild(el('rect', {
        x: d.x - 40, y: d.y - 22, width: 80, height: 44, rx: 6,
        fill: '#f3e7ca',
        stroke: '#2c2318',
        'stroke-width': 1.5,
      }));
      for (let i = 0; i < 4; i++) {
        devicesG.appendChild(el('rect', {
          x: d.x - 17 + i * 10, y: d.y + 8, width: 4, height: 4,
          fill: '#6b5d4a',
        }));
      }
      devicesG.appendChild(el('text', { x: d.x, y: d.y - 4, class: 'switch-label' }, d.label));
    } else {
      devicesG.appendChild(el('rect', {
        x: d.x - 42, y: d.y - 32, width: 84, height: 64, rx: 6,
        class: `pc-frame ${d.color}`,
        stroke: '#2c2318', 'stroke-width': 1.5,
      }));
      devicesG.appendChild(el('rect', {
        x: d.x - 36, y: d.y - 26, width: 72, height: 52, rx: 4,
        class: `pc-screen ${d.color}`
      }));
      devicesG.appendChild(el('rect', { x: d.x - 8,  y: d.y + 32, width: 16, height: 8, class: `pc-frame ${d.color}`, stroke: '#2c2318', 'stroke-width': 1.5 }));
      devicesG.appendChild(el('rect', { x: d.x - 22, y: d.y + 40, width: 44, height: 4, rx: 2, class: `pc-frame ${d.color}`, stroke: '#2c2318', 'stroke-width': 1.5 }));
      devicesG.appendChild(el('text', { x: d.x, y: d.y, class: `pc-num ${d.color}` }, `PC${d.num}`));
    }
  }
  labelsG.appendChild(el('text', { x: 340, y: 298, class: 'device-label' }, 'سوییچ A'));
  labelsG.appendChild(el('text', { x: 560, y: 298, class: 'device-label' }, 'سوییچ B'));

  // Arrival progress
  const arrivalPc3 = el('text', { x: 800, y: 35,  class: 'progress-text green'   }, `0 از ${GREEN_BITS} بیت`);
  const arrivalPc4 = el('text', { x: 800, y: 470, class: 'progress-text orange' }, `0 از ${ORANGE_BITS} بیت`);
  progressG.appendChild(arrivalPc3);
  progressG.appendChild(arrivalPc4);

  // --- State ---
  let nextId = 1;
  let packets = [];
  let totalTime = 0;
  let round = 1;
  let animating = false;
  let currentSchedule = null;
  let animStart = 0;
  let roundStartTime = 0;
  let greenDeliveredAt = null;
  let orangeDeliveredAt = null;
  let currentPopover = null;
  let activeTransfers = [];
  let peakMemoryA = 0;
  let peakMemoryB = 0;

  const LONG_PRESS_MS = 500;
  const LONG_PRESS_MOVE_TOL = 10;
  let longPressTimer = null;
  let longPressStart = null;
  let longPressPointerId = null;
  let longPressFired = false;

  function cancelLongPress() {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    longPressStart = null;
    longPressPointerId = null;
  }

  const goBtn      = document.getElementById('goBtn');
  const resetBtn   = document.getElementById('resetBtn');
  const timerEl    = document.getElementById('timer');
  const roundNumEl = document.getElementById('roundNum');
  const bestTimeEl = document.getElementById('bestTime');
  const statusMsg  = document.getElementById('statusMsg');
  const historyList  = document.getElementById('historyList');
  const historyCard  = document.getElementById('historyCard');

  let attemptsHistory = [];
  let attemptCounter  = 0;
  let attemptStarted  = false;

  const BEST_KEY = config.bestKey;
  const BEST_FROM_ATTEMPT_HISTORY = config.bestFromAttemptHistory === true;
  if (BEST_FROM_ATTEMPT_HISTORY) {
    bestTimeEl.textContent = '-';
  } else {
    const savedBest = localStorage.getItem(BEST_KEY);
    if (savedBest) bestTimeEl.textContent = `${parseFloat(savedBest).toFixed(1)} s`;
  }

  function updateBest(t) {
    if (BEST_FROM_ATTEMPT_HISTORY) return;
    const cur = localStorage.getItem(BEST_KEY);
    if (!cur || t < parseFloat(cur) - 1e-9) {
      localStorage.setItem(BEST_KEY, String(t));
      bestTimeEl.textContent = `${t.toFixed(1)} s`;
    }
  }

  function isAtDestination(pkt) { return pkt.location === DEST[pkt.color]; }
  function nextHop(pkt)         { return (ROUTE[pkt.color] || {})[pkt.location] || null; }
  function allDelivered()       { return packets.every(isAtDestination); }
  function isAvailable(pkt, at = totalTime) { return !EVENT_PAUSES || pkt.availableAt <= at + 1e-9; }
  function isInTransit(pkt) { return activeTransfers.some(transfer => transfer.packet === pkt); }
  function transmissionBits(pkt) { return packetWireBits(pkt.size, HEADER_BITS); }
  function packetVisibleLabel(pkt) {
    return HEADER_BITS > 0 ? `${pkt.size}+${HEADER_BITS}` : String(pkt.size);
  }
  function packetSizePhrase(pkt) {
    if (HEADER_BITS === 0) return `${pkt.size} بیتی`;
    return `${pkt.size} بیت داده و ${HEADER_BITS} بیت اطلاعات نشانی فرستنده و گیرنده؛ ${transmissionBits(pkt)} بیت در مجموع`;
  }

  function memoryUsage(device) {
    return packets
      .filter(packet => packet.location === device)
      .reduce((sum, packet) => sum + transmissionBits(packet), 0);
  }

  function updateMemoryPeaks() {
    if (!SHOW_MEMORY) return;
    peakMemoryA = Math.max(peakMemoryA, memoryUsage('A'));
    peakMemoryB = Math.max(peakMemoryB, memoryUsage('B'));
  }

  function initialState() {
    nextId = 1;
    const seeds = configuredPackets || [
      { size: GREEN_BITS, color: 'green', location: 'PC1', availableAt: GREEN_AVAILABLE_AT },
      { size: ORANGE_BITS, color: 'orange', location: 'PC2', availableAt: 0 },
    ];
    packets = seeds.map(packet => ({
      id: nextId++,
      size: packet.size,
      color: packet.color,
      location: packet.location,
      selected: false,
      availableAt: EVENT_PAUSES ? (packet.availableAt || 0) : 0,
    }));
    totalTime = 0;
    round = 1;
    animating = false;
    currentSchedule = null;
    roundStartTime = 0;
    greenDeliveredAt = null;
    orangeDeliveredAt = null;
    attemptStarted = false;
    activeTransfers = [];
    peakMemoryA = 0;
    peakMemoryB = 0;
  }

  // --- Popover ---
  function closePopover() {
    if (currentPopover) currentPopover.remove();
    currentPopover = null;
  }
  document.addEventListener('click',       closePopover);
  document.addEventListener('contextmenu', closePopover);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closePopover();
  });

  function openSplitPopover(pkt, clientX, clientY) {
    closePopover();
    if (!SPLITTING || animating || pkt.size < 2 || isAtDestination(pkt) || !isAvailable(pkt) || isInTransit(pkt)) return;
    const half = Math.floor(pkt.size / 2);
    const pop = document.createElement('div');
    pop.className = 'split-popover';
    const splitPreview = HEADER_BITS > 0
      ? `<b class="lval">${half}</b>+${HEADER_BITS} و <b class="rval">${pkt.size - half}</b>+${HEADER_BITS} بیت`
      : `<b class="lval">${half}</b> + <b class="rval">${pkt.size - half}</b>`;
    pop.innerHTML = `
      <div class="preview">${HEADER_BITS > 0 ? `${pkt.size} بیت داده را تقسیم کنید؛ حاصل با ${HEADER_BITS} بیت اطلاعات نشانی برای هر بسته: ${splitPreview}` : `${ITEM_NOUN_WITH_EZAFE} <b>${pkt.size}</b> بیتی را به ${splitPreview} تقسیم کنید`}</div>
      <input type="range" min="1" max="${pkt.size - 1}" value="${half}" aria-label="اندازهٔ بخش اول ${ITEM_NOUN}">
      <div class="btn-row">
        <button class="do" type="button">تقسیم</button>
        <button class="secondary cancel" type="button">انصراف</button>
      </div>
    `;
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', `تقسیم ${ITEM_NOUN}`);
    pop.style.left = '0px';
    pop.style.top  = '0px';
    document.body.appendChild(pop);
    currentPopover = pop;

    const rect = pop.getBoundingClientRect();
    const halfW  = rect.width / 2;
    const height = rect.height;
    const margin = 8;
    const left = Math.max(halfW + margin, Math.min(window.innerWidth - halfW - margin, clientX));
    const top  = Math.max(margin, Math.min(window.innerHeight - height - margin, clientY));
    pop.style.left = `${left}px`;
    pop.style.top  = `${top}px`;

    const slider = pop.querySelector('input');
    const lval   = pop.querySelector('.lval');
    const rval   = pop.querySelector('.rval');
    slider.addEventListener('input', () => {
      const v = parseInt(slider.value, 10);
      lval.textContent = v;
      rval.textContent = pkt.size - v;
    });
    pop.addEventListener('click',       e => e.stopPropagation());
    pop.addEventListener('contextmenu', e => { e.stopPropagation(); e.preventDefault(); });
    pop.querySelector('.do').addEventListener('click', () => {
      splitPacket(pkt, parseInt(slider.value, 10));
      closePopover();
    });
    pop.querySelector('.cancel').addEventListener('click', closePopover);
    slider.focus();
  }

  // --- State mutations ---
  function togglePacketSelection(pktId) {
    if (animating) return;
    const pkt = packets.find(p => p.id === pktId);
    if (!pkt || isAtDestination(pkt) || !isAvailable(pkt) || isInTransit(pkt)) return;
    pkt.selected = !pkt.selected;
    renderStatic();
    updateControls();
  }

  function splitPacket(pkt, v) {
    if (animating) return;
    if (v < 1 || v >= pkt.size) return;
    const idx = packets.indexOf(pkt);
    if (idx < 0) return;
    packets.splice(idx, 1,
      { id: nextId++, size: v,             color: pkt.color, location: pkt.location, selected: false, availableAt: pkt.availableAt },
      { id: nextId++, size: pkt.size - v,  color: pkt.color, location: pkt.location, selected: false, availableAt: pkt.availableAt }
    );
    updateMemoryPeaks();
    renderStatic();
    updateStats();
    updateControls();
  }

  // --- Rendering ---
  function envelopeShape(g, w, h, opts) {
    // opts: { fill, stroke, strokeWidth, flapStroke, glowColor }
    const rect = el('rect', {
      x: -w/2, y: -h/2, width: w, height: h, rx: 3,
      class: 'chip-body',
      fill: opts.fill,
      stroke: opts.stroke,
      'stroke-width': opts.strokeWidth,
    });
    g.appendChild(rect);
    // Envelope flap: an inverted V at the top
    g.appendChild(el('path', {
      d: `M ${-w/2 + 2.5} ${-h/2 + 2.5} L 0 ${h/2 - 4} L ${w/2 - 2.5} ${-h/2 + 2.5}`,
      fill: 'none',
      stroke: opts.flapStroke,
      'stroke-width': 1,
      'stroke-linejoin': 'round',
      opacity: 0.55,
    }));
  }

  function hideAvailabilityTooltip() {
    availabilityTooltipG.innerHTML = '';
  }

  function showAvailabilityTooltip(pkt, x, y) {
    hideAvailabilityTooltip();
    const width = 220;
    const height = 42;
    const margin = 8;
    const boxX = Math.max(margin, Math.min(900 - width - margin, x - width / 2));
    const boxY = Math.max(margin, y - height - 14);
    const arrowX = Math.max(boxX + 12, Math.min(boxX + width - 12, x));
    const tooltip = el('g', {});
    tooltip.appendChild(el('rect', {
      x: boxX, y: boxY, width, height, rx: 5, class: 'tooltip-box',
    }));
    tooltip.appendChild(el('path', {
      d: `M ${arrowX - 6} ${boxY + height - 1} L ${arrowX} ${boxY + height + 8} L ${arrowX + 6} ${boxY + height - 1} Z`,
      class: 'tooltip-arrow',
    }));
    tooltip.appendChild(el('text', {
      x: boxX + width / 2, y: boxY + 15,
      'text-anchor': 'middle', direction: 'rtl',
    },
      el('tspan', { x: boxX + width / 2, dy: 8 }, `این پیام تا لحظه ${pkt.availableAt.toFixed(1)}s آماده ارسال نیست.`),
    ));
    availabilityTooltipG.appendChild(tooltip);
  }

  function renderChip(pkt, x, y, interactive) {
    const palette = PACKET_COLORS[pkt.color];
    const atDest = isAtDestination(pkt);
    const unavailable = !isAvailable(pkt);
    const canInteract = interactive && !unavailable && (!EVENT_PAUSES || !atDest);
    const isSelected = pkt.selected && !atDest;
    const w = HEADER_BITS > 0 ? 48 : 30;
    const h = 22;

    const cls = ['chip-svg', pkt.color];
    if (!canInteract) cls.push('locked');
    if (unavailable)  cls.push('unavailable');
    if (isSelected)   cls.push('selected');
    const attrs = { class: cls.join(' '), transform: `translate(${x}, ${y})` };
    if (canInteract) {
      attrs.tabindex = '0';
      attrs.role = 'button';
      attrs['aria-label'] = `${ITEM_NOUN_WITH_EZAFE} ${packetSizePhrase(pkt)} ${palette.name}؛ ${isSelected ? 'انتخاب شده' : 'انتخاب نشده'}`;
    } else if (unavailable) {
      attrs.tabindex = '0';
      attrs.role = 'button';
      attrs['aria-disabled'] = 'true';
      attrs['aria-label'] = `${ITEM_NOUN_WITH_EZAFE} ${packetSizePhrase(pkt)} ${palette.name}؛ اکنون در دسترس نیست و در ${pkt.availableAt.toFixed(1)} s آماده می‌شود`;
    }
    const g = el('g', attrs);
    if (unavailable) {
      const showTooltip = () => showAvailabilityTooltip(pkt, x, y);
      g.addEventListener('mouseenter', showTooltip);
      g.addEventListener('mouseleave', hideAvailabilityTooltip);
      g.addEventListener('focus', showTooltip);
      g.addEventListener('blur', hideAvailabilityTooltip);
    }
    g.appendChild(el('rect', { x: -w / 2 - 2, y: -14, width: w + 4, height: 28, rx: 5, fill: 'transparent', stroke: 'transparent', class: 'focus-ring' }));

    envelopeShape(g, w, h, {
      fill:        isSelected ? (palette.solid || palette.base) : palette.soft,
      stroke:      palette.base,
      strokeWidth: isSelected ? 2 : 1.4,
      flapStroke:  isSelected ? palette.onBase : palette.base,
    });

    g.appendChild(el('text', {
      x: 0, y: 3,
      'text-anchor': 'middle', 'dominant-baseline': 'middle',
      'font-size': '12', 'font-weight': '800',
      fill: isSelected ? palette.onBase : '#2c2318',
    }, packetVisibleLabel(pkt)));

    if (atDest) g.setAttribute('opacity', '0.85');

    if (canInteract) {
      if (SPLITTING) {
        g.addEventListener('pointerdown', (e) => {
          if (e.pointerType === 'mouse' && e.button !== 0) return;
          cancelLongPress();
          longPressFired = false;
          longPressStart = { x: e.clientX, y: e.clientY };
          longPressPointerId = e.pointerId;
          longPressTimer = setTimeout(() => {
            longPressTimer = null;
            longPressFired = true;
            openSplitPopover(pkt, longPressStart.x, longPressStart.y);
          }, LONG_PRESS_MS);
        });
        g.addEventListener('pointermove', (e) => {
          if (!longPressStart || e.pointerId !== longPressPointerId) return;
          const dx = e.clientX - longPressStart.x;
          const dy = e.clientY - longPressStart.y;
          if (Math.hypot(dx, dy) > LONG_PRESS_MOVE_TOL) cancelLongPress();
        });
        g.addEventListener('pointerup',     cancelLongPress);
        g.addEventListener('pointercancel', cancelLongPress);
        g.addEventListener('pointerleave',  cancelLongPress);
      }

      g.addEventListener('click', (e) => {
        e.stopPropagation();
        if (longPressFired) {
          longPressFired = false;
          return;
        }
        closePopover();
        togglePacketSelection(pkt.id);
      });
      if (SPLITTING) {
        g.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          cancelLongPress();
          openSplitPopover(pkt, e.clientX, e.clientY);
        });
        g.addEventListener('dblclick', (e) => {
          e.preventDefault();
          e.stopPropagation();
          openSplitPopover(pkt, e.clientX, e.clientY);
        });
      }
      g.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          togglePacketSelection(pkt.id);
        } else if (SPLITTING && e.key.toLowerCase() === 's') {
          e.preventDefault();
          const bounds = g.getBoundingClientRect();
          openSplitPopover(pkt, bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
        }
      });
    }
    packetsAtRestG.appendChild(g);
  }

  function renderDock(device, pkts, interactive) {
    const dock = DOCK[device];
    if (!dock) return;
    const n = pkts.length;
    pkts.forEach((pkt, i) => {
      const row = Math.floor(i / MAX_PER_ROW);
      const col = i % MAX_PER_ROW;
      const rowStart = row * MAX_PER_ROW;
      const rowN = Math.min(MAX_PER_ROW, n - rowStart);
      const spacing = HEADER_BITS > 0 ? Math.max(dock.dx, 52) : dock.dx;
      const x = dock.x + (col - (rowN - 1) / 2) * spacing;
      const y = dock.y + row * dock.dy;
      renderChip(pkt, x, y, interactive);
    });
  }

  function pointOnWire(link, progress) {
    const path = wireEls[link];
    const len = wireLens[link];
    const s = Math.max(0, Math.min(len, len * progress));
    const p = path.getPointAtLength(s);
    const eps = Math.max(0.5, len * 0.02);
    const p2 = path.getPointAtLength(Math.min(len, s + eps));
    const angle = Math.atan2(p2.y - p.y, p2.x - p.x) * 180 / Math.PI;
    return { x: p.x, y: p.y, angle };
  }

  function drawTransitPacket(evt, t, paused = false) {
    const p = (t - evt.start) / (evt.end - evt.start);
    const { x, y, angle } = pointOnWire(evt.link, p);
    const palette = PACKET_COLORS[evt.packet.color];
    const color = palette.solid || palette.base;
    const rectW = Math.max(HEADER_BITS > 0 ? 48 : 30, Math.min(84, transmissionBits(evt.packet) * 5 + 18));
    const rectH = 26;
    const g = el('g', {
      class: `packet-anim${paused ? ' paused' : ''}`,
      transform: `translate(${x}, ${y}) rotate(${angle})`,
    });
    envelopeShape(g, rectW, rectH, {
      fill: color,
      stroke: color,
      strokeWidth: 1.5,
      flapStroke: palette.onBase,
    });
    g.appendChild(el('text', {
      x: 0, y: 3,
      'text-anchor': 'middle', 'dominant-baseline': 'middle',
      'font-size': '12', 'font-weight': '800', fill: palette.onBase,
      // Flip text upright if the packet moves right-to-left (angle > 90°)
      transform: (Math.abs(angle) > 90) ? 'rotate(180)' : '',
    }, packetVisibleLabel(evt.packet)));
    packetAnimG.appendChild(g);
  }

  function updateArrivalText() {
    let bBits = 0, oBits = 0;
    for (const p of packets) {
      if (isAtDestination(p)) {
        if (p.color === 'green') bBits += p.size;
        else oBits += p.size;
      }
    }
    arrivalPc3.textContent = `${bBits} از ${GREEN_BITS} بیت`;
    arrivalPc4.textContent = `${oBits} از ${ORANGE_BITS} بیت`;
    arrivalPc3.classList.toggle('done', bBits === GREEN_BITS);
    arrivalPc4.classList.toggle('done', oBits === ORANGE_BITS);
  }

  function updateStats() {
    // Current attempt is rendered as a live row in the history table.
    renderHistory();
  }

  function setWireClass(key, cls) {
    if (wireEls[key].getAttribute('class') !== cls) {
      wireEls[key].setAttribute('class', cls);
    }
  }

  function renderStatic() {
    hideAvailabilityTooltip();
    packetsAtRestG.innerHTML = '';
    packetAnimG.innerHTML = '';
    for (const key in wireEls) setWireClass(key, 'wire');
    const byDevice = {};
    for (const p of packets) {
      if (EVENT_PAUSES && isInTransit(p)) continue;
      (byDevice[p.location] = byDevice[p.location] || []).push(p);
    }
    for (const dev in byDevice) renderDock(dev, byDevice[dev], !animating);
    if (EVENT_PAUSES) {
      for (const transfer of activeTransfers) drawTransitPacket(transfer, totalTime, true);
    }
    updateArrivalText();
  }

  function packetPositionAt(pkt, t) {
    if (EVENT_PAUSES) {
      const evt = currentSchedule?.events.find(event => event.packet === pkt);
      if (!evt) return { kind: 'dock', device: pkt.location };
      if (t < evt.end) return { kind: 'transit', event: evt };
      return { kind: 'dock', device: evt.to };
    }
    if (!currentSchedule) return { kind: 'dock', device: pkt.location };
    const evt = currentSchedule.events.find(e => e.packet === pkt);
    if (!evt) return { kind: 'dock', device: pkt.location };
    if (t < evt.start) return { kind: 'dock', device: evt.from };
    if (t < evt.end)   return { kind: 'transit', event: evt };
    return { kind: 'dock', device: evt.to };
  }

  function renderAnimationFrame(t) {
    packetsAtRestG.innerHTML = '';
    packetAnimG.innerHTML = '';

    const byDevice = {};
    const transitEvents = [];
    const busyByLink = {};
    for (const p of packets) {
      const pos = packetPositionAt(p, t);
      if (pos.kind === 'dock') {
        (byDevice[pos.device] = byDevice[pos.device] || []).push(p);
      } else {
        transitEvents.push(pos.event);
        busyByLink[pos.event.link] = pos.event.packet.color;
      }
    }
    for (const key in wireEls) {
      setWireClass(key, busyByLink[key] ? `wire busy-${busyByLink[key]}` : 'wire');
    }
    for (const dev in byDevice) renderDock(dev, byDevice[dev], false);
    for (const evt of transitEvents) drawTransitPacket(evt, t);
    updateArrivalText();
  }

  // --- Round scheduling ---
  function computeSchedule() {
    const selected = packets.filter(p => p.selected && !isAtDestination(p) && nextHop(p));
    if (selected.length === 0) return null;

    const byLink = {};
    for (const p of selected) {
      const hop = nextHop(p);
      (byLink[hop.link] = byLink[hop.link] || []).push(p);
    }

    const events = [];
    let maxEnd = 0;
    for (const link in byLink) {
      const pkts = byLink[link].sort((a, b) => a.id - b.id);
      let t = 0;
      for (const p of pkts) {
        const hop = nextHop(p);
        const dur = transmissionBits(p) * BIT_TIME;
        events.push({ packet: p, link, from: p.location, to: hop.to, start: t, end: t + dur });
        t += dur;
      }
      if (t > maxEnd) maxEnd = t;
    }

    // Precompute when each color finishes fully arriving (relative to schedule start),
    // so animate() can fill the live row's cell as soon as it happens — not at round end.
    const colorDeliveryEnd = {};
    for (const color of ['green', 'orange']) {
      const dest = DEST[color];
      const allWillArrive = packets.filter(p => p.color === color).every(p => {
        const evt = events.find(e => e.packet === p);
        return evt ? evt.to === dest : p.location === dest;
      });
      if (allWillArrive) {
        const arrivals = events.filter(e => e.packet.color === color && e.to === dest);
        colorDeliveryEnd[color] = arrivals.length > 0 ? Math.max(...arrivals.map(e => e.end)) : 0;
      } else {
        colorDeliveryEnd[color] = null;
      }
    }
    return { events, duration: maxEnd, colorDeliveryEnd };
  }

  function startSelectedTransfers() {
    const occupiedLinks = new Set(activeTransfers.map(transfer => transfer.link));
    const selected = packets
      .filter(packet => packet.selected && isAvailable(packet) && !isAtDestination(packet) && !isInTransit(packet) && nextHop(packet))
      .sort((a, b) => a.id - b.id);

    for (const packet of selected) {
      const hop = nextHop(packet);
      if (occupiedLinks.has(hop.link)) continue;
      const duration = transmissionBits(packet) * BIT_TIME;
      activeTransfers.push({
        packet,
        link: hop.link,
        from: packet.location,
        to: hop.to,
        start: totalTime,
        end: totalTime + duration,
      });
      packet.selected = false;
      occupiedLinks.add(hop.link);
    }
  }

  function nextAvailabilityTime() {
    const times = packets
      .filter(packet => packet.availableAt > totalTime + 1e-9)
      .map(packet => packet.availableAt);
    return times.length ? Math.min(...times) : null;
  }

  function beginEventSegment({ startSelected = false } = {}) {
    hideAvailabilityTooltip();
    if (startSelected) startSelectedTransfers();
    const nextTransferEnd = activeTransfers.length
      ? Math.min(...activeTransfers.map(transfer => transfer.end))
      : null;
    const nextAvailability = nextAvailabilityTime();
    const candidates = [nextTransferEnd, nextAvailability].filter(time => time !== null);
    if (candidates.length === 0) {
      animating = false;
      currentSchedule = null;
      renderStatic();
      updateControls();
      return;
    }

    const boundary = Math.min(...candidates);
    currentSchedule = {
      events: activeTransfers.map(transfer => ({
        ...transfer,
        start: transfer.start - totalTime,
        end: transfer.end - totalTime,
      })),
      duration: boundary - totalTime,
      boundary,
      colorDeliveryEnd: { green: null, orange: null },
    };
    animating = true;
    attemptStarted = true;
    animStart = performance.now();
    roundStartTime = totalTime;
    statusMsg.textContent = 'زمان تا رویداد بعدی جلو می‌رود…';
    statusMsg.classList.remove('win');
    updateControls();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) finishEventSegment();
    else animate();
  }

  function finishEventSegment() {
    const boundary = currentSchedule.boundary;
    const becameAvailable = packets.filter(packet =>
      packet.availableAt > totalTime + 1e-9 && packet.availableAt <= boundary + 1e-9
    );
    const completed = activeTransfers.filter(transfer => transfer.end <= boundary + 1e-9);
    const completedLinks = new Set(completed.map(transfer => transfer.link));

    totalTime = boundary;
    for (const transfer of completed) {
      transfer.packet.location = transfer.to;
      transfer.packet.selected = false;
    }
    activeTransfers = activeTransfers.filter(transfer => transfer.end > boundary + 1e-9);
    updateMemoryPeaks();
    checkEventDelivery('green');
    checkEventDelivery('orange');

    const arrivedAtSwitch = completed.some(transfer => DEVICES[transfer.to]?.kind === 'switch');
    const forwardableAfterBusyLink = packets.some(packet => {
      if (!isAvailable(packet) || isAtDestination(packet) || isInTransit(packet)) return false;
      const hop = nextHop(packet);
      return hop && completedLinks.has(hop.link);
    });
    const shouldPause = becameAvailable.length > 0 || arrivedAtSwitch || forwardableAfterBusyLink || activeTransfers.length === 0 || allDelivered();

    animating = false;
    currentSchedule = null;
    renderStatic();
    updateStats();

    if (allDelivered()) {
      timerEl.textContent = `زمان: ${totalTime.toFixed(1)} s ✓`;
      timerEl.classList.add('done');
      statusMsg.textContent = `همهٔ پیام‌ها در ${totalTime.toFixed(1)} s رسیدند!`;
      statusMsg.classList.add('win');
      updateBest(totalTime);
      commitCurrentAttempt();
      updateControls();
      return;
    }

    if (!shouldPause) {
      beginEventSegment();
      return;
    }

    round++;
    timerEl.textContent = `زمان: ${totalTime.toFixed(1)} s`;
    if (becameAvailable.length > 0) {
      const packet = becameAvailable[0];
      statusMsg.textContent = `${ITEM_NOUN_WITH_EZAFE} ${packetSizePhrase(packet)} آمادهٔ ارسال شد؛ حالا می‌توانید انتخابش کنید.`;
    } else if (arrivedAtSwitch) {
      const names = [...new Set(completed
        .filter(transfer => DEVICES[transfer.to]?.kind === 'switch')
        .map(transfer => transfer.to))].join(' و ');
      statusMsg.textContent = `${ITEM_NOUN} به سوییچ ${names} رسید؛ ${config.statusAfterRound}`;
    } else {
      statusMsg.textContent = config.statusAfterRound;
    }
    updateControls();
  }

  function checkEventDelivery(color) {
    if ((color === 'green' ? greenDeliveredAt : orangeDeliveredAt) !== null) return;
    const delivered = packets.filter(packet => packet.color === color).every(isAtDestination);
    if (!delivered) return;
    if (color === 'green') greenDeliveredAt = totalTime;
    else orangeDeliveredAt = totalTime;
  }

  function animate() {
    if (!animating) return;
    const raw = (performance.now() - animStart) / 1000;
    const T   = Math.min(raw, currentSchedule.duration);

    renderAnimationFrame(T);
    timerEl.textContent = `زمان: ${(totalTime + T).toFixed(1)} s`;

    if (!EVENT_PAUSES) {
      const cd = currentSchedule.colorDeliveryEnd;
      if (greenDeliveredAt === null && cd.green !== null && T >= cd.green) {
        greenDeliveredAt = roundStartTime + cd.green;
        updateStats();
      }
      if (orangeDeliveredAt === null && cd.orange !== null && T >= cd.orange) {
        orangeDeliveredAt = roundStartTime + cd.orange;
        updateStats();
      }
    }

    if (raw >= currentSchedule.duration) {
      if (EVENT_PAUSES) finishEventSegment();
      else finishRound();
      return;
    }
    requestAnimationFrame(animate);
  }

  function finishRound() {
    totalTime += currentSchedule.duration;
    for (const evt of currentSchedule.events) {
      evt.packet.location = evt.to;
      evt.packet.selected = false;
    }
    const finishedEvents = currentSchedule.events;
    checkColorDelivery('green', 'PC3', finishedEvents);
    checkColorDelivery('orange', 'PC4', finishedEvents);

    animating = false;
    currentSchedule = null;
    round++;
    renderStatic();
    updateStats();

    if (allDelivered()) {
      timerEl.textContent = `زمان: ${totalTime.toFixed(1)} s ✓`;
      timerEl.classList.add('done');
      statusMsg.textContent = `همهٔ ${ITEM_NOUN}‌ها در ${totalTime.toFixed(1)} s رسیدند!`;
      statusMsg.classList.add('win');
      updateBest(totalTime);
      commitCurrentAttempt();
    } else {
      timerEl.textContent = `زمان: ${totalTime.toFixed(1)} s`;
      statusMsg.textContent = config.statusAfterRound;
    }
    updateControls();
  }

  function startRound() {
    if (animating || allDelivered()) return;
    if (EVENT_PAUSES) {
      closePopover();
      beginEventSegment({ startSelected: true });
      return;
    }
    const schedule = computeSchedule();
    if (!schedule) return;
    closePopover();
    currentSchedule = schedule;
    animating = true;
    attemptStarted = true;
    animStart = performance.now();
    roundStartTime = totalTime;
    statusMsg.textContent = `${ITEM_NOUN}‌های دور ${round} در حرکت‌اند…`;
    statusMsg.classList.remove('win');
    updateControls();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finishRound();
    } else {
      animate();
    }
  }

  function checkColorDelivery(color, dest, roundEvents) {
    if (color === 'green'   && greenDeliveredAt   !== null) return;
    if (color === 'orange' && orangeDeliveredAt !== null) return;

    const allOfColorDelivered = packets.filter(p => p.color === color).every(p => p.location === dest);
    if (!allOfColorDelivered) return;

    const relevant = roundEvents.filter(e => e.packet.color === color && e.to === dest);
    if (relevant.length === 0) return;
    const lastEnd = Math.max(...relevant.map(e => e.end));
    const t = roundStartTime + lastEnd;

    if (color === 'green') greenDeliveredAt = t;
    else orangeDeliveredAt = t;
  }

  function updateControls() {
    roundNumEl.textContent = String(round);
    const hasSelected = packets.some(p => p.selected && !isAtDestination(p));
    if (EVENT_PAUSES) {
      const occupiedLinks = new Set(activeTransfers.map(transfer => transfer.link));
      const hasStartableSelected = packets.some(packet => {
        if (!packet.selected || !isAvailable(packet) || isAtDestination(packet) || isInTransit(packet)) return false;
        const hop = nextHop(packet);
        return hop && !occupiedLinks.has(hop.link);
      });
      const canAdvance = activeTransfers.length > 0 || nextAvailabilityTime() !== null;
      goBtn.disabled = animating || allDelivered() || (!hasStartableSelected && !canAdvance);
      goBtn.textContent = hasStartableSelected ? 'ارسال' : 'ادامه';
    } else {
      goBtn.disabled = animating || !hasSelected || allDelivered();
    }
    resetBtn.disabled = animating;
  }

  function fmtTime(t) {
    return (t === null || t === undefined) ? '—' : `${t.toFixed(1)} s`;
  }

  function timeSinceAvailability(deliveredAt, availableAt) {
    if (deliveredAt === null || deliveredAt === undefined) return null;
    return Math.max(0, deliveredAt - availableAt);
  }

  function bestPerColumn(entries) {
    const keys = ['green', 'orange', 'all', 'packets'];
    if (SHOW_MEMORY) keys.push('memoryA', 'memoryB');
    const out = {};
    for (const k of keys) {
      const vals = entries.map(e => e[k]).filter(v => v !== null && v !== undefined);
      out[k] = vals.length ? Math.min(...vals) : null;
    }
    return out;
  }

  function currentAttemptEntry() {
    const greenDuration = timeSinceAvailability(greenDeliveredAt, GREEN_AVAILABLE_AT);
    const orangeDuration = timeSinceAvailability(orangeDeliveredAt, 0);
    return {
      n:       attemptCounter + 1,
      green:    greenDuration,
      orange:  orangeDuration,
      all:     completedStopwatchTime(greenDeliveredAt, orangeDeliveredAt, totalTime),
      packets: packets.length,
      memoryA: peakMemoryA,
      memoryB: peakMemoryB,
    };
  }

  function renderHistory() {
    if (BEST_FROM_ATTEMPT_HISTORY) {
      const completedTimes = attemptsHistory
        .map(entry => entry.all)
        .filter(time => time !== null && time !== undefined);
      bestTimeEl.textContent = completedTimes.length
        ? `${Math.min(...completedTimes).toFixed(1)} s`
        : '-';
    }

    historyList.innerHTML = '';
    // Only show the current live row once the user has actually started (clicked
    // GO) and the game isn't already won. Between finishing an attempt and
    // clicking Reset the packet count would otherwise mirror the row we just
    // committed, causing duplicate-looking data.
    const showCurrent = attemptStarted && !allDelivered();
    historyCard.hidden = attemptsHistory.length === 0 && !showCurrent;
    if (historyCard.hidden) return;

    const rowsForBest = showCurrent ? [...attemptsHistory, currentAttemptEntry()] : attemptsHistory;
    // No highlighting until there are at least two rows to compare.
    const bests = rowsForBest.length >= 2 ? bestPerColumn(rowsForBest) : null;

    const cell = (cls, key, entry, text) => {
      const isBest = bests && bests[key] !== null && entry[key] !== null && entry[key] === bests[key];
      return `<span class="${cls}${isBest ? ' best' : ''}" role="cell"><bdi dir="ltr">${text}</bdi></span>`;
    };
    const makeRow = (entry, extraCls = '') => {
      const row = document.createElement('div');
      row.className = `history-row${extraCls ? ` ${extraCls}` : ''}`;
      row.setAttribute('role', 'row');
      row.innerHTML = `
        <span class="num" role="cell"><bdi dir="ltr">${entry.n}</bdi></span>
        ${cell('green',   'green',   entry, fmtTime(entry.green))}
        ${cell('orange', 'orange', entry, fmtTime(entry.orange))}
        ${cell('all',    'all',    entry, fmtTime(entry.all))}
        ${cell('packets', 'packets', entry, entry.packets)}
        ${SHOW_MEMORY ? cell('memory-a', 'memoryA', entry, `${entry.memoryA} بیت`) : ''}
        ${SHOW_MEMORY ? cell('memory-b', 'memoryB', entry, `${entry.memoryB} بیت`) : ''}
      `;
      return row;
    };
    if (showCurrent) historyList.appendChild(makeRow(currentAttemptEntry(), 'current'));
    for (const entry of attemptsHistory) historyList.appendChild(makeRow(entry));
  }

  function commitCurrentAttempt() {
    // Only record attempts where at least one color made it to its destination.
    if (greenDeliveredAt === null && orangeDeliveredAt === null) return;
    attemptCounter++;
    const greenDuration = timeSinceAvailability(greenDeliveredAt, GREEN_AVAILABLE_AT);
    const orangeDuration = timeSinceAvailability(orangeDeliveredAt, 0);
    attemptsHistory.push({
      n:       attemptCounter,
      green:    greenDuration,
      orange:  orangeDuration,
      all:     completedStopwatchTime(greenDeliveredAt, orangeDeliveredAt, totalTime),
      packets: packets.length,
      memoryA: peakMemoryA,
      memoryB: peakMemoryB,
    });
    // Clear per-color delivery times so the "current" live row goes back to
    // empty instead of mirroring the row we just committed.
    greenDeliveredAt = null;
    orangeDeliveredAt = null;
    renderHistory();
  }

  function resetMap() {
    closePopover();
    initialState();
    timerEl.textContent = 'زمان: 0.0 s';
    timerEl.classList.remove('done');
    statusMsg.textContent = config.statusInitial;
    statusMsg.classList.remove('win');
    renderStatic();
    updateStats();
    updateControls();
  }

  function onResetClick() {
    if (animating) return;
    resetMap();
  }

  goBtn.addEventListener('click', startRound);
  resetBtn.addEventListener('click', onResetClick);

  renderHistory();
  resetMap();
}
