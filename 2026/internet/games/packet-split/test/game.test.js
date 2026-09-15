import assert from 'node:assert/strict'
import test from 'node:test'

import {completedStopwatchTime} from '../shared/game.js'

test('the همه column uses the stopwatch time for a delayed message', () => {
  assert.equal(completedStopwatchTime(24, 18, 24), 24)
  assert.equal(completedStopwatchTime(null, 18, 18), null)
})
