// Change this object to replace the topology, network labels, or layout.
// Router links are undirected. Each network is attached to exactly one router.
export const TOPOLOGY = {
  routers: [
    {id: 'A', x: 600, y: 255, table: {x: 455, y: 50, width: 290, height: 170, badgeSide: 'bottom'}},
    {id: 'B', x: 477, y: 360, table: {x: 140, y: 275, width: 290, height: 170, badgeSide: 'right'}},
    {id: 'C', x: 723, y: 360, table: {x: 770, y: 275, width: 290, height: 170, badgeSide: 'left'}},
    {id: 'D', x: 600, y: 465, table: {x: 455, y: 500, width: 290, height: 170, badgeSide: 'top'}},
  ],
  networks: [
    {
      id: 'net-a', label: '216.239.*.*', router: 'A', color: 'crimson', x: 890, y: 72,
      via: [{x: 800, y: 72}, {x: 800, y: 255}],
    },
    {
      id: 'net-b', label: '23.38.18.*', router: 'B', color: 'gold', x: 70, y: 360,
      via: [{x: 70, y: 245}, {x: 445, y: 245}],
    },
    {
      id: 'net-c', label: '3.160.150.*', router: 'C', color: 'turquoise', x: 1130, y: 360,
      via: [{x: 1130, y: 465}, {x: 755, y: 465}],
    },
    {
      id: 'net-d', label: '2.16.190.*', router: 'D', color: 'green', x: 330, y: 648,
      via: [{x: 400, y: 648}, {x: 400, y: 465}],
    },
  ],
  links: [
    ['B', 'A'],
    ['A', 'C'],
    ['A', 'D'],
    ['D', 'C'],
  ],
}

export const NETWORK_COLORS = {
  crimson: {base: '#B82A31', foreground: '#FFFFFF'},
  gold: {base: '#E8B33A', foreground: '#2C2318'},
  turquoise: {base: '#35AFB8', foreground: '#2C2318'},
  green: {base: '#185A3A', foreground: '#FFFFFF'},
  violet: {base: '#7A4E9D', foreground: '#FFFFFF'},
}
