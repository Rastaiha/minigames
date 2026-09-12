import '@fontsource-variable/vazirmatn';

const SVG_NS = 'http://www.w3.org/2000/svg';

const Senders = [
    { id: 'UT1', type: 'terminal', x: 15, y: 25, label: '1' },
    { id: 'UT2', type: 'terminal', x: 15, y: 50, label: '2' },
    { id: 'UT3', type: 'terminal', x: 15, y: 75, label: '3' },
];
const Switches = [
    { id: 'SwA', type: 'switch', x: 38, y: 35, label: 'A' },
    { id: 'SwB', type: 'switch', x: 38, y: 65, label: 'B' },
    { id: 'SwC', type: 'switch', x: 62, y: 35, label: 'C' },
    { id: 'SwD', type: 'switch', x: 62, y: 65, label: 'D' },
];
const Receivers = [
    { id: 'UT4', type: 'terminal', x: 85, y: 25, label: '4' },
    { id: 'UT5', type: 'terminal', x: 85, y: 50, label: '5' },
    { id: 'UT6', type: 'terminal', x: 85, y: 75, label: '6' },
];

const AllNodes = [...Senders, ...Switches, ...Receivers];

const Connections = [
    ['UT1', 'SwA'], ['UT2', 'SwA'], ['UT2', 'SwB'], ['UT3', 'SwB'],
    ['SwA', 'SwC'], ['SwA', 'SwD'], ['SwB', 'SwC'], ['SwB', 'SwD'],
    ['SwC', 'UT4'], ['SwC', 'UT5'], ['SwD', 'UT5'], ['SwD', 'UT6'],
];

let edges = [];
let state = {
    playing: false,
    activeRequest: null,
    currentPath: [],
    requestCount: 0,
    maxRequests: 15,
    usedInitialReceivers: [],
    activeRequests: {},
};

const DOM = {
    nodes: document.getElementById('nodes-container'),
    links: document.getElementById('links'),
    modal: document.getElementById('modal'),
    modalText: document.getElementById('modal-text'),
    topCenter: document.getElementById('top-center'),
    topLeft: document.getElementById('top-left'),
    toast: document.getElementById('toast'),
    btnStart: document.getElementById('btn-start'),
    btnUndo: document.getElementById('btn-undo'),
    btnRestart: document.getElementById('btn-restart'),
};

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function labelOf(id) {
    const n = AllNodes.find(x => x.id === id);
    if (!n) return id;
    const prefix = n.type === 'terminal' ? 'کامپیوتر' : 'سوییچ';
    return `${prefix} ${n.label}`;
}

function neighborsOf(nodeId) {
    return Connections
        .filter(([a, b]) => a === nodeId || b === nodeId)
        .map(([a, b]) => (a === nodeId ? b : a));
}

let toastTimer = null;
function showToast(msg, ms = 3200) {
    DOM.toast.textContent = msg;
    DOM.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => DOM.toast.classList.remove('show'), ms);
}

