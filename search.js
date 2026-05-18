export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const q = req.query.q;
  if (!q) { res.status(400).json({ error: 'q is required' }); return; }

  try {
    // Google Books API（サーバーサイドなのでCORSなし）
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=8&printType=books&orderBy=relevance`;
    const r = await fetch(url);
    const data = await r.json();

    const books = (data.items || []).map(item => {
      const info = item.volumeInfo;
      const cover = info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || '';
      return {
        title: info.title || '',
        author: (info.authors || []).join(', '),
        cover: cover.replace('http://', 'https://'),
        publisher: info.publisher || ''
      };
    }).filter(b => b.title);

    res.status(200).json({ books });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
