export const RouteOutcome = Object.freeze({
  OPTIMAL: 'optimal',
  SUBOPTIMAL: 'suboptimal',
  LOOP: 'loop',
  INCOMPLETE: 'incomplete',
})

export function createTopologyIndex(topology) {
  const routers = new Map(topology.routers.map((router) => [router.id, router]))
  const networks = new Map(topology.networks.map((network) => [network.id, network]))
  const neighbors = new Map(topology.routers.map((router) => [router.id, []]))

  for (const [left, right] of topology.links) {
    if (!routers.has(left) || !routers.has(right)) {
      throw new Error(`Unknown router in link: ${left}-${right}`)
    }
    neighbors.get(left).push(right)
    neighbors.get(right).push(left)
  }

  for (const network of topology.networks) {
    if (!routers.has(network.router)) {
      throw new Error(`Unknown router for network: ${network.id}`)
    }
  }

  for (const list of neighbors.values()) {
    list.sort()
  }

  return {routers, networks, neighbors}
}

export function allRouteTests(topology) {
  const tests = []
  for (let left = 0; left < topology.networks.length; left += 1) {
    for (let right = left + 1; right < topology.networks.length; right += 1) {
      const first = topology.networks[left]
      const second = topology.networks[right]
      tests.push(routeTest(first, second), routeTest(second, first))
    }
  }
  return tests
}

function routeTest(source, destination) {
  return {
    id: `${source.id}--${destination.id}`,
    sourceId: source.id,
    destinationId: destination.id,
  }
}

export function simulateRoute(topology, tables, sourceId, destinationId) {
  const index = createTopologyIndex(topology)
  const source = index.networks.get(sourceId)
  const destination = index.networks.get(destinationId)

  if (!source || !destination || source.id === destination.id) {
    throw new Error('Invalid source or destination network')
  }

  let current = source.router
  const routerPath = [current]
  const visited = new Set(routerPath)

  while (current !== destination.router) {
    const next = lookupNextHop(tables[current], destination)
    if (!next || !index.neighbors.get(current).includes(next)) {
      return {
        outcome: RouteOutcome.INCOMPLETE,
        sourceId,
        destinationId,
        routerPath,
        stoppedAt: current,
        hopCount: routerPath.length - 1,
        optimalHopCount: shortestHopCount(index, source.router, destination.router),
      }
    }

    routerPath.push(next)
    if (visited.has(next)) {
      return {
        outcome: RouteOutcome.LOOP,
        sourceId,
        destinationId,
        routerPath,
        stoppedAt: next,
        hopCount: routerPath.length - 1,
        optimalHopCount: shortestHopCount(index, source.router, destination.router),
      }
    }

    visited.add(next)
    current = next
  }

  const hopCount = routerPath.length - 1
  const optimalHopCount = shortestHopCount(index, source.router, destination.router)
  return {
    outcome: hopCount === optimalHopCount ? RouteOutcome.OPTIMAL : RouteOutcome.SUBOPTIMAL,
    sourceId,
    destinationId,
    routerPath,
    stoppedAt: current,
    hopCount,
    optimalHopCount,
  }
}

export function lookupNextHop(table, destination) {
  if (!Array.isArray(table)) return table?.[destination.id] ?? null

  let bestMatch = null
  let bestSpecificity = -1
  for (const entry of table) {
    const specificity = matchingPrefixSpecificity(entry.prefix, destination.label)
    if (specificity > bestSpecificity) {
      bestMatch = entry.nextHop || null
      bestSpecificity = specificity
    }
  }
  return bestMatch
}

export function matchingPrefixSpecificity(prefix, address) {
  if (!prefix || !address) return -1
  const prefixOctets = prefix.split('.')
  const addressOctets = address.split('.')
  if (prefixOctets.length !== 4 || addressOctets.length !== 4) return -1

  let specificity = 0
  let wildcardReached = false
  for (let index = 0; index < 4; index += 1) {
    if (prefixOctets[index] === '*') {
      wildcardReached = true
      continue
    }
    if (wildcardReached) return -1
    if (prefixOctets[index] !== addressOctets[index]) return -1
    specificity += 1
  }
  return specificity
}

export function shortestHopCount(index, sourceRouter, destinationRouter) {
  if (sourceRouter === destinationRouter) return 0

  const queue = [[sourceRouter, 0]]
  const visited = new Set([sourceRouter])
  while (queue.length > 0) {
    const [current, distance] = queue.shift()
    for (const next of index.neighbors.get(current)) {
      if (next === destinationRouter) return distance + 1
      if (!visited.has(next)) {
        visited.add(next)
        queue.push([next, distance + 1])
      }
    }
  }
  return Number.POSITIVE_INFINITY
}
