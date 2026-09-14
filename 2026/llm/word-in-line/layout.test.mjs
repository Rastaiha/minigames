import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('./words.js', import.meta.url), 'utf8');
const context = {};
vm.runInNewContext(`${source}; this.words = words;`, context);

test('word ids and labels are stable for the v1 layout', () => {
  assert.equal(context.words.length, 9);
  assert.equal(new Set(context.words.map(({ id }) => id)).size, context.words.length);
  assert.ok(context.words.every(({ id, text }) => id && text));
});

test('the app keeps the documented layout key and bounded zoom', async () => {
  const app = await readFile(new URL('./app.js', import.meta.url), 'utf8');
  assert.match(app, /word-in-line-layout-v1/);
  assert.match(app, /Math\.max\(0\.25, Math\.min\(4/);
});
