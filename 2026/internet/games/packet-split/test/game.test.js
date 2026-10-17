import assert from 'node:assert/strict'
import test from 'node:test'

import {completedStopwatchTime, packetWireBits} from '../shared/game.js'

test('the همه column uses the stopwatch time for a delayed message', () => {
  assert.equal(completedStopwatchTime(24, 18, 24), 24)
  assert.equal(completedStopwatchTime(null, 18, 18), null)
})

test('each split packet pays the fixed header overhead', () => {
  assert.equal(packetWireBits(64, 2), 66)
  assert.equal(packetWireBits(32, 2) * 2, 68)
})
