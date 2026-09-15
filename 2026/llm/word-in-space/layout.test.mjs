import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('./words.js', import.meta.url), 'utf8');
const context = {};
vm.runInNewContext(`${source}; this.words = words;`, context);

test('word ids and labels are stable for the v2 layout', () => {
  assert.equal(context.words.length, 12);
  assert.equal(
    new Set(context.words.map(({ id }) => id)).size,
    context.words.length
  );
  assert.ok(context.words.every(({ id, text }) => id && text));
});

test('the main game writes the documented v2 shape and vectors do not write it', async () => {
  const app = await readFile(new URL('./app.js', import.meta.url), 'utf8');
  const vectors = await readFile(
    new URL('./vectors.js', import.meta.url),
    'utf8'
  );
  assert.match(app, /vazhechin-layout-v2/);
  assert.match(app, /JSON\.stringify\(\{ positions, camera \}\)/);
  assert.doesNotMatch(vectors, /localStorage\.setItem/);
});
