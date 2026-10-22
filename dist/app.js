'use strict';
const $ = id => document.getElementById(id);
const validId = id => typeof id === 'string' && /^[A-Za-z0-9_-]{11}$/.test(id);
function parseVideo(value) {
  try { const u = new URL(value); if (!['https:', 'http:'].includes(u.protocol)) return null;
    const host = u.hostname.toLowerCase(); let id;
    if (host === 'youtu.be') id = u.pathname.split('/')[1];
    else if (['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com'].includes(host)) id = u.pathname === '/watch' ? u.searchParams.get('v') : /^\/(shorts|embed|live)\//.test(u.pathname) ? u.pathname.split('/')[2] : null;
    return validId(id) ? id : null;
  } catch { return null; }
}
let state = {songs:[], playlists:[]}, view = 'all', query = '', searchResults = null, player = null, pendingVideo = null, selectedSong = null, requestVersion = 0;
try { const saved = JSON.parse(localStorage.getItem('tambay-v1')); if (saved && Array.isArray(saved.songs) && Array.isArray(saved.playlists)) {
  state.songs = saved.songs.filter(s => validId(s.id) && typeof s.title === 'string').map(s => ({id:s.id,title:s.title,artist:typeof s.artist === 'string'?s.artist:'',favorite:!!s.favorite}));
  state.playlists = saved.playlists.filter(p => typeof p.id === 'string' && typeof p.name === 'string' && Array.isArray(p.songs)).map(p=>({...p,songs:p.songs.filter(validId)}));
} } catch { $('status').textContent = 'Saved library could not be read. You can start a new collection.'; }
let apiKey = ''; try { apiKey = sessionStorage.getItem('tambay-search-key') || ''; } catch {}
function status(message) { $('status').textContent = message; }
function save() { try { localStorage.setItem('tambay-v1',JSON.stringify(state)); return true; } catch { status('Storage is full or unavailable. Changes will only last while this page stays open.'); return false; } }
function node(tag, text, className) { const e=document.createElement(tag); if(text!==undefined)e.textContent=text; if(className)e.className=className; return e; }
function button(text, action, label) { const e=node('button',text); e.type='button'; e.onclick=action; if(label)e.setAttribute('aria-label',label); return e; }
function showDialog(id) { $(id).showModal(); }
function addSong(song) { if(!state.songs.some(s=>s.id===song.id))state.songs.push({...song,favorite:false}); return state.songs.find(s=>s.id===song.id); }
function setView(next) { view=next;query='';$('query').value='';searchResults=null;requestVersion++;status('');render(); }
function render() {
  document.querySelectorAll('[data-view]').forEach(e=>e.classList.toggle('active',e.dataset.view===view));
  $('playlists').replaceChildren();
  state.playlists.forEach(p=>{const b=button('♫  '+p.name,()=>setView(p.id));b.classList.toggle('active',view===p.id);$('playlists').append(b);});
  const create=button('+ New playlist',()=>showDialog('playlistDialog'));$('playlists').append(create);
  const list=state.playlists.find(p=>p.id===view);
  $('heading').textContent=searchResults?'YouTube results':view==='favorites'?'Favorites':list?list.name:'My library';
  let songs=searchResults || state.songs.filter(s=>view==='all'||view==='favorites'&&s.favorite||list?.songs.includes(s.id));
  if(!searchResults && query)songs=songs.filter(s=>(s.title+' '+s.artist).toLowerCase().includes(query.toLowerCase()));
  $('results').replaceChildren();$('empty').hidden=songs.length>0;
  $('empty').querySelector('h3').textContent=query?'No matches yet.':'Your next favorite starts here.';
  songs.forEach(song=>{
    const card=node('article',undefined,'card');const cover=button('',()=>play(song),'Play '+song.title);cover.className='cover';
    const img=node('img');img.src='https://i.ytimg.com/vi/'+song.id+'/mqdefault.jpg';img.alt='';img.loading='lazy';cover.append(img);
    card.append(cover,node('h3',song.title),node('p',song.artist||'YouTube video'));
    const actions=node('div',undefined,'actions'),saved=state.songs.find(s=>s.id===song.id);
    const like=button(saved?.favorite?'♥':'♡',()=>{const s=addSong(song);s.favorite=!s.favorite;save();render();},'Toggle favorite for '+song.title);like.setAttribute('aria-pressed',String(!!saved?.favorite));like.classList.toggle('liked',!!saved?.favorite);
    actions.append(like,button('+ Playlist',()=>assign(song)));
    if(!saved)actions.append(button('Save',()=>{addSong(song);save();render();status('Added to your library.');}));
    else actions.append(button(list?'Remove':'Delete',()=>{if(list)list.songs=list.songs.filter(id=>id!==song.id);else{state.songs=state.songs.filter(s=>s.id!==song.id);state.playlists.forEach(p=>p.songs=p.songs.filter(id=>id!==song.id));}save();render();status(list?'Removed from playlist.':'Removed from library.');}));
    card.append(actions);$('results').append(card);
  });
  $('searchHint').textContent=apiKey?'Connected to YouTube search · Results play through the official YouTube player.':'Search your library, or discover music on YouTube.';
}
function assign(song) { selectedSong=song;$('playlistChoices').replaceChildren(); if(!state.playlists.length){$('playlistChoices').append(node('p','Create a playlist first.'),button('+ New playlist',()=>{$('assignDialog').close();showDialog('playlistDialog');}));}else state.playlists.forEach(p=>$('playlistChoices').append(button(p.name,()=>{addSong(song);if(!p.songs.includes(song.id))p.songs.push(song.id);save();render();$('assignDialog').close();status('Added to '+p.name+'.');})));showDialog('assignDialog'); }
let apiLoading=false;
function play(song) {
  pendingVideo=song;$('playerPanel').hidden=false;$('playingTitle').textContent=song.title;$('watchLink').href='https://www.youtube.com/watch?v='+song.id;$('playerStatus').textContent='Use the YouTube controls to play. Some videos may only play on YouTube.';
  if(player?.cueVideoById)player.cueVideoById(song.id);
  else if(!apiLoading){apiLoading=true;const script=node('script');script.src='https://www.youtube.com/iframe_api';script.onerror=()=>{apiLoading=false;$('playerStatus').textContent='YouTube player could not load. Open the video on YouTube instead.';};document.head.append(script);}
}
window.onYouTubeIframeAPIReady=()=>{player=new YT.Player('player',{width:'100%',height:'230',videoId:pendingVideo?.id,playerVars:{playsinline:1,origin:location.origin},events:{onError:()=>{$('playerStatus').textContent='This video is unavailable here or embedding is disabled. Try Open on YouTube.';},onReady:()=>{if($('playerPanel').hidden||document.hidden)player.pauseVideo();},onStateChange:e=>{if(e.data===1 && (document.hidden||$('playerPanel').hidden))player.pauseVideo();}}});};
document.addEventListener('visibilitychange',()=>{if(document.hidden)player?.pauseVideo?.();});
$('closePlayer').onclick=()=>{player?.pauseVideo?.();$('playerPanel').hidden=true;};
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));
['addHero','addSong','emptyAdd'].forEach(id=>$(id).onclick=()=>showDialog('addDialog'));
$('newPlaylist').onclick=()=>showDialog('playlistDialog');
$('addForm').onsubmit=e=>{e.preventDefault();const id=parseVideo($('videoUrl').value.trim());if(!id){$('addError').textContent='Enter a valid YouTube video link (watch, shorts, live, or youtu.be).';return;}const title=$('songTitle').value.trim();if(!title){$('addError').textContent='Enter a song title.';return;}addSong({id,title,artist:$('artist').value.trim()});save();$('addDialog').close();e.target.reset();$('addError').textContent='';setView('all');status('Song added. Select its thumbnail to open the player.');};
$('playlistForm').onsubmit=e=>{e.preventDefault();const name=$('playlistName').value.trim();if(!name)return;const p={id:crypto.randomUUID(),name,songs:[]};state.playlists.push(p);save();$('playlistDialog').close();e.target.reset();setView(p.id);};
$('settings').onclick=()=>{$('origin').textContent=location.origin+'/*';$('apiKey').value=apiKey;showDialog('settingsDialog');};
$('settingsForm').onsubmit=e=>{e.preventDefault();apiKey=$('apiKey').value.trim();try{if(apiKey)sessionStorage.setItem('tambay-search-key',apiKey);else sessionStorage.removeItem('tambay-search-key');}catch{}$('settingsDialog').close();render();status(apiKey?'Search key saved for this tab. Search to test the connection.':'YouTube search disconnected.');};
$('searchForm').onsubmit=async e=>{
 e.preventDefault();query=$('query').value.trim();if(!query)return;const version=++requestVersion;
 if(!apiKey){searchResults=null;render();status('Showing library matches. ');const a=node('a','Search YouTube ↗');a.href='https://www.youtube.com/results?search_query='+encodeURIComponent(query+' music');a.target='_blank';a.rel='noopener';$('status').append(a);return;}
 const submit=e.target.querySelector('button');submit.disabled=true;status('Searching YouTube…');
 try {const params=new URLSearchParams({part:'snippet',type:'video',videoEmbeddable:'true',maxResults:'12',q:query,key:apiKey});const response=await fetch('https://www.googleapis.com/youtube/v3/search?'+params,{signal:AbortSignal.timeout(15000)});const data=await response.json();if(version!==requestVersion)return;if(!response.ok){const reason=data.error?.errors?.[0]?.reason;throw new Error(reason==='quotaExceeded'?'YouTube search quota reached. Try later or add a link.':'Search could not connect. Check the API key, enabled API, and website restrictions.');}
 searchResults=(data.items||[]).filter(x=>validId(x.id?.videoId)).map(x=>({id:x.id.videoId,title:decode(x.snippet.title),artist:decode(x.snippet.channelTitle)}));render();status(searchResults.length+' results from YouTube.');
 } catch(error){if(version===requestVersion)status(error.name==='TimeoutError'?'Search timed out. Please try again.':error instanceof TypeError?'Network error. Check your connection and try again.':error.message);}finally{submit.disabled=false;}
};
function decode(value){const doc=new DOMParser().parseFromString(value,'text/html');return doc.documentElement.textContent;}
render();
