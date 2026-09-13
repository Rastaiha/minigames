import '@fontsource-variable/vazirmatn'
import { initGame } from '../shared/game.js'

initGame({
  splitting: false,
  blueBits: 16,
  orangeBits: 16,
  bestFromAttemptHistory: true,
  statusInitial: 'بسته را بزنید تا انتخاب شود، سپس روی «حرکت» بزنید.',
  statusAfterRound: 'بستهٔ بعدی را انتخاب کنید.',
})
