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
    scopeHint: `
        Manchester Coding:
        <span class="up">بیت 1 = لبه بالا رونده ⬆</span> &nbsp;|&nbsp;
        <span class="down">بیت 0 = لبه پایین رونده ⬇</span>
    `,
    transmitterControls: `
        <div class="config-row">
            <input type="text" id="textInput" placeholder="متن (Hi)" value="Hi" maxlength="8">
            <span style="color:#aaa;">(بدون نیاز به کلاک مجزا)</span>
        </div>
    `,
    receiverControls: `
        <div class="config-row" style="justify-content:center;">
            <span style="color:var(--success); font-weight:bold; font-size:0.85rem;">همگام‌سازی و استخراج با تشخیص لبه در وسط بیت</span>
        </div>
    `,
    receiverMonitorId: 'rxMonitor',
});

let binaryData = '';
let isPlaying = false;
let hasStarted = false;
let globalTime = 0;

const bitDuration = 120;
let isMobile = false;
let speed = 1;
let canvasW;
let canvasH;
let txX = 50;
let defaultRxX = 0;
let ripples = [];

const receivedBits = new ReceivedBits();

function checkMobile() {
    isMobile = window.innerWidth <= 768;
    speed = isMobile ? 0.6 : 1.2;
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
    globalTime += bitDuration / 4;
});
document.getElementById('btnPrev').addEventListener('click', () => {
    if (!hasStarted) return;
    isPlaying = false;
    setPlaybackAppearance(false);
    globalTime = Math.max(0, globalTime - bitDuration / 4);
});
document.getElementById('btnReset').addEventListener('click', () => {
    isPlaying = false;
    hasStarted = false;
    globalTime = 0;
    ripples = [];
    receivedBits.reset();
    resetSharedDisplay();
});

function startTransmission() {
    const text = document.getElementById('textInput').value || 'A';
    binaryData = stringToBinary(text);
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
}

function windowResized() {
    checkMobile();
    const container = document.getElementById('canvas-div');
    canvasW = container.offsetWidth;
    canvasH = container.offsetHeight;
    resizeCanvas(canvasW, canvasH);
    defaultRxX = canvasW - (isMobile ? 30 : 50);
}

function draw() {
    background(3, 10, 15);
    drawScopeGrid({ isMobile, canvasHeight: canvasH, topRatio: 0.3, bottomRatio: 0.7 });
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
    drawBitGrid();
    drawSignal({ isMobile, transmitterX: txX, receiverX: defaultRxX, getVoltageAtPixel });
    drawReceiverScanLine();
    updateTransmitter();
    processReceiver();
    drawRipples();
}

function drawReceiverScanLine() {
    stroke(0, 255, 136, 120);
    strokeWeight(isMobile ? 1 : 2);
    drawingContext.setLineDash([5, 5]);
    line(defaultRxX, canvasH * 0.1, defaultRxX, canvasH * 0.9);
    drawingContext.setLineDash([]);

    fill(0, 255, 136, 20);
    noStroke();
    rect(defaultRxX - 4, canvasH * 0.1, 8, canvasH * 0.8);

    const point = getVoltageAtPixel(defaultRxX);
    if (point.index >= 0) {
        fill('#ffff00');
        noStroke();
        circle(defaultRxX, point.v, isMobile ? 8 : 12);
        fill(255, 255, 0, 50);
        circle(defaultRxX, point.v, isMobile ? 16 : 24);
    }
}

function getVoltageAtPixel(x) {
    const lowVoltage = canvasH * 0.7;
    const highVoltage = canvasH * 0.3;
    if (x < txX) return { v: lowVoltage, index: -1 };

    const distance = x - txX;
    const generatedTime = globalTime - distance / speed;
    if (generatedTime < 0 || generatedTime >= binaryData.length * bitDuration) {
        return { v: lowVoltage, index: -1 };
    }

    const bitIndex = Math.floor(generatedTime / bitDuration);
    const bitValue = parseInt(binaryData[bitIndex]);
    const bitTime = generatedTime % bitDuration;
    const isFirstHalf = bitTime < bitDuration / 2;
    const voltage = bitValue === 1
        ? (isFirstHalf ? lowVoltage : highVoltage)
        : (isFirstHalf ? highVoltage : lowVoltage);

    return { v: voltage, index: bitIndex, isFirstHalf };
}

