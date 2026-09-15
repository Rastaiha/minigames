import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';

const root = process.cwd();
const screenshotDirectory = process.env.BROWSER_SMOKE_SCREENSHOTS;
const pages = [
  'attention/index.html',
  'contexual-embedding/index.html',
  'dimensionality-reduction/index.html',
  'hallucination/index.html',
  'jailbreak/index.html',
  'model-lab/index.html',
  'next-token-prediction2/index.html',
  'pretrained-llm/index.html',
  'pretraining-box/index.html',
  'random-llm/index.html',
  'rlhf-llm/index.html',
  'sft-llm/index.html',
  'transformer/encoder.html',
  'transformer/decoder.html',
  'word-embedding/index.html',
  'wordembedding/index.html',
  'word-in-line/index.html',
  'word-in-space/index.html',
  'word-in-space/vectors.html',
  'words-and-vectors/index.html',
  'words-world/index.html',
];
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.otf': 'font/otf',
  '.ttf': 'font/ttf',
};

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

function findChrome() {
  const candidates = [
    process.env.CHROME_BIN,
    'google-chrome',
    'chromium',
    'chromium-browser',
  ].filter(Boolean);
  return candidates.find(
    (candidate) =>
      spawnSync(candidate, ['--version'], { stdio: 'ignore' }).status === 0
  );
}

async function freePort() {
  const probe = createServer();
  await new Promise((resolveListen) =>
    probe.listen(0, '127.0.0.1', resolveListen)
  );
  const { port } = probe.address();
  await new Promise((resolveClose) => probe.close(resolveClose));
  return port;
}

const server = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(
      new URL(request.url, 'http://127.0.0.1').pathname
    );
    let filename = resolve(root, `.${pathname}`);
    if (filename !== root && !filename.startsWith(`${root}${sep}`)) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    if ((await stat(filename)).isDirectory())
      filename = join(filename, 'index.html');
    const body = await readFile(filename);
    response.writeHead(200, {
      'Content-Type':
        mimeTypes[extname(filename)] || 'application/octet-stream',
    });
    response.end(body);
  } catch {
    response.writeHead(404).end('Not found');
  }
});

const chromeBinary = findChrome();
if (!chromeBinary) throw new Error('Chrome/Chromium executable not found.');

const httpPort = await freePort();
let debugPort = await freePort();
while (debugPort === httpPort) debugPort = await freePort();
const profileDirectory = await mkdtemp(join(tmpdir(), 'llm-browser-smoke-'));
let chrome;
let socket;

