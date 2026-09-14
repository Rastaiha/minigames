import { json } from '../http.js';
import {
  gatewayApiKey,
  parseChatCompletion,
  resolveApiUrl,
} from '../gateway.js';
import {
  buildAlignedOpenAiMessages,
  buildBaseOpenAiMessages,
  buildSftOpenAiMessages,
  controlledAlignedResponse,
  controlledSftResponse,
  GEMINI_MODELS_CHAIN,
} from '../policy.js';

export async function handleGenerate(request, env, cors, mode = 'base') {
  const contentType = request.headers.get('Content-Type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return json({ error: 'Content-Type must be application/json.' }, 415, cors);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON.' }, 400, cors);
  }

  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt || prompt.length > 600) {
    return json(
      { error: 'Prompt must contain 1 to 600 characters.' },
      400,
      cors
    );
  }

  if (env.RATE_LIMITER) {
    const suppliedId = request.headers.get('X-Client-Id') || '';
    const clientId = /^[a-zA-Z0-9-]{10,80}$/.test(suppliedId)
      ? suppliedId
      : 'anonymous';
    const { success } = await env.RATE_LIMITER.limit({
      key: `${clientId}:${mode}`,
    });
    if (!success) return json({ error: 'Too many requests.' }, 429, cors);
  }

  if (mode === 'sft') {
    const controlled = controlledSftResponse(prompt);
    if (controlled) return json({ text: controlled }, 200, cors);
  }

  if (mode === 'aligned') {
    const controlled = controlledAlignedResponse(prompt);
    if (controlled) return json({ text: controlled }, 200, cors);
  }

  const messages =
    mode === 'base'
      ? buildBaseOpenAiMessages(prompt)
      : mode === 'sft'
        ? buildSftOpenAiMessages(prompt)
        : buildAlignedOpenAiMessages(prompt);

  const apiUrl = resolveApiUrl(env.LLM_BASE_URL);
  const apiKey = gatewayApiKey(env);

  let lastError = null;
  let lastStatus = 500;

  for (const model of GEMINI_MODELS_CHAIN) {
    try {
      const resp = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: mode === 'aligned' ? 0.55 : mode === 'sft' ? 0.8 : 0.4,
          max_tokens: mode === 'base' ? 250 : 500,
          stream: false,
        }),
        signal: AbortSignal.timeout(25000),
      });

      if (!resp.ok) {
        lastStatus = resp.status;
        const errText = await resp.text();
        console.warn(
          `Model ${model} returned HTTP ${resp.status}: ${errText.slice(0, 200)}`
        );
        lastError = errText;
        continue;
      }

      const text = parseChatCompletion(await resp.text(), {
        stripThinking: true,
      });

      if (text) {
        return json({ text, modelUsed: model }, 200, cors);
      }
    } catch (err) {
      console.warn(`Model ${model} request error:`, err);
      lastError = String(err?.message || err);
    }
  }

  return json(
    {
      error: 'All fallback models were exhausted or unavailable.',
      status: lastStatus,
      details: lastError,
    },
    502,
    cors
  );
}
