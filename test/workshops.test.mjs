import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import {
  discoverWorkshops,
  repositoryRoot,
  runCommands,
  stageWorkshop,
  workshopEnvironment,
} from '../scripts/lib/workshops.mjs';
import {
  projectHomepages,
  renderReadme,
  prepareReadmePages,
  mergeReadmePages,
} from '../scripts/lib/homepages.mjs';

async function fixture(t, overrides = {}, files = {}) {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), 'minigames-infrastructure-')
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const directory = path.join(root, '2026/example');
  const manifest = {
    version: 1,
    title: 'نمونه',
    publish: { directory: 'public' },
    entries: ['index.html', 'nested/index.html'],
    ...overrides,
  };
  const contents = {
    'workshop.json': JSON.stringify(manifest),
    'public/index.html': '<title>نمونه</title>',
    'public/nested/index.html': '<script src="../asset.js"></script>',
    'public/asset.js': 'console.log("asset");',
    'private/backend.py': 'internal code',
    ...files,
  };
  for (const [filename, value] of Object.entries(contents)) {
    await fs.mkdir(path.dirname(path.join(directory, filename)), {
      recursive: true,
    });
    await fs.writeFile(path.join(directory, filename), value);
  }
  return { root, directory, manifest };
}

test('discovers local manifests without descending into workshop-owned structure', async (t) => {
  const { root, directory } = await fixture(t);
  await fs.mkdir(path.join(directory, 'anything/nested'), { recursive: true });
  await fs.writeFile(
    path.join(directory, 'anything/nested/workshop.json'),
    'invalid JSON'
  );
  await fs.mkdir(path.join(root, '2026/Unregistered scratch files'), {
    recursive: true,
  });
  const workshops = await discoverWorkshops(root);
  assert.deepEqual(
    workshops.map((workshop) => workshop.id),
    ['2026/example']
  );
});

test('rejects unsafe paths and malformed execution contracts', async (t) => {
  for (const overrides of [
    { publish: { directory: '../another-workshop' } },
    { publish: { directory: '/tmp/public' } },
    { publish: { directory: '.', include: ['../other'] } },
    { entries: ['../index.html'] },
    { entries: ['index.html', 'index.html'] },
    { entries: ['index.html?private=true'] },
    { commands: { build: 'npm run build' } },
    { commands: { build: [['node', 42]] } },
    { continueOnError: 'false' },
    { continueOnError: null },
  ]) {
    const { root } = await fixture(t, overrides);
    await assert.rejects(discoverWorkshops(root));
  }
});

test('projects default to blocking checks and can opt into CI warnings', async (t) => {
  for (const [overrides, expected] of [
    [{}, false],
    [{ continueOnError: true }, true],
    [{ continueOnError: false }, false],
  ]) {
    const { root } = await fixture(t, overrides);
    const [workshop] = await discoverWorkshops(root);
    assert.equal(workshop.continueOnError, expected);
    await assert.rejects(
      runCommands(
        {
          ...workshop,
          commands: { check: [[process.execPath, '-e', 'process.exit(7)']] },
        },
        'check'
      ),
      /failed \(7\)/
    );
  }
  const matrix = JSON.parse(
    execFileSync(process.execPath, ['scripts/workshops.mjs', 'matrix'], {
      cwd: repositoryRoot,
      encoding: 'utf8',
    })
  );
  assert.deepEqual(
    matrix.include,
    (await discoverWorkshops()).map((workshop) => ({
      id: workshop.id,
      pages: Boolean(workshop.publish),
      continueOnError: workshop.continueOnError,
    }))
  );
});

test('a server-hosted workshop can own its build and structure without publishing to Pages', async (t) => {
  const build = `require('node:fs').mkdirSync('server/artifacts', {recursive:true}); require('node:fs').writeFileSync('server/artifacts/build.txt', 'server-owned output');`;
  const { root, directory } = await fixture(t, {
    publish: null,
    entries: [],
    commands: { build: [[process.execPath, '-e', build]] },
  });
  const [workshop] = await discoverWorkshops(root);
  await runCommands(workshop, 'build');
  await stageWorkshop(workshop, root);
  assert.equal(
    await fs.readFile(
      path.join(directory, 'server/artifacts/build.txt'),
      'utf8'
    ),
    'server-owned output'
  );
  await assert.rejects(fs.access(path.join(root, '.pages')));
  assert.deepEqual(projectHomepages(await discoverWorkshops(root)), []);
});