function initGraph() {
    DOM.nodes.innerHTML = '';
    DOM.links.innerHTML = '';
    edges = [];

    Connections.forEach(pair => {
        const u = AllNodes.find(n => n.id === pair[0]);
        const v = AllNodes.find(n => n.id === pair[1]);
        const line = document.createElementNS(SVG_NS, 'line');
        line.setAttribute('class', 'edge');
        DOM.links.appendChild(line);
        edges.push({
            u: u.id, v: v.id, dom: line,
            occupiedBy: null, direction: null,
            idleLabel: null,
        });
    });

    AllNodes.forEach(n => {
        const el = document.createElement('div');
        el.className = `node ${n.type}`;
        el.id = n.id;
        el.style.left = `${n.x}%`;
        el.style.top = `${n.y}%`;

        if (n.type === 'switch') {
            const innerSvg = document.createElementNS(SVG_NS, 'svg');
            innerSvg.setAttribute('class', 'switch-inner');
            innerSvg.setAttribute('viewBox', '-50 -50 100 100');
            innerSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

            // Central chip outline (dashed ring hinting at internal circuitry).
            const chip = document.createElementNS(SVG_NS, 'circle');
            chip.setAttribute('cx', 0);
            chip.setAttribute('cy', 0);
            chip.setAttribute('r', 21);
            chip.setAttribute('class', 'switch-chip');
            innerSvg.appendChild(chip);

            n.ports = {};
            neighborsOf(n.id).forEach(neighborId => {
                const neighbor = AllNodes.find(x => x.id === neighborId);
                const angle = Math.atan2(neighbor.y - n.y, neighbor.x - n.x);
                const px = Math.cos(angle) * 36;
                const py = Math.sin(angle) * 36;
                const deg = angle * 180 / Math.PI;

                // Faint dashed trace from chip out to this port.
                const trace = document.createElementNS(SVG_NS, 'line');
                trace.setAttribute('x1', Math.cos(angle) * 21);
                trace.setAttribute('y1', Math.sin(angle) * 21);
                trace.setAttribute('x2', px);
                trace.setAttribute('y2', py);
                trace.setAttribute('class', 'switch-trace');
                innerSvg.appendChild(trace);

                // Port slot: rounded rect oriented toward its cable.
                const port = document.createElementNS(SVG_NS, 'rect');
                port.setAttribute('x', -5);
                port.setAttribute('y', -3.5);
                port.setAttribute('width', 10);
                port.setAttribute('height', 7);
                port.setAttribute('rx', 1.5);
                port.setAttribute('class', 'switch-port');
                port.setAttribute('transform', `translate(${px}, ${py}) rotate(${deg})`);
                innerSvg.appendChild(port);
                n.ports[neighborId] = { x: px, y: py, dom: port };
            });
            el.appendChild(innerSvg);

            const labelSpan = document.createElement('span');
            labelSpan.className = 'switch-label';
            labelSpan.innerHTML = `سوییچ<br>${n.label}`;
            el.appendChild(labelSpan);
        } else {
            const nameSpan = document.createElement('span');
            nameSpan.className = 'term-name';
            nameSpan.textContent = 'کامپیوتر';
            const numSpan = document.createElement('span');
            numSpan.className = 'term-num';
            numSpan.textContent = n.label;
            el.appendChild(nameSpan);
            el.appendChild(numSpan);
        }

        el.onclick = () => handleNodeClick(n);
        DOM.nodes.appendChild(el);
    });

    setTimeout(updateLines, 50);
    window.addEventListener('resize', updateLines);
}

function updateLines() {
    edges.forEach(edge => {
        const uEl = document.getElementById(edge.u);
        const vEl = document.getElementById(edge.v);
        if (!uEl || !vEl) return;
        const uRect = uEl.getBoundingClientRect();
        const vRect = vEl.getBoundingClientRect();
        edge.dom.setAttribute('x1', uRect.left + uRect.width / 2);
        edge.dom.setAttribute('y1', uRect.top + uRect.height / 2);
        edge.dom.setAttribute('x2', vRect.left + vRect.width / 2);
        edge.dom.setAttribute('y2', vRect.top + vRect.height / 2);
        if (edge.idleLabel) positionIdleLabel(edge);
    });
    const now = performance.now();
    Object.values(state.activeRequests).forEach(req => renderRequestPackets(req, now));
}

function startGame() {
    if (state.playing) return;
    state.playing = true;
    DOM.btnStart.disabled = true;
    spawnNextRequest();
}

function spawnNextRequest() {
    if (state.requestCount >= state.maxRequests) return;

    const s = Senders[Math.floor(Math.random() * Senders.length)].id;
    let r;

    if (state.requestCount < Receivers.length) {
        const available = Receivers.filter(rec => !state.usedInitialReceivers.includes(rec.id));
        if (available.length > 0) {
            r = available[Math.floor(Math.random() * available.length)].id;
            state.usedInitialReceivers.push(r);
        } else {
            r = Receivers[Math.floor(Math.random() * Receivers.length)].id;
        }
    } else {
        r = Receivers[Math.floor(Math.random() * Receivers.length)].id;
    }

    state.requestCount++;
    const vol = Math.floor(Math.random() * 3) + 1;
    const duration = 2 + vol * 4; // 6s / 10s / 14s — all under 15s
    const req = { id: Date.now(), s, r, vol, duration };
    showModal(req);
}

function showModal(req) {
    DOM.modalText.innerHTML =
        `<strong>${labelOf(req.s)} ➔ ${labelOf(req.r)}</strong>` +
        `<br>حجم دیتا: ${req.vol} MB` +
        `<br>زمان رزرو: ${req.duration} ثانیه`;
    DOM.modal.classList.add('show');
    setTimeout(() => {
        DOM.modal.classList.remove('show');
        activateRequest(req);
    }, 3000);
}

