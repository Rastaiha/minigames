import '@fontsource-variable/vazirmatn'
import '../src/styles.css'
import './styles.css'
import {NETWORK_COLORS} from '../src/topology.js'
import {allRouteTests, createTopologyIndex, ReportVerdict, RouteOutcome, routeReportVerdict, simulateRoute} from '../src/routing.js'
import {AGGREGATE_TOPOLOGY} from './topology.js'

const SVG_NS = 'http://www.w3.org/2000/svg'
const topologyIndex = createTopologyIndex(AGGREGATE_TOPOLOGY)
const tests = allRouteTests(AGGREGATE_TOPOLOGY)
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
const overviewEl = document.querySelector('.overview-layout')
const mapScrollEl = document.querySelector('.aggregate-map-scroll')
const reportVerdictEl = document.querySelector('#report-verdict')

let running = false
let latestResults = new Map()

const diagram = renderTopology()
renderTables()

runAllButton.addEventListener('click', () => runAllTests())

function renderTables() {
  const fragment = document.createDocumentFragment()
  for (const router of AGGREGATE_TOPOLOGY.routers) {
    const directNetworks = AGGREGATE_TOPOLOGY.networks.filter((network) => network.router === router.id)
    const card = document.createElement('article')
    card.className = 'table-card aggregate-table-card'
    card.dataset.router = router.id
    setFunctionalColor(card, router.color)
    card.innerHTML = `
      <h2>
        <span class="router-symbol" aria-hidden="true">⇄</span>
        جدول مسیریاب <bdi dir="ltr">${router.id}</bdi>
      </h2>
      <table>
        <thead><tr><th>پیشوند مقصد</th><th>گام بعد</th><th><span class="sr-only">حذف</span></th></tr></thead>
        <tbody class="route-rows"></tbody>
      </table>
      <footer class="table-actions">
        <span class="row-count" aria-live="polite"></span>
        <button class="add-row" type="button"><span aria-hidden="true">＋</span> افزودن ردیف</button>
      </footer>
    `

    const body = card.querySelector('.route-rows')
    for (const network of directNetworks) body.append(createDirectRow(network))
    card.querySelector('.add-row').addEventListener('click', () => addRouteRow(card, router))
    fragment.append(card)
    updateRowControls(card, router)
  }
  tablesEl.append(fragment)
}

function createDirectRow(network) {
  const row = document.createElement('tr')
  row.className = 'direct-row'
  row.innerHTML = `
    <td><bdi class="network-address" dir="ltr">${network.label}</bdi></td>
    <td><span class="direct-label">مستقیم</span></td>
    <td aria-hidden="true">—</td>
  `
  setFunctionalColor(row.querySelector('.network-address'), network.color)
  setFunctionalColor(row.querySelector('.direct-label'), network.color)
  return row
}

function addRouteRow(card, router) {
  const body = card.querySelector('.route-rows')
  if (body.querySelectorAll('.editable-row').length >= router.rowLimit) return

  const row = document.createElement('tr')
  row.className = 'editable-row'
  row.innerHTML = `
    <td>
      <label class="prefix-field">
        <span class="prefix-swatch" aria-hidden="true"></span>
        <span class="sr-only">پیشوند مقصد در مسیریاب ${router.id}</span>
        <select class="destination-select" aria-label="پیشوند مقصد در مسیریاب ${router.id}">
          <option value="">انتخاب مقصد</option>
          ${AGGREGATE_TOPOLOGY.prefixes.map((prefix) => `<option value="${prefix.value}">${prefix.value}</option>`).join('')}
        </select>
      </label>
    </td>
    <td>
      <select class="next-hop-select" aria-label="گام بعد از مسیریاب ${router.id}">
        <option value="">—</option>
        ${topologyIndex.neighbors.get(router.id).map((neighbor) => `<option value="${neighbor}">${neighbor}</option>`).join('')}
      </select>
    </td>
    <td><button class="remove-row" type="button" aria-label="حذف این ردیف">×</button></td>
  `
  row.querySelector('.destination-select').addEventListener('change', (event) => updatePrefixSwatch(row, event.target.value))
  row.querySelector('.remove-row').addEventListener('click', () => {
    row.remove()
    updateRowControls(card, router)
    card.querySelector('.add-row').focus()
  })
  body.append(row)
  updatePrefixSwatch(row, '')
  updateRowControls(card, router)
  row.querySelector('.destination-select').focus()
}

