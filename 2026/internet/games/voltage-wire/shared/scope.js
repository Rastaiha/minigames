export const V_MAX = 5
export const TIME_AXIS_HEIGHT = 22

export function prepareCanvas(canvas, context) {
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  const pixelRatio = window.devicePixelRatio || 1
  const targetWidth = Math.round(width * pixelRatio)
  const targetHeight = Math.round(height * pixelRatio)

  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth
    canvas.height = targetHeight
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
  }

  context.clearRect(0, 0, width, height)
  return {width, height, graphHeight: height - TIME_AXIS_HEIGHT}
}

export function voltageToY(voltage, graphHeight) {
  return graphHeight - (voltage / V_MAX) * (graphHeight - 20) - 10
}

export function drawVoltageGrid(context, width, yFor) {
  context.strokeStyle = 'rgb(44 35 24 / 16%)'
  context.setLineDash([])
  context.lineWidth = 1

  for (let voltage = 0; voltage <= V_MAX; voltage++) {
    const y = yFor(voltage)
    context.beginPath()
    context.moveTo(0, y)
    context.lineTo(width, y)
    context.stroke()
  }
}

export function drawVoltageLabels(context, yFor) {
  context.font = '600 11px "Vazirmatn Variable", Vazirmatn, sans-serif'
  context.direction = 'ltr'
  context.textAlign = 'left'
  context.textBaseline = 'middle'

  for (let voltage = 0; voltage <= V_MAX; voltage++) {
    const y = yFor(voltage)
    const label = `${voltage} V`
    const labelWidth = context.measureText(label).width
    context.fillStyle = 'rgb(252 250 244 / 88%)'
    context.fillRect(2, y - 8, labelWidth + 8, 16)
    context.fillStyle = 'rgb(44 35 24 / 78%)'
    context.fillText(label, 6, y)
  }
}

export function drawTimeAxis(context, {xFor, width, height, startSecond, endSecond}) {
  const axisTop = height - TIME_AXIS_HEIGHT
  const fadePixels = 24

  context.strokeStyle = 'rgb(44 35 24 / 20%)'
  context.lineWidth = 1
  context.beginPath()
  context.moveTo(0, axisTop + 0.5)
  context.lineTo(width, axisTop + 0.5)
  context.stroke()

  context.font = '600 11px "Vazirmatn Variable", Vazirmatn, sans-serif'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.direction = 'ltr'

  for (let second = startSecond; second <= endSecond; second++) {
    if (second < 0) continue
    const x = xFor(second)
    if (x < -fadePixels || x > width + fadePixels) continue

    let alpha = 1
    if (x < fadePixels) alpha = Math.max(0, x / fadePixels)
    else if (x > width - fadePixels) alpha = Math.max(0, (width - x) / fadePixels)

    context.globalAlpha = alpha
    context.strokeStyle = 'rgb(44 35 24 / 45%)'
    context.beginPath()
    context.moveTo(x, axisTop)
    context.lineTo(x, axisTop + 4)
    context.stroke()
    context.fillStyle = 'rgb(44 35 24 / 78%)'
    context.fillText(`${second} s`, x, axisTop + 13)
  }

  context.globalAlpha = 1
}
