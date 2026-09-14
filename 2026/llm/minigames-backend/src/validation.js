export async function readJson(request, { maxBytes = Infinity } = {}) {
  const raw = await request.text();
  if (raw.length > maxBytes) {
    return { error: 'Request is too large.', status: 413 };
  }
  try {
    return { value: JSON.parse(raw) };
  } catch {
    return { error: 'Invalid JSON.', status: 400 };
  }
}

export function validMessages(messages) {
  return (
    Array.isArray(messages) &&
    messages.length <= 40 &&
    messages.every(
      (message) =>
        message &&
        (message.role === 'user' || message.role === 'assistant') &&
        typeof message.content === 'string' &&
        message.content.trim().length > 0 &&
        message.content.length <= 6000
    )
  );
}

export function validLevel(level) {
  return [1, 2, 3].includes(Number(level));
}

export function validPrompt(prompt, maxLength = 600) {
  return (
    typeof prompt === 'string' &&
    Boolean(prompt.trim()) &&
    prompt.length <= maxLength
  );
}

export function apiRespondRateLimitKey(request, game) {
  const suppliedId = request.headers.get('X-Client-Id') || '';
  const clientId = /^[a-zA-Z0-9-]{10,80}$/.test(suppliedId)
    ? suppliedId
    : 'anonymous';
  return `${clientId}:api:${game}`;
}