function activateRequest(req) {
    state.activeRequest = req;
    state.currentPath = [];
    DOM.btnUndo.disabled = true;

    const card = document.createElement('div');
    card.className = 'req-card active';
    card.id = `req-${req.id}`;
    card.innerHTML =
        `درخواست فعلی: <strong>${labelOf(req.s)} ➔ ${labelOf(req.r)}</strong>` +
        ` — ${req.vol}MB، رزرو ${req.duration} ثانیه`;
    DOM.topCenter.innerHTML = '';
    DOM.topCenter.appendChild(card);
    renderGraphState();
}

function handleNodeClick(node) {
    if (!state.activeRequest) return;
    const req = state.activeRequest;

    if (state.currentPath.length === 0) {
        if (node.id === req.s) {
            state.currentPath.push(node.id);
            DOM.btnUndo.disabled = false;
        } else {
            showToast(`مسیر را از ${labelOf(req.s)} شروع کن.`, 2400);
        }
    } else {
        const lastNode = state.currentPath[state.currentPath.length - 1];
        if (state.currentPath.includes(node.id)) return;

        const edge = edges.find(e =>
            (e.u === lastNode && e.v === node.id) ||
            (e.v === lastNode && e.u === node.id),
        );

        if (!edge) return;

        if (edge.occupiedBy) {
            const busy = state.activeRequests[edge.occupiedBy];
            if (busy) {
                const remaining = Math.max(0, Math.ceil((busy.endsAt - performance.now()) / 1000));
                showToast(
                    `این ارتباط بین ${labelOf(busy.s)} و ${labelOf(busy.r)} مشغول است؛ ` +
                    `حدود ${remaining} ثانیهٔ دیگر منتظر بمان.`,
                );
            } else {
                showToast('این ارتباط مشغول است؛ یک مسیر دیگر امتحان کن.');
            }
            return;
        }

        state.currentPath.push(node.id);
        DOM.btnUndo.disabled = false;
        if (node.id === req.r) completePath();
    }
    renderGraphState();
}

function completePath() {
    const req = state.activeRequest;
    const path = state.currentPath.slice();
    const startedAt = performance.now();
    const endsAt = startedAt + req.duration * 1000;
    const internalWires = [];

    const pathEdges = [];
    for (let i = 0; i < path.length - 1; i++) {
        const u = path[i], v = path[i + 1];
        const edge = edges.find(e => (e.u === u && e.v === v) || (e.v === u && e.u === v));
        if (!edge) continue;
        edge.occupiedBy = req.id;
        edge.direction = edge.u === u ? 'uv' : 'vu';

        const idleLabel = document.createElementNS(SVG_NS, 'text');
        idleLabel.setAttribute('class', 'edge-idle-label');
        idleLabel.textContent = 'خالی';
        DOM.links.appendChild(idleLabel);
        edge.idleLabel = idleLabel;
        positionIdleLabel(edge);

        pathEdges.push(edge);
    }

    // Emit N packets, one after another. Total N = vol × PACKETS_PER_MB.
    const totalPackets = req.vol * PACKETS_PER_MB;
    const packetEls = [];
    for (let i = 0; i < totalPackets; i++) {
        const pkt = document.createElementNS(SVG_NS, 'g');
        pkt.setAttribute('class', 'packet');
        const body = document.createElementNS(SVG_NS, 'rect');
        body.setAttribute('class', 'packet-body');
        body.setAttribute('x', -6.5);
        body.setAttribute('y', -4);
        body.setAttribute('width', 13);
        body.setAttribute('height', 8);
        body.setAttribute('rx', 1.2);
        pkt.appendChild(body);
        const flap = document.createElementNS(SVG_NS, 'path');
        flap.setAttribute('class', 'packet-flap');
        flap.setAttribute('d', 'M -5.5 -3.5 L 0 -0.5 L 5.5 -3.5');
        pkt.appendChild(flap);
        pkt.style.display = 'none';
        DOM.links.appendChild(pkt);
        packetEls.push(pkt);
    }

    for (let i = 1; i < path.length - 1; i++) {
        const nodeId = path[i];
        const node = AllNodes.find(x => x.id === nodeId);
        if (!node || node.type !== 'switch' || !node.ports) continue;
        const inPort = node.ports[path[i - 1]];
        const outPort = node.ports[path[i + 1]];
        if (!inPort || !outPort) continue;
        const switchEl = document.getElementById(node.id);
        const innerSvg = switchEl.querySelector('svg.switch-inner');
        const wire = document.createElementNS(SVG_NS, 'line');
        wire.setAttribute('x1', inPort.x);
        wire.setAttribute('y1', inPort.y);
        wire.setAttribute('x2', outPort.x);
        wire.setAttribute('y2', outPort.y);
        wire.setAttribute('class', 'switch-inner-wire');
        innerSvg.appendChild(wire);
        internalWires.push({ wire, node, inNeighbor: path[i - 1], outNeighbor: path[i + 1] });
        inPort.dom.classList.add('active');
        outPort.dom.classList.add('active');
    }

    state.activeRequests[req.id] = {
        s: req.s, r: req.r, vol: req.vol, duration: req.duration,
        endsAt, path, internalWires,
        pathEdges, packetEls, packetStartedAt: startedAt,
    };
    renderRequestPackets(state.activeRequests[req.id], startedAt);

    DOM.topCenter.innerHTML = '';

    const card = document.createElement('div');
    card.className = 'req-card completed';
    card.id = `timer-${req.id}`;
    let timeLeft = req.duration;
    card.innerHTML =
        `<span>${labelOf(req.s)} ➔ ${labelOf(req.r)}</span>` +
        ` <span id="time-val-${req.id}">⏱ ${timeLeft}s</span>`;
    DOM.topLeft.appendChild(card);

    const timer = setInterval(() => {
        timeLeft--;
        const span = document.getElementById(`time-val-${req.id}`);
        if (span) span.innerHTML = `⏱ ${timeLeft}s`;
        if (timeLeft <= 0) {
            clearInterval(timer);
            releaseRequest(req.id);
            if (card.parentNode) card.parentNode.removeChild(card);
        }
    }, 1000);

    state.activeRequest = null;
    state.currentPath = [];
    DOM.btnUndo.disabled = true;
    renderGraphState();

    setTimeout(spawnNextRequest, 500);
}

