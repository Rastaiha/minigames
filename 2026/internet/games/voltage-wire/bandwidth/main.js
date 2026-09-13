import '@fontsource-variable/vazirmatn'
import {V_MAX, drawTimeAxis, drawVoltageGrid, drawVoltageLabels, prepareCanvas, voltageToY} from '../shared/scope.js'

const messageInput = document.querySelector('#messageInput')
const rateSlider = document.querySelector('#rateSlider')
const rateLabel = document.querySelector('#rateLabel')
const voltageSlider = document.querySelector('#voltageSlider')
const voltageLabel = document.querySelector('#voltageLabel')
const bitStreamContainer = document.querySelector('#bitStream')
const scope = document.querySelector('#scope')
const context = scope.getContext('2d')
const INITIAL_TIME_TICKS = 10
const TIME_WINDOW_SECONDS = INITIAL_TIME_TICKS - 1
const TIME_AXIS_MARGIN = 24
const NOISE_EPSILON = 0.08
const RC_CONSTANT = 0.12
const ERROR_RATE = 7
let bitRate = Number.parseInt(rateSlider.value, 10)
let bitSequence = []
let bitElements = []
let currentActualVoltage = 0
let bitProgress = 0
let startTime = null
let lastTime = null
const samples = []

function printableAsciiOnly(value) {
  return Array.from(value)
    .filter((character) => {
      const code = character.charCodeAt(0)
      return code >= 32 && code <= 126
    })
    .slice(0, 4)
    .join('')
}

function messageToBits(message) {
  return Array.from(message).flatMap((character) =>
    character.charCodeAt(0).toString(2).padStart(8, '0').split('').map(Number),
  )
}

function renderBitStream() {
  bitStreamContainer.replaceChildren()
  bitElements = bitSequence.map((bit, index) => {
    const element = document.createElement('span')
    element.textContent = bit
    if ((index + 1) % 8 === 0 && index !== bitSequence.length - 1) element.classList.add('byte-end')
    bitStreamContainer.appendChild(element)
    return element
  })
  bitStreamContainer.setAttribute(
    'aria-label',
    bitSequence.length ? `بیت‌های پیام: ${bitSequence.join(' ')}` : 'پیام خالی است',
  )
}

function resetTransmission() {
  samples.length = 0
  startTime = null
  lastTime = null
  bitProgress = 0
  currentActualVoltage = 0
  voltageSlider.value = '0'
  voltageLabel.textContent = '0.00'
  bitElements.forEach((element) => element.classList.remove('active', 'error-state'))
}

function updateMessage() {
  const sanitized = printableAsciiOnly(messageInput.value)
  if (sanitized !== messageInput.value) messageInput.value = sanitized
  bitSequence = messageToBits(sanitized)
  renderBitStream()
  resetTransmission()
}

messageInput.addEventListener('input', updateMessage)

messageInput.addEventListener('beforeinput', (event) => {
  if (!event.data || event.inputType.startsWith('delete')) return
  if (printableAsciiOnly(event.data) !== event.data) event.preventDefault()
})

messageInput.addEventListener('paste', (event) => {
  event.preventDefault()
  const pastedText = printableAsciiOnly(event.clipboardData.getData('text'))
  const start = messageInput.selectionStart ?? messageInput.value.length
  const end = messageInput.selectionEnd ?? start
  messageInput.value = printableAsciiOnly(messageInput.value.slice(0, start) + pastedText + messageInput.value.slice(end))
  updateMessage()
})

rateSlider.addEventListener('input', (event) => {
  bitRate = Number.parseInt(event.target.value, 10)
  rateLabel.textContent = bitRate
  resetTransmission()
})

function updateActiveBit(currentBitIndex) {
  bitElements.forEach((element, index) => {
    const isActive = index === currentBitIndex
    element.classList.toggle('active', isActive)
    element.classList.toggle('error-state', isActive && bitRate > ERROR_RATE)
  })
}

function drawThresholdRegions(width, yFor) {
  context.fillStyle = 'rgb(24 90 58 / 12%)'
  context.fillRect(0, yFor(5), width, yFor(3.5) - yFor(5))
  context.fillStyle = 'rgb(184 42 49 / 10%)'
  context.fillRect(0, yFor(1.5), width, yFor(0) - yFor(1.5))
}

function drawScope(currentTime) {
  const {width, height, graphHeight} = prepareCanvas(scope, context)
  const visibleEndTime = Math.max(TIME_WINDOW_SECONDS, currentTime)
  const visibleStartTime = visibleEndTime - TIME_WINDOW_SECONDS
  const xFor = (time) =>
    TIME_AXIS_MARGIN +
    ((time - visibleStartTime) / TIME_WINDOW_SECONDS) * (width - TIME_AXIS_MARGIN * 2)
  const yFor = (voltage) => voltageToY(voltage, graphHeight)
  drawThresholdRegions(width, yFor)
  drawVoltageGrid(context, width, yFor)

  if (samples.length >= 2) {
    context.lineWidth = 3
    context.lineJoin = 'round'
    context.lineCap = 'round'
    context.strokeStyle = bitRate > ERROR_RATE ? '#b82a31' : '#35afb8'
    context.beginPath()
    let started = false
    for (const sample of samples) {
      if (sample.time < visibleStartTime) continue
      const x = xFor(sample.time)
      const y = yFor(sample.voltage)
      if (!started) {
        context.moveTo(x, y)
        started = true
      } else {
        context.lineTo(x, y)
      }
    }
    context.stroke()
  }

  drawVoltageLabels(context, yFor)
  drawTimeAxis(context, {
    xFor, width, height,
    startSecond: Math.floor(visibleStartTime),
    endSecond: Math.ceil(visibleEndTime),
  })
}

function tick(now) {
  if (startTime === null) {
    startTime = now
    lastTime = now
  }
  const deltaTime = Math.min((now - lastTime) / 1000, 0.1)
  lastTime = now
  const time = (now - startTime) / 1000
  let targetVoltage = 0

  if (bitSequence.length) {
    bitProgress += deltaTime * bitRate
    const currentBitIndex = Math.floor(bitProgress) % bitSequence.length
    targetVoltage = bitSequence[currentBitIndex] * V_MAX
    updateActiveBit(currentBitIndex)
  }

  const alpha = 1 - Math.exp(-deltaTime / RC_CONSTANT)
  currentActualVoltage += (targetVoltage - currentActualVoltage) * alpha
  const jitter = (Math.random() - 0.5) * 2 * NOISE_EPSILON
  const displayVoltage = Math.max(0, Math.min(V_MAX, currentActualVoltage + jitter))
  voltageSlider.value = currentActualVoltage.toFixed(2)
  voltageLabel.textContent = currentActualVoltage.toFixed(2)
  samples.push({time, voltage: displayVoltage})

  const cutoff = time - TIME_WINDOW_SECONDS - 0.5
  while (samples.length && samples[0].time < cutoff) samples.shift()
  drawScope(time)
  window.requestAnimationFrame(tick)
}

async function start() {
  await document.fonts.load('600 12px "Vazirmatn Variable"')
  updateMessage()
  window.requestAnimationFrame(tick)
}

start()
