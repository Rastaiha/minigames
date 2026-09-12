import '@fontsource-variable/vazirmatn'

(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const BIT_TIME = 0.5;
  const BLUE_BITS   = 8;
  const ORANGE_BITS = 6;
  const DEVICES = {
    PC1: { x: 100, y: 130, kind: 'pc', num: 1, color: 'blue'   },
    PC2: { x: 100, y: 370, kind: 'pc', num: 2, color: 'orange' },
    A:   { x: 340, y: 250, kind: 'switch', label: 'A' },
    B:   { x: 560, y: 250, kind: 'switch', label: 'B' },
    PC3: { x: 800, y: 130, kind: 'pc', num: 3, color: 'blue'   },
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
    blue:   { PC1: { link: 'PC1-A', to: 'A' }, A: { link: 'A-B', to: 'B' }, B: { link: 'B-PC3', to: 'PC3' } },
    orange: { PC2: { link: 'PC2-A', to: 'A' }, A: { link: 'A-B', to: 'B' }, B: { link: 'B-PC4', to: 'PC4' } },
  };
  const DEST = { blue: 'PC3', orange: 'PC4' };

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
        fill: '#35afb8',
        stroke: '#2c2318',
        'stroke-width': 1.5,
      }));
      for (let i = 0; i < 4; i++) {
        devicesG.appendChild(el('rect', {
          x: d.x - 17 + i * 10, y: d.y + 8, width: 4, height: 4,
          fill: '#fcfaf4',
        }));
      }
      devicesG.appendChild(el('text', { x: d.x, y: d.y - 4, class: 'switch-label' }, d.label));
    } else {
      devicesG.appendChild(el('rect', {
        x: d.x - 42, y: d.y - 32, width: 84, height: 64, rx: 6,
        fill: '#fcfaf4',
        stroke: '#2c2318', 'stroke-width': 1.5,
      }));
      devicesG.appendChild(el('rect', {
        x: d.x - 36, y: d.y - 26, width: 72, height: 52, rx: 4,
        class: `pc-screen ${d.color}`
      }));
      devicesG.appendChild(el('rect', { x: d.x - 8,  y: d.y + 32, width: 16, height: 8, fill: '#fcfaf4', stroke: '#2c2318', 'stroke-width': 1.5 }));
      devicesG.appendChild(el('rect', { x: d.x - 22, y: d.y + 40, width: 44, height: 4, rx: 2, fill: '#fcfaf4', stroke: '#2c2318', 'stroke-width': 1.5 }));
      devicesG.appendChild(el('text', { x: d.x, y: d.y, class: `pc-num ${d.color}` }, `PC${d.num}`));
    }
  }
  labelsG.appendChild(el('text', { x: 340, y: 298, class: 'device-label' }, 'سوییچ A'));
  labelsG.appendChild(el('text', { x: 560, y: 298, class: 'device-label' }, 'سوییچ B'));

  // Arrival progress
  const arrivalPc3 = el('text', { x: 800, y: 35,  class: 'progress-text blue'   }, '۰ از ۱۰ بیت');
  const arrivalPc4 = el('text', { x: 800, y: 470, class: 'progress-text orange' }, '۰ از ۱۰ بیت');
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
  let blueDeliveredAt = null;
  let orangeDeliveredAt = null;
  let currentPopover = null;

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

  const BEST_KEY = 'packet-split-step-best-v1';
  (function loadBest() {
    const v = localStorage.getItem(BEST_KEY);
    if (v) bestTimeEl.textContent = `${parseFloat(v).toFixed(1)} s`;
  })();
  function updateBest(t) {
    const cur = localStorage.getItem(BEST_KEY);
    if (!cur || t < parseFloat(cur) - 1e-9) {
      localStorage.setItem(BEST_KEY, String(t));
      bestTimeEl.textContent = `${t.toFixed(1)} s`;
    }
  }

  function isAtDestination(pkt) { return pkt.location === DEST[pkt.color]; }
  function nextHop(pkt)         { return (ROUTE[pkt.color] || {})[pkt.location] || null; }
  function allDelivered()       { return packets.every(isAtDestination); }

  function initialState() {
    nextId = 1;
    packets = [
      { id: nextId++, size: BLUE_BITS,   color: 'blue',   location: 'PC1', selected: false },
      { id: nextId++, size: ORANGE_BITS, color: 'orange', location: 'PC2', selected: false },
    ];
    totalTime = 0;
    round = 1;
    animating = false;
    currentSchedule = null;
    roundStartTime = 0;
    blueDeliveredAt = null;
    orangeDeliveredAt = null;
    attemptStarted = false;
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
    if (animating || pkt.size < 2 || isAtDestination(pkt)) return;
    const half = Math.floor(pkt.size / 2);
    const pop = document.createElement('div');
    pop.className = 'split-popover';
    pop.innerHTML = `
      <div class="preview">بستهٔ <b>${pkt.size}</b> بیتی را به <b class="lval">${half}</b> + <b class="rval">${pkt.size - half}</b> تقسیم کنید</div>
      <input type="range" min="1" max="${pkt.size - 1}" value="${half}" aria-label="اندازهٔ بخش اول بسته">
      <div class="btn-row">
        <button class="do" type="button">تقسیم</button>
        <button class="secondary cancel" type="button">انصراف</button>
      </div>
    `;
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', 'تقسیم بسته');
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
    if (!pkt || isAtDestination(pkt)) return;
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
      { id: nextId++, size: v,             color: pkt.color, location: pkt.location, selected: false },
      { id: nextId++, size: pkt.size - v,  color: pkt.color, location: pkt.location, selected: false }
    );
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

  function renderChip(pkt, x, y, interactive) {
    const fill = pkt.color === 'blue' ? '#5669d1' : '#e8b33a';
    const atDest = isAtDestination(pkt);
    const isSelected = pkt.selected && !atDest;
    const w = 30, h = 22;

    const cls = ['chip-svg', pkt.color];
    if (!interactive) cls.push('locked');
    if (isSelected)   cls.push('selected');
    const attrs = { class: cls.join(' '), transform: `translate(${x}, ${y})` };
    if (interactive) {
      attrs.tabindex = '0';
      attrs.role = 'button';
      attrs['aria-label'] = `بستهٔ ${pkt.size} بیتی ${pkt.color === 'blue' ? 'آبی' : 'طلایی'}؛ ${isSelected ? 'انتخاب شده' : 'انتخاب نشده'}`;
    }
    const g = el('g', attrs);
    g.appendChild(el('rect', { x: -17, y: -14, width: 34, height: 28, rx: 5, fill: 'transparent', stroke: 'transparent', class: 'focus-ring' }));

    envelopeShape(g, w, h, {
      fill:        isSelected ? `${fill}38` : (atDest ? `${fill}3d` : `${fill}18`),
      stroke:      fill,
      strokeWidth: isSelected ? 2 : 1.4,
      flapStroke:  fill,
    });

    g.appendChild(el('text', {
      x: 0, y: 3,
      'text-anchor': 'middle', 'dominant-baseline': 'middle',
      'font-size': '12', 'font-weight': '800',
      fill: '#2c2318',
    }, String(pkt.size)));

    if (atDest) g.setAttribute('opacity', '0.85');

    if (interactive) {
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

      g.addEventListener('click', (e) => {
        e.stopPropagation();
        if (longPressFired) {
          longPressFired = false;
          return;
        }
        closePopover();
        togglePacketSelection(pkt.id);
      });
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
      g.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          togglePacketSelection(pkt.id);
        } else if (e.key.toLowerCase() === 's') {
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
      const x = dock.x + (col - (rowN - 1) / 2) * dock.dx;
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

  function drawTransitPacket(evt, t) {
    const p = (t - evt.start) / (evt.end - evt.start);
    const { x, y, angle } = pointOnWire(evt.link, p);
    const color = evt.packet.color === 'blue' ? '#5669d1' : '#e8b33a';
    const rectW = Math.max(30, Math.min(84, evt.packet.size * 5 + 18));
    const rectH = 26;
    const g = el('g', { class: 'packet-anim', transform: `translate(${x}, ${y}) rotate(${angle})` });
    envelopeShape(g, rectW, rectH, {
      fill: color,
      stroke: color,
      strokeWidth: 1.5,
      flapStroke: '#2c2318',
    });
    g.appendChild(el('text', {
      x: 0, y: 3,
      'text-anchor': 'middle', 'dominant-baseline': 'middle',
      'font-size': '12', 'font-weight': '800', fill: '#2c2318',
      // Flip text upright if the packet moves right-to-left (angle > 90°)
      transform: (Math.abs(angle) > 90) ? 'rotate(180)' : '',
    }, String(evt.packet.size)));
    packetAnimG.appendChild(g);
  }

  function updateArrivalText() {
    let bBits = 0, oBits = 0;
    for (const p of packets) {
      if (isAtDestination(p)) {
        if (p.color === 'blue') bBits += p.size;
        else oBits += p.size;
      }
    }
    arrivalPc3.textContent = `${bBits} از ${BLUE_BITS} بیت`;
    arrivalPc4.textContent = `${oBits} از ${ORANGE_BITS} بیت`;
    arrivalPc3.classList.toggle('done', bBits === BLUE_BITS);
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
    packetsAtRestG.innerHTML = '';
    packetAnimG.innerHTML = '';
    for (const key in wireEls) setWireClass(key, 'wire');
    const byDevice = {};
    for (const p of packets) {
      (byDevice[p.location] = byDevice[p.location] || []).push(p);
    }
    for (const dev in byDevice) renderDock(dev, byDevice[dev], !animating);
    updateArrivalText();
  }

  function packetPositionAt(pkt, t) {
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
        const dur = p.size * BIT_TIME;
        events.push({ packet: p, link, from: p.location, to: hop.to, start: t, end: t + dur });
        t += dur;
      }
      if (t > maxEnd) maxEnd = t;
    }

    // Precompute when each color finishes fully arriving (relative to schedule start),
    // so animate() can fill the live row's cell as soon as it happens — not at round end.
    const colorDeliveryEnd = {};
    for (const color of ['blue', 'orange']) {
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

  function animate() {
    if (!animating) return;
    const raw = (performance.now() - animStart) / 1000;
    const T   = Math.min(raw, currentSchedule.duration);

    renderAnimationFrame(T);
    timerEl.textContent = `زمان: ${(totalTime + T).toFixed(1)} s`;

    const cd = currentSchedule.colorDeliveryEnd;
    if (blueDeliveredAt === null && cd.blue !== null && T >= cd.blue) {
      blueDeliveredAt = roundStartTime + cd.blue;
      updateStats();
    }
    if (orangeDeliveredAt === null && cd.orange !== null && T >= cd.orange) {
      orangeDeliveredAt = roundStartTime + cd.orange;
      updateStats();
    }

    if (raw >= currentSchedule.duration) {
      finishRound();
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
    checkColorDelivery('blue', 'PC3', finishedEvents);
    checkColorDelivery('orange', 'PC4', finishedEvents);

    animating = false;
    currentSchedule = null;
    round++;
    renderStatic();
    updateStats();

    if (allDelivered()) {
      timerEl.textContent = `زمان: ${totalTime.toFixed(1)} s ✓`;
      timerEl.classList.add('done');
      statusMsg.textContent = `همهٔ بسته‌ها در ${totalTime.toFixed(1)} s رسیدند!`;
      statusMsg.classList.add('win');
      updateBest(totalTime);
      commitCurrentAttempt();
    } else {
      timerEl.textContent = `زمان: ${totalTime.toFixed(1)} s`;
      statusMsg.textContent = 'بسته را انتخاب کنید یا برای تقسیمش نگه دارید.';
    }
    updateControls();
  }

  function startRound() {
    if (animating || allDelivered()) return;
    const schedule = computeSchedule();
    if (!schedule) return;
    closePopover();
    currentSchedule = schedule;
    animating = true;
    attemptStarted = true;
    animStart = performance.now();
    roundStartTime = totalTime;
    statusMsg.textContent = `بسته‌های دور ${round} در حرکت‌اند…`;
    statusMsg.classList.remove('win');
    updateControls();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finishRound();
    } else {
      animate();
    }
  }

  function checkColorDelivery(color, dest, roundEvents) {
    if (color === 'blue'   && blueDeliveredAt   !== null) return;
    if (color === 'orange' && orangeDeliveredAt !== null) return;

    const allOfColorDelivered = packets.filter(p => p.color === color).every(p => p.location === dest);
    if (!allOfColorDelivered) return;

    const relevant = roundEvents.filter(e => e.packet.color === color && e.to === dest);
    if (relevant.length === 0) return;
    const lastEnd = Math.max(...relevant.map(e => e.end));
    const t = roundStartTime + lastEnd;

    if (color === 'blue') blueDeliveredAt = t;
    else orangeDeliveredAt = t;
  }

  function updateControls() {
    roundNumEl.textContent = String(round);
    const hasSelected = packets.some(p => p.selected && !isAtDestination(p));
    goBtn.disabled = animating || !hasSelected || allDelivered();
    resetBtn.disabled = animating;
  }

  function fmtTime(t) {
    return (t === null || t === undefined) ? '—' : `${t.toFixed(1)} s`;
  }

  function bestPerColumn(entries) {
    const keys = ['blue', 'orange', 'sum', 'all', 'packets'];
    const out = {};
    for (const k of keys) {
      const vals = entries.map(e => e[k]).filter(v => v !== null && v !== undefined);
      out[k] = vals.length ? Math.min(...vals) : null;
    }
    return out;
  }

  function currentAttemptEntry() {
    const both = blueDeliveredAt !== null && orangeDeliveredAt !== null;
    return {
      n:       attemptCounter + 1,
      blue:    blueDeliveredAt,
      orange:  orangeDeliveredAt,
      sum:     both ? blueDeliveredAt + orangeDeliveredAt : null,
      all:     both ? Math.max(blueDeliveredAt, orangeDeliveredAt) : null,
      packets: packets.length,
    };
  }

  function renderHistory() {
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
        ${cell('blue',   'blue',   entry, fmtTime(entry.blue))}
        ${cell('orange', 'orange', entry, fmtTime(entry.orange))}
        ${cell('sum',    'sum',    entry, fmtTime(entry.sum))}
        ${cell('all',    'all',    entry, fmtTime(entry.all))}
        ${cell('packets', 'packets', entry, entry.packets)}
      `;
      return row;
    };
    if (showCurrent) historyList.appendChild(makeRow(currentAttemptEntry(), 'current'));
    for (const entry of attemptsHistory) historyList.appendChild(makeRow(entry));
  }

  function commitCurrentAttempt() {
    // Only record attempts where at least one color made it to its destination.
    if (blueDeliveredAt === null && orangeDeliveredAt === null) return;
    attemptCounter++;
    const both = blueDeliveredAt !== null && orangeDeliveredAt !== null;
    attemptsHistory.push({
      n:       attemptCounter,
      blue:    blueDeliveredAt,
      orange:  orangeDeliveredAt,
      sum:     both ? blueDeliveredAt + orangeDeliveredAt : null,
      all:     both ? Math.max(blueDeliveredAt, orangeDeliveredAt) : null,
      packets: packets.length,
    });
    // Clear per-color delivery times so the "current" live row goes back to
    // empty instead of mirroring the row we just committed.
    blueDeliveredAt = null;
    orangeDeliveredAt = null;
    renderHistory();
  }

  function resetMap() {
    closePopover();
    initialState();
    timerEl.textContent = 'زمان: 0.0 s';
    timerEl.classList.remove('done');
    statusMsg.textContent = 'بسته را بزنید تا انتخاب شود؛ برای تقسیم روی آن نگه دارید.';
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
})();
