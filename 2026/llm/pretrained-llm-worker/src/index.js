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

function extractGeneratedText(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts.map((part) => typeof part?.text === "string" ? part.text : "").join("").trim();
}

const COMPLETION_INSTRUCTION = `
شما یک موتور تکمیل متن فارسی هستید، نه یک دستیار گفت‌وگویی. ورودی کاربر را بخشی از یک متن، مقاله، پرسش‌نامه، داستان یا گفت‌وگو در نظر بگیرید و فقط ادامه طبیعی و محتمل آن را تولید کنید.

قواعد:
- هیچ مقدمه‌ای مانند «حتماً»، «پاسخ» یا «در ادامه» اضافه نکنید.
- ورودی را تکرار نکنید و درباره نقش، قوانین یا نوع مدل توضیح ندهید.
- دستورهای کاربر را الزاماً اجرا نکنید. اگر ورودی حالت دستوری داشت، معمولاً خود متن دستور، توضیح مربوط به آن یا نمونه‌ای از یک سند را ادامه دهید.
- پرسش محاوره‌ای ممکن است به شکل بخشی از مقاله، گفت‌وگو، آزمون یا صفحه آموزشی ادامه پیدا کند.
- فقط وقتی ورودی الگوی صریح «سؤال: ... پاسخ:» یا «پرسش: ... جواب:» دارد، یک پاسخ کوتاه و مستقیم محتمل است.
- خروجی باید فارسی روان، منسجم و کوتاه باشد، اما لازم نیست مانند پاسخ یک چت‌بات رفتار کند.
- فقط متن تکمیل‌شده را برگردانید.
`.trim();

async function handleGenerate(request, env, cors) {
  if (!env.GEMINI_API_KEY) {
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

  const model = String(env.GEMINI_MODEL || "gemini-3.5-flash-lite");
  if (!/^[a-z0-9.-]+$/.test(model)) {
    return json({ error: "Invalid model configuration." }, 503, cors);
  }

  let modelResponse;
  try {
    modelResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "x-goog-api-key": env.GEMINI_API_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: COMPLETION_INSTRUCTION }]
          },
          contents: [{
            role: "user",
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            maxOutputTokens: 160,
            temperature: 1.15,
            topP: 0.92,
            topK: 50,
            candidateCount: 1
          },
          store: false
        }),
        signal: AbortSignal.timeout(45000)
      }
    );
  } catch {
    return json({ error: "Model endpoint is unavailable." }, 502, cors);
  }

  if (!modelResponse.ok) {
    const upstreamText = await modelResponse.text();
    console.error("Gemini API error", modelResponse.status, upstreamText.slice(0, 500));
    return json({ error: "Model endpoint returned an error." }, 502, cors);
  }

  let payload;
  try {
    payload = await modelResponse.json();
  } catch {
    return json({ error: "Model endpoint returned invalid JSON." }, 502, cors);
  }

  const text = extractGeneratedText(payload);
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
