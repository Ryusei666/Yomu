// api/auth.js — ユーザー情報の取得・更新
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

async function supabaseFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      ...options.headers
    }
  });
  return res.json();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  // ユーザートークンを取得
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) { res.status(401).json({ error: '認証が必要です' }); return; }

  // Supabaseでユーザー情報を取得
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${token}`
    }
  });

  if (!userRes.ok) { res.status(401).json({ error: '無効なトークンです' }); return; }
  const user = await userRes.json();

  if (req.method === 'GET') {
    // ユーザー情報取得
    const data = await supabaseFetch(`/users?id=eq.${user.id}&select=*`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    res.status(200).json({ user: data[0] || null });

  } else if (req.method === 'POST') {
    // 本の記録数を更新
    const { action } = req.body;
    if (action === 'increment_book') {
      await supabaseFetch(`/users?id=eq.${user.id}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ book_count: req.body.count })
      });
      res.status(200).json({ success: true });
    }
  }
}
