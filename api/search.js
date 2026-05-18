export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const q = req.query.q;
  if (!q) { res.status(400).json({ error: 'q is required' }); return; }

  try {
    // 国立国会図書館 書誌情報API（無料・APIキー不要・日本語対応）
    const ndlUrl = `https://iss.ndl.go.jp/api/sru?operation=searchRetrieve&query=title+any+%22${encodeURIComponent(q)}%22&maximumRecords=8&recordSchema=dcndl`;
    const ndlRes = await fetch(ndlUrl);
    const xml = await ndlRes.text();

    const books = [];
    const records = xml.match(/<recordData>([\s\S]*?)<\/recordData>/g) || [];
    for (const record of records.slice(0, 8)) {
      const tm = record.match(/<dc:title[^>]*>(.*?)<\/dc:title>/);
      const am = record.match(/<dc:creator[^>]*>(.*?)<\/dc:creator>/);
      const title = tm ? tm[1].replace(/<[^>]+>/g, '').trim() : '';
      const author = am ? am[1].replace(/<[^>]+>/g, '').trim() : '';
      if (title) books.push({ title, author, cover: '', publisher: '' });
    }

    if (books.length > 0) {
      res.status(200).json({ books });
      return;
    }

    // フォールバック: Google Books API
    const gbUrl = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=8&printType=books`;
    const gbRes = await fetch(gbUrl);
    const gbData = await gbRes.json();
    const gbBooks = (gbData.items || []).map(item => {
      const info = item.volumeInfo;
      const cover = (info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || '').replace('http://', 'https://');
      return { title: info.title || '', author: (info.authors || []).join(', '), cover, publisher: info.publisher || '' };
    }).filter(b => b.title);

    res.status(200).json({ books: gbBooks });
  } catch (e) {
    res.status(500).json({ error: e.message, books: [] });
  }
}
