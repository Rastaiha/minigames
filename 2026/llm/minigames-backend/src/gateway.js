export function gatewayApiKey(env) {
  const rawKey =
    typeof env.LLM_API_KEY === 'string' ? env.LLM_API_KEY.trim() : '';
  return rawKey.length > 5 ? rawKey : '';
}

export function resolveApiUrl(rawUrl) {
  const urlStr = String(rawUrl || '').trim();
  try {
    const parsed = new URL(urlStr);
    if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(parsed.hostname)) {
      parsed.hostname = `${parsed.hostname}.sslip.io`;
      return parsed.toString();
    }
  } catch {}
  return urlStr;
}

export function parseChatCompletion(rawText, { stripThinking = false } = {}) {
  const trimmed = rawText.trim();
  let text = '';
  if (trimmed.startsWith('data:')) {
    for (const line of trimmed.split('\n')) {
      const candidate = line.trim();
      if (!candidate.startsWith('data:') || candidate === 'data: [DONE]') continue;
      try {
        const payload = JSON.parse(candidate.replace(/^data:\s*/, ''));
        text +=
          payload?.choices?.[0]?.delta?.content ||
          payload?.choices?.[0]?.text ||
          '';
      } catch {}
    }
  }
  if (!text) {
    try {
      const payload = JSON.parse(
        trimmed.replace(/data:\s*\[DONE\].*$/s, '').trim()
      );
      text = payload?.choices?.[0]?.message?.content || '';
    } catch {}
  }
  return stripThinking
    ? text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
    : text.trim();
}
