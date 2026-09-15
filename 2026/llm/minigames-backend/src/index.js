import {
  apiRespondRateLimitKey,
  validMessages,
  validPrompt,
} from './validation.js';
import { routeRequest } from './router.js';
import { handleGenerate } from './handlers/completion.js';
import { handleHallucination } from './handlers/hallucination.js';
import { handleJailbreak, handleJailbreakOld } from './handlers/jailbreak.js';
import { handleNextToken } from './handlers/next-token.js';
import { apiRespondError, apiRespondSuccess } from './api-response.js';

const API_RESPOND_GAMES = new Set([
  'completion',
  'hallucination',
  'jailbreak',
  'next-token-prediction',
]);

async function handleApiRespond(request, env, cors) {
  const contentType = request.headers.get('Content-Type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return apiRespondError('Content-Type must be application/json.', 415, cors);
  }

  let body;
  try {
    const raw = await request.text();
    if (raw.length > 40000)
      return apiRespondError('Request is too large.', 413, cors);
    body = JSON.parse(raw);
  } catch {
    return apiRespondError('Invalid JSON.', 400, cors);
  }

  const version = body?.version;
  const game = body?.game;
  const mode = body?.mode;
  const input = body?.input;
  if (
    version !== 1 ||
    !API_RESPOND_GAMES.has(game) ||
    typeof mode !== 'string'
  ) {
    return apiRespondError('Unsupported response operation.', 400, cors);
  }

  const expectedModes = {
    completion: ['base', 'sft', 'aligned'],
    hallucination: ['challenge'],
    jailbreak: ['challenge'],
    'next-token-prediction': ['predict'],
  };
  if (
    !expectedModes[game].includes(mode) ||
    !input ||
    typeof input !== 'object'
  ) {
    return apiRespondError('Invalid response operation input.', 400, cors);
  }

  if (env.RATE_LIMITER) {
    const { success } = await env.RATE_LIMITER.limit({
      key: apiRespondRateLimitKey(request, game),
    });
    if (!success) return apiRespondError('Too many requests.', 429, cors);
  }

  if (game === 'next-token-prediction') {
    if (!validPrompt(input.prompt)) {
      return apiRespondError(
        'Prompt must contain 1 to 600 characters.',
        400,
        cors
      );
    }
    return handleNextToken(request, env, cors, input);
  }

  if (game === 'completion') {
    if (!validPrompt(input.prompt)) {
      return apiRespondError(
        'Prompt must contain 1 to 600 characters.',
        400,
        cors
      );
    }
    const delegated = new Request(request, {
      body: JSON.stringify({ prompt: input.prompt }),
      headers: new Headers(request.headers),
    });
    const response = await handleGenerate(
      delegated,
      { ...env, RATE_LIMITER: undefined },
      cors,
      mode
    );
    const result = await response.json();
    if (!response.ok)
      return apiRespondError('Model request failed.', response.status, cors);
    return apiRespondSuccess({ text: result.text }, { operation: mode }, cors);
  }

  if (
    !validMessages(input.messages) ||
    ![1, 2, 3].includes(Number(input.level))
  ) {
    return apiRespondError('Invalid messages or level.', 400, cors);
  }
  const delegated = new Request(request, {
    body: JSON.stringify({
      level: Number(input.level),
      messages: input.messages,
    }),
    headers: new Headers(request.headers),
  });
  const response =
    game === 'jailbreak'
      ? await handleJailbreak(delegated, env, cors)
      : await handleHallucination(delegated, env, cors);
  const result = await response.json();
  if (!response.ok)
    return apiRespondError('Model request failed.', response.status, cors);
  return apiRespondSuccess(
    game === 'jailbreak'
      ? {
          text: result.text,
          answer: result.answer,
          checklist: result.checklist,
        }
      : { text: result.text, answer: result.answer, model: result.model },
    { operation: game },
    cors
  );
}

export default {
  async fetch(request, env) {
    return routeRequest(request, env, {
      '/api/respond': handleApiRespond,
      '/hallucination': handleHallucination,
      '/jailbreak': handleJailbreak,
      '/jailbreak-old': handleJailbreakOld,
      generate: handleGenerate,
    });
  },
};
