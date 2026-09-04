import {
    ReceivedBits,
    renderTransmittedBits,
    restrictToAscii,
    stringToBinary,
} from '../shared/game.js';

const PROPAGATION_DELAY_MS = 50;
const SLIDER_SETTLE_DURATION_MS = 220;

const elements = {
    textInput: document.getElementById('textInput'),
    sentBinary: document.getElementById('sentBinary'),
    targetBit: document.getElementById('targetBit'),
    txReading: document.getElementById('txReading'),
    rxReading: document.getElementById('rxReading'),
    txVoltage: document.getElementById('txVoltage'),
    rxVoltage: document.getElementById('rxVoltage'),
    sliderValue: document.getElementById('sliderValue'),
    voltageSlider: document.getElementById('voltageSlider'),
    voltageSliderControl: document.getElementById('voltageSliderControl'),
    voltageAnnouncement: document.getElementById('voltageAnnouncement'),
    sampleResult: document.getElementById('sampleResult'),
    btnSample: document.getElementById('btnSample'),
    btnClear: document.getElementById('btnClear'),
};

let binaryData = '';
let receiverVoltage = 0;
let sliderAnimationFrame = null;
let isSliderSettling = false;
const propagationTimers = new Set();
const receivedBits = new ReceivedBits();

restrictToAscii(elements.textInput);

elements.textInput.addEventListener('input', encodeMessage);
elements.voltageSlider.addEventListener('input', () => {
    cancelSliderSettling();
    setTransmitterVoltage(Number(elements.voltageSlider.value));
});
elements.voltageSlider.addEventListener('change', settleSlider);
elements.btnSample.addEventListener('click', sampleReceiverVoltage);
elements.btnClear.addEventListener('click', clearReceivedData);

function encodeMessage() {
    binaryData = stringToBinary(elements.textInput.value);
    clearReceivedData();
}

function setTransmitterVoltage(voltage) {
    updateReading('tx', voltage);
    const bit = voltageToBit(voltage);
    elements.sliderValue.textContent = `${voltage.toFixed(1)} V`;
    elements.voltageSliderControl.dataset.level = String(bit);

    const timer = setTimeout(() => {
        propagationTimers.delete(timer);
        receiverVoltage = voltage;
        updateReading('rx', voltage);
        elements.voltageAnnouncement.textContent = `ولتاژ ${voltage.toFixed(1)} ولت به انتهای سیم رسید.`;
    }, PROPAGATION_DELAY_MS);

    propagationTimers.add(timer);
}

function settleSlider() {
    cancelSliderSettling();

    const startVoltage = Number(elements.voltageSlider.value);
    const targetVoltage = voltageToBit(startVoltage) === 1 ? 5 : 0;
    if (startVoltage === targetVoltage) return;

    const startedAt = performance.now();
    isSliderSettling = true;

    function animate(now) {
        const progress = Math.min((now - startedAt) / SLIDER_SETTLE_DURATION_MS, 1);
        const easedProgress = 1 - (1 - progress) ** 3;
        const voltage = startVoltage + (targetVoltage - startVoltage) * easedProgress;
        elements.voltageSlider.value = voltage.toFixed(1);
        setTransmitterVoltage(Number(elements.voltageSlider.value));

        if (progress < 1) {
            sliderAnimationFrame = requestAnimationFrame(animate);
            return;
        }

        elements.voltageSlider.value = String(targetVoltage);
        setTransmitterVoltage(targetVoltage);
        sliderAnimationFrame = null;
        isSliderSettling = false;
    }

    sliderAnimationFrame = requestAnimationFrame(animate);
}

function cancelSliderSettling() {
    if (sliderAnimationFrame !== null) cancelAnimationFrame(sliderAnimationFrame);
    sliderAnimationFrame = null;
    isSliderSettling = false;
}

function updateReading(side, voltage) {
    const reading = side === 'tx' ? elements.txReading : elements.rxReading;
    const value = side === 'tx' ? elements.txVoltage : elements.rxVoltage;
    const bit = voltageToBit(voltage);
    reading.dataset.level = String(bit);
    value.textContent = voltage.toFixed(1);
    reading.querySelector('.current-level').style.bottom = `${voltage / 5 * 100}%`;
}

function sampleReceiverVoltage() {
    const bit = String(voltageToBit(receiverVoltage));
    receivedBits.append(bit);
    receivedBits.updateDecodedText();
    elements.sampleResult.textContent = `ولتاژ ${receiverVoltage.toFixed(1)} ولت نمونه‌برداری شد ← بیت ${bit}`;
    updateTransmittedBits();
}

function voltageToBit(voltage) {
    return voltage > 2.5 ? 1 : 0;
}

function updateTransmittedBits() {
    const activeIndex = receivedBits.count < binaryData.length ? receivedBits.count : -1;
    elements.sentBinary.innerHTML = renderTransmittedBits(binaryData, activeIndex);
    elements.targetBit.textContent = activeIndex >= 0 ? binaryData[activeIndex] : (binaryData ? '✓' : '–');
}

function clearReceivedData() {
    receivedBits.reset();
    elements.sampleResult.textContent = 'هنوز بیتی نمونه‌برداری نشده.';
    updateTransmittedBits();
}

function resetVoltage() {
    cancelSliderSettling();
    for (const timer of propagationTimers) clearTimeout(timer);
    propagationTimers.clear();
    receiverVoltage = 0;
    elements.voltageSlider.value = '0';
    elements.sliderValue.textContent = '0.0 V';
    elements.voltageSliderControl.dataset.level = '0';
    updateReading('tx', 0);
    updateReading('rx', 0);
}

window.addEventListener('pagehide', resetVoltage);

encodeMessage();
