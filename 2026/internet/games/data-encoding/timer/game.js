import {
    BYTE_COLORS,
    ReceivedBits,
    mountEncodingGame,
    renderTransmittedBits,
    resetSharedDisplay,
    restrictToAscii,
    setPlaybackAppearance,
    stringToBinary,
} from '../shared/game.js';

const FPS = 60;
const SLIDER_ANIM_MS = 100;
const PROPAGATION_DELAY_MS = 50;
const PROPAGATION_DELAY_LABEL = 'تأخیر مسیر: ۱۰۰۰ نانوثانیه';
const PROPAGATION_DELAY_FRAMES = (PROPAGATION_DELAY_MS / 1000) * FPS;

mountEncodingGame({
    scopeHint: '',
    transmitterControls: `
        <div class="config-row">
            <input type="text" id="textInput" placeholder="متن (Hello!)" value="Hello!" maxlength="16">
            <input type="number" id="txRate" step="0.1" min="0.2" max="3.0" value="0.5" title="سرعت ارسال">
            <span>ثانیه/بیت</span>
        </div>
    `,
    receiverControls: `
        <div class="config-row">
            <span style="color:var(--success); font-weight:bold;">نرخ نمونه‌برداری:</span>
            <input type="number" id="rxRate" step="0.1" min="0.2" max="3.0" value="0.5" title="سرعت دریافت">
            <span>ثانیه/بیت</span>
        </div>
    `,
});

const scopeWrapper = document.getElementById('scopeWrapper');
scopeWrapper.outerHTML = `
    <section class="voltage-monitor" dir="rtl">
        <header class="monitor-header">
            <div>
                <p class="eyebrow">وضعیت همین لحظهٔ سیم</p>
                <h2>ولتاژ روی سیم — فرستنده تا گیرنده</h2>
            </div>
            <span class="delay-badge">${PROPAGATION_DELAY_LABEL}</span>
        </header>
        <div class="monitor-readings" dir="ltr">
            <div class="voltage-slider-container">
                <div class="voltage-slider-control" id="voltageSliderControl" data-level="0">
                    <label>ولتاژ فرستنده</label>
                    <output id="sliderValue">0.0 V</output>
                    <div class="slider-track-wrap">
                        <span class="slider-limit slider-max">5V</span>
                        <input class="voltage-slider" type="range" id="voltageSlider"
                               min="0" max="5" step="0.01" value="0"
                               disabled tabindex="-1" aria-hidden="true">
                        <span class="slider-threshold" aria-hidden="true">2.5</span>
                        <span class="slider-limit slider-min">0V</span>
                    </div>
                </div>
            </div>

            <div class="voltage-reading tx-reading" id="txReading" data-level="0">
                <span class="reading-label">فرستنده (TX)</span>
                <span class="voltage-value"><b id="txVoltage">0.0</b><small>V</small></span>
                <div class="level-window">
                    <span class="level-guide level-guide-high">5V</span>
                    <span class="level-guide level-guide-low">0V</span>
                    <span class="level-track"><span class="current-level"></span></span>
                </div>
            </div>

            <div class="wire-timing" dir="rtl">
                <div class="paired-clock" aria-hidden="true">
                    <div class="clock-face">
                        <div class="clock-tick"></div>
                        <div class="pulse-ring tx-pulse" id="pairedTxPulse"></div>
                        <div class="pulse-ring rx-pulse" id="pairedRxPulse"></div>
                        <div class="clock-hand tx-hand" id="pairedTxHand"></div>
                        <div class="clock-hand rx-hand" id="pairedRxHand"></div>
                        <div class="clock-center"></div>
                    </div>
                    <div class="clock-legend">
                        <span><i class="dot tx-dot"></i>فرستنده</span>
                        <span><i class="dot rx-dot"></i>گیرنده</span>
                    </div>
                </div>
                <div class="propagation-gap" aria-hidden="true">
                    <span></span><span></span><span></span>
                </div>
            </div>

            <div class="voltage-reading rx-reading" id="rxReading" data-level="0">
                <span class="reading-label">گیرنده (RX)</span>
                <span class="voltage-value"><b id="rxVoltage">0.0</b><small>V</small></span>
                <div class="level-window">
                    <span class="level-guide level-guide-high">5V</span>
                    <span class="level-guide level-guide-low">0V</span>
                    <span class="level-track"><span class="current-level"></span></span>
                </div>
            </div>
        </div>
    </section>
`;

