import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const ignored = new Set([
  'node_modules',
  '.git',
  '.wrangler',
  'archive',
  'minigames-backend',
]);
const forbidden = [
  /api\.groq\.com/i,
  /generativelanguage\.googleapis\.com/i,
  /Authorization\s*['"`]\s*:/i,
  /(?:LLM|GROQ|GEMINI)_API_KEY/i,
  /fetch\s*\(\s*['"`]https?:\/\/(?!minigames-backend\.llmminigamesback\.workers\.dev)/i,
];

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (ignored.has(entry.name)) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await filesIn(full)));
    else if (/\.(html|js|mjs|css)$/.test(entry.name)) files.push(full);
  }
  return files;
}

const violations = [];
for (const file of await filesIn(root)) {
  const text = await readFile(file, 'utf8');
  text.split('\n').forEach((line, index) => {
    if (forbidden.some((pattern) => pattern.test(line))) {
      violations.push(`${path.relative(root, file)}:${index + 1}`);
    }
  });
}

if (violations.length) {
  console.error(`Browser API boundary violations:\n${violations.join('\n')}`);
  process.exitCode = 1;
} else {
  console.log('Browser API boundary check passed.');
}
