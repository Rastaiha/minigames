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
    ['SwA', 'SwD'], ['SwB', 'SwC'], ['SwB', 'SwD'],
    ['SwC', 'UT4'], ['SwC', 'UT5'], ['SwD', 'UT5'], ['SwD', 'UT6'],
];

// Destinations reachable from each sender given the topology.
// UT1 loses UT4 because SwA-SwC is broken by the mountains.
const REACHABLE = {
    'UT1': ['UT5', 'UT6'],
    'UT2': ['UT4', 'UT5', 'UT6'],
    'UT3': ['UT4', 'UT5', 'UT6'],
};
const SCENARIO_DEADLINE_MS = 40000;

function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// 5-request queue: 2 from UT1 and 2 from UT3 (each pair guaranteed to chain
// on its source-to-switch edge) plus 1 flexible UT2 request. Destinations
// and order are randomized while the chain-forced-failure property holds.
function buildScenario() {
    const ut1Dests = shuffle(REACHABLE['UT1']).slice(0, 2);
    const ut3Dests = shuffle(REACHABLE['UT3']).slice(0, 2);
    const ut2Dest = REACHABLE['UT2'][Math.floor(Math.random() * REACHABLE['UT2'].length)];
    const items = [
        { s: 'UT1', r: ut1Dests[0], volBits: 32, totalPackets: 4 },
        { s: 'UT1', r: ut1Dests[1], volBits: 32, totalPackets: 4 },
        { s: 'UT3', r: ut3Dests[0], volBits: 32, totalPackets: 4 },
        { s: 'UT3', r: ut3Dests[1], volBits: 32, totalPackets: 4 },
        { s: 'UT2', r: ut2Dest, volBits: 24, totalPackets: 3 },
    ];
    return shuffle(items);
}

let edges = [];
let state = {
    playing: false,
    ended: false,
    activeRequest: null,
    currentPath: [],
    queue: [],
    queueIndex: 0,
    activeRequests: {},
    scenarioStartedAt: 0,
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
    btnSkip: document.getElementById('btn-skip'),
    btnRestart: document.getElementById('btn-restart'),
    queue: document.getElementById('queue'),
    deadline: document.getElementById('deadline'),
    scoreboard: document.getElementById('scoreboard'),
    scoreboardText: document.getElementById('scoreboard-text'),
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
        const path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('class', 'edge');
        DOM.links.appendChild(path);
        edges.push({
            u: u.id, v: v.id, dom: path,
            occupiedBy: null, direction: null,
            idleLabel: null,
            totalLen: 0,
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
            const screen = document.createElement('div');
            screen.className = 'term-screen';
            const nameSpan = document.createElement('span');
            nameSpan.className = 'term-name';
            nameSpan.textContent = 'کامپیوتر';
            const numSpan = document.createElement('span');
            numSpan.className = 'term-num';
            numSpan.textContent = n.label;
            screen.appendChild(nameSpan);
            screen.appendChild(numSpan);
            el.appendChild(screen);

            const stand = document.createElement('div');
            stand.className = 'term-stand';
            el.appendChild(stand);

            const base = document.createElement('div');
            base.className = 'term-base';
            el.appendChild(base);
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
        const x1 = uRect.left + uRect.width / 2;
        const y1 = uRect.top + uRect.height / 2;
        const x2 = vRect.left + vRect.width / 2;
        const y2 = vRect.top + vRect.height / 2;
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.hypot(dx, dy);
        // Curl the chord: perpendicular offset, rotated CCW, ~10% of chord length.
        const nx = len > 0 ? -dy / len : 0;
        const ny = len > 0 ?  dx / len : 0;
        const curveAmount = len * 0.10;
        const cpx = (x1 + x2) / 2 + nx * curveAmount;
        const cpy = (y1 + y2) / 2 + ny * curveAmount;
        edge.dom.setAttribute('d', `M ${x1} ${y1} Q ${cpx} ${cpy} ${x2} ${y2}`);
        edge.totalLen = edge.dom.getTotalLength();
        if (edge.idleLabel) positionIdleLabel(edge);
    });
    const now = performance.now();
    Object.values(state.activeRequests).forEach(req => renderRequestPackets(req, now));
}

function startGame() {
    if (state.playing) return;
    state.playing = true;
    state.ended = false;
    state.queue = buildScenario().map((item, i) => ({ ...item, index: i, status: 'pending' }));
    state.queueIndex = 0;
    state.scenarioStartedAt = performance.now();
    DOM.btnStart.disabled = true;
    renderQueue();
    startDeadlineTimer();
    spawnNextRequest();
}

function spawnNextRequest() {
    if (state.ended) return;
    if (state.queueIndex >= state.queue.length) return;
    const item = state.queue[state.queueIndex];
    item.status = 'routing';
    state.queueIndex++;
    renderQueue();
    const req = {
        id: `req-${item.index}-${Date.now()}`,
        s: item.s,
        r: item.r,
        volBits: item.volBits,
        totalPackets: item.totalPackets,
        queueIndex: item.index,
    };
    showModal(req);
}