const voltageMonitor = document.querySelector('.voltage-monitor');
voltageMonitor.insertAdjacentHTML('afterend', `
    <div class="sample-trail-wrapper">
        <canvas id="sampleTrailCanvas"></canvas>
        <div class="trail-caption">ثبت نمونه‌برداری‌ها روی محور بیت‌ها</div>
    </div>
`);

const rxMonitorScreen = document.querySelectorAll('.monitor-screen')[1];
rxMonitorScreen.insertAdjacentHTML('beforeend', `
    <div class="phase-meter">
        <div class="phase-meter-label">فاز نمونه‌برداری</div>
        <div class="phase-track">
            <div class="phase-center-tick"></div>
            <div class="phase-marker" id="phaseMarker"></div>
        </div>
    </div>
`);

let binaryData = '';
let isPlaying = false;
let hasStarted = false;
let globalTime = 0;
let lastTxBit = -1;
let lastRxWireBit = -1;
let txPeriod = 1;
let rxPeriod = 1;
let displayTxVoltage = 0;
let displayRxVoltage = 0;
let txAnimRaf = null;
let txAnimStart = 0;
let txAnimFrom = 0;
let txAnimTarget = 0;
let rxAnimRaf = null;
let rxAnimStart = 0;
let rxAnimFrom = 0;
let rxAnimTarget = 0;
let sampleRecords = [];
let isMobile = false;
let lastLoopMs = 0;

const receivedBits = new ReceivedBits({ showErrors: true });
const trailCanvas = document.getElementById('sampleTrailCanvas');
const trailCtx = trailCanvas.getContext('2d');

const txReading = document.getElementById('txReading');
const rxReading = document.getElementById('rxReading');
const txVoltageEl = document.getElementById('txVoltage');
const rxVoltageEl = document.getElementById('rxVoltage');
const txLevelBar = txReading.querySelector('.current-level');
const rxLevelBar = rxReading.querySelector('.current-level');
const sliderEl = document.getElementById('voltageSlider');
const sliderValueEl = document.getElementById('sliderValue');
const sliderControlEl = document.getElementById('voltageSliderControl');
const pairedTxHand = document.getElementById('pairedTxHand');
const pairedRxHand = document.getElementById('pairedRxHand');
const pairedTxPulse = document.getElementById('pairedTxPulse');
const pairedRxPulse = document.getElementById('pairedRxPulse');

function checkMobile() {
    isMobile = window.innerWidth <= 768;
}

function pulseElement(el) {
    el.classList.remove('active');
    void el.offsetWidth;
    el.classList.add('active');
}

function glowHand(el, cls) {
    el.classList.remove('glow-tx', 'glow-rx', 'glow-rx-error');
    void el.offsetWidth;
    el.classList.add(cls);
}

restrictToAscii(document.getElementById('textInput'));
document.getElementById('btnSend').addEventListener('click', startTransmission);
document.getElementById('btnPlayPause').addEventListener('click', () => {
    if (!hasStarted) return;
    isPlaying = !isPlaying;
    setPlaybackAppearance(isPlaying);
});
document.getElementById('btnNext').addEventListener('click', () => {
    if (!hasStarted) return;
    isPlaying = false;
    setPlaybackAppearance(false);
    globalTime += txPeriod * FPS / 4;
    syncStateToTime();
});
document.getElementById('btnPrev').addEventListener('click', () => {
    if (!hasStarted) return;
    isPlaying = false;
    setPlaybackAppearance(false);
    globalTime = Math.max(0, globalTime - txPeriod * FPS / 4);
    syncStateToTime();
});
document.getElementById('btnReset').addEventListener('click', resetAll);

