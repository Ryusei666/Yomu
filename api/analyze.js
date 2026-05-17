// レート制限用ストア（1時間10回・1日30回）
const store = new Map();

function checkRateLimit(ip) {
  const now = Date.now();
  const hourMs = 60 * 60 * 1000;
  const dayMs = 24 * 60 * 60 * 1000;

  if (!store.has(ip)) store.set(ip, { h: [], d: [] });
  const r = store.get(ip);

  r.h = r.h.filter(t => now - t < hourMs);
  r.d = r.d.filter(t => now - t < dayMs);

  if (r.h.length >= 10) {
    const min = Math.ceil((r.h[0] + hourMs - now) / 60000);
    return { ok: false, msg: `1時間の上限（10回）に達しました。あと${min}分後にリセットされます。` };
  }
  if (r.d.length >= 30) {
    const hr = Math.ceil((r.d[0] + dayMs - now) / 3600000);
    return { ok: false, msg: `1日の上限（30回）に達しました。あと${hr}時間後にリセットされます。` };
  }

  r.h.push(now);
  r.d.push(now);
  return { ok: true, remainH: 10 - r.h.length, remainD: 30 - r.d.length };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  // IPを取得してレート制限チェック
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.headers['x-real-ip'] || 'unknown';
  const limit = checkRateLimit(ip);

  if (!limit.ok) {
    res.status(429).json({ error: limit.msg, type: 'rate_limit_error' });
    return;
  }

  res.setHeader('X-RateLimit-Remaining-Hourly', limit.remainH);
  res.setHeader('X-RateLimit-Remaining-Daily', limit.remainD);

  const { prompt, maxTokens } = req.body;

  if (!prompt) { res.status(400).json({ error: 'prompt is required' }); return; }
  if (!process.env.ANTHROPIC_API_KEY) { res.status(500).json({ error: 'ANTHROPIC_API_KEY is not set' }); return; }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: maxTokens || 1500,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    if (!response.ok) { res.status(response.status).json({ error: data.error?.message || 'API error' }); return; }
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
