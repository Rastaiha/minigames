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

const stopwatch = (kind, handId, bodyId = '') => `
    <div class="stopwatch ${kind}-watch"${bodyId ? ` id="${bodyId}"` : ''}>
        <div class="watch-button"></div>
        <div class="watch-tick"></div>
        <div class="watch-center"></div>
        <div class="watch-hand" id="${handId}"></div>
    </div>
`;

mountEncodingGame({
    scopeHint: 'محل نمونه‌برداری (خط‌چین قرمز) را بگیرید و بکشید',
    transmitterDecoration: stopwatch('tx', 'txHand'),
    receiverDecoration: stopwatch('rx', 'rxHand', 'rxWatchBody'),
    transmitterControls: `
        <div class="config-row">
            <input type="text" id="textInput" placeholder="متن (Hi)" value="Hi" maxlength="8">
            <input type="number" id="txRate" step="0.1" min="0.2" max="3.0" value="1.0" title="سرعت ارسال">
            <span>ثانیه/بیت</span>
        </div>
    `,
    receiverControls: `
        <div class="config-row">
            <span style="color:var(--success); font-weight:bold;">نرخ نمونه‌برداری:</span>
            <input type="number" id="rxRate" step="0.1" min="0.2" max="3.0" value="1.0" title="سرعت دریافت">
            <span>ثانیه/بیت</span>
        </div>
    `,
});

let binaryData = '';
let isPlaying = false;
let hasStarted = false;
let globalTime = 0;

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
let isDraggingOffset = false;
let ripples = [];

const receivedBits = new ReceivedBits({ showErrors: true });

function checkMobile() {
    isMobile = window.innerWidth <= 768;
    speed = isMobile ? 1 : 2;
    txX = isMobile ? 30 : 60;
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
    receivedBits.reset();
    resetSharedDisplay();
    document.getElementById('txHand').style.transform = 'rotate(0deg)';
    document.getElementById('rxHand').style.transform = 'rotate(0deg)';
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
    receivedBits.reset();
    setPlaybackAppearance(true);
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
    canvas.mousePressed(startDragOffset);
    canvas.mouseReleased(stopDragOffset);
    canvas.touchStarted(startDragOffset);
    canvas.touchEnded(stopDragOffset);
}

function windowResized() {
    checkMobile();
    const container = document.getElementById('canvas-div');
    canvasW = container.offsetWidth;
    canvasH = container.offsetHeight;
    resizeCanvas(canvasW, canvasH);
    defaultRxX = canvasW - (isMobile ? 30 : 50);
    if (sampleLineX > defaultRxX) sampleLineX = defaultRxX - (isMobile ? 20 : 30);
}

function draw() {
    background(3, 10, 15);
    drawScopeGrid({ isMobile, canvasHeight: canvasH, topRatio: 0.25, bottomRatio: 0.75 });
    drawPorts({ isMobile, canvasWidth: canvasW, canvasHeight: canvasH, transmitterX: txX, receiverX: defaultRxX });

    if (isDraggingOffset && hasStarted) {
        const pointerX = touches.length > 0 ? touches[0].x : mouseX;
        sampleLineX = constrain(pointerX, txX + 50, defaultRxX + 10);
    }

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

    if (isPlaying && !isDraggingOffset) globalTime++;
    updateTransmitter();
    drawSignal({ isMobile, transmitterX: txX, receiverX: defaultRxX, getVoltageAtPixel });
    drawBitGrid();
    processReceiver();
    drawRipples();
    updateVisualClocks();
}

function startDragOffset(event) {
    if (!hasStarted) return;
    const pointerX = touches.length > 0 ? touches[0].x : mouseX;
    const tolerance = isMobile ? 40 : 30;
    if (abs(pointerX - sampleLineX) < tolerance) {
        isDraggingOffset = true;
        isPlaying = false;
        setPlaybackAppearance(false);
        if (event.type === 'touchstart') event.preventDefault();
    }
}

function stopDragOffset() {
    isDraggingOffset = false;
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

    if (isDraggingOffset) {
        stroke('#ffb703');
        fill('#ffb703');
    } else {
        stroke('#ff4757');
        fill('#ff4757');
    }

    strokeWeight(isMobile ? 2 : 3);
    drawingContext.setLineDash([6, 4]);
    line(sampleLineX, 0, sampleLineX, height);
    drawingContext.setLineDash([]);

    const handleWidth = isMobile ? 24 : 36;
    const handleHeight = isMobile ? 16 : 20;
    noStroke();
    triangle(sampleLineX - 8, 10, sampleLineX + 8, 10, sampleLineX, 26);
    rect(sampleLineX - handleWidth / 2, height - handleHeight, handleWidth, handleHeight, 4);
    fill(0);
    textSize(isMobile ? 10 : 12);
    textAlign(CENTER, CENTER);
    textStyle(BOLD);
    text('< >', sampleLineX, height - handleHeight / 2);
    textStyle(NORMAL);

    if (globalTime >= nextSampleTime && nextSampleTime <= endTime) {
        const generatedTimeAtSample = nextSampleTime - arrivalTime;
        const targetBitIndex = Math.floor(generatedTimeAtSample / txBitDuration);
        let sampled = '0';
        if (targetBitIndex >= 0 && targetBitIndex < binaryData.length) {
            sampled = binaryData[targetBitIndex];
        }

        const expectedBit = receivedBits.count < binaryData.length ? binaryData[receivedBits.count] : null;
        const isError = sampled !== expectedBit;
        receivedBits.append(sampled, isError);

        const sampleY = parseInt(sampled) === 1 ? canvasH * 0.25 : canvasH * 0.75;
        ripples.push({ x: sampleLineX, y: sampleY, radius: isMobile ? 3 : 5, alpha: 255, val: sampled, isError });

        const receiverWatch = document.getElementById('rxWatchBody');
        receiverWatch.style.boxShadow = isError ? '0 0 20px #ff4757' : '0 0 20px #00ff88';
        setTimeout(() => receiverWatch.style.boxShadow = '0 5px 10px rgba(0,0,0,0.8), inset 0 0 10px rgba(0,0,0,1)', 200);
        justSampled = true;
    }

    if (justSampled || globalTime % 10 === 0) receivedBits.updateDecodedText();
}

function updateVisualClocks() {
    const txBitDuration = txPeriod * FPS;
    const rxBitDuration = rxPeriod * FPS;
    const txAngle = globalTime / txBitDuration * 360 % 360;
    document.getElementById('txHand').style.transform = `rotate(${txAngle}deg)`;

    const arrivalTime = (sampleLineX - txX) / speed;
    const rxPhase = (globalTime - arrivalTime) / rxBitDuration - 0.5;
    let rxAngle = (rxPhase * 360 % 360 + 360) % 360;
    if (globalTime < arrivalTime) rxAngle = 0;
    document.getElementById('rxHand').style.transform = `rotate(${rxAngle}deg)`;
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
