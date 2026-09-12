import '@fontsource-variable/vazirmatn'

const slider = document.querySelector('#slider')
const voltageLabel = document.querySelector('#vLabel')
const scope = document.querySelector('#scope')
const context = scope.getContext('2d')

const LOW_MAX = 1.5
const HIGH_MIN = 3.5
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

  context.fillStyle = 'rgb(53 175 184 / 18%)'
  context.fillRect(0, yFor(LOW_MAX), width, height - yFor(LOW_MAX))
  context.fillStyle = 'rgb(232 179 58 / 16%)'
  context.fillRect(0, yFor(HIGH_MIN), width, yFor(LOW_MAX) - yFor(HIGH_MIN))
  context.fillStyle = 'rgb(184 42 49 / 16%)'
  context.fillRect(0, yFor(V_MAX), width, yFor(HIGH_MIN) - yFor(V_MAX))

  context.strokeStyle = 'rgb(41 54 79 / 30%)'
  context.setLineDash([4, 4])
  context.lineWidth = 1
  for (const threshold of [LOW_MAX, HIGH_MIN]) {
    const y = yFor(threshold)
    context.beginPath()
    context.moveTo(0, y)
    context.lineTo(width, y)
    context.stroke()
  }
  context.setLineDash([])

  context.fillStyle = 'rgb(41 54 79 / 72%)'
  context.font = '600 12px "Vazirmatn Variable", Vazirmatn, sans-serif'
  context.direction = 'rtl'
  context.textAlign = 'right'
  context.fillText('۵ V', width - 10, yFor(V_MAX) + 14)
  context.fillText('بازهٔ بالا · ۳٫۵ V', width - 10, yFor(HIGH_MIN) - 6)
  context.fillText('بازهٔ پایین · ۱٫۵ V', width - 10, yFor(LOW_MAX) + 16)
  context.fillText('۰ V', width - 10, yFor(0) - 6)

  if (samples.length < 2) return

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
