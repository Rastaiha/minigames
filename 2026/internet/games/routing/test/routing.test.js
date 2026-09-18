import test from 'node:test'
import assert from 'node:assert/strict'
import {TOPOLOGY} from '../src/topology.js'
import {AGGREGATE_TOPOLOGY} from '../aggregate/topology.js'
import {allRouteTests, lookupNextHop, matchingPrefixSpecificity, RouteOutcome, simulateRoute} from '../src/routing.js'

const completeTables = {
  A: {'net-b': 'B', 'net-c': 'C', 'net-d': 'D'},
  B: {'net-a': 'A', 'net-c': 'A', 'net-d': 'A'},
  C: {'net-a': 'A', 'net-b': 'A', 'net-d': 'D'},
  D: {'net-a': 'A', 'net-b': 'A', 'net-c': 'C'},
}

const optimalAggregateTables = {
  A: [{prefix: '*.*.*.*', nextHop: 'B'}],
  B: [
    {prefix: '10.42.*.*', nextHop: 'A'},
    {prefix: '91.*.*.*', nextHop: 'C'},
  ],
  C: [
    {prefix: '10.42.*.*', nextHop: 'B'},
    {prefix: '172.20.8.*', nextHop: 'B'},
    {prefix: '91.18.*.*', nextHop: 'D'},
    {prefix: '91.73.*.*', nextHop: 'E'},
  ],
  D: [{prefix: '*.*.*.*', nextHop: 'C'}],
  E: [{prefix: '*.*.*.*', nextHop: 'C'}],
}

test('the topology produces twelve ordered network tests', () => {
  const tests = allRouteTests(TOPOLOGY)
  assert.equal(tests.length, 12)
  assert.deepEqual(
    tests.slice(0, 4).map(({sourceId, destinationId}) => [sourceId, destinationId]),
    [
      ['net-a', 'net-b'],
      ['net-b', 'net-a'],
      ['net-a', 'net-c'],
      ['net-c', 'net-a'],
    ],
  )
})

test('router B uses the configured wildcard network', () => {
  const network = TOPOLOGY.networks.find(({router}) => router === 'B')
  assert.equal(network.label, '23.38.18.*')
})

test('a shortest-path table sends all twelve packets optimally', () => {
  for (const routeTest of allRouteTests(TOPOLOGY)) {
    const result = simulateRoute(
      TOPOLOGY,
      completeTables,
      routeTest.sourceId,
      routeTest.destinationId,
    )
    assert.equal(result.outcome, RouteOutcome.OPTIMAL, routeTest.id)
  }
})

test('a packet can arrive through a longer valid route', () => {
  const tables = structuredClone(completeTables)
  tables.A['net-c'] = 'D'
  const result = simulateRoute(TOPOLOGY, tables, 'net-a', 'net-c')
  assert.equal(result.outcome, RouteOutcome.SUBOPTIMAL)
  assert.equal(result.hopCount, 2)
  assert.equal(result.optimalHopCount, 1)
})

test('a repeated router is detected as a loop', () => {
  const tables = structuredClone(completeTables)
  tables.A['net-c'] = 'D'
  tables.D['net-c'] = 'A'
  const result = simulateRoute(TOPOLOGY, tables, 'net-a', 'net-c')
  assert.equal(result.outcome, RouteOutcome.LOOP)
  assert.deepEqual(result.routerPath, ['A', 'D', 'A'])
})

test('a blank entry stops the packet as an incomplete table', () => {
  const tables = structuredClone(completeTables)
  tables.A['net-c'] = null
  const result = simulateRoute(TOPOLOGY, tables, 'net-a', 'net-c')
  assert.equal(result.outcome, RouteOutcome.INCOMPLETE)
  assert.equal(result.stoppedAt, 'A')
})

test('the harder topology is a five-router tree with four attached networks', () => {
  assert.equal(AGGREGATE_TOPOLOGY.routers.length, 5)
  assert.equal(AGGREGATE_TOPOLOGY.networks.length, 4)
  assert.deepEqual(
    Object.fromEntries(AGGREGATE_TOPOLOGY.routers.map(({id, rowLimit}) => [id, rowLimit])),
    {A: 1, B: 2, C: 4, D: 1, E: 1},
  )
})

test('D and E can share one first-octet route at router B', () => {
  const destinations = ['net-d', 'net-e'].map((id) =>
    AGGREGATE_TOPOLOGY.networks.find((network) => network.id === id),
  )
  for (const destination of destinations) {
    assert.equal(lookupNextHop(optimalAggregateTables.B, destination), 'C')
    assert.equal(matchingPrefixSpecificity('91.*.*.*', destination.label), 1)
  }
})

test('the longest matching prefix wins regardless of table order', () => {
  const networkD = AGGREGATE_TOPOLOGY.networks.find(({id}) => id === 'net-d')
  const entries = [
    {prefix: '*.*.*.*', nextHop: 'B'},
    {prefix: '91.*.*.*', nextHop: 'C'},
    {prefix: '91.18.*.*', nextHop: 'D'},
  ]
  assert.equal(lookupNextHop(entries, networkD), 'D')
  assert.equal(lookupNextHop(entries.toReversed(), networkD), 'D')
})

test('non-contiguous wildcard patterns are not valid prefixes', () => {
  assert.equal(matchingPrefixSpecificity('91.*.18.*', '91.73.18.*'), -1)
})

test('the compact harder tables route all reports optimally', () => {
  for (const routeTest of allRouteTests(AGGREGATE_TOPOLOGY)) {
    const result = simulateRoute(
      AGGREGATE_TOPOLOGY,
      optimalAggregateTables,
      routeTest.sourceId,
      routeTest.destinationId,
    )
    assert.equal(result.outcome, RouteOutcome.OPTIMAL, routeTest.id)
  }
})
