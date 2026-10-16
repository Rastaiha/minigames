import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
export const publicationDirectory = '.pages';

export function relativePath(value, label, allowDot = false) {
  if (allowDot && value === '.') return value;
  if (
    typeof value !== 'string' ||
    !value ||
    value.includes('\\') ||
    path.posix.isAbsolute(value) ||
    value.split('/').some((part) => !part || part === '.' || part === '..') ||
    /[\x00-\x1f:#?]/.test(value)
  )
    throw new Error(
      `${label} must be a relative path without traversal: ${value}`
    );
  return value;
}

function validateManifest(manifest, id) {
  if (
    manifest.version !== 1 ||
    typeof manifest.title !== 'string' ||
    !manifest.title.trim()
  ) {
    throw new Error(`${id}/workshop.json needs version 1 and a title`);
  }
  if (
    manifest.continueOnError !== undefined &&
    typeof manifest.continueOnError !== 'boolean'
  ) {
    throw new Error(`${id} continueOnError must be a boolean`);
  }
  const publish = manifest.publish ?? null;
  if (
    publish !== null &&
    (typeof publish !== 'object' || Array.isArray(publish))
  ) {
    throw new Error(`${id} publish must be an object or omitted`);
  }
  if (publish) relativePath(publish.directory, `${id} publish.directory`, true);
  if (publish?.readmeHomepage !== undefined) {
    relativePath(publish.readmeHomepage, `${id} publish.readmeHomepage`);
    if (!publish.readmeHomepage.endsWith('.md')) {
      throw new Error(`${id} publish.readmeHomepage must be a Markdown file`);
    }
  }
  const include = publish?.include ?? ['.'];
  if (!Array.isArray(include) || (!include.length && !publish?.readmeHomepage))
    throw new Error(`${id} needs public files`);
  include.forEach((item) => relativePath(item, `${id} publish.include`, true));
  const extensions = publish?.extensions;
  if (
    extensions !== undefined &&
    (!Array.isArray(extensions) ||
      !extensions.length ||
      extensions.some(
        (extension) =>
          typeof extension !== 'string' || !/^\.[a-z0-9]+$/i.test(extension)
      ))
  ) {
    throw new Error(
      `${id} publish.extensions must be an array of file extensions`
    );
  }
  const declaredEntries = manifest.entries ?? [];
  if (
    !Array.isArray(declaredEntries) ||
    (publish && !publish.readmeHomepage && !declaredEntries.length)
  ) {
    throw new Error(`${id} needs at least one public entry`);
  }
  if (!publish && declaredEntries.length) {
    throw new Error(`${id} cannot declare Pages entries without publish`);
  }
  const entries = declaredEntries.map((entry) => {
    if (
      typeof entry !== 'string' &&
      (!entry || typeof entry !== 'object' || Array.isArray(entry))
    ) {
      throw new Error(
        `${id} entries must be paths or objects with a path and optional title`
      );
    }
    const entryPath = typeof entry === 'string' ? entry : entry.path;
    relativePath(entryPath, `${id} entry`);
    if (!entryPath.endsWith('.html'))
      throw new Error(`${id} entry must end in .html`);
    if (
      typeof entry === 'object' &&
      entry.title !== undefined &&
      typeof entry.title !== 'string'
    ) {
      throw new Error(`${id} entry.title must be text`);
    }
    return typeof entry === 'string' ? { path: entry } : entry;
  });
  if (new Set(entries.map((entry) => entry.path)).size !== entries.length) {
    throw new Error(`${id} has duplicate entry paths`);
  }
  if (
    publish?.readmeHomepage &&
    entries.some((entry) => entry.path === 'index.html')
  ) {
    throw new Error(
      `${id} must choose either a built index.html or a README homepage`
    );
  }
  const homepage =
    manifest.homepage ??
    (publish?.readmeHomepage ||
    entries.some((entry) => entry.path === 'index.html')
      ? 'index.html'
      : null);
  if (homepage !== null) {
    if (typeof homepage !== 'string')
      throw new Error(`${id} homepage must be a path or URL`);
    if (/^https?:\/\//.test(homepage)) {
      new URL(homepage);
    } else {
      relativePath(homepage, `${id} homepage`);
      if (
        !entries.some((entry) => entry.path === homepage) &&
        !(publish?.readmeHomepage && homepage === 'index.html')
      ) {
        throw new Error(`${id} homepage must be a declared entry`);
      }
    }
  }
  const commands = manifest.commands ?? {};
  if (!commands || typeof commands !== 'object' || Array.isArray(commands)) {
    throw new Error(`${id} commands must be an object`);
  }
  for (const [name, steps] of Object.entries(commands)) {
    if (
      !Array.isArray(steps) ||
      steps.some(
        (step) =>
          !Array.isArray(step) ||
          !step.length ||
          step.some((arg) => typeof arg !== 'string') ||
          !step[0]
      )
    ) {
      throw new Error(
        `${id} command ${name} must be an array of argument arrays`
      );
    }
  }
  return {
    ...manifest,
    continueOnError: manifest.continueOnError ?? false,
    entries,
    commands,
    homepage,
    publish: publish ? { ...publish, include } : null,
  };
}

// Discovery stops at the workshop boundary; internal project layout is unrestricted.
export async function discoverWorkshops(root = repositoryRoot) {
  const workshops = [];
  for (const year of await fs.readdir(root, { withFileTypes: true })) {
    if (!year.isDirectory() || !/^\d{4}$/.test(year.name)) continue;
    for (const directory of await fs.readdir(path.join(root, year.name), {
      withFileTypes: true,
    })) {
      if (!directory.isDirectory()) continue;
      const id = `${year.name}/${directory.name}`;
      let source;
      try {
        source = await fs.readFile(
          path.join(root, id, 'workshop.json'),
          'utf8'
        );
      } catch (error) {
        if (error.code === 'ENOENT') continue;
        throw error;
      }
      if (!/^[0-9]{4}\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
        throw new Error(
          `Workshop directory must use lowercase kebab-case: ${id}`
        );
      }
      workshops.push({
        ...validateManifest(JSON.parse(source), id),
        id,
        root: path.join(root, id),
      });
    }
  }
  return workshops.sort((a, b) => a.id.localeCompare(b.id));
}

export function workshopEnvironment(workshop, environment = process.env) {
  const base = environment.PAGES_BASE_PATH ?? '/minigames';
  if (base !== '' && base !== '/' && !/^\/[a-zA-Z0-9_/-]+$/.test(base)) {
    throw new Error(
      'PAGES_BASE_PATH must be a URL path, for example /minigames'
    );
  }
  const publicPath = `${base.replace(/\/$/, '')}/${workshop.id}`;
  return {
    ...environment,
    WORKSHOP_ROOT: workshop.root,
    WORKSHOP_PUBLIC_PATH: publicPath,
    BASE_PATH: publicPath,
    SITE_URL: environment.PAGES_SITE_URL ?? 'https://rastaiha.github.io',
  };
}

export async function runCommands(workshop, name, environment = process.env) {
  for (const [executable, ...args] of workshop.commands[name] ?? []) {
    console.log(`[${workshop.id}] ${name}: ${[executable, ...args].join(' ')}`);
    await new Promise((resolve, reject) => {
      const command =
        process.platform === 'win32' && /^(npm|npx)$/.test(executable)
          ? `${executable}.cmd`
          : executable;
      const child = spawn(command, args, {
        cwd: workshop.root,
        env: workshopEnvironment(workshop, environment),
        stdio: 'inherit',
      });
      child.on('error', reject);
      child.on('exit', (code, signal) =>
        code === 0
          ? resolve()
          : reject(
              new Error(`[${workshop.id}] ${name} failed (${signal ?? code})`)
            )
      );
    });
  }
}

function forbiddenPublicationPath(relative) {
  return relative
    .split('/')
    .some(
      (part) =>
        [
          '.git',
          '.github',
          '.wrangler',
          'node_modules',
          'google-oauth-client.json',
          'google-refresh-token.txt',
        ].includes(part) ||
        part === '.env' ||
        part.startsWith('.env.') ||
        part === '.dev.vars' ||
        part.startsWith('.dev.vars.')
    );
}

async function assertInside(directory, filename) {
  const relative = path.relative(
    await fs.realpath(directory),
    await fs.realpath(filename)
  );
  if (
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new Error(`Public source escapes its workshop: ${filename}`);
  }
}

export async function verifyWorkshop(workshop, output) {
  for (const entry of workshop.entries) {
    const filename = path.join(output, entry.path);
    if (!(await fs.stat(filename)).isFile())
      throw new Error(`Missing public entry: ${filename}`);
  }
  if (workshop.publish?.readmeHomepage) {
    await fs.access(path.join(output, 'README.md'));
  }
}

export async function stageWorkshop(workshop, root = repositoryRoot) {
  if (!workshop.publish) return;
  const source = path.join(workshop.root, workshop.publish.directory);
  await assertInside(workshop.root, source);
  const assembly = path.join(root, publicationDirectory);
  await fs.mkdir(assembly, { recursive: true });
  const temporary = await fs.mkdtemp(path.join(assembly, '.staging-'));
  const extensions = workshop.publish.extensions;
  const copied = new Set();
  async function copy(relative) {
    if (forbiddenPublicationPath(relative)) return;
    const filename = path.join(source, relative);
    const stat = await fs.lstat(filename);
    if (stat.isSymbolicLink())
      throw new Error(`Public output must not contain symlinks: ${filename}`);
    if (stat.isDirectory()) {
      for (const child of await fs.readdir(filename)) {
        await copy(relative === '.' ? child : `${relative}/${child}`);
      }
    } else if (
      stat.isFile() &&
      (!extensions || extensions.includes(path.extname(filename)))
    ) {
      if (copied.has(relative))
        throw new Error(`Overlapping public includes: ${relative}`);
      copied.add(relative);
      const destination = path.join(temporary, relative);
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.copyFile(filename, destination);
    }
  }
  try {
    for (const include of workshop.publish.include) {
      await assertInside(source, path.join(source, include));
      await copy(include);
    }
    if (workshop.publish.readmeHomepage) {
      const readme = path.join(source, workshop.publish.readmeHomepage);
      await assertInside(source, readme);
      if ((await fs.lstat(readme)).isSymbolicLink())
        throw new Error('README homepage must not be a symlink');
      await fs.copyFile(readme, path.join(temporary, 'README.md'));
      copied.add('README.md');
    }
    await verifyWorkshop(workshop, temporary);
    const destination = path.join(assembly, workshop.id);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.rm(destination, { recursive: true, force: true });
    await fs.rename(temporary, destination);
    console.log(`[${workshop.id}] Staged ${copied.size} public files.`);
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
}
