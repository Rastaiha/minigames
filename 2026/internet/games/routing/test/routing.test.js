import test from 'node:test'
import assert from 'node:assert/strict'
import {TOPOLOGY} from '../src/topology.js'
import {allRouteTests, RouteOutcome, simulateRoute} from '../src/routing.js'

const completeTables = {
  A: {'net-b': 'B', 'net-c': 'C', 'net-d': 'D'},
  B: {'net-a': 'A', 'net-c': 'A', 'net-d': 'A'},
  C: {'net-a': 'A', 'net-b': 'A', 'net-d': 'D'},
  D: {'net-a': 'A', 'net-b': 'A', 'net-c': 'C'},
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
