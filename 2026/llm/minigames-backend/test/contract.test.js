import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../src/index.js';

const ENV = {
  ALLOWED_ORIGINS: 'https://rastaiha.github.io',
  LLM_BASE_URL: 'https://gateway.test/v1/chat/completions',
};

function request(body, options = {}) {
  const headers = {
    Origin: options.origin || 'http://localhost:5173',
    'Content-Type': 'application/json',
    'X-Client-Id': 'contract-test-client',
    ...(options.headers || {}),
  };
  return new Request('https://worker.test/api/respond', {
    method: options.method || 'POST',
    headers,
    body: options.method === 'OPTIONS' ? undefined : JSON.stringify(body),
  });
}

async function read(response) {
  return response.json();
}

async function withUpstream(payload, callback, status = 200) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  try {
    return await callback();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function completionPayload(content = 'ادامه آزمایشی') {
  return { choices: [{ message: { content } }] };
}

function nextTokenPayload(content) {
  return completionPayload(JSON.stringify(content));
}

test('rejects disallowed origins before routing', async () => {
  const response = await worker.fetch(
    request(
      { version: 1, game: 'completion', mode: 'base', input: {} },
      {
        origin: 'https://evil.example',
      }
    ),
    ENV
  );

  assert.equal(response.status, 403);
  assert.deepEqual(await read(response), { error: 'Origin is not allowed.' });
});

test('handles preflight for the versioned endpoint', async () => {
  const response = await worker.fetch(request({}, { method: 'OPTIONS' }), ENV);

  assert.equal(response.status, 204);
  assert.equal(
    response.headers.get('Access-Control-Allow-Origin'),
    'http://localhost:5173'
  );
});

test('validates the versioned operation envelope', async () => {
  const response = await worker.fetch(
    request({ version: 2, game: 'completion', mode: 'base', input: {} }),
    ENV
  );

  assert.equal(response.status, 400);
  assert.equal((await read(response)).ok, false);
});

test('adapts completion requests and normalizes the response', async () => {
  const response = await withUpstream(completionPayload(), () =>
    worker.fetch(
      request({
        version: 1,
        game: 'completion',
        mode: 'base',
        input: { prompt: 'من امروز' },
      }),
      ENV
    )
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await read(response), {
    ok: true,
    data: { text: 'ادامه آزمایشی' },
    meta: { operation: 'base' },
    error: null,
  });
});

test('applies the versioned rate limit once', async () => {
  let calls = 0;
  const env = {
    ...ENV,
    RATE_LIMITER: {
      limit: async () => {
        calls += 1;
        return { success: false };
      },
    },
  };
  const response = await worker.fetch(
    request({
      version: 1,
      game: 'completion',
      mode: 'base',
      input: { prompt: 'من امروز' },
    }),
    env
  );

  assert.equal(response.status, 429);
  assert.equal(calls, 1);
  assert.equal((await read(response)).error, 'Too many requests.');
});

test('adapts jailbreak history without accepting browser model settings', async () => {
  const response = await withUpstream(completionPayload('پاسخ نگهبان'), () =>
    worker.fetch(
      request({
        version: 1,
        game: 'jailbreak',
        mode: 'challenge',
        input: {
          level: 1,
          messages: [{ role: 'user', content: 'سلام' }],
          model: 'browser-controlled-model',
          temperature: 2,
        },
      }),
      ENV
    )
  );

  assert.equal(response.status, 200);
  const body = await read(response);
  assert.equal(body.data.answer, 'پاسخ نگهبان');
  assert.equal(body.data.text, 'پاسخ نگهبان');
});

test('returns validated structured next-token predictions', async () => {
  const predictions = [
    { word: 'الف', prob: 40 },
    { word: 'ب', prob: 20 },
    { word: 'ج', prob: 15 },
    { word: 'د', prob: 15 },
    { word: 'ه', prob: 10 },
  ];
  const response = await withUpstream(nextTokenPayload(predictions), () =>
    worker.fetch(
      request({
        version: 1,
        game: 'next-token-prediction',
        mode: 'predict',
        input: { prompt: 'من امروز' },
      }),
      ENV
    )
  );

  assert.equal(response.status, 200);
  assert.deepEqual((await read(response)).data.predictions, predictions);
});

test('rejects next-token predictions whose probabilities do not sum to 100', async () => {
  const response = await withUpstream(
    nextTokenPayload([
      { word: 'الف', prob: 10 },
      { word: 'ب', prob: 10 },
      { word: 'ج', prob: 10 },
      { word: 'د', prob: 10 },
      { word: 'ه', prob: 10 },
    ]),
    () =>
      worker.fetch(
        request({
          version: 1,
          game: 'next-token-prediction',
          mode: 'predict',
          input: { prompt: 'من امروز' },
        }),
        ENV
      )
  );

  assert.equal(response.status, 502);
  assert.equal(
    (await read(response)).error,
    'مجموع احتمال‌های پیش‌بینی معتبر نبود.'
  );
});

test('redacts upstream failures behind a learner-safe error', async () => {
  const response = await withUpstream(
    { secret: 'provider diagnostic' },
    () =>
      worker.fetch(
        request({
          version: 1,
          game: 'next-token-prediction',
          mode: 'predict',
          input: { prompt: 'من امروز' },
        }),
        ENV
      ),
    500
  );

  assert.equal(response.status, 502);
  const body = await read(response);
  assert.equal(body.error, 'مدل پاسخ موفقی نداد.');
  assert.equal(JSON.stringify(body).includes('provider diagnostic'), false);
});
