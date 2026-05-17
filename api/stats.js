// api/stats.js — 管理者用統計（ユーザー数・利用状況）
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ADMIN_SECRET = process.env.ADMIN_SECRET; // 自分だけが知る秘密キー

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Secret');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  // 管理者認証
  const secret = req.headers['x-admin-secret'];
  if (secret !== ADMIN_SECRET) {
    res.status(403).json({ error: '管理者権限が必要です' });
    return;
  }

  try {
    // Service Keyで全ユーザー情報を取得（RLSをバイパス）
    const usersRes = await fetch(`${SUPABASE_URL}/rest/v1/users?select=*&order=created_at.desc`, {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY || SUPABASE_ANON_KEY}`
      }
    });
    const users = await usersRes.json();

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekStart = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const stats = {
      total: users.length,
      today: users.filter(u => u.created_at >= todayStart).length,
      thisWeek: users.filter(u => u.created_at >= weekStart).length,
      thisMonth: users.filter(u => u.created_at >= monthStart).length,
      paid: users.filter(u => u.plan === 'paid').length,
      free: users.filter(u => u.plan === 'free').length,
      totalBooks: users.reduce((sum, u) => sum + (u.book_count || 0), 0),
      avgBooks: users.length ? (users.reduce((sum, u) => sum + (u.book_count || 0), 0) / users.length).toFixed(1) : 0,
      recentUsers: users.slice(0, 10).map(u => ({
        email: u.email?.replace(/(.{2}).*(@.*)/, '$1***$2'),
        plan: u.plan,
        books: u.book_count,
        joined: u.created_at?.slice(0, 10)
      }))
    };

    res.status(200).json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
