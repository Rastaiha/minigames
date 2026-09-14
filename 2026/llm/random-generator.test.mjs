import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = await readFile(
  new URL('./random-generator.js', import.meta.url),
  'utf8'
);
const context = {
  window: {},
  crypto: { getRandomValues: (value) => value.fill(7) },
};
vm.runInNewContext(source, context);
const generator = context.window.RandomPersianModel;

test('seeded generation is repeatable and bounded', () => {
  const first = generator.generatePieces(40, { seed: 1234 });
  const second = generator.generatePieces(40, { seed: 1234 });
  assert.deepEqual(first, second);
  assert.equal(first.length, 40);
  assert.ok(
    first.every(
      (piece) => piece.text.length > 0 && typeof piece.joinLeft === 'boolean'
    )
  );
});

test('seed changes the generated fixture', () => {
  assert.notDeepEqual(
    generator.generateText(24, { seed: 1 }),
    generator.generateText(24, { seed: 2 })
  );
});

test('punctuation joins to the preceding text', () => {
  const pieces = generator.generatePieces(200, { seed: 99 });
  pieces.forEach((piece, index) => {
    if ('،؛؟.'.includes(piece.text)) assert.equal(piece.joinLeft, true);
    if (index > 0 && piece.joinLeft)
      assert.notEqual(pieces[index - 1].text, undefined);
  });
});
