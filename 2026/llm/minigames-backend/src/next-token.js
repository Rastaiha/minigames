// Probabilities come from the inference API, never from generated JSON estimates.
async function readJsonWithoutWaitingForClose(response) {
  if (!response.body) return response.json();
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
      try {
        const payload = JSON.parse(text);
        await reader.cancel();
        return payload;
      } catch {}
    }
    text += decoder.decode();
    return JSON.parse(text);
  } finally {
    reader.releaseLock();
  }
}

export async function predictNextToken(prompt, env) {
  if (!env.LLM_API_KEY || !env.TOKEN_MODEL) {
    return { status: 503, body: { error: "Token prediction is not configured." } };
  }

  try {
    const response = await fetch(env.LLM_BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.LLM_API_KEY}`
      },
      body: JSON.stringify({
        model: env.TOKEN_MODEL,
        messages: [
          { role: "system", content: "Continue the unfinished text directly. Return only its continuation, without repeating it or adding explanations." },
          { role: "user", content: prompt }
        ],
        temperature: 1,
        top_k: 5,
        max_tokens: 6,
        logprobs: true,
        top_logprobs: 5,
        stream: false
      }),
      signal: AbortSignal.timeout(25000)
    });
    if (!response.ok) {
      return { status: 502, body: { error: "Token probability provider unavailable." } };
    }
    const payload = await readJsonWithoutWaitingForClose(response);
    const content = payload?.choices?.[0]?.logprobs?.content;
    // Partial UTF-8 byte tokens cannot be faithfully appended as browser text.
    const decode = (item) => {
      if (Array.isArray(item?.bytes)) {
        if (!item.bytes.every(b => Number.isInteger(b) && b >= 0 && b <= 255)) return null;
        try { return new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(item.bytes)); }
        catch { return null; }
      }
      return typeof item?.token === "string" && !item.token.includes("\uFFFD") ? item.token : null;
    };
    if (!Array.isArray(content) || !content.length) {
      return { status: 502, body: { error: "Usable token probabilities were not returned." } };
    }

    const positions = [];
    for (const position of content) {
      const chosenToken = decode(position);
      if (!chosenToken || /^<\|.*\|>$/.test(chosenToken)) break;
      const candidates = Array.isArray(position?.top_logprobs) ? position.top_logprobs : [];
      const tokens = candidates
        .map(item => ({ token: decode(item), logprob: item.logprob }))
        .filter(item => item.token && !/^<\|.*\|>$/.test(item.token) &&
          Number.isFinite(item.logprob) && item.logprob <= 0 && item.logprob > -9999)
        .map(item => ({ token: item.token, probability: Math.exp(item.logprob) * 100 }))
        .sort((a, b) => b.probability - a.probability);
      if (!tokens.some(item => item.token === chosenToken)) break;
      positions.push({ chosenToken, tokens });
    }
    if (!positions.length) {
      return { status: 502, body: { error: "Usable token probabilities were not returned." } };
    }
    return {
      status: 200,
      body: {
        source: "logprobs",
        model: env.TOKEN_MODEL,
        positions
      }
    };
  } catch {
    return { status: 502, body: { error: "Token probability provider unavailable." } };
  }
}
