export const BYTE_COLORS = [
    '#00ffcc',
    '#ff3366',
    '#ffcc00',
    '#cc33ff',
    '#3399ff',
    '#ff6633',
    '#00ff44',
    '#ff33cc',
];

const WAITING_MESSAGE = '<span style="color:#555; font-size:0.8rem; direction:rtl; display:block;">منتظر ارسال...</span>';

export function mountEncodingGame({
    scopeHint,
    transmitterControls,
    receiverControls,
    transmitterDecoration = '',
    receiverDecoration = '',
    receiverMonitorId = '',
}) {
    document.body.innerHTML = `
        <div class="container">
            <div class="oscilloscope-wrapper" id="scopeWrapper">
                <div class="scope-hint">${scopeHint}</div>
                <div id="canvas-div"></div>
            </div>

            <div class="toolbar">
                <div class="controls">
                    <button id="btnPrev" title="بازگشت زمان">⏪</button>
                    <button id="btnPlayPause" title="توقف/پخش">▶️</button>
                    <button id="btnNext" title="جلو بردن زمان">⏩</button>
                    <button id="btnReset" title="شروع مجدد">🔄 پاک‌کردن</button>
                </div>
            </div>

            <div class="network-layout" id="networkLayout">
                ${computer({
                    label: '💻 فرستنده (TX)',
                    labelClass: 'tx-label',
                    decoration: transmitterDecoration,
                    content: `
                        ${transmitterControls}
                        <button class="btn-send" id="btnSend">تایید و ارسال روی سیم</button>
                        <div class="binary-display" id="sentBinary">${WAITING_MESSAGE}</div>
                    `,
                })}

                <div class="physical-wire-container">
                    <div class="wire-label">DATA Cable</div>
                    <div class="wire-line"><div class="wire-pulse"></div></div>
                </div>

                ${computer({
                    label: '🖥️ گیرنده (RX)',
                    labelClass: 'rx-label',
                    decoration: receiverDecoration,
                    content: `
                        ${receiverControls}
                        <hr style="border-color: #222; width: 100%; margin: 3px 0;">
                        <div class="binary-display" id="receivedBinary"></div>
                        <div class="final-text" id="receivedText">-</div>
                    `,
                    monitorId: receiverMonitorId,
                })}
            </div>
        </div>
    `;
}

function computer({ label, labelClass, decoration, content, monitorId = '' }) {
    return `
        <div class="computer-wrapper">
            <div class="monitor-frame"${monitorId ? ` id="${monitorId}"` : ''}>
                <div class="comp-label ${labelClass}">${label}</div>
                ${decoration}
                <div class="monitor-screen">${content}</div>
            </div>
            <div class="monitor-stand"></div>
            <div class="monitor-base"></div>
        </div>
    `;
}

export function stringToBinary(value) {
    let binary = '';
    for (let index = 0; index < value.length; index++) {
        binary += value.charCodeAt(index).toString(2).padStart(8, '0');
    }
    return binary;
}

export function renderTransmittedBits(binary, activeIndex) {
    if (!binary) return '';

    let html = '';
    let globalBitIndex = 0;
    const bytes = binary.match(/.{1,8}/g) || [];

    bytes.forEach((byte, byteIndex) => {
        const color = BYTE_COLORS[byteIndex % BYTE_COLORS.length];
        html += `<span class="byte-block" style="color:${color}">`;
        for (let bitIndex = 0; bitIndex < 8; bitIndex++) {
            html += globalBitIndex === activeIndex
                ? `<span class="active-tx-bit">${byte[bitIndex]}</span>`
                : byte[bitIndex];
            globalBitIndex++;
        }
        html += '</span>';
    });

    return html;
}

export class ReceivedBits {
    constructor({ showErrors = false } = {}) {
        this.showErrors = showErrors;
        this.reset();
    }

    reset() {
        this.count = 0;
        this.raw = '';
        this.html = '';
        const binaryOutput = document.getElementById('receivedBinary');
        if (binaryOutput) binaryOutput.innerHTML = '';
        const textOutput = document.getElementById('receivedText');
        if (textOutput) textOutput.innerText = '-';
    }

    append(bit, isError = false) {
        const colorClass = this.showErrors && isError ? 'new-rx-error' : 'new-rx-correct';
        this.html = this.html.replace(/new-rx-correct|new-rx-error/g, '');

        const byteIndex = Math.floor(this.count / 8);
        const color = BYTE_COLORS[byteIndex % BYTE_COLORS.length];
        if (this.count % 8 === 0 && this.count > 0) {
            this.html += `</span> <span class="byte-block" style="color:${color}">`;
        } else if (this.count === 0) {
            this.html += `<span class="byte-block" style="color:${color}">`;
        }

        this.html += `<span class="${colorClass}">${bit}</span>`;
        this.raw += bit;
        this.count++;
        document.getElementById('receivedBinary').innerHTML = `${this.html}</span>`;
    }

