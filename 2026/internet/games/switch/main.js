import '@fontsource-variable/vazirmatn'

const NS = 'http://www.w3.org/2000/svg'
const wiresG = document.getElementById('wires')
const switchBgG = document.getElementById('switchBg')
const innerWiresG = document.getElementById('innerWires')
const switchPortsG = document.getElementById('switchPorts')
const pcsG = document.getElementById('pcs')
const packetsG = document.getElementById('packets')
const interactionStatus = document.getElementById('interactionStatus')

const N = 10
const CX = 450
const CY = 350
const R_CIRCLE = 265
const R_SWITCH = 80
const R_PORT = 7
const PACKET_SPEED = 220

const PALETTE = [
  '#b82a31',
  '#e8b33a',
  '#35afb8',
  '#5669d1',
  '#3c9468',
]

const pcs = []
for (let i = 0; i < N; i += 1) {
  const angle = (i / N) * 2 * Math.PI - Math.PI / 2
  pcs.push({
    i,
    angle,
    x: CX + Math.cos(angle) * R_CIRCLE,
    y: CY + Math.sin(angle) * R_CIRCLE,
    px: CX + Math.cos(angle) * R_SWITCH,
    py: CY + Math.sin(angle) * R_SWITCH,
    connected: null,
    color: null,
    _el: null,
    _halo: null,
    _body: null,
    _screen: null,
    _label: null,
    _wire: null,
    _port: null,
  })
}

function svgElement(name, attributes = {}) {
  const element = document.createElementNS(NS, name)
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value))
  return element
}

const switchBody = svgElement('circle', {
  cx: CX,
  cy: CY,
  r: R_SWITCH,
  class: 'switch-body',
})
switchBgG.appendChild(switchBody)

const switchLabel = svgElement('text', {
  x: CX,
  y: CY,
  class: 'switch-label',
  dir: 'rtl',
})
switchLabel.textContent = 'سوئیچ'
switchBgG.appendChild(switchLabel)

pcs.forEach((pc) => {
  const wire = svgElement('line', {
    x1: pc.x,
    y1: pc.y,
    x2: pc.px,
    y2: pc.py,
    class: 'wire',
  })
  wiresG.appendChild(wire)
  pc._wire = wire
})

pcs.forEach((pc) => {
  const port = svgElement('circle', {
    cx: pc.px,
    cy: pc.py,
    r: R_PORT,
    class: 'port',
  })
  switchPortsG.appendChild(port)
  pc._port = port
})

function activatePc(index) {
  onPcClick(index)
}

function buildPc(pc, index) {
  const group = svgElement('g', {
    class: 'pc',
    transform: `translate(${pc.x}, ${pc.y})`,
    role: 'button',
    tabindex: '0',
  })

  const hitTarget = svgElement('rect', {
    x: -56,
    y: -56,
    width: 112,
    height: 112,
    fill: 'transparent',
  })
  group.appendChild(hitTarget)

  const connectionHalo = svgElement('rect', {
    x: -40,
    y: -37,
    width: 80,
    height: 74,
    class: 'connection-halo',
  })
  group.appendChild(connectionHalo)

  const selectionRing = svgElement('rect', {
    x: -42,
    y: -39,
    width: 84,
    height: 78,
    class: 'selection-ring',
  })
  group.appendChild(selectionRing)

  const focusRing = svgElement('rect', {
    x: -47,
    y: -44,
    width: 94,
    height: 88,
    class: 'focus-ring',
  })
  group.appendChild(focusRing)

  const body = svgElement('rect', {
    x: -34,
    y: -29,
    width: 68,
    height: 50,
    class: 'body',
  })
  group.appendChild(body)

  const screen = svgElement('rect', {
    x: -28,
    y: -23,
    width: 56,
    height: 36,
    class: 'screen',
  })
  group.appendChild(screen)

  const stand = svgElement('rect', {
    x: -6,
    y: 21,
    width: 12,
    height: 7,
    class: 'stand',
  })
  group.appendChild(stand)

  const base = svgElement('rect', {
    x: -18,
    y: 28,
    width: 36,
    height: 4,
    class: 'base',
  })
  group.appendChild(base)

  const label = svgElement('text', {
    x: 0,
    y: -3,
    class: 'pc-label',
  })
  label.textContent = index + 1
  group.appendChild(label)

  group.addEventListener('click', () => activatePc(index))
  group.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      activatePc(index)
    }
  })

  pcsG.appendChild(group)
  pc._el = group
  pc._halo = connectionHalo
  pc._body = body
  pc._screen = screen
  pc._label = label
}

