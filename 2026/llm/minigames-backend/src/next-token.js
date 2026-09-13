// Probabilities come from the inference API, never from generated JSON estimates.
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
        max_tokens: 1,
        logprobs: true,
        top_logprobs: 5,
        stream: false
      }),
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) {
      return { status: 502, body: { error: "Token probability provider unavailable." } };
    }
    const payload = await response.json();
    const position = payload?.choices?.[0]?.logprobs?.content?.[0];
    const candidates = position?.top_logprobs;
    // Partial UTF-8 byte tokens cannot be faithfully appended as browser text.
    const decode = (item) => {
      if (Array.isArray(item?.bytes)) {
        if (!item.bytes.every(b => Number.isInteger(b) && b >= 0 && b <= 255)) return null;
        try { return new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(item.bytes)); }
        catch { return null; }
      }
      return typeof item?.token === "string" && !item.token.includes("\uFFFD") ? item.token : null;
    };
    const chosenToken = decode(position);
    if (!chosenToken || !Array.isArray(candidates) || !candidates.length) {
      return { status: 502, body: { error: "Usable token probabilities were not returned." } };
    }
    const tokens = candidates.map(item => ({
      token: decode(item), logprob: item.logprob
    }));
    if (tokens.some(item => !item.token || !Number.isFinite(item.logprob) || item.logprob > 0 || item.logprob <= -9999)) {
      return { status: 502, body: { error: "Usable token probabilities were not returned." } };
    }
    return {
      status: 200,
      body: {
        source: "logprobs",
        model: env.TOKEN_MODEL,
        chosenToken,
        // Do not normalize the top five to 100%; other tokens retain probability mass.
        tokens: tokens.map(item => ({ token: item.token, probability: Math.exp(item.logprob) * 100 }))
          .sort((a, b) => b.probability - a.probability)
      }
    };
  } catch {
    return { status: 502, body: { error: "Token probability provider unavailable." } };
  }
}
