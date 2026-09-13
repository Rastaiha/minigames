import '@fontsource-variable/vazirmatn'
import './styles.css'
import {NETWORK_COLORS, TOPOLOGY} from './topology.js'
import {allRouteTests, createTopologyIndex, RouteOutcome, simulateRoute} from './routing.js'

const SVG_NS = 'http://www.w3.org/2000/svg'
const topologyIndex = createTopologyIndex(TOPOLOGY)
const tests = allRouteTests(TOPOLOGY)
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

const tablesEl = document.querySelector('#tables')
const resultsEl = document.querySelector('#results')
const testListEl = document.querySelector('#test-list')
const summaryEl = document.querySelector('#summary')
const runAllButton = document.querySelector('#run-all')
const statusEl = document.querySelector('#run-status')
const linksLayer = document.querySelector('#network-links')
const nodesLayer = document.querySelector('#network-nodes')
const packetLayer = document.querySelector('#packet-layer')

const diagram = renderTopology()
renderTables()

let running = false
let latestResults = new Map()

runAllButton.addEventListener('click', () => runAllTests())

function renderTables() {
  const fragment = document.createDocumentFragment()
  for (const router of TOPOLOGY.routers) {
    const directNetwork = TOPOLOGY.networks.find((network) => network.router === router.id)
    const card = document.createElement('article')
    card.className = 'table-card'
    setAddressColor(card, directNetwork)
    card.style.setProperty('--table-x', `${router.table.x / 12}%`)
    card.style.setProperty('--table-y', `${router.table.y / 7.2}%`)
    card.style.setProperty('--table-w', `${router.table.width / 12}%`)
    card.style.setProperty('--table-h', `${router.table.height / 7.2}%`)
    card.innerHTML = `
      <span class="router-badge badge-${router.table.badgeSide}" role="img" aria-label="مسیریاب ${router.id}">
        <svg viewBox="0 0 72 62" aria-hidden="true">
          <path class="router-body" d="M7 20v24c0 8 13 14 29 14s29-6 29-14V20Z"></path>
          <path class="router-bottom" d="M7 43c0 8 13 14 29 14s29-6 29-14"></path>
          <ellipse class="router-top" cx="36" cy="20" rx="29" ry="14"></ellipse>
          <path class="router-arrows" d="M36 8v9m-4-4 4 4 4-4M36 32v-8m-4 4 4-4 4 4M21 20h9m-4-4 4 4-4 4M51 20h-9m4-4-4 4 4 4"></path>
          <text class="router-letter" x="36" y="48" text-anchor="middle">${router.id}</text>
        </svg>
      </span>
      <h2>جدول مسیریاب <bdi dir="ltr">${router.id}</bdi></h2>
      <table>
        <thead><tr><th>شبکهٔ مقصد</th><th>گام بعد</th></tr></thead>
        <tbody></tbody>
      </table>
    `
    const body = card.querySelector('tbody')
    for (const network of TOPOLOGY.networks) {
      const row = document.createElement('tr')
      row.className = 'network-row'
      const destinationCell = document.createElement('td')
      destinationCell.className = 'network-destination'
      const address = document.createElement('bdi')
      address.className = 'network-address'
      address.dir = 'ltr'
      address.textContent = network.label
      setAddressColor(address, network)
      destinationCell.append(address)

      const nextHopCell = document.createElement('td')
      if (network.router === router.id) {
        row.classList.add('direct-row')
        const direct = document.createElement('span')
        direct.className = 'direct-label'
        direct.textContent = 'مستقیم'
        setAddressColor(direct, network)
        nextHopCell.append(direct)
      } else {
        const select = document.createElement('select')
        select.dataset.router = router.id
        select.dataset.destination = network.id
        select.setAttribute('aria-label', `گام بعد از مسیریاب ${router.id} به شبکهٔ ${network.label}`)
        select.innerHTML = '<option value="">—</option>'
        for (const neighbor of topologyIndex.neighbors.get(router.id)) {
          const option = document.createElement('option')
          option.value = neighbor
          option.textContent = neighbor
          select.append(option)
        }
        nextHopCell.append(select)
      }

      row.append(destinationCell, nextHopCell)
      body.append(row)
    }
    fragment.append(card)
  }
  tablesEl.append(fragment)
}

