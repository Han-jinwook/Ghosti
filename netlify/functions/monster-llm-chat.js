// 귀신같이 (Ghosti) — 클린몬스터 × 설정몬스터 저가 LLM AI (Gemini 2.5 Flash) 대화 & JSON 코어 위임 게이트웨이
// 1순위: 중앙 멀린허브 AI 게이트웨이 (https://os.sundreamer.app/api/ai/gemini)
// 2순위: 중앙 멀린허브 OpenAI 게이트웨이 (https://os.sundreamer.app/api/ai/openai)
// 3순위: Netlify 환경변수 폴백 (GEMINI_API_KEY / OPENAI_API_KEY)

const HUB_GEMINI_URL = process.env.HUB_AI_GATEWAY_URL || 'https://os.sundreamer.app/api/ai/gemini';
const HUB_OPENAI_URL = process.env.HUB_OPENAI_GATEWAY_URL || 'https://os.sundreamer.app/api/ai/openai';

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function reply(status, body) {
  return { statusCode: status, headers: JSON_HEADERS, body: JSON.stringify(body) };
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return reply(204, {});
  }
  if (event.httpMethod !== 'POST') {
    return reply(405, { ok: false, error: 'Method Not Allowed' });
  }

  let body = {};
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return reply(400, { ok: false, error: 'Invalid JSON body' });
  }

  const prompt = String(body.prompt || '').trim();
  if (!prompt) {
    return reply(400, { ok: false, error: 'Empty prompt' });
  }

  // 1순위: 중앙 멀린허브 Gemini 2.5 Flash 게이트웨이
  try {
    const res = await fetch(HUB_GEMINI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': 'ghosti',
        'x-ai-account': 'beakes',
      },
      body: JSON.stringify({
        appId: 'ghosti',
        account: 'beakes',
        model: 'gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
        config: { temperature: 0.4, maxOutputTokens: 1024 },
      }),
    });
    if (res.ok) {
      const data = await res.json();
      const text = String(data?.text || '').trim();
      if (text) {
        return reply(200, { ok: true, model: 'gemini-2.5-flash', text });
      }
    }
  } catch {
    // fallback to next
  }

  // 2순위: 중앙 멀린허브 OpenAI (gpt-4o-mini) 게이트웨이
  try {
    const res = await fetch(HUB_OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': 'ghosti',
        'x-ai-account': 'beakes',
      },
      body: JSON.stringify({
        appId: 'ghosti',
        account: 'beakes',
        model: 'gpt-4o-mini',
        temperature: 0.4,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (res.ok) {
      const data = await res.json();
      const text = String(data?.text || '').trim();
      if (text) {
        return reply(200, { ok: true, model: 'gpt-4o-mini', text });
      }
    }
  } catch {
    // fallback to env key
  }

  // 3순위: 직접 환경변수 GEMINI_API_KEY 폴백
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (geminiKey) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const text = String(data?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
        if (text) {
          return reply(200, { ok: true, model: 'gemini-2.5-flash-direct', text });
        }
      }
    } catch {
      // ignore
    }
  }

  return reply(502, { ok: false, error: 'LLM gateway unavailable' });
}
