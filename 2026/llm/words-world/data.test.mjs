import test from 'node:test';
import assert from 'node:assert/strict';
import { nearest, parseCSV } from './data.js';

test('parseCSV accepts quoted Persian words and ignores invalid coordinates', () => {
  const rows = parseCSV(
    'word,tsne_x,tsne_y,tsne_z\n"واژه، نمونه",1,2,3\nناقص,not-a-number,2,3\n'
  );

  assert.deepEqual(rows, [{ id: 0, word: 'واژه، نمونه', tsne: [1, 2, 3] }]);
});

test('nearest is deterministic and excludes the selected word', () => {
  const words = [
    { id: 0, word: 'مرکز', tsne: [0, 0, 0] },
    { id: 1, word: 'نزدیک', tsne: [1, 0, 0] },
    { id: 2, word: 'دور', tsne: [3, 0, 0] },
    { id: 3, word: 'هم‌فاصله', tsne: [-1, 0, 0] },
  ];

  assert.deepEqual(
    nearest(words, words[0], 3).map(({ word, distance }) => [
      word.word,
      distance,
    ]),
    [
      ['نزدیک', 1],
      ['هم‌فاصله', 1],
      ['دور', 3],
    ]
  );
});