function renderTopology() {
  const points = new Map()
  const lineByKey = new Map()

  for (const [leftId, rightId] of TOPOLOGY.links) {
    const left = topologyIndex.routers.get(leftId)
    const right = topologyIndex.routers.get(rightId)
    const line = svg('line', {x1: left.x, y1: left.y, x2: right.x, y2: right.y, class: 'router-link'})
    linksLayer.append(line)
    lineByKey.set(edgeKey(leftId, rightId), line)
  }

  for (const network of TOPOLOGY.networks) {
    const router = topologyIndex.routers.get(network.router)
    const path = [network, ...(network.via ?? []), router]
    const link = svg('path', {d: svgPath(path), class: 'network-link'})
    linksLayer.append(link)
    lineByKey.set(edgeKey(network.id, router.id), link)
  }

  for (const router of TOPOLOGY.routers) points.set(router.id, router)

  for (const network of TOPOLOGY.networks) {
    points.set(network.id, network)
    const group = svg('g', {class: 'network-node'})
    setAddressColor(group, network)
    group.append(
      svg('path', {
        d: 'M-62 16H53C66 16 73 6 68-5C64-14 54-17 44-13C37-31 19-39 1-35C-15-31-25-21-27-8C-43-16-61-6-62 10Z',
        class: 'network-cloud',
        transform: `translate(${network.x} ${network.y})`,
      }),
      svgText(network.x, network.y + 3, network.label, 'network-label'),
    )
    nodesLayer.append(group)
  }

  const packet = svg('g', {class: 'packet', hidden: 'true'})
  packet.append(svg('rect', {x: -9, y: -7, width: 18, height: 14, rx: 3}), svg('path', {d: 'M-6 -3 L0 1 L6 -3'}))
  packetLayer.append(packet)

  return {points, lineByKey, packet}
}

function renderTestList() {
  testListEl.replaceChildren()
  for (const test of tests) {
    const source = topologyIndex.networks.get(test.sourceId)
    const destination = topologyIndex.networks.get(test.destinationId)
    const item = document.createElement('article')
    item.className = 'test-card pending'
    item.dataset.testId = test.id
    item.innerHTML = `
      <div class="test-route">
        ${reportNetwork(source)}
        <span aria-hidden="true">→</span>
        ${reportNetwork(destination)}
      </div>
      <div class="test-outcome" aria-live="polite">—</div>
      <button class="test-run" type="button" aria-label="اجرای مسیر از ${source.label} به ${destination.label}">▶</button>
    `
    item.querySelector('button').addEventListener('click', () => runSingleTest(test))
    testListEl.append(item)
  }
}

async function runAllTests() {
  if (running) return
  latestResults = new Map()
  renderTestList()
  resultsEl.hidden = false
  updateSummary()
  setRunning(true)
  const tables = readTables()

  for (const test of tests) {
    await runTest(test, tables)
  }

  statusEl.textContent = 'اجرای همهٔ مسیرها تمام شد؛ جدول‌ها را تغییر دهید یا یک مسیر را دوباره اجرا کنید.'
  setRunning(false)
}

async function runSingleTest(test) {
  if (running) return
  setRunning(true)
  await runTest(test, readTables())
  statusEl.textContent = 'این مسیر دوباره اجرا شد؛ فقط نتیجهٔ تازه نگه داشته شده است.'
  setRunning(false)
}

async function runTest(test, tables) {
  const source = topologyIndex.networks.get(test.sourceId)
  const destination = topologyIndex.networks.get(test.destinationId)
  const card = testListEl.querySelector(`[data-test-id="${test.id}"]`)
  card.className = 'test-card running'
  card.querySelector('.test-outcome').textContent = 'در حال اجرا'
  statusEl.replaceChildren(document.createTextNode('ارسال بسته از '), addressNode(source), document.createTextNode(' به '), addressNode(destination))

  const result = simulateRoute(TOPOLOGY, tables, test.sourceId, test.destinationId)
  await animateResult(result)
  latestResults.set(test.id, result)
  showResult(card, result)
  updateSummary()
  if (!reducedMotion) await wait(90)
}

function readTables() {
  const tables = Object.fromEntries(TOPOLOGY.routers.map((router) => [router.id, {}]))
  for (const select of tablesEl.querySelectorAll('select')) {
    tables[select.dataset.router][select.dataset.destination] = select.value || null
  }
  return tables
}

function showResult(card, result) {
  const copy = resultCopy(result)
  card.className = `test-card ${result.outcome}`
  const outcome = card.querySelector('.test-outcome')
  outcome.textContent = `${copy.icon} ${copy.label}`
  outcome.setAttribute('aria-label', copy.detail)
}

function resultCopy(result) {
  if (result.outcome === RouteOutcome.OPTIMAL) {
    return {icon: '✓', label: 'بهینه', detail: `بهینه رسید؛ ${faNumber(result.hopCount)} گام`}
  }
  if (result.outcome === RouteOutcome.SUBOPTIMAL) {
    return {icon: '↗', label: 'نابهینه', detail: `نابهینه رسید؛ ${faNumber(result.hopCount)} به‌جای ${faNumber(result.optimalHopCount)} گام`}
  }
  if (result.outcome === RouteOutcome.LOOP) {
    return {icon: '↻', label: 'حلقه', detail: `در حلقه افتاد؛ ${result.routerPath.join(' ← ')}`}
  }
  return {icon: '…', label: 'ناقص', detail: `جدول ناقص است؛ توقف در ${result.stoppedAt}`}
}

