const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...headers }
  });
}

function allowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || "https://rastaiha.github.io")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = allowedOrigins(env);
  const local = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

  if (!allowed.includes(origin) && !local) return null;

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Client-Id",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}

function extractGeneratedText(payload, originalPrompt) {
  let value = "";

  if (Array.isArray(payload)) value = payload[0]?.generated_text || payload[0]?.text || "";
  else if (typeof payload?.generated_text === "string") value = payload.generated_text;
  else if (typeof payload?.text === "string") value = payload.text;
  else if (Array.isArray(payload?.choices)) value = payload.choices[0]?.text || "";

  value = String(value);
  if (value.startsWith(originalPrompt)) value = value.slice(originalPrompt.length);
  return value.trim();
}

async function handleGenerate(request, env, cors) {
  if (!env.HF_ENDPOINT_URL || !env.HF_TOKEN) {
    return json({ error: "Server is not configured." }, 503, cors);
  }

  const contentType = request.headers.get("Content-Type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return json({ error: "Content-Type must be application/json." }, 415, cors);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON." }, 400, cors);
  }

  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt || prompt.length > 600) {
    return json({ error: "Prompt must contain 1 to 600 characters." }, 400, cors);
  }

  if (env.RATE_LIMITER) {
    const suppliedId = request.headers.get("X-Client-Id") || "";
    const clientId = /^[a-zA-Z0-9-]{10,80}$/.test(suppliedId) ? suppliedId : "anonymous";
    const { success } = await env.RATE_LIMITER.limit({ key: clientId });
    if (!success) return json({ error: "Too many requests." }, 429, cors);
  }

  let modelResponse;
  try {
    modelResponse = await fetch(env.HF_ENDPOINT_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.HF_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: 72,
          temperature: 0.9,
          top_p: 0.92,
          top_k: 50,
          do_sample: true,
          repetition_penalty: 1.08,
          return_full_text: false
        },
        options: { wait_for_model: true }
      }),
      signal: AbortSignal.timeout(45000)
    });
  } catch {
    return json({ error: "Model endpoint is unavailable." }, 502, cors);
  }

  if (!modelResponse.ok) {
    const upstreamText = await modelResponse.text();
    console.error("Model endpoint error", modelResponse.status, upstreamText.slice(0, 500));
    return json({ error: "Model endpoint returned an error." }, 502, cors);
  }

  let payload;
  try {
    payload = await modelResponse.json();
  } catch {
    return json({ error: "Model endpoint returned invalid JSON." }, 502, cors);
  }

  const text = extractGeneratedText(payload, prompt);
  if (!text) return json({ error: "Model endpoint returned no text." }, 502, cors);
  return json({ text }, 200, cors);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);

    if (!cors) return json({ error: "Origin is not allowed." }, 403);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (url.pathname !== "/generate") return json({ error: "Not found." }, 404, cors);
    if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, cors);

    return handleGenerate(request, env, cors);
  }
};