test('stages built multi-page output while preserving sibling workshops', async (t) => {
  const { root } = await fixture(
    t,
    {},
    {
      'public/.env': 'must not publish',
      'public/.dev.vars': 'must not publish',
      'public/google-refresh-token.txt': 'must not publish',
      'public/node_modules/dep/index.js': 'must not publish',
    }
  );
  const [workshop] = await discoverWorkshops(root);
  const sibling = path.join(root, '.pages/2026/other/index.html');
  await fs.mkdir(path.dirname(sibling), { recursive: true });
  await fs.writeFile(sibling, 'unrelated workshop');
  await stageWorkshop(workshop, root);
  const output = path.join(root, '.pages/2026/example');
  assert.equal(
    await fs.readFile(path.join(output, 'asset.js'), 'utf8'),
    'console.log("asset");'
  );
  assert.equal(await fs.readFile(sibling, 'utf8'), 'unrelated workshop');
  for (const filename of [
    '.env',
    '.dev.vars',
    'google-refresh-token.txt',
    'node_modules',
    'private',
  ]) {
    await assert.rejects(fs.access(path.join(output, filename)));
  }
  assert.equal(
    await fs.readFile(path.join(output, 'nested/index.html'), 'utf8'),
    '<script src="../asset.js"></script>'
  );
});

test('a missing nested entry fails before replacing previously staged output', async (t) => {
  const { root, directory } = await fixture(t);
  const [workshop] = await discoverWorkshops(root);
  await stageWorkshop(workshop, root);
  await fs.rm(path.join(directory, 'public/nested/index.html'));
  await assert.rejects(stageWorkshop(workshop, root));
  assert.equal(
    await fs.readFile(
      path.join(root, '.pages/2026/example/nested/index.html'),
      'utf8'
    ),
    '<script src="../asset.js"></script>'
  );
});

test('rejects public symlinks and publication roots escaping the workshop', async (t) => {
  const { root, directory } = await fixture(t);
  const [workshop] = await discoverWorkshops(root);
  await fs.symlink(
    path.join(directory, 'private/backend.py'),
    path.join(directory, 'public/linked.py')
  );
  await assert.rejects(stageWorkshop(workshop, root), /symlinks/);
  await fs.symlink(root, path.join(directory, 'outside'));
  await assert.rejects(
    stageWorkshop(
      { ...workshop, publish: { directory: 'outside', include: ['.'] } },
      root
    ),
    /escapes/
  );
});

test('runs arbitrary project commands in their own cwd with the complete public prefix', async (t) => {
  const script = `require('node:fs').writeFileSync('execution.json', JSON.stringify({cwd:process.cwd(),root:process.env.WORKSHOP_ROOT,base:process.env.BASE_PATH,site:process.env.SITE_URL,publicPath:process.env.WORKSHOP_PUBLIC_PATH}));`;
  const { root, directory } = await fixture(t, {
    commands: { build: [[process.execPath, '-e', script]] },
  });
  const [workshop] = await discoverWorkshops(root);
  await runCommands(workshop, 'build', {
    ...process.env,
    PAGES_BASE_PATH: '/minigames',
    PAGES_SITE_URL: 'https://example.github.io',
  });
  assert.deepEqual(
    JSON.parse(
      await fs.readFile(path.join(directory, 'execution.json'), 'utf8')
    ),
    {
      cwd: await fs.realpath(directory),
      root: directory,
      base: '/minigames/2026/example',
      site: 'https://example.github.io',
      publicPath: '/minigames/2026/example',
    }
  );
  assert.equal(
    workshopEnvironment(workshop, { PAGES_BASE_PATH: '/' }).BASE_PATH,
    '/2026/example'
  );
  await runCommands(workshop, 'ciSetup'); // Optional hooks do not impose dependencies.
  await assert.rejects(
    runCommands(
      {
        ...workshop,
        commands: { check: [[process.execPath, '-e', 'process.exit(7)']] },
      },
      'check'
    ),
    /failed \(7\)/
  );
});

test('root directory lists only homepage URLs, without game details or source paths', async (t) => {
  const { root } = await fixture(
    t,
    {
      publish: { directory: 'not-built-yet' },
      entries: [{ path: 'index.html', title: 'عنوان | نمونه' }],
    },
    { 'private/source.html': '<title>private</title>' }
  );
  const projects = projectHomepages(await discoverWorkshops(root));
  assert.deepEqual(projects, [
    {
      id: '2026/example',
      title: 'نمونه',
      url: 'https://rastaiha.github.io/minigames/2026/example/',
    },
  ]);
  const markdown = renderReadme(projects);
  assert.match(
    markdown,
    /https:\/\/rastaiha.github.io\/minigames\/2026\/example\//
  );
  assert.doesNotMatch(markdown, /private|not-built-yet/);
});

test('homepage metadata supports external hosting and non-index HTML entries', async (t) => {
  const external = await fixture(t, {
    publish: null,
    entries: [],
    homepage: 'https://example.org/play/',
  });
  assert.equal(
    projectHomepages(await discoverWorkshops(external.root))[0].url,
    'https://example.org/play/'
  );
  const custom = await fixture(t, {
    homepage: 'myindex.html',
    entries: ['myindex.html'],
  });
  assert.equal(
    projectHomepages(await discoverWorkshops(custom.root))[0].url,
    'https://rastaiha.github.io/minigames/2026/example/myindex.html'
  );
});

