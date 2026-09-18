import '@fontsource-variable/vazirmatn'
import { initGame } from '../shared/game.js'

initGame({
  splitting: true,
  eventPauses: true,
  showMemory: true,
  headerBits: 2,
  initialPackets: [
    { size: 64, color: 'green', location: 'PC1', availableAt: 0 },
    { size: 64, color: 'orange', location: 'PC2', availableAt: 0 },
  ],
  itemNoun: 'پیام',
  itemNounWithEzafe: 'پیامِ',
  bestKey: 'packet-split-with-overhead-best-v3',
  statusInitial: 'پیام را بزنید تا انتخاب شود؛ برای تقسیم روی آن نگه دارید.',
  statusAfterRound: 'پیام‌های آماده را انتخاب کنید یا برای تقسیم نگه دارید.',
})
