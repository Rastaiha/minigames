import '@fontsource-variable/vazirmatn'

const slider = document.querySelector('#slider')
const voltageLabel = document.querySelector('#vLabel')
const scope = document.querySelector('#scope')
const context = scope.getContext('2d')

const V_MAX = 5
const HISTORY_SECONDS = 8
const NOISE_EPSILON = 0.12 // ± volts of real-world jitter on the wire

let currentVoltage = 0
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
  const width = scope.clientWidth
  const height = scope.clientHeight
  const pixelRatio = window.devicePixelRatio || 1

  if (scope.width !== width * pixelRatio || scope.height !== height * pixelRatio) {
    scope.width = width * pixelRatio
    scope.height = height * pixelRatio
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
  }

  context.clearRect(0, 0, width, height)

  const yFor = (voltage) => height - (voltage / V_MAX) * (height - 20) - 10

  // Grid: horizontal line + label at each integer volt. No band colors —
  // the kid discovers the thresholds by experimenting with the signal.
  context.strokeStyle = 'rgb(41 54 79 / 16%)'
  context.setLineDash([])
  context.lineWidth = 1
  for (let v = 0; v <= V_MAX; v++) {
    const y = yFor(v)
    context.beginPath()
    context.moveTo(0, y)
    context.lineTo(width, y)
    context.stroke()
  }

  if (samples.length < 2) {
    drawVoltageLabels(yFor, width)
    return
  }

  const currentTime = samples.at(-1).time
  const earliestTime = currentTime - HISTORY_SECONDS
  const xFor = (time) => ((time - earliestTime) / HISTORY_SECONDS) * width

  context.lineWidth = 3
  context.lineJoin = 'round'
  context.lineCap = 'round'
  context.strokeStyle = '#5669d1'
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

  drawVoltageLabels(yFor, width)
}

function drawVoltageLabels(yFor, width) {
  context.font = '600 11px "Vazirmatn Variable", Vazirmatn, sans-serif'
  context.direction = 'ltr'
  context.textAlign = 'left'
  context.textBaseline = 'middle'
  for (let v = 0; v <= V_MAX; v++) {
    const y = yFor(v)
    const text = `${v} V`
    const w = context.measureText(text).width
    context.fillStyle = 'rgb(252 250 244 / 88%)'
    context.fillRect(2, y - 8, w + 8, 16)
    context.fillStyle = 'rgb(41 54 79 / 78%)'
    context.fillText(text, 6, y)
  }
}

function tick(now) {
  const time = now / 1000
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
