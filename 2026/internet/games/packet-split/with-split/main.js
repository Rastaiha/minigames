import '@fontsource-variable/vazirmatn'
import { initGame } from '../shared/game.js'

initGame({
  splitting: true,
  greenBits: 16,
  orangeBits: 48,
  greenAvailableAt: 6,
  eventPauses: true,
  showMemory: true,
  itemNoun: 'پیام',
  itemNounWithEzafe: 'پیامِ',
  bestKey: 'packet-split-with-split-best-v2',
  statusInitial: 'پیام را بزنید تا انتخاب شود؛ برای تقسیم روی آن نگه دارید.',
  statusAfterRound: 'پیام‌های آماده را انتخاب کنید یا برای تقسیم نگه دارید.',
})