function resetAll() {
    isPlaying = false;
    hasStarted = false;
    globalTime = 0;
    sampleRecords = [];
    lastTxBit = -1;
    lastRxWireBit = -1;
    receivedBits.reset();
    resetSharedDisplay();
    resetPairedClock();
    resetPhaseMarker();
    cancelTxAnim();
    cancelRxAnim();
    setDisplayTx(0);
    setDisplayRx(0);
    drawTrail();
}

function startTransmission() {
    const text = document.getElementById('textInput').value || 'A';
    binaryData = stringToBinary(text);
    txPeriod = parseFloat(document.getElementById('txRate').value) || 1;
    rxPeriod = parseFloat(document.getElementById('rxRate').value) || 1;
    globalTime = 0;
    hasStarted = true;
    isPlaying = true;
    sampleRecords = [];
    lastTxBit = -1;
    lastRxWireBit = -1;
    receivedBits.reset();
    resetPhaseMarker();
    cancelTxAnim();
    cancelRxAnim();
    setDisplayTx(0);
    setDisplayRx(0);
    setPlaybackAppearance(true);
    drawTrail();
}

function txBitDurationFrames() { return txPeriod * FPS; }
function rxBitDurationFrames() { return rxPeriod * FPS; }

function wireVoltageAtTx(time) {
    if (time < 0) return 0;
    const bit = Math.floor(time / txBitDurationFrames());
    if (bit < 0 || bit >= binaryData.length) return 0;
    return binaryData[bit] === '1' ? 5 : 0;
}

function wireVoltageAtRx(time) {
    return wireVoltageAtTx(time - PROPAGATION_DELAY_FRAMES);
}

function syncStateToTime() {
    if (!binaryData) return;
    const bitDur = txBitDurationFrames();

    const txBit = Math.min(binaryData.length - 1, Math.floor(globalTime / bitDur));
    lastTxBit = Math.max(-1, txBit);
    setDisplayTx(wireVoltageAtTx(globalTime));

    const rxSideTime = globalTime - PROPAGATION_DELAY_FRAMES;
    const rxBit = rxSideTime >= 0
        ? Math.min(binaryData.length - 1, Math.floor(rxSideTime / bitDur))
        : -1;
    lastRxWireBit = Math.max(-1, rxBit);
    setDisplayRx(wireVoltageAtRx(globalTime));

    updateTransmittedBits();
}

