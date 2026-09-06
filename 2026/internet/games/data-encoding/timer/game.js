import {
    BYTE_COLORS,
    ReceivedBits,
    drawPorts,
    drawScopeGrid,
    drawSignal,
    mountEncodingGame,
    renderTransmittedBits,
    resetSharedDisplay,
    restrictToAscii,
    setPlaybackAppearance,
    stringToBinary,
} from '../shared/game.js';

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
scopeWrapper.insertAdjacentHTML('beforebegin', `
    <div class="paired-clock" aria-hidden="true">
        <div class="clock-face">
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
`);
scopeWrapper.insertAdjacentHTML('afterend', `
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
let lastTxBitPulsed = -1;

const FPS = 60;
let isMobile = false;
let speed = 2;
let txPeriod = 1;
let rxPeriod = 1;
let canvasW;
let canvasH;
let txX = 50;
let defaultRxX = 0;
let sampleLineX = 0;
let ripples = [];
let sampleRecords = [];

const receivedBits = new ReceivedBits({ showErrors: true });
const trailCanvas = document.getElementById('sampleTrailCanvas');
const trailCtx = trailCanvas.getContext('2d');

function checkMobile() {
    isMobile = window.innerWidth <= 768;
    speed = isMobile ? 1 : 2;
    txX = isMobile ? 30 : 60;
}

function pulseElement(el) {
    el.classList.remove('active');
    void el.offsetWidth;
    el.classList.add('active');
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
});
document.getElementById('btnPrev').addEventListener('click', () => {
    if (!hasStarted) return;
    isPlaying = false;
    setPlaybackAppearance(false);
    globalTime = Math.max(0, globalTime - txPeriod * FPS / 4);
});
document.getElementById('btnReset').addEventListener('click', () => {
    isPlaying = false;
    hasStarted = false;
    globalTime = 0;
    ripples = [];
    sampleRecords = [];
    lastTxBitPulsed = -1;
    receivedBits.reset();
    resetSharedDisplay();
    resetPairedClock();
    resetPhaseMarker();
    drawTrail();
    if (canvasW) sampleLineX = defaultRxX - (isMobile ? 20 : 30);
});

function startTransmission() {
    const text = document.getElementById('textInput').value || 'A';
    binaryData = stringToBinary(text);
    txPeriod = parseFloat(document.getElementById('txRate').value) || 1;
    rxPeriod = parseFloat(document.getElementById('rxRate').value) || 1;
    globalTime = 0;
    hasStarted = true;
    isPlaying = true;
    ripples = [];
    sampleRecords = [];
    lastTxBitPulsed = -1;
    receivedBits.reset();
    resetPhaseMarker();
    setPlaybackAppearance(true);
    drawTrail();
}

function setup() {
    checkMobile();
    const container = document.getElementById('canvas-div');
    canvasW = container.offsetWidth;
    canvasH = container.offsetHeight;
    const canvas = createCanvas(canvasW, canvasH);
    canvas.parent('canvas-div');
    textFont('Vazirmatn');

    defaultRxX = canvasW - (isMobile ? 30 : 50);
    sampleLineX = defaultRxX - (isMobile ? 20 : 30);
    resizeTrail();
    drawTrail();
}

function windowResized() {
    checkMobile();
    const container = document.getElementById('canvas-div');
    canvasW = container.offsetWidth;
    canvasH = container.offsetHeight;
    resizeCanvas(canvasW, canvasH);
    defaultRxX = canvasW - (isMobile ? 30 : 50);
    if (sampleLineX > defaultRxX) sampleLineX = defaultRxX - (isMobile ? 20 : 30);
    resizeTrail();
    drawTrail();
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

    // subtle byte-colored background bands
    for (let index = 0; index < bitCount; index++) {
        const byteIndex = Math.floor(index / 8);
        trailCtx.fillStyle = BYTE_COLORS[byteIndex % BYTE_COLORS.length] + '15';
        trailCtx.fillRect(padX + index * bitWidth, topY, bitWidth, bottomY - topY);
    }

    // bit-boundary gridlines
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

    // ideal-sample markers (light) at middle of each bit
    trailCtx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    for (let index = 0; index < bitCount; index++) {
        const x = padX + (index + 0.5) * bitWidth;
        trailCtx.fillRect(x - 0.5, midY - 5, 1, 10);
    }

    // expected bit values
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

    // recorded samples
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

function resetPhaseMarker() {
    const marker = document.getElementById('phaseMarker');
    marker.style.left = '50%';
    marker.classList.remove('warn', 'danger');
}

function resetPairedClock() {
    document.getElementById('pairedTxHand').style.transform = 'rotate(0deg)';
    document.getElementById('pairedRxHand').style.transform = 'rotate(0deg)';
    document.getElementById('pairedTxPulse').classList.remove('active');
    document.getElementById('pairedRxPulse').classList.remove('active', 'error');
}

function draw() {
    background(3, 10, 15);
    drawScopeGrid({ isMobile, canvasHeight: canvasH, topRatio: 0.25, bottomRatio: 0.75 });
    drawPorts({ isMobile, canvasWidth: canvasW, canvasHeight: canvasH, transmitterX: txX, receiverX: defaultRxX });

    if (!hasStarted) {
        fill(100);
        noStroke();
        textAlign(CENTER, CENTER);
        textSize(isMobile ? 11 : 14);
        textStyle(BOLD);
        text('تنظیمات را اعمال و پیام را ارسال کنید.', width / 2, height / 2);
        textStyle(NORMAL);
        return;
    }

    if (isPlaying) globalTime++;
    updateTransmitter();
    updateTxPulse();
    drawSignal({ isMobile, transmitterX: txX, receiverX: defaultRxX, getVoltageAtPixel });
    drawBitGrid();
    processReceiver();
    drawRipples();
    updateVisualClocks();
}

function updateTxPulse() {
    const txBitDuration = txPeriod * FPS;
    const currentTxBit = Math.floor(globalTime / txBitDuration);
    if (currentTxBit !== lastTxBitPulsed && currentTxBit >= 0 && currentTxBit < binaryData.length) {
        pulseElement(document.getElementById('pairedTxPulse'));
        lastTxBitPulsed = currentTxBit;
    }
}

function getVoltageAtPixel(x) {
    if (x < txX) return { v: null, index: -1 };
    const distance = x - txX;
    const generatedTime = globalTime - distance / speed;
    const lowVoltage = canvasH * 0.75;
    const highVoltage = canvasH * 0.25;
    const txBitDuration = txPeriod * FPS;

    if (generatedTime < 0 || generatedTime >= binaryData.length * txBitDuration) {
        return { v: lowVoltage, index: -1 };
    }

    const bitIndex = Math.floor(generatedTime / txBitDuration);
    const bitValue = parseInt(binaryData[bitIndex]);
    return { v: bitValue === 1 ? highVoltage : lowVoltage, index: bitIndex };
}

function drawBitGrid() {
    const txBitDuration = txPeriod * FPS;
    for (let index = 0; index <= binaryData.length; index++) {
        const generatedTime = index * txBitDuration;
        const x = txX + (globalTime - generatedTime) * speed;
        if (x <= txX || x >= defaultRxX) continue;

        stroke(255, 255, 255, 30);
        strokeWeight(1);
        drawingContext.setLineDash([4, 4]);
        line(x, canvasH * 0.15, x, canvasH * 0.85);
        drawingContext.setLineDash([]);

        if (index >= binaryData.length) continue;
        const nextX = txX + (globalTime - (index + 1) * txBitDuration) * speed;
        const middleX = (x + nextX) / 2;
        if (middleX <= txX || middleX >= defaultRxX) continue;

        const byteIndex = Math.floor(index / 8);
        fill(BYTE_COLORS[byteIndex % BYTE_COLORS.length]);
        noStroke();
        textSize(isMobile ? 12 : 16);
        textAlign(CENTER, BOTTOM);
        textStyle(BOLD);
        text(binaryData[index], middleX, canvasH * 0.25 - (isMobile ? 6 : 10));
        textStyle(NORMAL);
    }
}

function updateTransmitter() {
    const point = getVoltageAtPixel(txX + 1);
    document.getElementById('sentBinary').innerHTML = renderTransmittedBits(binaryData, point.index);
}

function processReceiver() {
    const txBitDuration = txPeriod * FPS;
    const rxBitDuration = rxPeriod * FPS;
    const arrivalTime = (sampleLineX - txX) / speed;
    const endTime = arrivalTime + binaryData.length * txBitDuration;
    const nextSampleTime = arrivalTime + 0.5 * rxBitDuration + receivedBits.count * rxBitDuration;
    let justSampled = false;

    stroke('#ff4757');
    strokeWeight(isMobile ? 2 : 3);
    drawingContext.setLineDash([6, 4]);
    line(sampleLineX, 0, sampleLineX, height);
    drawingContext.setLineDash([]);

    if (globalTime >= nextSampleTime && nextSampleTime <= endTime) {
        const generatedTimeAtSample = nextSampleTime - arrivalTime;
        const bitPositionFloat = generatedTimeAtSample / txBitDuration;
        const targetBitIndex = Math.floor(bitPositionFloat);
        const phaseFraction = bitPositionFloat - targetBitIndex;
        let sampled = '0';
        if (targetBitIndex >= 0 && targetBitIndex < binaryData.length) {
            sampled = binaryData[targetBitIndex];
        }

        const expectedIndex = receivedBits.count;
        const expectedBit = expectedIndex < binaryData.length ? binaryData[expectedIndex] : null;
        const isError = sampled !== expectedBit;
        receivedBits.append(sampled, isError);

        const sampleY = parseInt(sampled) === 1 ? canvasH * 0.25 : canvasH * 0.75;
        ripples.push({ x: sampleLineX, y: sampleY, radius: isMobile ? 3 : 5, alpha: 255, val: sampled, isError });

        if (targetBitIndex >= 0 && targetBitIndex < binaryData.length) {
            sampleRecords.push({ bitIndex: targetBitIndex, phaseFraction, isError });
        }

        pulseRxRing(isError);
        const cumulativePhaseError = bitPositionFloat - (expectedIndex + 0.5);
        updatePhaseMarker(cumulativePhaseError);
        drawTrail();

        justSampled = true;
    }

    if (justSampled || globalTime % 10 === 0) receivedBits.updateDecodedText();
}

function pulseRxRing(isError) {
    const ring = document.getElementById('pairedRxPulse');
    ring.classList.toggle('error', isError);
    pulseElement(ring);
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

function updateVisualClocks() {
    const txBitDuration = txPeriod * FPS;
    const rxBitDuration = rxPeriod * FPS;
    const txAngle = (globalTime / txBitDuration) * 360 % 360;
    document.getElementById('pairedTxHand').style.transform = `rotate(${txAngle}deg)`;

    const arrivalTime = (sampleLineX - txX) / speed;
    const rxPhase = (globalTime - arrivalTime) / rxBitDuration - 0.5;
    let rxAngle = (rxPhase * 360 % 360 + 360) % 360;
    if (globalTime < arrivalTime) rxAngle = 0;
    document.getElementById('pairedRxHand').style.transform = `rotate(${rxAngle}deg)`;
}

function drawRipples() {
    for (let index = ripples.length - 1; index >= 0; index--) {
        const ripple = ripples[index];
        const rippleColor = ripple.isError
            ? color(255, 71, 87, ripple.alpha)
            : color(0, 255, 136, ripple.alpha);

        noFill();
        stroke(rippleColor);
        strokeWeight(isMobile ? 2 : 3);
        circle(ripple.x, ripple.y, ripple.radius);

        fill(rippleColor);
        noStroke();
        textSize(isMobile ? 18 : 24);
        textAlign(CENTER, CENTER);
        textStyle(BOLD);
        text(`${ripple.val} ${ripple.isError ? '❌' : '✔️'}`, ripple.x - (isMobile ? 22 : 30), ripple.y - (isMobile ? 20 : 25));
        textStyle(NORMAL);

        ripple.radius += isMobile ? 1.5 : 2.5;
        ripple.alpha -= 12;
        if (ripple.alpha <= 0) ripples.splice(index, 1);
    }
}

window.setup = setup;
window.draw = draw;
window.windowResized = windowResized;