test('a README-only project publishes no unrelated source files', async (t) => {
  const { root } = await fixture(
    t,
    {
      publish: {
        directory: 'public',
        include: [],
        readmeHomepage: 'README.md',
      },
      entries: [],
    },
    { 'public/README.md': '# Documentation only\n' }
  );
  const workshops = await discoverWorkshops(root);
  await stageWorkshop(workshops[0], root);
  assert.deepEqual(await fs.readdir(path.join(root, '.pages/2026/example')), [
    'README.md',
  ]);
  assert.equal(
    projectHomepages(workshops)[0].url,
    'https://rastaiha.github.io/minigames/2026/example/'
  );
});

test('README rendering is opt-in and keeps frontend files outside the Jekyll source', async (t) => {
  const markdown = '# Original README\n\nContent stays unchanged.\n';
  const { root } = await fixture(
    t,
    {
      publish: {
        directory: 'public',
        include: ['nested', 'asset.js'],
        readmeHomepage: 'description.md',
      },
      entries: ['nested/index.html'],
    },
    { 'public/description.md': markdown }
  );
  await fs.writeFile(path.join(root, 'README.md'), '# Project directory\n');
  const workshops = await discoverWorkshops(root);
  await stageWorkshop(workshops[0], root);
  assert.equal(
    await fs.readFile(path.join(root, '.pages/2026/example/README.md'), 'utf8'),
    markdown
  );
  await prepareReadmePages(workshops, root);
  const prepared = await fs.readFile(
    path.join(root, '.readme-pages/2026/example/index.md'),
    'utf8'
  );
  assert.ok(prepared.endsWith(markdown));
  await assert.rejects(
    fs.access(path.join(root, '.readme-pages/2026/example/asset.js'))
  );
  const rendered = {
    'index.html': '<h1>Directory</h1>',
    '2026/example/index.html': '<h1>Original README</h1>',
    'assets/css/style.css': 'body { color: black; }',
  };
  for (const [filename, contents] of Object.entries(rendered)) {
    await fs.mkdir(path.dirname(path.join(root, '.readme-site', filename)), {
      recursive: true,
    });
    await fs.writeFile(path.join(root, '.readme-site', filename), contents);
  }
  await mergeReadmePages(workshops, root);
  assert.equal(
    await fs.readFile(
      path.join(root, '.pages/2026/example/index.html'),
      'utf8'
    ),
    '<h1>Original README</h1>'
  );
  assert.equal(
    await fs.readFile(path.join(root, '.pages/2026/example/asset.js'), 'utf8'),
    'console.log("asset");'
  );
  await fs.writeFile(
    path.join(root, '.readme-site/2026/example/asset.js'),
    'replacement'
  );
  await assert.rejects(mergeReadmePages(workshops, root), /overwrite existing/);
  assert.equal(
    await fs.readFile(path.join(root, '.pages/2026/example/asset.js'), 'utf8'),
    'console.log("asset");'
  );
});

test('all existing LLM page URLs and browser asset bytes survive assembly', async (t) => {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), 'minigames-llm-compatibility-')
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const workshop = (await discoverWorkshops()).find(
    (item) => item.id === '2026/llm'
  );
  assert.ok(workshop);
  const preservedPaths = JSON.parse(
    await fs.readFile(
      new URL('./fixtures/llm-public-paths.json', import.meta.url),
      'utf8'
    )
  );
  const declaredPaths = new Set(workshop.entries.map((entry) => entry.path));
  for (const originalPath of preservedPaths) {
    assert.ok(
      declaredPaths.has(originalPath),
      `Existing LLM URL was removed: ${originalPath}`
    );
  }
  const tracked = execFileSync('git', ['ls-files', '2026/llm'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  })
    .trim()
    .split('\n');
  const pages = tracked.filter((filename) => filename.endsWith('.html'));
  assert.deepEqual(
    workshop.entries.map((entry) => `2026/llm/${entry.path}`).sort(),
    pages.sort()
  );
  await stageWorkshop(workshop, root);
  const browserFiles = tracked.filter(
    (filename) =>
      /\.(html|css|js|ttf|otf)$/.test(filename) &&
      !filename.startsWith('2026/llm/minigames-backend/') &&
      !filename.startsWith('2026/llm/scripts/')
  );
  for (const filename of browserFiles) {
    assert.deepEqual(
      await fs.readFile(path.join(root, '.pages', filename)),
      await fs.readFile(path.join(repositoryRoot, filename)),
      filename
    );
  }
  for (const internal of [
    'minigames-backend',
    'scripts',
    'workshop.json',
    'AGENTS.md',
    'package.json',
  ]) {
    await assert.rejects(
      fs.access(path.join(root, '.pages/2026/llm', internal))
    );
  }
});