try {
  if (screenshotDirectory) {
    await mkdir(screenshotDirectory, { recursive: true });
  }
  await new Promise((resolveListen) =>
    server.listen(httpPort, '127.0.0.1', resolveListen)
  );
  chrome = spawn(
    chromeBinary,
    [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--disable-background-networking',
      '--no-default-browser-check',
      '--no-first-run',
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${profileDirectory}`,
      'about:blank',
    ],
    { stdio: 'ignore' }
  );

  await delay(400);

  let targets;
  const devtoolsTargetUrl = new URL(
    `/json/list`,
    `http://127.0.0.1:${debugPort}`
  );
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      targets = await fetch(devtoolsTargetUrl).then((response) =>
        response.json()
      );
      if (targets.length) break;
    } catch {
      await delay(100);
    }
  }
  if (!targets?.length)
    throw new Error('Chrome DevTools endpoint did not start.');

  const pageTarget = targets.find((target) => target.type === 'page');
  if (!pageTarget) throw new Error('Chrome page target not found.');
  socket = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise((resolveOpen, rejectOpen) => {
    socket.addEventListener('open', resolveOpen, { once: true });
    socket.addEventListener('error', rejectOpen, { once: true });
  });

  let nextId = 1;
  let pageProblems = [];
  const pending = new Map();
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const waiter = pending.get(message.id);
      if (!waiter) return;
      pending.delete(message.id);
      if (message.error) waiter.reject(new Error(message.error.message));
      else waiter.resolve(message.result);
      return;
    }
    if (message.method === 'Runtime.exceptionThrown') {
      pageProblems.push(`runtime: ${message.params.exceptionDetails.text}`);
    }
    if (
      message.method === 'Network.responseReceived' &&
      message.params.response.status >= 400 &&
      message.params.response.url.startsWith(`http://127.0.0.1:${httpPort}`) &&
      !message.params.response.url.endsWith('/favicon.ico')
    ) {
      pageProblems.push(
        `HTTP ${message.params.response.status}: ${message.params.response.url}`
      );
    }
  });

  const send = (method, params = {}) => {
    const id = nextId;
    nextId += 1;
    socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolveMessage, rejectMessage) =>
      pending.set(id, { resolve: resolveMessage, reject: rejectMessage })
    );
  };
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      throw new Error(
        result.exceptionDetails.exception?.description ||
          result.exceptionDetails.text ||
          'Browser evaluation failed.'
      );
    }
    return result.result.value;
  };
  const navigate = async (page, width, height) => {
    pageProblems = [];
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width <= 600,
    });
    const navigation = await send('Page.navigate', {
      url: `http://127.0.0.1:${httpPort}/${page}`,
    });
    const expectedPath = `/${page}`;
    let ready = false;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      ready = await evaluate(
        `location.pathname === ${JSON.stringify(expectedPath)} && document.readyState !== 'loading'`
      );
      if (ready) break;
      await delay(100);
    }
    if (!ready) {
      throw new Error(
        `Page did not become ready: ${page}${navigation.errorText ? ` (${navigation.errorText})` : ''}`
      );
    }
    await delay(page.startsWith('dimensionality-reduction/') ? 1800 : 300);
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });

  const failures = [];
  for (const viewport of [
    { name: 'desktop', width: 1280, height: 800 },
    { name: 'mobile', width: 390, height: 844 },
  ]) {
    for (const page of pages) {
      await navigate(page, viewport.width, viewport.height);
      const metrics = await evaluate(`(() => {
        const root = document.documentElement;
        const controls = [...document.querySelectorAll('button, input:not([type="hidden"]), textarea, select, [role="button"]')]
          .filter((element) => {
            const style = getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return style.display !== 'none' && style.visibility !== 'hidden' && style.pointerEvents !== 'none' && Number(style.opacity) > 0 && rect.width > 0 && rect.height > 0 && !element.closest('[hidden], [aria-hidden="true"]');
          });
        return {
          overflow: root.scrollWidth - root.clientWidth,
          smallControls: controls
            .filter((element) => {
              const rect = element.getBoundingClientRect();
              return rect.width < 43.5 || rect.height < 43.5;
            })
            .map((element) => {
              const rect = element.getBoundingClientRect();
              return {
                tag: element.tagName,
                id: element.id,
                label: (element.textContent || element.getAttribute('aria-label') || '').trim().slice(0, 30),
                width: Math.round(rect.width),
                height: Math.round(rect.height),
              };
            }),
        };
      })()`);
      if (metrics.overflow > 1) {
        failures.push(
          `${viewport.name} ${page}: horizontal overflow ${metrics.overflow}px`
        );
      }
      if (viewport.name === 'mobile' && metrics.smallControls.length) {
        failures.push(
          `mobile ${page}: undersized controls ${JSON.stringify(metrics.smallControls)}`
        );
      }
      for (const problem of pageProblems) {
        failures.push(`${viewport.name} ${page}: ${problem}`);
      }
      if (screenshotDirectory) {
        const screenshot = await send('Page.captureScreenshot', {
          format: 'png',
          captureBeyondViewport: false,
        });
        const slug = page
          .replace(/\/index\.html$/, '')
          .replace(/\.html$/, '')
          .replaceAll('/', '__');
        await writeFile(
          join(screenshotDirectory, `${viewport.name}__${slug}.png`),
          Buffer.from(screenshot.data, 'base64')
        );
      }
    }
  }

  for (const width of [320, 390, 560]) {
    for (const page of [
      'transformer/encoder.html',
      'transformer/decoder.html',
    ]) {
      await navigate(page, width, 844);
      const overlap = await evaluate(`(() => {
        const controls = document.querySelector('.toolbar').getBoundingClientRect();
        const poem = document.querySelector('.token-strip').getBoundingClientRect();
        return Math.max(0, Math.min(controls.bottom, poem.bottom) - Math.max(controls.top, poem.top));
      })()`);
      if (overlap > 0)
        failures.push(
          `${width}px ${page}: toolbar overlaps poem by ${overlap}px`
        );
    }
  }

  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
  ]) {
    await navigate(
      'word-embedding/index.html',
      viewport.width,
      viewport.height
    );
    const hub = await evaluate(`(() => {
      const scroller = document.querySelector('#hub-view');
      const header = document.querySelector('.hub-header');
      const reset = document.querySelector('.hub-btn-reset');
      const top = header.getBoundingClientRect().top;
      scroller.scrollTop = scroller.scrollHeight;
      return { top, resetBottom: reset.getBoundingClientRect().bottom };
    })()`);
    if (hub.top < 0)
      failures.push(
        `${viewport.width}px word-embedding: header starts at ${hub.top}px`
      );
    if (hub.resetBottom > viewport.height + 1) {
      failures.push(
        `${viewport.width}px word-embedding: reset action is not reachable`
      );
    }

    await navigate(
      'contexual-embedding/index.html',
      viewport.width,
      viewport.height
    );
    const contextual = await evaluate(`(() => {
      const canvas = document.querySelector('.canvas-space').getBoundingClientRect();
      document.querySelector('.sidebar-token').focus();
      return { width: canvas.width, height: canvas.height };
    })()`);
    await send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: 'Enter',
      code: 'Enter',
    });
    await send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: 'Enter',
      code: 'Enter',
    });
    const placed = await evaluate(
      "document.querySelectorAll('.canvas-space .token').length"
    );
    if (contextual.width < viewport.width * 0.9 || contextual.height < 200) {
      failures.push(
        `${viewport.width}px contextual embedding: canvas is ${contextual.width}×${contextual.height}`
      );
    }
    if (placed !== 1)
      failures.push(
        `${viewport.width}px contextual embedding: keyboard placement failed`
      );
  }

  if (failures.length) {
    throw new Error(`Browser smoke failures:\n${failures.join('\n')}`);
  }
  console.log(`Browser smoke checks passed for ${pages.length} active pages.`);
} finally {
  socket?.close();
  if (chrome) {
    chrome.kill('SIGTERM');
    await Promise.race([
      new Promise((resolveExit) => {
        if (chrome.exitCode !== null) resolveExit();
        else chrome.once('exit', resolveExit);
      }),
      delay(2000),
    ]);
  }
  await new Promise((resolveClose) => server.close(resolveClose));
  await rm(profileDirectory, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 100,
  });
}
