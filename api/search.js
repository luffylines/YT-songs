'use strict';
// Server-side proxy: the YouTube API key must never be sent to the browser.
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({error:'Method not allowed'});
  }
  const q = String(req.query?.q || '').trim();
  const sort = req.query?.sort === 'date' ? 'date' : 'relevance';
  if (!q || q.length > 100) return res.status(400).json({error:'Enter a search between 1 and 100 characters.'});
  if (!process.env.YOUTUBE_API_KEY) return res.status(503).json({error:'YouTube search needs YOUTUBE_API_KEY in Vercel environment variables.'});
  const params = new URLSearchParams({
    part:'snippet',type:'video',videoEmbeddable:'true',videoCategoryId:'10',
    maxResults:'18',q,order:sort,key:process.env.YOUTUBE_API_KEY
  });
  try {
    const upstream = await fetch('https://www.googleapis.com/youtube/v3/search?' + params, {signal:AbortSignal.timeout(9000)});
    const data = await upstream.json();
    if (!upstream.ok) {
      const reason = data?.error?.errors?.[0]?.reason;
      return res.status(upstream.status === 403 ? 429 : 502).json({
        error: reason === 'quotaExceeded' || reason === 'dailyLimitExceeded'
          ? 'YouTube API search quota reached. Please try later.'
          : 'YouTube search failed. Check the API key, enabled API, and credentials restrictions.'
      });
    }
    const items = (data.items || []).filter(v => /^[\w-]{11}$/.test(v.id?.videoId || '')).map(v => ({
      id:v.id.videoId, title:v.snippet?.title || 'Untitled',
      artist:v.snippet?.channelTitle || 'YouTube', publishedAt:v.snippet?.publishedAt || null
    }));
    res.setHeader('Cache-Control','public, s-maxage=180, stale-while-revalidate=300');
    return res.status(200).json({items});
  } catch {
    return res.status(502).json({error:'YouTube is temporarily unreachable. Please try again.'});
  }
};