function releaseRequest(reqId) {
    const active = state.activeRequests[reqId];
    if (!active) return;

    edges.forEach(e => {
        if (e.occupiedBy === reqId) {
            if (e.idleLabel) { e.idleLabel.remove(); e.idleLabel = null; }
            e.occupiedBy = null;
            e.direction = null;
            e.dom.classList.remove('idle');
        }
    });

    if (active.packetEls) active.packetEls.forEach(p => p.remove());

    active.internalWires.forEach(entry => {
        entry.wire.remove();
        const stillUsed = (portId) => Object.entries(state.activeRequests).some(([otherId, other]) => {
            if (otherId === String(reqId)) return false;
            const p = other.path;
            for (let k = 1; k < p.length - 1; k++) {
                if (p[k] === entry.node.id && (p[k - 1] === portId || p[k + 1] === portId)) return true;
            }
            return false;
        });
        if (!stillUsed(entry.inNeighbor) && entry.node.ports[entry.inNeighbor]) {
            entry.node.ports[entry.inNeighbor].dom.classList.remove('active');
        }
        if (!stillUsed(entry.outNeighbor) && entry.node.ports[entry.outNeighbor]) {
            entry.node.ports[entry.outNeighbor].dom.classList.remove('active');
        }
    });

    delete state.activeRequests[reqId];
    renderGraphState();
}

DOM.btnUndo.addEventListener('click', () => {
    if (state.currentPath.length > 0) {
        state.currentPath.pop();
        if (state.currentPath.length === 0) DOM.btnUndo.disabled = true;
        renderGraphState();
    }
});

DOM.btnRestart.addEventListener('click', () => {
    location.reload();
});

DOM.btnStart.addEventListener('click', startGame);

function renderGraphState() {
    document.querySelectorAll('.node').forEach(el => {
        el.classList.remove('selected', 'hint-source', 'hint-target');
    });
    state.currentPath.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('selected');
    });

    if (state.activeRequest) {
        if (state.currentPath.length === 0) {
            const srcEl = document.getElementById(state.activeRequest.s);
            if (srcEl) srcEl.classList.add('hint-source');
        } else {
            const dstEl = document.getElementById(state.activeRequest.r);
            if (dstEl && !state.currentPath.includes(state.activeRequest.r)) {
                dstEl.classList.add('hint-target');
            }
        }
    }

    edges.forEach(e => {
        e.dom.setAttribute('class', 'edge');
        if (e.occupiedBy) {
            e.dom.setAttribute('class', 'edge occupied');
        } else if (state.currentPath.includes(e.u) && state.currentPath.includes(e.v)) {
            const idxU = state.currentPath.indexOf(e.u);
            const idxV = state.currentPath.indexOf(e.v);
            if (Math.abs(idxU - idxV) === 1) {
                e.dom.setAttribute('class', 'edge drawing');
            }
        }
    });
}

