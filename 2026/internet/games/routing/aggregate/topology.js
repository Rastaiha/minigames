export const AGGREGATE_TOPOLOGY = {
  routers: [
    {id: 'A', x: 275, y: 250, color: 'crimson', rowLimit: 1},
    {id: 'B', x: 565, y: 250, color: 'gold', rowLimit: 2},
    {id: 'C', x: 805, y: 410, color: 'violet', rowLimit: 4},
    {id: 'D', x: 655, y: 610, color: 'turquoise', rowLimit: 1},
    {id: 'E', x: 1000, y: 610, color: 'green', rowLimit: 1},
  ],
  networks: [
    {id: 'net-a', label: '10.42.*.*', router: 'A', color: 'crimson', x: 80, y: 250},
    {id: 'net-b', label: '172.20.8.*', router: 'B', color: 'gold', x: 565, y: 70},
    {id: 'net-d', label: '91.18.*.*', router: 'D', color: 'turquoise', x: 490, y: 700},
    {id: 'net-e', label: '91.73.*.*', router: 'E', color: 'green', x: 1130, y: 700},
  ],
  prefixes: [
    {value: '10.42.*.*', networkId: 'net-a'},
    {value: '172.20.8.*', networkId: 'net-b'},
    {value: '91.18.*.*', networkId: 'net-d'},
    {value: '91.73.*.*', networkId: 'net-e'},
    {value: '91.*.*.*', color: 'violet'},
    {value: '*.*.*.*', color: null},
  ],
  links: [
    ['A', 'B'],
    ['B', 'C'],
    ['C', 'D'],
    ['C', 'E'],
  ],
}