function updateSummary() {
  const counts = Object.fromEntries(Object.values(RouteOutcome).map((outcome) => [outcome, 0]))
  for (const result of latestResults.values()) counts[result.outcome] += 1
  const items = [
    [RouteOutcome.OPTIMAL, '✓', 'بهینه'],
    [RouteOutcome.SUBOPTIMAL, '↗', 'نابهینه'],
    [RouteOutcome.LOOP, '↻', 'حلقه'],
    [RouteOutcome.INCOMPLETE, '…', 'ناقص'],
  ]
  summaryEl.innerHTML = items.map(([outcome, icon, label]) =>
    `<span class="summary-item ${outcome}"><b aria-hidden="true">${icon}</b>${label}: ${faNumber(counts[outcome])}</span>`,
  ).join('')
}

async function animateResult(result) {
  const nodes = [result.sourceId, ...result.routerPath]
  if (result.outcome === RouteOutcome.OPTIMAL || result.outcome === RouteOutcome.SUBOPTIMAL) {
    nodes.push(result.destinationId)
  }

  clearDiagramState()
  diagram.packet.removeAttribute('hidden')
  const start = diagram.points.get(nodes[0])
  diagram.packet.setAttribute('transform', `translate(${start.x} ${start.y})`)

  for (let i = 0; i < nodes.length - 1; i += 1) {
    const fromId = nodes[i]
    const toId = nodes[i + 1]
    const from = diagram.points.get(fromId)
    const to = diagram.points.get(toId)
    const line = diagram.lineByKey.get(edgeKey(fromId, toId))
    line?.classList.add('active-link')
    const travelPoints = pointsBetween(fromId, toId, from, to)
    for (let segment = 0; segment < travelPoints.length - 1; segment += 1) {
      const segmentStart = travelPoints[segment]
      const segmentEnd = travelPoints[segment + 1]
      const distance = Math.hypot(segmentEnd.x - segmentStart.x, segmentEnd.y - segmentStart.y)
      const animation = diagram.packet.animate(
        [
          {transform: `translate(${segmentStart.x}px, ${segmentStart.y}px)`},
          {transform: `translate(${segmentEnd.x}px, ${segmentEnd.y}px)`},
        ],
        {duration: reducedMotion ? 1 : Math.max(70, Math.min(220, distance * 0.65)), easing: 'ease-in-out'},
      )
      await animation.finished
      diagram.packet.setAttribute('transform', `translate(${segmentEnd.x} ${segmentEnd.y})`)
    }
  }

  if (!reducedMotion) await wait(80)
  diagram.packet.setAttribute('hidden', 'true')
}

function clearDiagramState() {
  for (const line of diagram.lineByKey.values()) line.classList.remove('active-link')
  diagram.packet.getAnimations().forEach((animation) => animation.cancel())
  diagram.packet.setAttribute('hidden', 'true')
}

function setRunning(value) {
  running = value
  document.body.classList.toggle('is-running', value)
  for (const control of document.querySelectorAll('button, select')) control.disabled = value
  runAllButton.innerHTML = value
    ? '<span class="spinner" aria-hidden="true"></span> در حال اجرا'
    : '<span aria-hidden="true">▶</span> اجرا'
}

function svg(name, attributes = {}) {
  const element = document.createElementNS(SVG_NS, name)
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value)
  return element
}

function svgText(x, y, text, className) {
  const element = svg('text', {x, y, class: className, 'text-anchor': 'middle', 'dominant-baseline': 'middle'})
  element.textContent = text
  return element
}

function edgeKey(left, right) {
  return [left, right].sort().join('--')
}

function pointsBetween(fromId, toId, from, to) {
  const sourceNetwork = topologyIndex.networks.get(fromId)
  if (sourceNetwork?.router === toId) {
    return [sourceNetwork, ...(sourceNetwork.via ?? []), to]
  }
  const destinationNetwork = topologyIndex.networks.get(toId)
  if (destinationNetwork?.router === fromId) {
    return [from, ...[...(destinationNetwork.via ?? [])].reverse(), destinationNetwork]
  }
  return [from, to]
}

function svgPath(points) {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`).join(' ')
}

function colorFor(network) {
  return NETWORK_COLORS[network.color]
}

function setAddressColor(element, network) {
  const color = colorFor(network)
  element.style.setProperty('--network-color', color.base)
  element.style.setProperty('--network-foreground', color.foreground)
}

function reportNetwork(network) {
  const color = colorFor(network)
  return `<bdi class="report-network network-address" dir="ltr" style="--network-color:${color.base};--network-foreground:${color.foreground}">${network.label}</bdi>`
}

function addressNode(network) {
  const node = document.createElement('bdi')
  node.className = 'network-address status-address'
  node.dir = 'ltr'
  node.textContent = network.label
  setAddressColor(node, network)
  return node
}

function faNumber(number) {
  return new Intl.NumberFormat('fa-IR').format(number)
}

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds))
}
