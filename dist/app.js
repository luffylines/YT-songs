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
  $('searchHint').textContent='Live YouTube music discovery · Results open in the visible official YouTube player.';
}
function assign(song) { selectedSong=song;$('playlistChoices').replaceChildren(); if(!state.playlists.length){$('playlistChoices').append(node('p','Create a playlist first.'),button('+ New playlist',()=>{$('assignDialog').close();showDialog('playlistDialog');}));}else state.playlists.forEach(p=>$('playlistChoices').append(button(p.name,()=>{addSong(song);if(!p.songs.includes(song.id))p.songs.push(song.id);save();render();$('assignDialog').close();status('Added to '+p.name+'.');})));showDialog('assignDialog'); }
let apiLoading=false;
function play(song) {
  $('audioPlayer').pause();$('audioPanel').hidden=true;
  pendingVideo=song;$('playerPanel').hidden=false;$('playingTitle').textContent=song.title;$('watchLink').href='https://www.youtube.com/watch?v='+song.id;$('playerStatus').textContent='Use the YouTube controls to play. Some videos may only play on YouTube.';
  if(player?.cueVideoById)player.cueVideoById(song.id);
  else if(!apiLoading){apiLoading=true;const script=node('script');script.src='https://www.youtube.com/iframe_api';script.onerror=()=>{apiLoading=false;$('playerStatus').textContent='YouTube player could not load. Open the video on YouTube instead.';};document.head.append(script);}
}
window.onYouTubeIframeAPIReady=()=>{player=new YT.Player('player',{width:'100%',height:'230',videoId:pendingVideo?.id,playerVars:{playsinline:1,origin:location.origin},events:{onError:()=>{$('playerStatus').textContent='This video is unavailable here or embedding is disabled. Try Open on YouTube.';},onReady:()=>{if($('playerPanel').hidden||document.hidden)player.pauseVideo();},onStateChange:e=>{if(e.data===1){$('audioPlayer').pause();if(document.hidden||$('playerPanel').hidden)player.pauseVideo();}}}});};
document.addEventListener('visibilitychange',()=>{if(document.hidden)player?.pauseVideo?.();});
$('closePlayer').onclick=()=>{player?.pauseVideo?.();$('playerPanel').hidden=true;};
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));
['addHero','addSong','emptyAdd'].forEach(id=>$(id).onclick=()=>showDialog('addDialog'));
$('newPlaylist').onclick=()=>showDialog('playlistDialog');
$('addForm').onsubmit=e=>{e.preventDefault();const id=parseVideo($('videoUrl').value.trim());if(!id){$('addError').textContent='Enter a valid YouTube video link (watch, shorts, live, or youtu.be).';return;}const title=$('songTitle').value.trim();if(!title){$('addError').textContent='Enter a song title.';return;}addSong({id,title,artist:$('artist').value.trim()});save();$('addDialog').close();e.target.reset();$('addError').textContent='';setView('all');status('Song added. Select its thumbnail to open the player.');};
$('playlistForm').onsubmit=e=>{e.preventDefault();const name=$('playlistName').value.trim();if(!name)return;const p={id:crypto.randomUUID(),name,songs:[]};state.playlists.push(p);save();$('playlistDialog').close();e.target.reset();setView(p.id);};
$('settings').onclick=()=>showDialog('helpDialog');
document.querySelectorAll('[data-search]').forEach(b=>b.onclick=()=>{
  $('query').value=b.dataset.search;
  $('searchForm').requestSubmit();
});
$('searchForm').onsubmit=async e=>{
  e.preventDefault();
  query=$('query').value.trim();
  if(!query)return;
  const version=++requestVersion;
  const submit=e.target.querySelector('button[type=submit],button.primary');
  submit.disabled=true;
  status('Finding music on YouTube…');
  try{
    const url='/api/search?'+new URLSearchParams({q:query,sort:$('searchMode').value});
    const response=await fetch(url,{signal:AbortSignal.timeout(13000)});
    const data=await response.json();
    if(version!==requestVersion)return;
    if(!response.ok)throw new Error(data.error||'YouTube search is unavailable.');
    searchResults=(data.items||[]).filter(x=>validId(x.id)).map(x=>({
      id:x.id,title:decode(x.title||'Untitled'),artist:decode(x.artist||'YouTube')
    }));
    render();
    status(searchResults.length+' YouTube results · '+($('searchMode').value==='date'?'Newest uploads':'Best match')+'. Select a cover to open the player.');
  }catch(error){
    if(version===requestVersion){
      status(error.name==='TimeoutError'?'YouTube search timed out. Please try again.':error.message||'Could not search.');
      const a=node('a',' Search on YouTube ↗');
      a.href='https://www.youtube.com/results?search_query='+encodeURIComponent(query+' music');
      a.target='_blank';a.rel='noopener';$('status').append(a);
    }
  }finally{submit.disabled=false;}
};
function decode(value){const doc=new DOMParser().parseFromString(value,'text/html');return doc.documentElement.textContent;}
// Imported audio is available during this tab session only; no uploads occur.
const localTracks=[];
let activeAudio=-1;
function renderLocal(){
  $('localCount').textContent=String(localTracks.length);
  $('localHint').hidden=localTracks.length>0;
  $('localResults').replaceChildren();
  localTracks.forEach((track,i)=>{
    const card=node('article',undefined,'local-card');
    const art=node('div','♫','local-art');
    const info=node('div',undefined,'local-info');
    info.append(node('strong',track.title),node('small',track.fileName));
    const actions=node('div',undefined,'local-actions');
    actions.append(button('▶ Play',()=>playLocal(i),'Play '+track.title));
    const dl=node('a','↓');dl.href=track.url;dl.download=track.fileName;dl.title='Download your own file';dl.setAttribute('aria-label','Download '+track.title);actions.append(dl);
    actions.append(button('×',()=>{
      if(activeAudio===i){$('audioPlayer').pause();$('audioPlayer').removeAttribute('src');$('audioPanel').hidden=true;activeAudio=-1;}
      else if(activeAudio>i)activeAudio--;
      URL.revokeObjectURL(track.url);localTracks.splice(i,1);renderLocal();
    },'Remove '+track.title));
    card.append(art,info,actions);$('localResults').append(card);
  });
}
function playLocal(i){
  const track=localTracks[i];if(!track)return;
  player?.pauseVideo?.();$('playerPanel').hidden=true;
  activeAudio=i;
  $('audioPanel').hidden=false;
  $('audioTitle').textContent=track.title;
  $('downloadAudio').href=track.url;$('downloadAudio').download=track.fileName;
  const audio=$('audioPlayer');
  if(audio.src!==track.url)audio.src=track.url;
  audio.play().catch(()=>status('Tap Play in the audio controls to start your music.'));
  if('mediaSession' in navigator && 'MediaMetadata' in window){
    navigator.mediaSession.metadata=new MediaMetadata({title:track.title,artist:'My audio · Tambay'});
    navigator.mediaSession.setActionHandler('previoustrack',()=>moveAudio(-1));
    navigator.mediaSession.setActionHandler('nexttrack',()=>moveAudio(1));
    navigator.mediaSession.setActionHandler('play',()=>audio.play());
    navigator.mediaSession.setActionHandler('pause',()=>audio.pause());
  }
}
function moveAudio(n){
  if(!localTracks.length)return;
  playLocal((activeAudio+n+localTracks.length)%localTracks.length);
}
$('audioPlayer').addEventListener('ended',()=>moveAudio(1));
$('audioPlayer').addEventListener('error',()=>status('This audio format may not be supported by your browser.'));
$('prevAudio').onclick=()=>moveAudio(-1);
$('nextAudio').onclick=()=>moveAudio(1);
$('closeAudio').onclick=()=>{$('audioPlayer').pause();$('audioPanel').hidden=true;};
['importMusic','importMusicMore'].forEach(id=>$(id).onclick=()=>$('audioFiles').click());
$('audioFiles').onchange=e=>{
  for(const file of Array.from(e.target.files||[]).slice(0,50)){
    if(!file.type.startsWith('audio/')&&!/\.(mp3|m4a|ogg|wav|aac|flac)$/i.test(file.name))continue;
    if(localTracks.some(t=>t.fileName===file.name&&t.size===file.size))continue;
    const url=URL.createObjectURL(file);
    localTracks.push({url,fileName:file.name,title:file.name.replace(/\.[^.]+$/,'').replace(/[_-]+/g,' '),size:file.size});
  }
  e.target.value='';renderLocal();
  status(localTracks.length?'Your audio is ready. Imported files remain on this device, in this tab.':'No supported audio files were selected.');
};
window.addEventListener('beforeunload',()=>localTracks.forEach(t=>URL.revokeObjectURL(t.url)));
renderLocal();
render();
