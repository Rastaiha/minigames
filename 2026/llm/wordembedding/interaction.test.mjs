import assert from 'node:assert/strict';
import test from 'node:test';

function isTap(start, end, threshold = 8) {
  return Math.hypot(end.x - start.x, end.y - start.y) <= threshold;
}

test('accepts a stationary touch as a tap', () => {
  assert.equal(isTap({ x: 10, y: 10 }, { x: 15, y: 13 }), true);
});

test('rejects a touch that moved into horizontal scrolling', () => {
  assert.equal(isTap({ x: 10, y: 10 }, { x: 30, y: 11 }), false);
});