function updatePrefixSwatch(row, prefixValue) {
  const prefix = AGGREGATE_TOPOLOGY.prefixes.find((candidate) => candidate.value === prefixValue)
  const network = prefix?.networkId ? topologyIndex.networks.get(prefix.networkId) : null
  const colorName = network?.color ?? prefix?.color ?? null
  const swatch = row.querySelector('.prefix-swatch')
  swatch.style.setProperty('--prefix-color', colorName ? NETWORK_COLORS[colorName].base : '#6B5D4A')
  swatch.classList.toggle('is-empty', !prefixValue)
}

function updateRowControls(card, router) {
  const count = card.querySelectorAll('.editable-row').length
  const addButton = card.querySelector('.add-row')
  addButton.disabled = running || count >= router.rowLimit
  addButton.title = count >= router.rowLimit ? 'همهٔ جای جدول استفاده شده است' : ''
  card.querySelector('.row-count').textContent = `${faNumber(count)} از ${faNumber(router.rowLimit)} ردیف`
}

function renderTopology() {
  const points = new Map()
  const lineByKey = new Map()

  for (const [leftId, rightId] of AGGREGATE_TOPOLOGY.links) {
    const left = topologyIndex.routers.get(leftId)
    const right = topologyIndex.routers.get(rightId)
    const line = svg('line', {x1: left.x, y1: left.y, x2: right.x, y2: right.y, class: 'router-link'})
    linksLayer.append(line)
    lineByKey.set(edgeKey(leftId, rightId), line)
  }

  for (const network of AGGREGATE_TOPOLOGY.networks) {
    const router = topologyIndex.routers.get(network.router)
    const link = svg('line', {x1: network.x, y1: network.y, x2: router.x, y2: router.y, class: 'network-link'})
    linksLayer.append(link)
    lineByKey.set(edgeKey(network.id, router.id), link)
  }

  for (const router of AGGREGATE_TOPOLOGY.routers) {
    points.set(router.id, router)
    const group = svg('g', {class: 'diagram-router', transform: `translate(${router.x} ${router.y})`})
    setFunctionalColor(group, router.color)
    group.append(
      svg('path', {d: 'M-38 -16v32c0 11 17 19 38 19s38-8 38-19v-32Z', class: 'diagram-router-body'}),
      svg('ellipse', {cx: 0, cy: -16, rx: 38, ry: 18, class: 'diagram-router-top'}),
      svgText(0, 10, router.id, 'diagram-router-label'),
    )
    nodesLayer.append(group)
  }

  for (const network of AGGREGATE_TOPOLOGY.networks) {
    points.set(network.id, network)
    const group = svg('g', {class: 'network-node'})
    setFunctionalColor(group, network.color)
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
  overviewEl.classList.add('has-results')
  updateSummary()
  setRunning(true)
  const tables = readTables()

  for (const test of tests) await runTest(test, tables)

  statusEl.textContent = 'اجرای همهٔ مسیرها تمام شد؛ ردیف‌ها را تغییر دهید یا یک مسیر را دوباره اجرا کنید.'
  setRunning(false)
}

async function runSingleTest(test) {
  if (running) return
  setRunning(true)
  await bringDiagramIntoView()
  await runTest(test, readTables())
  statusEl.textContent = 'این مسیر دوباره اجرا شد؛ فقط نتیجهٔ تازه نگه داشته شده است.'
  setRunning(false)
}

async function bringDiagramIntoView() {
  const bounds = mapScrollEl.getBoundingClientRect()
  const visibleTop = Math.max(bounds.top, 0)
  const visibleBottom = Math.min(bounds.bottom, window.innerHeight)
  const visibleHeight = Math.max(0, visibleBottom - visibleTop)
  if (visibleHeight >= Math.min(bounds.height * 0.72, 420)) return

  mapScrollEl.scrollIntoView({behavior: reducedMotion ? 'auto' : 'smooth', block: 'start'})
  if (!reducedMotion) await wait(420)
}

async function runTest(test, tables) {
  const source = topologyIndex.networks.get(test.sourceId)
  const destination = topologyIndex.networks.get(test.destinationId)
  const card = testListEl.querySelector(`[data-test-id="${test.id}"]`)
  card.className = 'test-card running'
  card.querySelector('.test-outcome').textContent = 'در حال اجرا'
  statusEl.replaceChildren(document.createTextNode('ارسال بسته از '), addressNode(source), document.createTextNode(' به '), addressNode(destination))

  const result = simulateRoute(AGGREGATE_TOPOLOGY, tables, test.sourceId, test.destinationId)
  await animateResult(result)
  latestResults.set(test.id, result)
  showResult(card, result)
  updateSummary()
  if (!reducedMotion) await wait(90)
}

function readTables() {
  return Object.fromEntries(AGGREGATE_TOPOLOGY.routers.map((router) => {
    const card = tablesEl.querySelector(`[data-router="${router.id}"]`)
    const entries = [...card.querySelectorAll('.editable-row')].map((row) => ({
      prefix: row.querySelector('.destination-select').value,
      nextHop: row.querySelector('.next-hop-select').value || null,
    }))
    return [router.id, entries]
  }))
}

function showResult(card, result) {
  const copy = resultCopy(result)
  card.className = `test-card ${result.outcome}`
  const outcome = card.querySelector('.test-outcome')
  outcome.textContent = `${copy.icon} ${copy.label}`
  outcome.setAttribute('aria-label', copy.detail)
}

function resultCopy(result) {
  if (result.outcome === RouteOutcome.OPTIMAL) return {icon: '✓', label: 'بهینه', detail: `بهینه رسید؛ ${faNumber(result.hopCount)} گام`}
  if (result.outcome === RouteOutcome.SUBOPTIMAL) return {icon: '↗', label: 'نابهینه', detail: `نابهینه رسید؛ ${faNumber(result.hopCount)} به‌جای ${faNumber(result.optimalHopCount)} گام`}
  if (result.outcome === RouteOutcome.LOOP) return {icon: '↻', label: 'حلقه', detail: `در حلقه افتاد؛ ${result.routerPath.join(' ← ')}`}
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
  updateReportVerdict()
}

function updateReportVerdict() {
  const verdict = routeReportVerdict(latestResults.values(), tests.length)
  const copy = {
    [ReportVerdict.PENDING]: ['…', 'گزارش‌ها در حال اجرا هستند؛ نتیجهٔ نهایی هنوز مشخص نیست.'],
    [ReportVerdict.ALL_OPTIMAL]: ['✓', 'همهٔ گزارش‌ها سبزند؛ همهٔ مسیرها بهینه‌اند.'],
    [ReportVerdict.NEEDS_WORK]: ['!', 'همهٔ گزارش‌ها سبز نیستند؛ دست‌کم یک مسیر ناموفق یا نابهینه است.'],
  }[verdict]
  reportVerdictEl.className = `report-verdict ${verdict}`
  reportVerdictEl.querySelector('.report-verdict-icon').textContent = copy[0]
  reportVerdictEl.querySelector('.report-verdict-copy').textContent = copy[1]
}

async function animateResult(result) {
  const nodes = [result.sourceId, ...result.routerPath]
  if (result.outcome === RouteOutcome.OPTIMAL || result.outcome === RouteOutcome.SUBOPTIMAL) nodes.push(result.destinationId)

  clearDiagramState()
  diagram.packet.removeAttribute('hidden')
  const start = diagram.points.get(nodes[0])
  diagram.packet.setAttribute('transform', `translate(${start.x} ${start.y})`)

  for (let index = 0; index < nodes.length - 1; index += 1) {
    const fromId = nodes[index]
    const toId = nodes[index + 1]
    const from = diagram.points.get(fromId)
    const to = diagram.points.get(toId)
    diagram.lineByKey.get(edgeKey(fromId, toId))?.classList.add('active-link')
    const distance = Math.hypot(to.x - from.x, to.y - from.y)
    const animation = diagram.packet.animate(
      [{transform: `translate(${from.x}px, ${from.y}px)`}, {transform: `translate(${to.x}px, ${to.y}px)`}],
      {duration: reducedMotion ? 1 : Math.max(80, Math.min(230, distance * 0.65)), easing: 'ease-in-out'},
    )
    await animation.finished
    diagram.packet.setAttribute('transform', `translate(${to.x} ${to.y})`)
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
    : '<span aria-hidden="true">▶</span> اجرای گزارش'
  if (!value) {
    for (const router of AGGREGATE_TOPOLOGY.routers) {
      updateRowControls(tablesEl.querySelector(`[data-router="${router.id}"]`), router)
    }
  }
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

function setFunctionalColor(element, colorName) {
  const color = NETWORK_COLORS[colorName]
  element.style.setProperty('--network-color', color.base)
  element.style.setProperty('--network-foreground', color.foreground)
}

function reportNetwork(network) {
  const color = NETWORK_COLORS[network.color]
  return `<bdi class="report-network network-address" dir="ltr" style="--network-color:${color.base};--network-foreground:${color.foreground}">${network.label}</bdi>`
}

function addressNode(network) {
  const node = document.createElement('bdi')
  node.className = 'network-address status-address'
  node.dir = 'ltr'
  node.textContent = network.label
  setFunctionalColor(node, network.color)
  return node
}

function faNumber(number) {
  return new Intl.NumberFormat('fa-IR').format(number)
}

function wait(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds))
}