function loop(nowMs) {
    if (lastLoopMs === 0) lastLoopMs = nowMs;
    const deltaFrames = ((nowMs - lastLoopMs) / 1000) * FPS;
    lastLoopMs = nowMs;

    if (hasStarted && isPlaying) {
        globalTime += deltaFrames;
        onTick();
    }
    updateVisualClocks();
    requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

function onTick() {
    const bitDur = txBitDurationFrames();

    // TX-side bit boundary: TX emits a new bit
    const currentTxBit = Math.floor(globalTime / bitDur);
    if (currentTxBit !== lastTxBit && currentTxBit >= 0 && currentTxBit < binaryData.length) {
        lastTxBit = currentTxBit;
        pulseElement(pairedTxPulse);
        glowHand(pairedTxHand, 'glow-tx');
        const v = binaryData[currentTxBit] === '1' ? 5 : 0;
        animateTxDisplay(v);
        updateTransmittedBits();
    }

    // RX-side wire arrival: same bit, PROPAGATION_DELAY later
    const rxSideTime = globalTime - PROPAGATION_DELAY_FRAMES;
    if (rxSideTime >= 0) {
        const currentRxWireBit = Math.floor(rxSideTime / bitDur);
        if (currentRxWireBit !== lastRxWireBit && currentRxWireBit >= 0 && currentRxWireBit < binaryData.length) {
            lastRxWireBit = currentRxWireBit;
            const v = binaryData[currentRxWireBit] === '1' ? 5 : 0;
            animateRxDisplay(v);
        }
    }

    // RX sampling: shifted by delay so perfect-sync sample lands in bit center
    const rxDur = rxBitDurationFrames();
    const endTime = binaryData.length * bitDur + PROPAGATION_DELAY_FRAMES;
    const nextSampleTime = PROPAGATION_DELAY_FRAMES + 0.5 * rxDur + receivedBits.count * rxDur;
    if (
        globalTime >= nextSampleTime &&
        nextSampleTime <= endTime &&
        receivedBits.count < binaryData.length
    ) {
        performSample(nextSampleTime);
    }
}

function performSample(sampleTime) {
    const bitDur = txBitDurationFrames();
    // Phase math ignores the constant delay so drift is the only source of offset
    const bitPositionFloat = (sampleTime - PROPAGATION_DELAY_FRAMES) / bitDur;
    const targetBitIndex = Math.floor(bitPositionFloat);
    const phaseFraction = bitPositionFloat - targetBitIndex;

    const sampledV = wireVoltageAtRx(sampleTime);
    const sampledBit = sampledV > 2.5 ? '1' : '0';
    const expectedIndex = receivedBits.count;
    const expectedBit = binaryData[expectedIndex];
    const isError = sampledBit !== expectedBit;
    receivedBits.append(sampledBit, isError);

    if (targetBitIndex >= 0 && targetBitIndex < binaryData.length) {
        sampleRecords.push({ bitIndex: targetBitIndex, phaseFraction, isError });
    }
    pulseRxRing(isError);
    glowHand(pairedRxHand, isError ? 'glow-rx-error' : 'glow-rx');
    flashRxReading(isError);
    const cumulativePhaseError = bitPositionFloat - (expectedIndex + 0.5);
    updatePhaseMarker(cumulativePhaseError);
    drawTrail();
    receivedBits.updateDecodedText();
}

function updateTransmittedBits() {
    const currentTxBit = Math.max(-1, Math.min(binaryData.length - 1, Math.floor(globalTime / txBitDurationFrames())));
    document.getElementById('sentBinary').innerHTML = renderTransmittedBits(binaryData, currentTxBit);
}

function animateTxDisplay(target) {
    animate(target, SLIDER_ANIM_MS, {
        get from() { return displayTxVoltage; },
        cancelRef: () => cancelTxAnim(),
        setAnim: (raf, start, from, target, dur) => {
            txAnimRaf = raf; txAnimStart = start; txAnimFrom = from; txAnimTarget = target;
        },
        stepFn: stepTxAnim,
        apply: setDisplayTx,
    });
}

function animateRxDisplay(target) {
    animate(target, SLIDER_ANIM_MS, {
        get from() { return displayRxVoltage; },
        cancelRef: () => cancelRxAnim(),
        setAnim: (raf, start, from, target, dur) => {
            rxAnimRaf = raf; rxAnimStart = start; rxAnimFrom = from; rxAnimTarget = target;
        },
        stepFn: stepRxAnim,
        apply: setDisplayRx,
    });
}

function animate(target, durationMs, cfg) {
    cfg.cancelRef();
    if (Math.abs(cfg.from - target) < 0.001 || durationMs <= 0) {
        cfg.apply(target);
        return;
    }
    const start = performance.now();
    const from = cfg.from;
    cfg.setAnim(null, start, from, target, durationMs);
    const raf = requestAnimationFrame(cfg.stepFn);
    cfg.setAnim(raf, start, from, target, durationMs);
}

function stepTxAnim(now) {
    const t = Math.min(1, (now - txAnimStart) / SLIDER_ANIM_MS);
    const eased = 1 - Math.pow(1 - t, 3);
    setDisplayTx(txAnimFrom + (txAnimTarget - txAnimFrom) * eased);
    if (t < 1) txAnimRaf = requestAnimationFrame(stepTxAnim);
    else { setDisplayTx(txAnimTarget); txAnimRaf = null; }
}

function stepRxAnim(now) {
    const t = Math.min(1, (now - rxAnimStart) / SLIDER_ANIM_MS);
    const eased = 1 - Math.pow(1 - t, 3);
    setDisplayRx(rxAnimFrom + (rxAnimTarget - rxAnimFrom) * eased);
    if (t < 1) rxAnimRaf = requestAnimationFrame(stepRxAnim);
    else { setDisplayRx(rxAnimTarget); rxAnimRaf = null; }
}

function cancelTxAnim() { if (txAnimRaf !== null) cancelAnimationFrame(txAnimRaf); txAnimRaf = null; }
function cancelRxAnim() { if (rxAnimRaf !== null) cancelAnimationFrame(rxAnimRaf); rxAnimRaf = null; }

function setDisplayTx(v) {
    displayTxVoltage = v;
    const clamped = Math.max(0, Math.min(5, v));
    const bit = clamped > 2.5 ? 1 : 0;
    const text = clamped.toFixed(1);
    sliderEl.value = clamped.toFixed(2);
    sliderValueEl.textContent = `${text} V`;
    sliderControlEl.dataset.level = String(bit);
    txVoltageEl.textContent = text;
    txReading.dataset.level = String(bit);
    txLevelBar.style.bottom = `${(clamped / 5) * 100}%`;
}

function setDisplayRx(v) {
    displayRxVoltage = v;
    const clamped = Math.max(0, Math.min(5, v));
    const bit = clamped > 2.5 ? 1 : 0;
    const text = clamped.toFixed(1);
    rxVoltageEl.textContent = text;
    rxReading.dataset.level = String(bit);
    rxLevelBar.style.bottom = `${(clamped / 5) * 100}%`;
}

function pulseRxRing(isError) {
    pairedRxPulse.classList.toggle('error', isError);
    pulseElement(pairedRxPulse);
}

function flashRxReading(isError) {
    rxReading.classList.remove('sample-flash', 'sample-flash-error');
    void rxReading.offsetWidth;
    rxReading.classList.add(isError ? 'sample-flash-error' : 'sample-flash');
}

function updatePhaseMarker(cumulativePhaseError) {
    const marker = document.getElementById('phaseMarker');
    const clamped = Math.max(-0.5, Math.min(0.5, cumulativePhaseError));
    marker.style.left = `${50 + clamped * 100}%`;
    marker.classList.remove('warn', 'danger');
    const magnitude = Math.abs(cumulativePhaseError);
    if (magnitude > 0.4) marker.classList.add('danger');
    else if (magnitude > 0.3) marker.classList.add('warn');
}

function resetPhaseMarker() {
    const marker = document.getElementById('phaseMarker');
    marker.style.left = '50%';
    marker.classList.remove('warn', 'danger');
}

function resetPairedClock() {
    pairedTxHand.classList.remove('glow-tx');
    pairedRxHand.classList.remove('glow-rx', 'glow-rx-error');
    pairedTxPulse.classList.remove('active');
    pairedRxPulse.classList.remove('active', 'error');
}

function currentTxDurFrames() {
    if (hasStarted) return txBitDurationFrames();
    const v = parseFloat(document.getElementById('txRate').value);
    return (Number.isFinite(v) && v > 0 ? v : 1) * FPS;
}

function currentRxDurFrames() {
    if (hasStarted) return rxBitDurationFrames();
    const v = parseFloat(document.getElementById('rxRate').value);
    return (Number.isFinite(v) && v > 0 ? v : 1) * FPS;
}

function updateVisualClocks() {
    const txDur = currentTxDurFrames();
    const rxDur = currentRxDurFrames();
    const txAngle = (globalTime / txDur) * 360 % 360;
    pairedTxHand.style.transform = `rotate(${txAngle}deg)`;

    // Both hands are on-screen even at rest. RX hand's phase is offset so it
    // hits the tick exactly at sample moments (delay + 0.5*rxDur + k*rxDur).
    // At rest (globalTime = 0) the RX hand sits in the lower half of the face,
    // which is where it would naturally be one frame into playback — so
    // clicking Send never causes a visible jump.
    const rxPhase = (globalTime - PROPAGATION_DELAY_FRAMES) / rxDur - 0.5;
    const rxAngle = (rxPhase * 360 % 360 + 360) % 360;
    pairedRxHand.style.transform = `rotate(${rxAngle}deg)`;
}

function resizeTrail() {
    const dpr = window.devicePixelRatio || 1;
    const cssWidth = trailCanvas.parentElement.clientWidth - 16;
    const cssHeight = trailCanvas.clientHeight || (isMobile ? 52 : 64);
    trailCanvas.style.width = cssWidth + 'px';
    trailCanvas.style.height = cssHeight + 'px';
    trailCanvas.width = Math.floor(cssWidth * dpr);
    trailCanvas.height = Math.floor(cssHeight * dpr);
    trailCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawTrail() {
    const w = trailCanvas.clientWidth;
    const h = trailCanvas.clientHeight;
    trailCtx.clearRect(0, 0, w, h);

    if (!hasStarted || !binaryData) {
        trailCtx.fillStyle = '#555';
        trailCtx.font = '12px Vazirmatn';
        trailCtx.textAlign = 'center';
        trailCtx.textBaseline = 'middle';
        trailCtx.fillText('نمونه‌برداری‌های گیرنده اینجا ثبت می‌شوند', w / 2, h / 2);
        return;
    }

    const padX = 6;
    const midY = h * 0.55;
    const topY = 4;
    const bottomY = h - 4;
    const bitCount = binaryData.length;
    const bitWidth = (w - padX * 2) / bitCount;
    const showLabels = bitWidth >= 14;
    const showBoundaries = bitWidth >= 3;

    for (let index = 0; index < bitCount; index++) {
        const byteIndex = Math.floor(index / 8);
        trailCtx.fillStyle = BYTE_COLORS[byteIndex % BYTE_COLORS.length] + '15';
        trailCtx.fillRect(padX + index * bitWidth, topY, bitWidth, bottomY - topY);
    }

    if (showBoundaries) {
        trailCtx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
        trailCtx.lineWidth = 1;
        trailCtx.setLineDash([2, 3]);
        for (let index = 0; index <= bitCount; index++) {
            const x = padX + index * bitWidth;
            trailCtx.beginPath();
            trailCtx.moveTo(x, topY);
            trailCtx.lineTo(x, bottomY);
            trailCtx.stroke();
        }
        trailCtx.setLineDash([]);
    }

    trailCtx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    for (let index = 0; index < bitCount; index++) {
        const x = padX + (index + 0.5) * bitWidth;
        trailCtx.fillRect(x - 0.5, midY - 5, 1, 10);
    }

    if (showLabels) {
        trailCtx.font = 'bold 10px Vazirmatn';
        trailCtx.textAlign = 'center';
        trailCtx.textBaseline = 'top';
        for (let index = 0; index < bitCount; index++) {
            const byteIndex = Math.floor(index / 8);
            trailCtx.fillStyle = BYTE_COLORS[byteIndex % BYTE_COLORS.length];
            trailCtx.fillText(binaryData[index], padX + (index + 0.5) * bitWidth, topY);
        }
    }

    for (const record of sampleRecords) {
        const x = padX + (record.bitIndex + record.phaseFraction) * bitWidth;
        const color = record.isError ? '#ff4757' : '#00ff88';
        trailCtx.strokeStyle = color;
        trailCtx.lineWidth = 2;
        trailCtx.beginPath();
        trailCtx.moveTo(x, midY - 7);
        trailCtx.lineTo(x, bottomY - 2);
        trailCtx.stroke();

        trailCtx.fillStyle = color;
        trailCtx.beginPath();
        trailCtx.arc(x, midY - 7, 3, 0, Math.PI * 2);
        trailCtx.fill();
    }
}

window.addEventListener('resize', () => {
    checkMobile();
    resizeTrail();
    drawTrail();
});

checkMobile();
requestAnimationFrame(() => {
    resizeTrail();
    drawTrail();
});