    updateDecodedText() {
        let text = '';
        for (let index = 0; index < this.raw.length; index += 8) {
            const byte = this.raw.substring(index, index + 8);
            if (byte.length === 8) text += String.fromCharCode(parseInt(byte, 2));
        }
        document.getElementById('receivedText').innerText = text || '-';
    }
}

export function restrictToAscii(input) {
    input.addEventListener('input', function () {
        this.value = this.value.replace(/[^\x00-\x7F]/g, '');
    });
}

export function setPlaybackAppearance(isPlaying) {
    document.getElementById('btnPlayPause').innerText = isPlaying ? '⏸️' : '▶️';
    document.getElementById('networkLayout').classList.toggle('playing', isPlaying);
}

export function resetSharedDisplay() {
    setPlaybackAppearance(false);
    document.getElementById('sentBinary').innerHTML = WAITING_MESSAGE;
    document.getElementById('receivedBinary').innerHTML = '';
    document.getElementById('receivedText').innerText = '-';
}

export function drawScopeGrid({ isMobile, canvasHeight, topRatio, bottomRatio }) {
    stroke(19, 36, 32);
    strokeWeight(1);
    const gridSize = isMobile ? 25 : 35;
    for (let x = 0; x < width; x += gridSize) line(x, 0, x, height);
    for (let y = 0; y < height; y += gridSize) line(0, y, width, y);

    const dataTop = canvasHeight * topRatio;
    const dataBottom = canvasHeight * bottomRatio;
    stroke(255, 255, 255, 40);
    drawingContext.setLineDash([2, 4]);
    line(0, dataTop, width, dataTop);
    line(0, dataBottom, width, dataBottom);
    drawingContext.setLineDash([]);

    const labelWidth = isMobile ? 45 : 65;
    const labelHeight = isMobile ? 20 : 30;
    fill(0, 0, 0, 220);
    noStroke();
    rect(5, dataTop - labelHeight / 2, labelWidth, labelHeight, 4);
    rect(5, dataBottom - labelHeight / 2, labelWidth, labelHeight, 4);

    fill('#66fcf1');
    textAlign(CENTER, CENTER);
    textSize(isMobile ? 11 : 14);
    textStyle(BOLD);
    text('5V', 5 + labelWidth / 2, dataTop);
    text('0V', 5 + labelWidth / 2, dataBottom);
    textStyle(NORMAL);
}

export function drawPorts({ isMobile, canvasWidth, canvasHeight, transmitterX, receiverX }) {
    const dataMiddle = canvasHeight * 0.5;
    const portWidth = isMobile ? 8 : 10;
    const jackHeight = isMobile ? 18 : 24;

    strokeWeight(isMobile ? 3 : 5);
    stroke('#4e8cff');
    line(0, dataMiddle, transmitterX, dataMiddle);
    stroke('#00ff88');
    line(receiverX, dataMiddle, canvasWidth, dataMiddle);

    noStroke();
    fill('#2b3744');
    rect(transmitterX - portWidth, 0, portWidth, height);
    rect(receiverX, 0, portWidth, height);
    fill('#4e8cff');
    rect(transmitterX - portWidth, dataMiddle - jackHeight / 2, portWidth, jackHeight, 3);
    fill('#00ff88');
    rect(receiverX, dataMiddle - jackHeight / 2, portWidth, jackHeight, 3);
}

export function drawSignal({ isMobile, transmitterX, receiverX, getVoltageAtPixel }) {
    noFill();
    strokeWeight(isMobile ? 3 : 5);
    let previousIndex = -2;
    let previousVoltage = null;
    let currentPath = [];

    for (let x = transmitterX; x <= receiverX; x++) {
        const point = getVoltageAtPixel(x);
        if (point.index !== previousIndex || x === receiverX) {
            if (currentPath.length > 0) {
                const byteIndex = Math.floor(previousIndex / 8);
                stroke(previousIndex === -1 ? '#555555' : BYTE_COLORS[byteIndex % BYTE_COLORS.length]);
                beginShape();
                for (const pathPoint of currentPath) vertex(pathPoint.x, pathPoint.y);
                endShape();
            }
            currentPath = [];
            if (previousVoltage !== null && point.v !== previousVoltage && x !== receiverX) {
                currentPath.push({ x, y: previousVoltage });
            }
        }
        currentPath.push({ x, y: point.v });
        previousIndex = point.index;
        previousVoltage = point.v;
    }
}