pcs.forEach((pc, index) => buildPc(pc, index))

let pending = null
const connections = []

function pickColor() {
  const used = new Set(connections.map((connection) => connection.color))
  return PALETTE.find((color) => !used.has(color)) || PALETTE[connections.length % PALETTE.length]
}

function controlPointFor(a, b) {
  const ap = pcs[a]
  const bp = pcs[b]
  const midpointX = (ap.px + bp.px) / 2
  const midpointY = (ap.py + bp.py) / 2
  let vectorX = CX - midpointX
  let vectorY = CY - midpointY
  const vectorLength = Math.hypot(vectorX, vectorY)

  if (vectorLength < 0.001) {
    vectorX = 0
    vectorY = 0
  } else {
    vectorX /= vectorLength
    vectorY /= vectorLength
  }

  const pull = vectorLength > 0.5 ? Math.min(vectorLength * 0.9, R_SWITCH * 0.85) : 0
  return [midpointX + vectorX * pull, midpointY + vectorY * pull]
}

function connect(a, b) {
  const color = pickColor()
  const [controlX, controlY] = controlPointFor(a, b)
  const cable = svgElement('path', {
    d: `M ${pcs[a].px} ${pcs[a].py} Q ${controlX} ${controlY} ${pcs[b].px} ${pcs[b].py}`,
    class: 'inner-cable',
    stroke: color,
  })
  innerWiresG.appendChild(cable)

  const packet = svgElement('circle', {
    r: 6,
    fill: color,
    class: 'packet',
  })
  packetsG.appendChild(packet)

  connections.push({
    a,
    b,
    color,
    phase: 0,
    packet,
    cable,
    ctrl: [controlX, controlY],
  })
  pcs[a].connected = b
  pcs[a].color = color
  pcs[b].connected = a
  pcs[b].color = color
  interactionStatus.textContent = `رایانهٔ ${a + 1} و ${b + 1} به هم وصل شدند.`
}

function disconnect(index) {
  const connectionIndex = connections.findIndex(
    (connection) => connection.a === index || connection.b === index,
  )
  if (connectionIndex < 0) return

  const connection = connections[connectionIndex]
  connection.packet.remove()
  connection.cable.remove()
  connections.splice(connectionIndex, 1)
  pcs[connection.a].connected = null
  pcs[connection.a].color = null
  pcs[connection.b].connected = null
  pcs[connection.b].color = null
  interactionStatus.textContent = `ارتباط رایانهٔ ${connection.a + 1} و ${connection.b + 1} قطع شد.`
}

function clearAll() {
  while (connections.length) {
    const connection = connections.pop()
    connection.packet.remove()
    connection.cable.remove()
    pcs[connection.a].connected = null
    pcs[connection.a].color = null
    pcs[connection.b].connected = null
    pcs[connection.b].color = null
  }
  pending = null
  interactionStatus.textContent = 'همهٔ ارتباط‌ها قطع شدند؛ یک رایانه را انتخاب کن.'
  updateStyles()
}

function onPcClick(index) {
  const pc = pcs[index]
  if (pc.connected !== null) {
    disconnect(index)
    pending = null
  } else if (pending === null) {
    pending = index
    interactionStatus.textContent = `رایانهٔ ${index + 1} انتخاب شد؛ جفتش را انتخاب کن.`
  } else if (pending === index) {
    pending = null
    interactionStatus.textContent = `انتخاب رایانهٔ ${index + 1} لغو شد.`
  } else {
    connect(pending, index)
    pending = null
  }
  updateStyles()
}

