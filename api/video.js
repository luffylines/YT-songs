'use strict';

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed.' });
  }
  const id = String(req.query?.id || '');
  if (!/^[A-Za-z0-9_-]{11}$/.test(id)) {
    return res.status(400).json({ error: 'A valid YouTube video ID is required.' });
  }
  try {
    const response = await fetch('https://www.youtube.com/oembed?format=json&url=' +
      encodeURIComponent('https://www.youtube.com/watch?v=' + id), {
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) return res.status(502).json({ error: 'YouTube details are unavailable for this video.' });
    const data = await response.json();
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json({
      title: typeof data.title === 'string' ? data.title.slice(0, 150) : '',
      artist: typeof data.author_name === 'string' ? data.author_name.slice(0, 100) : ''
    });
  } catch {
    return res.status(502).json({ error: 'Could not look up YouTube details.' });
  }
};
