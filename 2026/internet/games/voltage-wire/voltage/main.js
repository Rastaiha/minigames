import '@fontsource-variable/vazirmatn'
import {V_MAX, drawTimeAxis, drawVoltageGrid, drawVoltageLabels, prepareCanvas, voltageToY} from '../shared/scope.js'

const slider = document.querySelector('#voltageSlider')
const voltageLabel = document.querySelector('#voltageLabel')
const scope = document.querySelector('#scope')
const context = scope.getContext('2d')
const HISTORY_SECONDS = 8
const NOISE_EPSILON = 0.12
let currentVoltage = 0
let startTime = null
const samples = []

function noisy(voltage) {
  const jitter = (Math.random() - 0.5) * 2 * NOISE_EPSILON
  return Math.max(0, Math.min(V_MAX, voltage + jitter))
}

slider.addEventListener('input', (event) => {
  currentVoltage = Number.parseFloat(event.target.value)
  voltageLabel.textContent = currentVoltage.toFixed(2)
})

function drawScope() {
  const {width, height, graphHeight} = prepareCanvas(scope, context)
  const yFor = (voltage) => voltageToY(voltage, graphHeight)
  drawVoltageGrid(context, width, yFor)

  const currentTime = samples.length ? samples.at(-1).time : 0
  const earliestTime = currentTime - HISTORY_SECONDS
  const xFor = (time) => ((time - earliestTime) / HISTORY_SECONDS) * width

  if (samples.length >= 2) {
    context.lineWidth = 3
    context.lineJoin = 'round'
    context.lineCap = 'round'
    context.strokeStyle = '#35afb8'
    context.beginPath()
    let started = false
    for (const sample of samples) {
      if (sample.time < earliestTime) continue
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
    startSecond: Math.floor(earliestTime) - 1,
    endSecond: Math.ceil(currentTime) + 1,
  })
}

function tick(now) {
  if (startTime === null) startTime = now
  const time = (now - startTime) / 1000
  samples.push({time, voltage: noisy(currentVoltage)})
  const cutoff = time - HISTORY_SECONDS - 0.5
  while (samples.length && samples[0].time < cutoff) samples.shift()
  drawScope()
  window.requestAnimationFrame(tick)
}

async function start() {
  await document.fonts.load('600 12px "Vazirmatn Variable"')
  voltageLabel.textContent = currentVoltage.toFixed(2)
  window.requestAnimationFrame(tick)
}

start()