function updateStyles() {
  pcs.forEach((pc) => {
    pc._el.classList.remove('pending', 'connected')
    if (pending === pc.i) pc._el.classList.add('pending')

    if (pc.connected !== null) {
      pc._el.classList.add('connected')
      pc._el.setAttribute(
        'aria-label',
        `رایانهٔ ${pc.i + 1}، متصل به رایانهٔ ${pc.connected + 1}؛ برای قطع ارتباط فعال کن`,
      )
      pc._body.style.stroke = pc.color
      pc._halo.style.fill = pc.color
      pc._halo.style.stroke = pc.color
      pc._screen.style.fill = pc.color
      pc._label.style.fill = pc.color === '#e8b33a' || pc.color === '#35afb8'
        ? 'var(--ink)'
        : 'var(--paper)'
      pc._wire.style.stroke = pc.color
      pc._wire.style.strokeWidth = 4.5
      pc._port.style.fill = pc.color
      pc._port.style.stroke = pc.color
    } else {
      const state = pending === pc.i ? '، انتخاب‌شده' : ''
      pc._el.setAttribute('aria-label', `رایانهٔ ${pc.i + 1}${state}`)
      pc._body.style.stroke = ''
      pc._halo.style.fill = ''
      pc._halo.style.stroke = ''
      pc._screen.style.fill = ''
      pc._label.style.fill = ''
      pc._wire.style.stroke = ''
      pc._wire.style.strokeWidth = ''
      pc._port.style.fill = ''
      pc._port.style.stroke = ''
    }
  })
}

function bezierSample(point0, point1, point2, count = 32) {
  const points = []
  for (let i = 0; i <= count; i += 1) {
    const t = i / count
    const u = 1 - t
    const x = u * u * point0[0] + 2 * u * t * point1[0] + t * t * point2[0]
    const y = u * u * point0[1] + 2 * u * t * point1[1] + t * t * point2[1]
    points.push([x, y])
  }
  return points
}

function pathFor(connection) {
  const a = pcs[connection.a]
  const b = pcs[connection.b]
  const inner = bezierSample([a.px, a.py], connection.ctrl, [b.px, b.py])
  return [[a.x, a.y], ...inner, [b.x, b.y]]
}

function pointAt(points, distance) {
  let accumulated = 0
  for (let i = 0; i < points.length - 1; i += 1) {
    const deltaX = points[i + 1][0] - points[i][0]
    const deltaY = points[i + 1][1] - points[i][1]
    const length = Math.hypot(deltaX, deltaY)
    if (accumulated + length >= distance) {
      const t = (distance - accumulated) / length
      return [points[i][0] + deltaX * t, points[i][1] + deltaY * t]
    }
    accumulated += length
  }
  return points.at(-1)
}

function pathLength(points) {
  let total = 0
  for (let i = 0; i < points.length - 1; i += 1) {
    total += Math.hypot(
      points[i + 1][0] - points[i][0],
      points[i + 1][1] - points[i][1],
    )
  }
  return total
}

const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
let lastFrame = performance.now()

function tick(now) {
  const deltaTime = Math.min(0.05, (now - lastFrame) / 1000)
  lastFrame = now

  connections.forEach((connection) => {
    const points = pathFor(connection)
    const total = pathLength(points)
    if (!motionQuery.matches) {
      connection.phase = (connection.phase + (PACKET_SPEED * deltaTime) / total) % 2
    }
    const progress = motionQuery.matches
      ? 0.5
      : connection.phase < 1
        ? connection.phase
        : 2 - connection.phase
    const [x, y] = pointAt(points, progress * total)
    connection.packet.setAttribute('cx', x)
    connection.packet.setAttribute('cy', y)
  })

  requestAnimationFrame(tick)
}

document.getElementById('clearBtn').addEventListener('click', clearAll)

updateStyles()
requestAnimationFrame(tick)
