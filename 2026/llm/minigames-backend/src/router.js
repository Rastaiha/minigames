import { json, corsHeaders } from './http.js';

const METHODS = new Set([
  '/api/respond',
  '/hallucination',
  '/jailbreak',
  '/jailbreak-old',
]);

export async function routeRequest(request, env, handlers) {
  const url = new URL(request.url);
  const cors = corsHeaders(request, env);

  if (!cors) return json({ error: 'Origin is not allowed.' }, 403);
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }

  if (METHODS.has(url.pathname)) {
    if (request.method !== 'POST')
      return json({ error: 'Method not allowed.' }, 405, cors);
    return handlers[url.pathname](request, env, cors);
  }

  const modes = {
    '/generate': 'base',
    '/generate-sft': 'sft',
    '/generate-aligned': 'aligned',
  };
  const mode = modes[url.pathname];
  if (!mode) return json({ error: 'Not found.' }, 404, cors);
  if (request.method !== 'POST')
    return json({ error: 'Method not allowed.' }, 405, cors);
  return handlers.generate(request, env, cors, mode);
}