const PACKET_SPEED = 500; // px per second
const PACKETS_PER_MB = 3; // packets emitted per MB of the request's data volume

function edgeLength(edge) {
    const x1 = parseFloat(edge.dom.getAttribute('x1'));
    const y1 = parseFloat(edge.dom.getAttribute('y1'));
    const x2 = parseFloat(edge.dom.getAttribute('x2'));
    const y2 = parseFloat(edge.dom.getAttribute('y2'));
    return Math.hypot(x2 - x1, y2 - y1);
}

function positionPacketOnEdge(edge, pkt, phase) {
    const x1 = parseFloat(edge.dom.getAttribute('x1'));
    const y1 = parseFloat(edge.dom.getAttribute('y1'));
    const x2 = parseFloat(edge.dom.getAttribute('x2'));
    const y2 = parseFloat(edge.dom.getAttribute('y2'));
    let sx = x1, sy = y1, ex = x2, ey = y2;
    if (edge.direction === 'vu') { sx = x2; sy = y2; ex = x1; ey = y1; }
    const x = sx + (ex - sx) * phase;
    const y = sy + (ey - sy) * phase;
    const deg = Math.atan2(ey - sy, ex - sx) * 180 / Math.PI;
    pkt.setAttribute('transform', `translate(${x}, ${y}) rotate(${deg})`);
}

function positionIdleLabel(edge) {
    if (!edge.idleLabel) return;
    const x1 = parseFloat(edge.dom.getAttribute('x1'));
    const y1 = parseFloat(edge.dom.getAttribute('y1'));
    const x2 = parseFloat(edge.dom.getAttribute('x2'));
    const y2 = parseFloat(edge.dom.getAttribute('y2'));
    edge.idleLabel.setAttribute('x', (x1 + x2) / 2);
    edge.idleLabel.setAttribute('y', (y1 + y2) / 2);
}

function renderRequestPackets(req, now) {
    if (!req.pathEdges || req.pathEdges.length === 0) return;
    const lengths = req.pathEdges.map(edgeLength);
    const totalLen = lengths.reduce((a, b) => a + b, 0);
    const numLinks = req.pathEdges.length;
    if (totalLen <= 0 || numLinks === 0) return;

    const activeLinks = new Set();

    if (reducedMotion.matches) {
        // Static: one packet on each link, rest hidden.
        req.packetEls.forEach((pkt, i) => {
            if (i < numLinks) {
                positionPacketOnEdge(req.pathEdges[i], pkt, 0.5);
                pkt.style.display = '';
                activeLinks.add(i);
            } else {
                pkt.style.display = 'none';
            }
        });
    } else {
        const emissionIntervalMs = (totalLen / numLinks / PACKET_SPEED) * 1000;
        const totalTravelMs = (totalLen / PACKET_SPEED) * 1000;
        const elapsed = now - req.packetStartedAt;
        req.packetEls.forEach((pkt, i) => {
            const tSinceEmerged = elapsed - i * emissionIntervalMs;
            if (tSinceEmerged < 0 || tSinceEmerged >= totalTravelMs) {
                pkt.style.display = 'none';
                return;
            }
            const dist = (tSinceEmerged / 1000) * PACKET_SPEED;
            let acc = 0;
            for (let k = 0; k < numLinks; k++) {
                if (acc + lengths[k] >= dist) {
                    const localPhase = lengths[k] > 0 ? (dist - acc) / lengths[k] : 0;
                    positionPacketOnEdge(req.pathEdges[k], pkt, localPhase);
                    activeLinks.add(k);
                    pkt.style.display = '';
                    break;
                }
                acc += lengths[k];
            }
        });
    }

    req.pathEdges.forEach((edge, idx) => {
        const isActive = activeLinks.has(idx);
        edge.dom.classList.toggle('idle', !isActive);
        if (edge.idleLabel) edge.idleLabel.classList.toggle('visible', !isActive);
    });
}

function packetTick(now) {
    if (!reducedMotion.matches) {
        Object.values(state.activeRequests).forEach(req => renderRequestPackets(req, now));
    }
    requestAnimationFrame(packetTick);
}

initGraph();
requestAnimationFrame(packetTick);
