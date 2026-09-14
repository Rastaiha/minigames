import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const ignored = new Set(['node_modules', '.git', '.wrangler']);

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (ignored.has(entry.name)) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await filesIn(full)));
    else if (/\.js$/.test(entry.name)) files.push(full);
  }
  return files;
}

for (const file of await filesIn(root)) {
  execFileSync(process.execPath, ['--check', file], { stdio: 'inherit' });
}
console.log('JavaScript syntax check passed.');
