import { json } from '../http.js';
import { gatewayApiKey, resolveApiUrl } from '../gateway.js';

export async function handleHallucination(request, env, cors) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON.' }, 400, cors);
  }

  const level = Number(body?.level) || 1;
  const rawMessages = Array.isArray(body?.messages) ? body.messages : [];

  let temperature = level === 2 ? 0.2 : 0.7;
  if (body?.temperature !== undefined && !isNaN(Number(body.temperature))) {
    temperature = Math.min(Math.max(Number(body.temperature), 0.05), 1.2);
  }

  const modelMessages = [];
  for (const m of rawMessages) {
    if ((m.role === 'user' || m.role === 'assistant') && m.content) {
      modelMessages.push({ role: m.role, content: String(m.content) });
    }
  }

  if (
    modelMessages.length === 0 &&
    typeof body?.prompt === 'string' &&
    body.prompt.trim()
  ) {
    modelMessages.push({ role: 'user', content: body.prompt.trim() });
  }

  const userMsgs = rawMessages
    .filter((m) => m.role === 'user')
    .map((m) => String(m.content || ''));
  const lastUserMsg =
    userMsgs[userMsgs.length - 1] ||
    (typeof body?.prompt === 'string' ? body.prompt : '');
  const asksForCoT =
    /(مرحله\s*(به\s*|‌)مرحله|گام\s*(به\s*|‌)گام|قدم\s*(به\s*|‌)قدم|روند\s*محاسبه|دلیل|با\s*توضیح|فکر\s*کن|زنجیره\s*تفکر|قدم\s*قدم|step\s*by\s*step|think\s*step|reasoning|توضیح\s*بده|تشریح|چطور\s*حساب)/i.test(
      lastUserMsg
    );

  if (level === 2) {
    if (asksForCoT) {
      modelMessages.unshift({
        role: 'system',
        content:
          'کاربر خواسته است که مرحله‌به‌مرحله و با ذکر روند محاسبه فکر کنی. گام‌های محاسبه و استدلال را به ترتیب، تمیز و کامل بنویس و در انتها جواب نهایی و صحیح را اعلام کن.',
      });
      temperature = 0.2;
    } else {
      modelMessages.unshift({
        role: 'system',
        content:
          'به درخواست کاربر مستقیماً و بدون نوشتن هرگونه راه‌حل، استدلال یا محاسبات مرحله‌به‌مرحله پاسخ بده.',
      });
      temperature = 0.1;
    }
  }

  const apiUrl = resolveApiUrl(env.LLM_BASE_URL);
  const apiKey = gatewayApiKey(env);

  const candidateModels =
    level === 2
      ? [
          'cf/@cf/meta/llama-3.3-70b-instruct-fp8-fast',
          'cf/@cf/meta/llama-3.1-70b-instruct-fp8-fast',
          'cf/@cf/mistralai/mistral-small-3.1-24b-instruct',
          'cf/@cf/meta/llama-3.1-8b-instruct-fp8-fast',
        ]
      : [
          'cf/@cf/mistralai/mistral-small-3.1-24b-instruct',
          'cf/@cf/meta/llama-3.3-70b-instruct-fp8-fast',
          'cf/@cf/meta/llama-3.1-70b-instruct-fp8-fast',
          'cf/@cf/meta/llama-3.1-8b-instruct-fp8-fast',
        ];

  let lastError = null;
  for (const model of candidateModels) {
    try {
      const upstreamResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: modelMessages,
          temperature,
          top_p: 0.98,
          max_tokens: 512,
          stream: false,
        }),
        signal: AbortSignal.timeout(45000),
      });

      if (!upstreamResponse.ok) {
        const errText = await upstreamResponse.text();
        console.warn(
          `Model ${model} returned ${upstreamResponse.status}:`,
          errText.slice(0, 200)
        );
        lastError = `Status ${upstreamResponse.status}`;
        continue;
      }

      const rawText = await upstreamResponse.text();
      let answer = '';
      const trimmed = rawText.trim();

      if (trimmed.startsWith('data:')) {
        const lines = trimmed.split('\n');
        for (const line of lines) {
          const lineTrimmed = line.trim();
          if (
            !lineTrimmed.startsWith('data:') ||
            lineTrimmed === 'data: [DONE]'
          )
            continue;
          try {
            const jsonStr = lineTrimmed.replace(/^data:\s*/, '');
            const parsed = JSON.parse(jsonStr);
            const delta =
              parsed?.choices?.[0]?.delta?.content ||
              parsed?.choices?.[0]?.text;
            if (delta) answer += delta;
          } catch {}
        }
        answer = answer.trim();
      }

      if (!answer) {
        const cleanText = trimmed.replace(/data:\s*\[DONE\].*$/s, '').trim();
        try {
          const payload = JSON.parse(cleanText);
          answer = payload?.choices?.[0]?.message?.content || '';
        } catch {
          const match = cleanText.match(/\{[\s\S]*?\}(?=\s*\{|\s*$)/);
          if (match) {
            try {
              const payload = JSON.parse(match[0]);
              answer = payload?.choices?.[0]?.message?.content || '';
            } catch {}
          }
        }
      }

      answer = answer.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

      if (answer) {
        return json({ text: answer, answer, model, temperature }, 200, cors);
      }
      lastError = 'Empty model response or unparseable JSON';
    } catch (err) {
      console.warn(`Candidate ${model} failed:`, err?.message || err);
      lastError = err?.message || String(err);
    }
  }

  return json(
    {
      error: 'All candidate models failed for hallucination.',
      details: lastError,
    },
    502,
    cors
  );
}