function showModal(req) {
    DOM.modalText.innerHTML =
        `<strong>${labelOf(req.s)} ← ${labelOf(req.r)}</strong>` +
        `<br>حجم دیتا: ${req.volBits} بیت`;
    DOM.modal.classList.add('show');
    setTimeout(() => {
        DOM.modal.classList.remove('show');
        if (state.ended) return;
        activateRequest(req);
    }, 1000);
}

function activateRequest(req) {
    state.activeRequest = req;
    state.currentPath = [];
    DOM.btnUndo.disabled = true;
    DOM.btnSkip.disabled = false;

    const card = document.createElement('div');
    card.className = 'req-card active';
    card.id = `req-${req.id}`;
    card.innerHTML =
        `درخواست فعلی: <strong>${labelOf(req.s)} ← ${labelOf(req.r)}</strong>` +
        ` — ${req.volBits} بیت`;
    DOM.topCenter.innerHTML = '';
    DOM.topCenter.appendChild(card);
    renderGraphState();
}

function handleNodeClick(node) {
    if (state.ended) return;
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

        if (node.type === 'terminal' && node.id !== req.r) {
            showToast('کامپیوترها بسته را عبور نمی‌دهند؛ مسیر باید از سوییچ‌ها بگذرد.');
            return;
        }

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

    // Emit N packets, one after another.
    const totalPackets = req.totalPackets;
    const color = REQUEST_COLORS[req.queueIndex % REQUEST_COLORS.length];
    const packetEls = [];
    for (let i = 0; i < totalPackets; i++) {
        const pkt = document.createElementNS(SVG_NS, 'g');
        pkt.setAttribute('class', 'packet');
        pkt.setAttribute('filter', 'url(#packet-shadow)');
        const halo = document.createElementNS(SVG_NS, 'rect');
        halo.setAttribute('class', 'packet-halo');
        halo.setAttribute('x', -11);
        halo.setAttribute('y', -8);
        halo.setAttribute('width', 22);
        halo.setAttribute('height', 16);
        halo.setAttribute('rx', 3);
        halo.setAttribute('fill', color);
        pkt.appendChild(halo);
        const body = document.createElementNS(SVG_NS, 'rect');
        body.setAttribute('class', 'packet-body');
        body.setAttribute('x', -9);
        body.setAttribute('y', -6);
        body.setAttribute('width', 18);
        body.setAttribute('height', 12);
        body.setAttribute('rx', 2);
        body.setAttribute('fill', color);
        pkt.appendChild(body);
        const flap = document.createElementNS(SVG_NS, 'path');
        flap.setAttribute('class', 'packet-flap');
        flap.setAttribute('d', 'M -7.5 -5 L 0 0 L 7.5 -5');
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

    const lengths = pathEdges.map(edgeLength);
    const totalLen = lengths.reduce((a, b) => a + b, 0);
    const numLinks = pathEdges.length;
    const linkTravelMs = numLinks > 0 ? (totalLen / numLinks / PACKET_SPEED) * 1000 : 0;
    const totalTravelMs = (totalLen / PACKET_SPEED) * 1000;
    // Only one packet on the path at a time, plus a link-time gap between them,
    // so the reserved route is visibly empty between packets.
    const emissionIntervalMs = totalTravelMs + linkTravelMs;
    const totalDurationMs = (totalPackets - 1) * emissionIntervalMs + totalTravelMs;
    const endsAt = startedAt + totalDurationMs;

    state.activeRequests[req.id] = {
        s: req.s, r: req.r, volBits: req.volBits,
        endsAt, path, internalWires,
        pathEdges, packetEls, packetStartedAt: startedAt,
        queueIndex: req.queueIndex,
    };
    renderRequestPackets(state.activeRequests[req.id], startedAt);

    DOM.topCenter.innerHTML = '';

    const item = state.queue[req.queueIndex];
    if (item) item.status = 'sending';
    renderQueue();

    setTimeout(() => {
        releaseRequest(req.id);
        if (state.ended) return;
        if (item && item.status !== 'failed') {
            item.status = 'done';
            renderQueue();
        }
        if (state.queue.every(i => i.status === 'done' || i.status === 'failed')) {
            endScenario();
        }
    }, totalDurationMs);

    state.activeRequest = null;
    state.currentPath = [];
    DOM.btnUndo.disabled = true;
    DOM.btnSkip.disabled = true;
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

DOM.btnSkip.addEventListener('click', () => {
    if (!state.activeRequest || state.ended) return;
    const req = state.activeRequest;
    const item = state.queue[req.queueIndex];
    if (item) item.status = 'failed';
    renderQueue();
    state.activeRequest = null;
    state.currentPath = [];
    DOM.btnUndo.disabled = true;
    DOM.btnSkip.disabled = true;
    DOM.topCenter.innerHTML = '';
    renderGraphState();
    if (state.queue.every(i => i.status === 'done' || i.status === 'failed')) {
        endScenario();
    } else {
        setTimeout(spawnNextRequest, 500);
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

const PACKET_SPEED = 200; // px per second — slow enough to watch a single packet cross

const REQUEST_COLORS = ['#5669D1', '#E8B33A', '#3C9468', '#B82A31', '#35AFB8'];

function edgeLength(edge) {
    return edge.totalLen || edge.dom.getTotalLength();
}

function positionPacketOnEdge(edge, pkt, phase) {
    const len = edge.totalLen || edge.dom.getTotalLength();
    if (len <= 0) return;
    const t = edge.direction === 'vu' ? (1 - phase) : phase;
    const dist = Math.max(0, Math.min(len, len * t));
    const p = edge.dom.getPointAtLength(dist);
    const eps = Math.min(1.5, len * 0.02);
    const forward = edge.direction === 'vu' ? Math.max(0, dist - eps) : Math.min(len, dist + eps);
    const pFwd = edge.dom.getPointAtLength(forward);
    const dx = pFwd.x - p.x;
    const dy = pFwd.y - p.y;
    const deg = Math.atan2(dy, dx) * 180 / Math.PI;
    pkt.setAttribute('transform', `translate(${p.x}, ${p.y}) rotate(${deg})`);
}

function positionIdleLabel(edge) {
    if (!edge.idleLabel) return;
    const len = edge.totalLen || edge.dom.getTotalLength();
    const p = edge.dom.getPointAtLength(len / 2);
    edge.idleLabel.setAttribute('x', p.x);
    edge.idleLabel.setAttribute('y', p.y);
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
        const linkTravelMs = (totalLen / numLinks / PACKET_SPEED) * 1000;
        const totalTravelMs = (totalLen / PACKET_SPEED) * 1000;
        const emissionIntervalMs = totalTravelMs + linkTravelMs;
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

function toPersianDigits(n) {
    return String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
}

const QUEUE_BADGE = {
    pending: '·',
    routing: '…',
    sending: '▶',
    done: '✓',
    failed: '✗',
};

function shortLabel(id) {
    const n = AllNodes.find(x => x.id === id);
    return n ? toPersianDigits(n.label) : id;
}

function renderQueue() {
    DOM.queue.innerHTML = '';
    state.queue.forEach((item, i) => {
        const tile = document.createElement('div');
        tile.className = `queue-tile ${item.status}`;
        const idx = document.createElement('span');
        idx.className = 'queue-idx';
        idx.textContent = toPersianDigits(i + 1);
        const label = document.createElement('span');
        label.className = 'queue-label';
        label.textContent = `${shortLabel(item.s)} ← ${shortLabel(item.r)}`;
        const badge = document.createElement('span');
        badge.className = 'queue-badge';
        badge.textContent = QUEUE_BADGE[item.status] || '·';
        tile.appendChild(idx);
        tile.appendChild(label);
        tile.appendChild(badge);
        DOM.queue.appendChild(tile);
    });
}

function startDeadlineTimer() {
    const tick = () => {
        if (state.ended) return;
        const remainingMs = SCENARIO_DEADLINE_MS - (performance.now() - state.scenarioStartedAt);
        if (remainingMs <= 0) {
            DOM.deadline.textContent = `⏱ ${toPersianDigits(0)}s`;
            endScenario();
            return;
        }
        DOM.deadline.textContent = `⏱ ${toPersianDigits(Math.ceil(remainingMs / 1000))}s`;
        DOM.deadline.classList.toggle('warning', remainingMs < 10000);
        requestAnimationFrame(tick);
    };
    tick();
}

function endScenario() {
    if (state.ended) return;
    state.ended = true;
    state.playing = false;
    state.queue.forEach(item => {
        if (item.status !== 'done') item.status = 'failed';
    });
    renderQueue();
    Object.keys(state.activeRequests).slice().forEach(id => releaseRequest(id));
    state.activeRequest = null;
    state.currentPath = [];
    DOM.topCenter.innerHTML = '';
    DOM.modal.classList.remove('show');
    DOM.btnUndo.disabled = true;
    DOM.btnSkip.disabled = true;
    const success = state.queue.filter(i => i.status === 'done').length;
    showScoreboard(success);
}

function showScoreboard(success) {
    const total = state.queue.length;
    const failed = total - success;
    const headline = success === total
        ? 'همه رسیدند!'
        : (success === 0 ? 'همه شکست خوردند' : 'مهلت تمام شد');
    const hint = failed > 0
        ? 'در سوییچینگ مداری هر مسیر رزرو می‌شود؛ وقتی چند درخواست از یک ارتباط بگذرند، برخی ناچار پشت صف می‌مانند و شکست می‌خورند.'
        : 'مسیرها را طوری چیدی که هیچ درخواستی پشت رزرو دیگری گیر نکرد.';
    DOM.scoreboardText.innerHTML =
        `<div class="score-title">${headline}</div>` +
        `<div class="score-body">شد <strong>${toPersianDigits(success)}</strong> از <strong>${toPersianDigits(total)}</strong></div>` +
        `<div class="score-hint">${hint}</div>` +
        `<button class="btn" id="score-restart">شروع مجدد</button>`;
    DOM.scoreboard.classList.add('show');
    document.getElementById('score-restart').onclick = () => location.reload();
}

initGraph();
requestAnimationFrame(packetTick);