function drawBitGrid() {
    for (let index = 0; index <= binaryData.length; index++) {
        const generatedTime = index * bitDuration;
        const x = txX + (globalTime - generatedTime) * speed;
        if (x <= txX || x > defaultRxX + bitDuration * speed) continue;

        if (index < binaryData.length) {
            const nextX = txX + (globalTime - (index + 1) * bitDuration) * speed;
            const drawStartX = constrain(nextX, txX, defaultRxX);
            const drawEndX = constrain(x, txX, defaultRxX);
            if (drawStartX < drawEndX && index % 2 === 0) {
                fill(255, 255, 255, 12);
                noStroke();
                rect(drawStartX, canvasH * 0.1, drawEndX - drawStartX, canvasH * 0.8);
            }
        }

        if (x >= defaultRxX) continue;
        stroke(255, 255, 255, 130);
        strokeWeight(isMobile ? 1 : 2);
        drawingContext.setLineDash([8, 6]);
        line(x, canvasH * 0.12, x, canvasH * 0.88);
        drawingContext.setLineDash([]);

        if (index >= binaryData.length) continue;
        const nextX = txX + (globalTime - (index + 1) * bitDuration) * speed;
        const middleX = (x + nextX) / 2;
        if (middleX <= txX || middleX >= defaultRxX) continue;

        stroke(255, 255, 255, 30);
        drawingContext.setLineDash([2, 5]);
        line(middleX, canvasH * 0.2, middleX, canvasH * 0.8);
        drawingContext.setLineDash([]);

        const byteIndex = Math.floor(index / 8);
        fill(BYTE_COLORS[byteIndex % BYTE_COLORS.length]);
        noStroke();
        textSize(isMobile ? 12 : 16);
        textAlign(CENTER, BOTTOM);
        textStyle(BOLD);
        text(binaryData[index], middleX, canvasH * 0.3 - (isMobile ? 6 : 10));

        textSize(isMobile ? 12 : 16);
        if (binaryData[index] === '1') {
            fill('#00ff88');
            text('⬆', middleX, canvasH * 0.7 + (isMobile ? 18 : 25));
        } else {
            fill('#ff4757');
            text('⬇', middleX, canvasH * 0.7 + (isMobile ? 18 : 25));
        }
        textStyle(NORMAL);
    }
}

function updateTransmitter() {
    const point = getVoltageAtPixel(txX + 1);
    document.getElementById('sentBinary').innerHTML = renderTransmittedBits(binaryData, point.index);
}

function processReceiver() {
    const arrivalTime = (defaultRxX - txX) / speed;
    const currentReceiverTime = globalTime - arrivalTime;
    if (currentReceiverTime <= 0 || currentReceiverTime > binaryData.length * bitDuration) return;

    const sampleTime = receivedBits.count * bitDuration + bitDuration / 2;
    if (currentReceiverTime < sampleTime) return;

    const sampled = binaryData[receivedBits.count];
    receivedBits.append(sampled);

    const isRisingEdge = sampled === '1';
    ripples.push({
        x: defaultRxX,
        y: canvasH * 0.5,
        radius: isMobile ? 8 : 12,
        alpha: 255,
        val: sampled,
        isRising: isRisingEdge,
    });

    const receiverFrame = document.getElementById('rxMonitor');
    receiverFrame.style.boxShadow = isRisingEdge ? '0 0 25px #00ff88' : '0 0 25px #ff4757';
    setTimeout(() => receiverFrame.style.boxShadow = '0 10px 20px rgba(0,0,0,0.6)', 200);
    receivedBits.updateDecodedText();
}

function drawRipples() {
    for (let index = ripples.length - 1; index >= 0; index--) {
        const ripple = ripples[index];
        const rippleColor = ripple.isRising
            ? color(0, 255, 136, ripple.alpha)
            : color(255, 71, 87, ripple.alpha);

        noFill();
        stroke(rippleColor);
        strokeWeight(isMobile ? 2 : 4);
        circle(ripple.x, ripple.y, ripple.radius);

        fill(rippleColor);
        noStroke();
        textSize(isMobile ? 16 : 22);
        textAlign(CENTER, CENTER);
        textStyle(BOLD);
        text(`${ripple.val} ${ripple.isRising ? '⬆' : '⬇'}`, ripple.x - (isMobile ? 25 : 35), ripple.y);
        textStyle(NORMAL);

        ripple.radius += isMobile ? 1.5 : 2.5;
        ripple.alpha -= 8;
        if (ripple.alpha <= 0) ripples.splice(index, 1);
    }
}

window.setup = setup;
window.draw = draw;
window.windowResized = windowResized;
