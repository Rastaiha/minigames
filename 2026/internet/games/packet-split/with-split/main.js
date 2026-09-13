import '@fontsource-variable/vazirmatn'
import { initGame } from '../shared/game.js'

initGame({
  splitting: true,
  blueBits: 8,
  orangeBits: 6,
  bestKey: 'packet-split-with-split-best-v1',
  statusInitial: 'بسته را بزنید تا انتخاب شود؛ برای تقسیم روی آن نگه دارید.',
  statusAfterRound: 'بسته را انتخاب کنید یا برای تقسیمش نگه دارید.',
})
