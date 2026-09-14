import test from 'node:test';
import assert from 'node:assert/strict';
import { softmax, trainLogits } from './logic.js';

test('softmax is deterministic and sums to one', () => {
  const probabilities = softmax([1, 0, -1]);
  assert.deepEqual(probabilities, softmax([1, 0, -1]));
  assert.ok(
    Math.abs(probabilities.reduce((sum, value) => sum + value, 0) - 1) < 1e-12
  );
});

test('training changes only the target logit', () => {
  const trained = trainLogits([1, 2, 3], 1, 0.28);
  assert.deepEqual([trained[0], trained[2]], [1, 3]);
  assert.ok(Math.abs(trained[1] - 2.28) < 1e-12);
});
