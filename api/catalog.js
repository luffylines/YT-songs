'use strict';
// Jamendo discovery is for non-commercial use under Jamendo's API Terms.
// Do not cache provider audio, offer offline access, or omit artist/provider credit.
const PAGE_SIZE=40;
const GENRES=new Set(['pop','rock','electronic','jazz','classical','hiphop','ambient','lofi','acoustic','metal','folk']);
const validJamendoUrl=value=>{
  if(typeof value!=='string')return '';
  try{const u=new URL(value);return u.protocol==='https:'&&(u.hostname==='jamendo.com'||u.hostname.endsWith('.jamendo.com'))?u.href:'';}catch{return '';}
};
const safeText=(v,n=180)=>typeof v==='string'?v.slice(0,n):'';
const num=(v)=>Number.isFinite(Number(v))?Number(v):0;
function track(row){
  if(!row||!/^\d+$/.test(String(row.id))||!validJamendoUrl(row.audio))return null;
  return {
    id:'jm-'+String(row.id),
    title:safeText(row.name)||'Untitled',
    artist:safeText(row.artist_name)||'Independent artist',
    album:safeText(row.album_name),
    image:validJamendoUrl(row.image)||validJamendoUrl(row.album_image),
    audio:validJamendoUrl(row.audio),
    duration:Math.max(0,Math.floor(num(row.duration))),
    released:safeText(row.releasedate,10),
    sourceUrl:validJamendoUrl(row.shareurl)||'https://www.jamendo.com/track/'+String(row.id),
    licenseUrl:validJamendoUrl(row.license_ccurl),
    provider:'Jamendo'
  };
}
async function handler(req,res){
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','public, max-age=30, s-maxage=60');
  if(req.method!=='GET')return res.status(405).json({error:'Only GET requests are supported.'});
  const key=process.env.JAMENDO_CLIENT_ID;
  if(!key)return res.status(503).json({error:'Independent music is not configured yet. Add JAMENDO_CLIENT_ID on Vercel.'});
  const page=Number(req.query?.page||1);
  if(!Number.isSafeInteger(page)||page<1||page>50)return res.status(400).json({error:'Page must be between 1 and 50.'});
  const trackId=String(req.query?.track||'').trim();
  if(trackId&&!/^\\d{1,15}$/.test(trackId))return res.status(400).json({error:'Invalid track ID.'});
  const q=String(req.query?.q||'').trim();
  if(q.length>100)return res.status(400).json({error:'Search is too long.'});
  const sort=req.query?.sort==='new'?'new':'popular';
  const genre=String(req.query?.genre||'').toLowerCase();
  if(genre&&!GENRES.has(genre))return res.status(400).json({error:'Unsupported genre.'});
  const url=new URL('https://api.jamendo.com/v3.0/tracks/');
  url.searchParams.set('client_id',key);
  url.searchParams.set('format','json');
  url.searchParams.set('limit',String(PAGE_SIZE));
  url.searchParams.set('offset',String(trackId?0:(page-1)*PAGE_SIZE));
  url.searchParams.set('audioformat','mp31');
  url.searchParams.set('imagesize','300');
  url.searchParams.set('type','single albumtrack');
  url.searchParams.set('include','licenses');
  if(trackId){url.searchParams.set('id',trackId);url.searchParams.set('limit','1');}
  if(!trackId&&q){url.searchParams.set('search',q);url.searchParams.set('order','relevance');}
  else if(!trackId)url.searchParams.set('order',sort==='new'?'releasedate_desc':'popularity_month');
  if(!trackId&&genre)url.searchParams.set('tags',genre==='lofi'?'relaxation':genre);
  try{
    const response=await fetch(url,{signal:AbortSignal.timeout(12000)});
    if(!response.ok)return res.status(502).json({error:'Music catalog is temporarily unavailable.'});
    const data=await response.json();
    if(data?.headers?.status==='failed')return res.status(502).json({error:'The music provider could not complete this search.'});
    const raw=Array.isArray(data?.results)?data.results:[];
    const items=raw.map(track).filter(Boolean);
    return res.status(200).json({
      items,page,pageSize:PAGE_SIZE,hasMore:!trackId&&raw.length===PAGE_SIZE,
      provider:'Jamendo',notice:'Jamendo independent artists. Non-commercial use only; no offline caching.'
    });
  }catch{return res.status(502).json({error:'Could not reach the independent music catalog. Try again.'});}
}
module.exports=handler;
module.exports._test={track,validJamendoUrl,PAGE_SIZE};
