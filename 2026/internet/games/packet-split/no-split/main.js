import '@fontsource-variable/vazirmatn'
import { initGame } from '../shared/game.js'

initGame({
  splitting: false,
  blueBits: 10,
  orangeBits: 10,
  bestKey: 'packet-split-no-split-best-v1',
  statusInitial: 'بسته را بزنید تا انتخاب شود، سپس روی «حرکت» بزنید.',
  statusAfterRound: 'بستهٔ بعدی را انتخاب کنید.',
})
