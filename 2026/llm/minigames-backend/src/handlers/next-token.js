import { json } from '../http.js';
import { gatewayApiKey, resolveApiUrl } from '../gateway.js';
import { apiRespondError, apiRespondSuccess } from '../api-response.js';

export async function handleNextToken(request, env, cors, input) {
  const prompt = input.prompt.trim();
  const apiUrl = resolveApiUrl(env.LLM_BASE_URL);
  const apiKey = gatewayApiKey(env);
  const messages = [
    {
      role: 'system',
      content:
        'برای متن ناتمام دقیقاً پنج کلمه یا عدد محتمل بعدی را پیش‌بینی کن. فقط JSON خام با ساختار [{"word":"...","prob":0}] برگردان. احتمال‌ها درصدی بین صفر و صد باشند و مجموع آن‌ها دقیقاً ۱۰۰ شود.',
    },
    { role: 'user', content: `متن ناتمام: «${prompt}»` },
  ];

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gemini/gemini-3.8-flash',
        messages,
        temperature: 0,
        max_tokens: 300,
        stream: false,
      }),
      signal: AbortSignal.timeout(60000),
    });
    if (!response.ok) return apiRespondError('مدل پاسخ موفقی نداد.', 502, cors);

    const payload = await response.json();
    const text = String(payload?.choices?.[0]?.message?.content || '');
    const match = text.match(/\[[\s\S]*\]/);
    if (!match)
      return apiRespondError('ساختار پیش‌بینی معتبر نبود.', 502, cors);

    let predictions;
    try {
      predictions = JSON.parse(match[0]);
    } catch {
      return apiRespondError('ساختار پیش‌بینی معتبر نبود.', 502, cors);
    }
    if (
      !Array.isArray(predictions) ||
      predictions.length !== 5 ||
      predictions.some(
        (item) =>
          !item ||
          typeof item.word !== 'string' ||
          !item.word.trim() ||
          !Number.isFinite(Number(item.prob)) ||
          Number(item.prob) < 0 ||
          Number(item.prob) > 100
      )
    ) {
      return apiRespondError('ساختار پیش‌بینی معتبر نبود.', 502, cors);
    }
    const normalized = predictions.map((item) => ({
      word: item.word.trim(),
      prob: Number(item.prob),
    }));
    const total = normalized.reduce((sum, item) => sum + item.prob, 0);
    if (Math.abs(total - 100) > 0.5) {
      return apiRespondError(
        'مجموع احتمال‌های پیش‌بینی معتبر نبود.',
        502,
        cors
      );
    }
    return apiRespondSuccess(
      { predictions: normalized },
      { operation: 'next-token' },
      cors
    );
  } catch (error) {
    if (error?.name === 'AbortError' || error?.name === 'TimeoutError') {
      return apiRespondError('زمان پاسخ‌گویی مدل تمام شد.', 504, cors);
    }
    console.warn('Next-token operation failed:', error?.message || error);
    return apiRespondError('ارتباط با مدل برقرار نشد.', 502, cors);
  }
}
