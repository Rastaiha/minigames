const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };

export function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...headers },
  });
}

function allowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || 'https://rastaiha.github.io')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = allowedOrigins(env);
  const local = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

  if (!allowed.includes(origin) && !local) return null;

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Client-Id',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}
