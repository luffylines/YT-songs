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
let visibleSongs = [], youtubeQueue = [], priorityQueue = [], queuePosition = -1, activeSource = null, youtubeIsPlaying = false;
// Independent artist streaming stays in memory; never persist provider audio URLs or cache media.
let catalogQueue = [], catalogPosition = -1;
// Preserve music collections from older Tambay installations during the Musikero rebrand.
try { const saved = JSON.parse(localStorage.getItem('musikero-v1') || localStorage.getItem('tambay-v1')); if (saved && Array.isArray(saved.songs) && Array.isArray(saved.playlists)) {
  state.songs = saved.songs.filter(s => validId(s.id) && typeof s.title === 'string').map(s => ({id:s.id,title:s.title,artist:typeof s.artist === 'string'?s.artist:'',favorite:!!s.favorite}));
  state.playlists = saved.playlists.filter(p => typeof p.id === 'string' && typeof p.name === 'string' && Array.isArray(p.songs)).map(p=>({...p,songs:p.songs.filter(validId)}));
} } catch { $('status').textContent = 'Saved library could not be read. You can start a new collection.'; }
function status(message) { $('status').textContent = message; }
function save() { try { localStorage.setItem('musikero-v1',JSON.stringify(state)); return true; } catch { status('Storage is full or unavailable. Changes will only last while this page stays open.'); return false; } }
function node(tag, text, className) { const e=document.createElement(tag); if(text!==undefined)e.textContent=text; if(className)e.className=className; return e; }
function button(text, action, label) { const e=node('button',text); e.type='button'; e.onclick=action; if(label)e.setAttribute('aria-label',label); return e; }
function showDialog(id) { $(id).showModal(); }
function addSong(song) { if(!state.songs.some(s=>s.id===song.id))state.songs.push({...song,favorite:false}); return state.songs.find(s=>s.id===song.id); }
function setView(next) { view=next;query='';$('query').value='';searchResults=null;requestVersion++;status('');render(); showSectionView(); }
function showSectionView(){
  const independent=view==='independent';
  const library=view==='all'||view==='favorites'||state.playlists.some(p=>p.id===view);
  $('heroTitle').closest('.hero').hidden=view!=='all';
  $('discover').hidden=view!=='all';
  $('catalogSection').hidden=!independent;
  $('heading').closest('.library-heading').hidden=!library;
  $('status').hidden=!library;
  $('results').hidden=!library;
  $('empty').hidden=!library||visibleSongs.length>0;
  $('ownMusic').hidden=!library;
  if($('searchArea')) $('searchArea').hidden=view!=='all';
}
function render() {
  document.querySelectorAll('[data-view]').forEach(e=>e.classList.toggle('active',e.dataset.view===view));
  $('playlists').replaceChildren();
  state.playlists.forEach(p=>{const b=button('♫  '+p.name,()=>setView(p.id));b.classList.toggle('active',view===p.id);$('playlists').append(b);});
  const create=button('+ New playlist',()=>showDialog('playlistDialog'));$('playlists').append(create);
  const list=state.playlists.find(p=>p.id===view);
  $('heading').textContent=searchResults?'Fresh discoveries':view==='favorites'?'Your favorites':list?list.name:'Your music library';
  showSectionView();
  let songs=searchResults || state.songs.filter(s=>view==='all'||view==='favorites'&&s.favorite||list?.songs.includes(s.id));
  if(!searchResults && query)songs=songs.filter(s=>(s.title+' '+s.artist).toLowerCase().includes(query.toLowerCase()));
  visibleSongs=songs.slice();
  $('results').replaceChildren();$('empty').hidden=songs.length>0;
  $('empty').querySelector('h3').textContent=query?'No matches yet.':'Your next favorite starts here.';
  songs.forEach(song=>{
    const card=node('article',undefined,'card');const cover=button('',()=>play(song,songs),'Play '+song.title);cover.className='cover';
    const img=node('img');img.src='https://i.ytimg.com/vi/'+song.id+'/mqdefault.jpg';img.alt='';img.loading='lazy';cover.append(img);
    card.append(cover,node('h3',song.title),node('p',song.artist||'YouTube video'));
    const actions=node('div',undefined,'actions'),saved=state.songs.find(s=>s.id===song.id);
    const like=button(saved?.favorite?'♥':'♡',()=>{const s=addSong(song);s.favorite=!s.favorite;save();render();},'Toggle favorite for '+song.title);like.setAttribute('aria-pressed',String(!!saved?.favorite));like.classList.toggle('liked',!!saved?.favorite);
    actions.append(like,button('Play next',()=>enqueueNext(song),'Queue '+song.title+' to play next'),button('+ Playlist',()=>assign(song)));
    if(partySession) actions.append(button('🎉 Party +',()=>partyAddSong(song),'Add '+song.title+' to the listening party queue'));
    if(!saved)actions.append(button('Save',()=>{addSong(song);save();render();status('Added to your library.');}));
    else actions.append(button(list?'Remove':'Delete',()=>{if(list)list.songs=list.songs.filter(id=>id!==song.id);else{state.songs=state.songs.filter(s=>s.id!==song.id);state.playlists.forEach(p=>p.songs=p.songs.filter(id=>id!==song.id));}save();render();status(list?'Removed from playlist.':'Removed from library.');}));
    card.append(actions);$('results').append(card);
  });
  $('searchHint').textContent='Discover music with the official YouTube player. Ad availability and playback controls remain YouTube-managed.';
  syncTransport();
}
function assign(song) { selectedSong=song;$('playlistChoices').replaceChildren(); if(!state.playlists.length){$('playlistChoices').append(node('p','Create a playlist first.'),button('+ New playlist',()=>{$('assignDialog').close();showDialog('playlistDialog');}));}else state.playlists.forEach(p=>$('playlistChoices').append(button(p.name,()=>{addSong(song);if(!p.songs.includes(song.id))p.songs.push(song.id);save();render();$('assignDialog').close();status('Added to '+p.name+'.');})));showDialog('assignDialog'); }
let apiLoading=false;
const audio = $('audioPlayer');
function playbackSong(){
  return activeSource==='youtube' ? pendingVideo : activeSource==='local' ? localTracks[activeAudio] : activeSource==='catalog' ? catalogQueue[catalogPosition] : null;
}
function playbackLength(){
  return activeSource==='youtube' ? youtubeQueue.length : activeSource==='local' ? localTracks.length : activeSource==='catalog' ? catalogQueue.length : 0;
}
function isPlaying(){
  if(activeSource==='local'||activeSource==='catalog')return !audio.paused && !audio.ended;
  return activeSource==='youtube' && youtubeIsPlaying;
}
function clock(seconds){
  if(!Number.isFinite(seconds)||seconds<0)return '0:00';
  const value=Math.floor(seconds);
  return Math.floor(value/60)+':'+String(value%60).padStart(2,'0');
}
function syncProgress(){
  let now=0,duration=0;
  if(activeSource==='youtube'&&player?.getDuration){
    try{duration=Number(player.getDuration())||0;now=Number(player.getCurrentTime())||0;}catch{}
  }else if(activeSource==='local'||activeSource==='catalog'){
    duration=Number(audio.duration)||0;now=Number(audio.currentTime)||0;
  }
  $('barTime').textContent=clock(now);
  $('barDuration').textContent=clock(duration);
  $('seekSlider').disabled=duration<=0;
  if(!document.activeElement || document.activeElement!==$('seekSlider')){
    $('seekSlider').value=duration>0?String(Math.min(1000,Math.round(now/duration*1000))):'0';
  }
}
function syncTransport(){
  const track=playbackSong(), youtube=activeSource==='youtube';
  $('bottomPlayer').classList.toggle('has-track',!!track);
  $('barTitle').textContent=track ? track.title : 'Choose a song';
  $('barArtist').textContent=!track ? 'Your soundtrack starts here' : youtube ? (track.artist||'YouTube') : activeSource==='catalog' ? track.artist+' · Jamendo' : 'Your imported audio';
  $('barArtwork').src=youtube&&track ? 'https://i.ytimg.com/vi/'+track.id+'/mqdefault.jpg' : activeSource==='catalog'&&track?.image ? track.image : '/icon.svg';
  $('barSource').textContent=!track?'MUSIKERO':youtube?'YOUTUBE · IN-APP PLAYER':activeSource==='catalog'?'INDEPENDENT MUSIC · JAMENDO':'MY AUDIO · THIS DEVICE';
  $('barPlay').disabled=!track;
  $('barPlay').innerHTML=isPlaying()?'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="4" width="4" height="16" rx="1.4" fill="currentColor"/><rect x="14" y="4" width="4" height="16" rx="1.4" fill="currentColor"/></svg>':'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.8a1.2 1.2 0 0 1 1.8-1l11 6.7a1.8 1.8 0 0 1 0 3L8.8 20.2A1.2 1.2 0 0 1 7 19.2z" fill="currentColor"/></svg>';
  $('barPlay').setAttribute('aria-label',isPlaying()?'Pause':'Play');
  const index=youtube?queuePosition:activeSource==='catalog'?catalogPosition:activeAudio;
  $('barPrev').disabled=!track||index<=0;
  $('barNext').disabled=!track||index>=playbackLength()-1;
  $('barLike').hidden=!(youtube||activeSource==='catalog');
  if(activeSource==='catalog'&&track){
    $('barLike').disabled=false;
    const fav=window.MusikeroCatalog?.isFavorite?.(track.id)||false;
    $('barLike').textContent=fav?'♥':'♡';
    $('barLike').setAttribute('aria-pressed',String(fav));
  }
  if(youtube&&track){
    const saved=state.songs.find(x=>x.id===track.id);
    $('barLike').disabled=false;$('barLike').textContent=saved?.favorite?'♥':'♡';
    $('barLike').setAttribute('aria-pressed',String(!!saved?.favorite));
  }
  $('barVideo').hidden=!youtube;
  $('barVideo').textContent=$('playerPanel').hidden?'▣ Show video':'− Hide video';
  $('barVideo').setAttribute('aria-label',$('playerPanel').hidden?'Show video player':'Hide video player');
  $('barDownload').hidden=activeSource!=='local'||!track;
  if(activeSource==='local'&&track){
    $('barDownload').href=track.url;
    $('barDownload').download=track.fileName;
  }else{$('barDownload').removeAttribute('href');}
  $('barQueue').disabled=playbackLength()===0;
  if('mediaSession' in navigator){try{navigator.mediaSession.playbackState=isPlaying()?'playing':track?'paused':'none';}catch{}}
  syncProgress();
  if(!$('queuePanel').hidden)renderQueue();
}
function renderQueue(){
  const tracks=activeSource==='youtube'?youtubeQueue:activeSource==='local'?localTracks:activeSource==='catalog'?catalogQueue:[];
  const current=activeSource==='youtube'?queuePosition:activeSource==='catalog'?catalogPosition:activeAudio;
  $('queueItems').replaceChildren();
  if(!tracks.length){$('queueItems').append(node('p','Choose a song to fill your queue.'));return;}
  tracks.forEach((track,i)=>{
    const item=button('',()=>{
      if(activeSource==='youtube'){queuePosition=i;showYoutube(track,true);}
      else if(activeSource==='catalog'){catalogPosition=i;playCatalogAt(i);}
      else playLocal(i);
      closeQueue();
    },'Play '+track.title);
    item.className='queue-track';
    if(i===current)item.classList.add('queue-current');
    const thumb=node('img');
    thumb.src=activeSource==='youtube'?'https://i.ytimg.com/vi/'+track.id+'/mqdefault.jpg':activeSource==='catalog'?(track.image||'/icon.svg'):'/icon.svg';
    thumb.alt='';thumb.loading='lazy';
    const copy=node('span',undefined,'queue-copy');
    copy.append(node('strong',track.title),node('small',activeSource==='youtube'?(track.artist||'YouTube'):activeSource==='catalog'?(track.artist+' · Jamendo'):'My audio'));

    item.append(thumb,copy,node('span',i===current?'♫':String(i+1),'queue-index'));
    $('queueItems').append(item);
  });
}
function closeQueue(){
  $('queuePanel').hidden=true;$('queueBackdrop').hidden=true;
  $('barQueue').setAttribute('aria-expanded','false');
}
function enqueueNext(song){
  if(!validId(song?.id))return;
  priorityQueue=priorityQueue.filter(item=>item.id!==song.id);
  priorityQueue.unshift(song);
  status('Added to play next: '+song.title);
  syncTransport();
}
function showYoutube(song,autoplay=true){
  if(!validId(song?.id))return;
  audio.pause();
  activeSource='youtube';pendingVideo=song;youtubeIsPlaying=false;
  $('playerPanel').hidden=false;
  $('playingTitle').textContent=song.title;
  $('watchLink').href='https://www.youtube.com/watch?v='+song.id;
  $('playerStatus').textContent='Use the official player controls if your browser does not start playback automatically.';
  if('mediaSession' in navigator && 'MediaMetadata' in window){
    try{
      navigator.mediaSession.metadata=new MediaMetadata({
        title:song.title||'Unknown title',artist:song.artist||'YouTube',album:'Musikero · YouTube',
        artwork:[{src:'https://i.ytimg.com/vi/'+song.id+'/hqdefault.jpg',sizes:'480x360',type:'image/jpeg'}]
      });
      navigator.mediaSession.setActionHandler('play',()=>togglePlayback());
      navigator.mediaSession.setActionHandler('pause',()=>togglePlayback());
      navigator.mediaSession.setActionHandler('nexttrack',()=>moveQueue(1));
      navigator.mediaSession.setActionHandler('previoustrack',()=>moveQueue(-1));
    }catch{}
  }
  if(player?.loadVideoById){
    if(autoplay)player.loadVideoById(song.id);
    else player.cueVideoById(song.id);
  }else if(!apiLoading){
    apiLoading=true;
    const script=node('script');
    script.src='https://www.youtube.com/iframe_api';
    script.onerror=()=>{apiLoading=false;$('playerStatus').textContent='Player could not load. Try again or open in YouTube.';};
    document.head.append(script);
  }
  syncTransport();
}
function play(song,collection=visibleSongs){
  if(partySession?.role==='guest'){
    status('The host controls playback in this Listening Party. Tap 🎉 Party + to add songs to the shared queue.');
    return;
  }
  youtubeQueue=Array.from(new Map([...(collection||[]),song].filter(v=>validId(v.id)).map(v=>[v.id,v])).values());
  queuePosition=youtubeQueue.findIndex(v=>v.id===song.id);
  showYoutube(song,true);
  if(partySession?.role==='host')partyPublishPlayback(true);
}
window.onYouTubeIframeAPIReady=()=>{
  apiLoading=false;
  player=new YT.Player('player',{
    width:'100%',height:'230',videoId:pendingVideo?.id,
    playerVars:{playsinline:1,origin:location.origin,controls:1},
    events:{
      onError:e=>{
        const code=e?.data;
        const restricted=code===101||code===150;
        $('playerStatus').textContent=restricted
          ? 'This video is restricted from embedded playback. Skipping to the next queued song when available.'
          : 'This video cannot play in the embedded player. Skipping to the next queued song when available.';
        if(!moveQueue(1))status('Could not play this YouTube video. Try another song or choose Independent Music.');
      },
      onReady:()=>{
        if(activeSource==='youtube'&&pendingVideo){
          if(youtubeIsPlaying) player.playVideo();
          else player.cueVideoById(pendingVideo.id);
          $('playerStatus').textContent='Playback is controlled by YouTube and your browser. Background playback availability depends on the device and browser.';
        }else player.pauseVideo();
        syncTransport();
      },
      onStateChange:e=>{
        if(e.data===1&&activeSource!=='youtube'){
          player.pauseVideo();return;
        }
        if(activeSource==='youtube'){
          youtubeIsPlaying=e.data===1;
          if(e.data===0){
            if(partySession?.role==='host')partyAdvanceQueue();
            else if(!partySession&&!moveQueue(1))youtubeIsPlaying=false;
          }else if((e.data===1||e.data===2)&&partySession?.role==='host'){
            partyPublishPlayback(true);
          }
          syncTransport();
        }
      }
    }
  });
};
function moveQueue(delta){
  if(activeSource==='youtube'){
    if(delta>0&&priorityQueue.length){
      const nextSong=priorityQueue.shift();
      youtubeQueue=youtubeQueue.filter(item=>item.id!==nextSong.id);
      youtubeQueue.splice(Math.max(0,queuePosition+1),0,nextSong);
      queuePosition=youtubeQueue.findIndex(item=>item.id===nextSong.id);
      showYoutube(nextSong,true);return true;
    }
    const next=queuePosition+delta;
    if(next<0||next>=youtubeQueue.length)return false;
    queuePosition=next;showYoutube(youtubeQueue[next],true);return true;
  }
  if(activeSource==='catalog'){
    const next=catalogPosition+delta;
    if(next<0||next>=catalogQueue.length)return false;
    playCatalogAt(next);return true;
  }
  if(activeSource==='local'){
    const next=activeAudio+delta;
    if(next<0||next>=localTracks.length)return false;
    playLocal(next);return true;
  }
  return false;
}
function togglePlayback(){
  if(partySession?.role==='guest'){
    status('The host controls playback in this Listening Party.');
    return;
  }
  if(activeSource==='youtube'){
    if(!player?.getPlayerState){
      $('playerStatus').textContent='YouTube player is loading. Tap play once it appears.';
      return;
    }
    try{
      const state=player.getPlayerState();
      if(state===1 || state===3){
        player.pauseVideo();
        youtubeIsPlaying=false;
        if('mediaSession' in navigator){try{navigator.mediaSession.playbackState='paused';}catch{}}
        if(partySession?.role==='host')partyPublishPlayback(true);
      }else{
        player.playVideo();
      }
      syncTransport();
    }catch{status('Unable to control YouTube playback. Try again.');}
  }else if(activeSource==='local'||activeSource==='catalog'){
    if(audio.paused){
      const attempt=audio.play();
      if(attempt&&typeof attempt.catch==='function')attempt.catch(()=>status('Tap Play to allow audio playback.'));
    }else{
      audio.pause();
      syncTransport();
    }
  }
}
$('barPlay').onclick=togglePlayback;
$('barPrev').onclick=()=>moveQueue(-1);
$('barNext').onclick=()=>moveQueue(1);
$('barLike').onclick=()=>{
  if(activeSource==='catalog'){
    const track=catalogQueue[catalogPosition];if(track)window.MusikeroCatalog?.toggleFavorite?.(track);syncTransport();return;
  }
  if(activeSource!=='youtube'||!pendingVideo)return;
  const saved=addSong(pendingVideo);saved.favorite=!saved.favorite;
  save();render();syncTransport();
};
function toggleVideoPanel(){
  if(activeSource!=='youtube')return;
  const hiding=!$('playerPanel').hidden;
  $('playerPanel').hidden=hiding;
  if(!hiding){
    closeQueue();
    $('playerPanel').focus({preventScroll:true});
    $('playerPanel').classList.add('focus-pulse');
    setTimeout(()=>$('playerPanel').classList.remove('focus-pulse'),900);
  }
  $('barVideo').textContent=hiding?'▣ Show video':'− Hide video';
  $('barVideo').setAttribute('aria-label',hiding?'Show video player':'Hide video player');
}
$('barVideo').onclick=toggleVideoPanel;
$('hideVideo').onclick=toggleVideoPanel;
$('barQueue').onclick=()=>{
  const opening=$('queuePanel').hidden;
  $('queuePanel').hidden=!opening;$('queueBackdrop').hidden=!opening;
  $('barQueue').setAttribute('aria-expanded',String(opening));
  if(opening)renderQueue();
};
$('closeQueue').onclick=closeQueue;
$('queueBackdrop').onclick=closeQueue;
$('seekSlider').onchange=()=>{
  let duration=0;
  if(activeSource==='youtube'&&player?.getDuration){
    duration=Number(player.getDuration())||0;
    if(duration>0)player.seekTo(duration*Number($('seekSlider').value)/1000,true);
  }else if(activeSource==='local'||activeSource==='catalog'){
    duration=Number(audio.duration)||0;
    if(duration>0)audio.currentTime=duration*Number($('seekSlider').value)/1000;
  }
  syncProgress();
};
$('seekSlider').oninput=()=>{
  const duration=activeSource==='youtube'?(Number(player?.getDuration?.())||0):(Number(audio.duration)||0);
  $('barTime').textContent=clock(duration*Number($('seekSlider').value)/1000);
};
// Do not forcibly pause audio when the page becomes hidden. Browser and
// operating-system background playback policies still apply.
setInterval(syncProgress,1000);

// Play streams directly from the independent music provider. Do not cache or offer downloads.
function validCatalogStream(url){
  try{const u=new URL(url);return u.protocol==='https:'&&(u.hostname==='jamendo.com'||u.hostname.endsWith('.jamendo.com'));}catch{return false;}
}
function playCatalogAt(index){
  const track=catalogQueue[index];
  if(!track||!validCatalogStream(track.audio))return;
  player?.pauseVideo?.();
  $('playerPanel').hidden=true;
  activeSource='catalog';catalogPosition=index;youtubeIsPlaying=false;
  const stream=track.audio;
  if(audio.src!==stream){audio.src=stream;audio.load();}
  if('mediaSession' in navigator&&'MediaMetadata' in window){
    try{
      navigator.mediaSession.metadata=new MediaMetadata({
        title:track.title,artist:track.artist,album:track.album||'Independent music · Jamendo',
        artwork:track.image?[{src:track.image,sizes:'300x300',type:'image/jpeg'}]:[]
      });
      navigator.mediaSession.setActionHandler('play',()=>audio.play());
      navigator.mediaSession.setActionHandler('pause',()=>audio.pause());
      navigator.mediaSession.setActionHandler('nexttrack',()=>moveQueue(1));
      navigator.mediaSession.setActionHandler('previoustrack',()=>moveQueue(-1));
      navigator.mediaSession.setActionHandler('seekto',e=>{if(Number.isFinite(e.seekTime))audio.currentTime=e.seekTime;});
    }catch{}
  }
  audio.play().catch(()=>status('Tap Play in the bottom bar to start independent music.'));
  syncTransport();
}
window.MusikeroAudio=Object.freeze({
  play(track,items){
    if(!track||!Array.isArray(items))return;
    const unique=new Map();
    for(const item of items){if(item?.id?.startsWith('jm-')&&validCatalogStream(item.audio))unique.set(item.id,item);}
    if(validCatalogStream(track.audio))unique.set(track.id,track);
    catalogQueue=Array.from(unique.values());
    catalogPosition=catalogQueue.findIndex(item=>item.id===track.id);
    playCatalogAt(catalogPosition);
  },
  isCurrent(id){return activeSource==='catalog'&&catalogQueue[catalogPosition]?.id===id;},
  refresh(){syncTransport();}
});
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));
$('showIndependent').onclick=()=>setView('independent');
['addHero','addSong','emptyAdd'].forEach(id=>$(id).onclick=()=>showDialog('addDialog'));
$('newPlaylist').onclick=()=>showDialog('playlistDialog');
async function autofillVideoMetadata(){
 const id=parseVideo($('videoUrl').value.trim());if(!id)return;
 $('addError').textContent='Looking up title and artist…';
 try{const r=await fetch('/api/video?id='+encodeURIComponent(id));const d=await r.json();if(!r.ok)throw new Error();
 if(!$('songTitle').value.trim())$('songTitle').value=d.title||'';
 if(!$('artist').value.trim())$('artist').value=d.artist||'';
 $('addError').textContent='Details filled in. You can edit them before saving.';
 }catch{$('addError').textContent='Auto-detection failed; you can enter the details manually.';}
}
$('videoUrl').addEventListener('change',autofillVideoMetadata);
$('videoUrl').addEventListener('paste',()=>setTimeout(autofillVideoMetadata,0));
$('addForm').onsubmit=e=>{e.preventDefault();const id=parseVideo($('videoUrl').value.trim());if(!id){$('addError').textContent='Enter a valid YouTube video link (watch, shorts, live, or youtu.be).';return;}const title=$('songTitle').value.trim();if(!title){$('addError').textContent='Enter a song title.';return;}addSong({id,title,artist:$('artist').value.trim()});save();$('addDialog').close();e.target.reset();$('addError').textContent='';setView('all');status('Song added. Your library is saved in this browser.');};
$('playlistForm').onsubmit=e=>{e.preventDefault();const name=$('playlistName').value.trim();if(!name)return;const p={id:crypto.randomUUID(),name,songs:[]};state.playlists.push(p);save();$('playlistDialog').close();e.target.reset();setView(p.id);};
$('settings').onclick=()=>showDialog('helpDialog');
$('exploreMusic').onclick=()=>{document.getElementById('discover').scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});$('query').focus({preventScroll:true});};
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
      if(activeAudio===i){
        audio.pause();audio.removeAttribute('src');audio.load();
        activeAudio=-1;activeSource=null;
      }else if(activeAudio>i)activeAudio--;
      URL.revokeObjectURL(track.url);localTracks.splice(i,1);renderLocal();syncTransport();
    },'Remove '+track.title));
    card.append(art,info,actions);$('localResults').append(card);
  });
}
function playLocal(i){
  const track=localTracks[i];if(!track)return;
  player?.pauseVideo?.();
  $('playerPanel').hidden=true;
  activeSource='local';activeAudio=i;youtubeIsPlaying=false;
  if(audio.src!==track.url)audio.src=track.url;
  audio.play().catch(()=>status('Tap play again to start your own audio.'));
  if('mediaSession' in navigator && 'MediaMetadata' in window){
    try{
      navigator.mediaSession.metadata=new MediaMetadata({title:track.title,artist:'My audio · Musikero'});
      navigator.mediaSession.setActionHandler('previoustrack',()=>moveQueue(-1));
      navigator.mediaSession.setActionHandler('nexttrack',()=>moveQueue(1));
      navigator.mediaSession.setActionHandler('play',()=>audio.play());
      navigator.mediaSession.setActionHandler('pause',()=>audio.pause());
    }catch{}
  }
  syncTransport();
}
audio.addEventListener('ended',()=>{if(!moveQueue(1))syncTransport();});
audio.addEventListener('error',()=>status('This audio format may not be supported by your browser.'));
for(const event of ['play','pause','loadedmetadata','durationchange','timeupdate']){
  audio.addEventListener(event,syncTransport);
}
['importMusic','importMusicMore'].forEach(id=>$(id).onclick=()=>$('audioFiles').click());
$('audioFiles').onchange=e=>{
  for(const file of Array.from(e.target.files||[]).slice(0,50)){
    if(!file.type.startsWith('audio/')&&!/\.(mp3|m4a|ogg|wav|aac|flac)$/i.test(file.name))continue;
    if(localTracks.some(t=>t.fileName===file.name&&t.size===file.size))continue;
    const url=URL.createObjectURL(file);
    localTracks.push({url,fileName:file.name,title:file.name.replace(/\.[^.]+$/,'').replace(/[_-]+/g,' '),size:file.size});
  }
  e.target.value='';renderLocal();syncTransport();
  status(localTracks.length?'Your audio is ready. Imported files remain on this device, in this tab.':'No supported audio files were selected.');
};
window.addEventListener('beforeunload',()=>localTracks.forEach(t=>URL.revokeObjectURL(t.url)));

/* Listening Party: server-backed shared room, host moderation, and a shared queue. */
const PARTY_ENDPOINT='https://xfuwswyyvbpbuuftggkf.supabase.co/functions/v1/musikero-party';
const PARTY_PUBLIC_KEY='sb_publishable_pKo1y2tEB94NklL5szhqjg_K4xEic4r';
let partySession=null, partyPollBusy=false, partySeenQueue=new Set(), partyPollTimer=null;
try{const savedParty=JSON.parse(localStorage.getItem('musikero-party-session')||'null');if(savedParty?.partyId&&savedParty?.token&&savedParty?.role)partySession=savedParty;}catch{}
async function partyRequest(action,extra={}){
  const body={action,...extra};
  if(partySession){body.partyId=partySession.partyId;body.token=partySession.token;}
  const res=await fetch(PARTY_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json','apikey':PARTY_PUBLIC_KEY},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(data.error||'Party request failed.');
  return data;
}
function partyError(message=''){ $('partyError').textContent=message; }
function partySetSession(session){
  partySession=session;
  partySeenQueue=new Set();
  try{if(session)localStorage.setItem('musikero-party-session',JSON.stringify(session));else localStorage.removeItem('musikero-party-session');}catch{}
  $('partyStart').hidden=!!session;$('partyRoom').hidden=!session;
  $('barParty').classList.toggle('party-active',!!session);
  $('barParty').setAttribute('aria-label',session?'Open active listening party':'Create or join a listening party');
  render();
  if(session)partyRefresh();
}
async function partyCreate(){
  partyError('');
  const name=$('partyName').value.trim();
  try{
    const data=await partyRequest('create',{name});
    partySetSession({partyId:data.party.id,code:data.party.code,token:data.party.hostToken,role:'host',name:data.party.host_name});
  }catch(e){partyError(e.message);}
}
async function partyJoin(e){
  e.preventDefault();partyError('');
  const name=$('partyName').value.trim(),code=$('partyCode').value.replace(/\D/g,'').slice(0,6);
  try{
    const data=await partyRequest('join',{name,code});
    partySetSession({partyId:data.party.id,code:data.party.code,token:data.memberToken,role:'guest',name:data.member.name});
  }catch(err){partyError(err.message);}
}
async function partyAddSong(song){
  if(!partySession){showDialog('partyDialog');partyError('Create or join a party first.');return;}
  try{
    await partyRequest('add',{youtubeId:song.id,title:song.title,artist:song.artist||'YouTube'});
    $('partyStatus').textContent='Added “'+song.title+'” to the shared queue.';
    await partyRefresh();
  }catch(e){partyError(e.message);showDialog('partyDialog');}
}
let partyLastPublishedKey='';
let partyApplyingRemote=false;
let partyRemoteTrack='';
async function partyPublishPlayback(force=false){
  if(!partySession||partySession.role!=='host'||activeSource!=='youtube'||!pendingVideo||!player?.getCurrentTime)return;
  try{
    const state=player.getPlayerState?.();
    if(state!==1&&state!==2&&state!==3)return;
    const position=Math.max(0,Number(player.getCurrentTime())||0);
    const playing=state===1;
    const key=[pendingVideo.id,playing,Math.floor(position/4)].join(':');
    if(!force&&key===partyLastPublishedKey)return;
    partyLastPublishedKey=key;
    await partyRequest('playback',{playback:{
      youtubeId:pendingVideo.id,title:pendingVideo.title,artist:pendingVideo.artist||'YouTube',
      playing,position,updatedAt:Date.now()
    }});
  }catch{}
}
async function partyAdvanceQueue(){
  if(!partySession||partySession.role!=='host')return;
  try{
    const result=await partyRequest('start-next');
    const track=result.playback;
    if(track?.youtubeId){
      youtubeQueue=[{id:track.youtubeId,title:track.title,artist:track.artist}];
      queuePosition=0;
      showYoutube({id:track.youtubeId,title:track.title,artist:track.artist},true);
    }else{
      youtubeIsPlaying=false;
      partyLastPublishedKey='';
      syncTransport();
    }
    await partyRefresh();
  }catch(e){partyError(e.message);}
}
function partyApplyPlayback(playback){
  if(!partySession||partySession.role!=='guest'||!playback?.youtubeId)return;
  const song={id:playback.youtubeId,title:playback.title||'Untitled',artist:playback.artist||'YouTube'};
  const currentTime=()=>{
    try{return player?.getCurrentTime?Number(player.getCurrentTime())||0:0;}catch{return 0;}
  };
  if(partyRemoteTrack!==song.id){
    partyRemoteTrack=song.id;
    partyApplyingRemote=true;
    youtubeQueue=[song];queuePosition=0;
    showYoutube(song,false);
    const apply=()=>{
      if(!player?.getPlayerState)return;
      try{
        const target=Math.max(0,Number(playback.position)||0)+(playback.playing?Math.max(0,(Date.now()-Number(playback.updatedAt||Date.now()))/1000):0);
        player.seekTo(target,true);
        if(playback.playing)player.playVideo();else player.pauseVideo();
        $('partyStatus').textContent='Following host: '+song.title+'. If playback is blocked, tap Play once in the player.';
      }catch{}
      partyApplyingRemote=false;
    };
    setTimeout(apply,700);
    return;
  }
  if(!player?.getPlayerState)return;
  try{
    const target=Math.max(0,Number(playback.position)||0)+(playback.playing?Math.max(0,(Date.now()-Number(playback.updatedAt||Date.now()))/1000):0);
    if(Math.abs(currentTime()-target)>5)player.seekTo(target,true);
    const state=player.getPlayerState();
    if(playback.playing&&state!==1&&state!==3)player.playVideo();
    if(!playback.playing&&state===1)player.pauseVideo();
  }catch{}
}
function partyRender(data){
  $('partyCodeDisplay').textContent=data.party.code;
  $('partyMemberCount').textContent=(data.members.length)+' member'+(data.members.length===1?'':'s');
  $('partyClose').hidden=data.role!=='host';
  $('partyLeave').textContent=data.role==='host'?'Close party':'Leave party';
  $('partyMembers').replaceChildren();
  data.members.forEach(member=>{
    const row=node('div',undefined,'party-member');
    const avatar=node('span',member.role==='host'?'♛':'♟','party-avatar');
    const details=node('span',undefined,'party-member-copy');details.append(node('strong',member.name),node('small',member.role==='host'?'HOST':'GUEST'));
    row.append(avatar,details);
    if(data.role==='host'&&member.role==='guest')row.append(button('Remove',async()=>{try{await partyRequest('remove-member',{memberId:member.id});await partyRefresh();}catch(e){partyError(e.message);}},'Remove '+member.name+' from party'));
    $('partyMembers').append(row);
  });
  $('partyQueue').replaceChildren();
  if(!data.queue.length)$('partyQueue').append(node('p','No songs yet. Add one from YouTube search using ♟ Party +.'));
  data.queue.forEach((track,index)=>{
    const row=node('div',undefined,'party-queue-item');
    const thumb=node('img');thumb.src='https://i.ytimg.com/vi/'+track.youtube_id+'/mqdefault.jpg';thumb.alt='';thumb.loading='lazy';
    const copy=node('span',undefined,'party-queue-copy');copy.append(node('strong',track.title),node('small',track.artist+' · added by '+track.added_by));
    row.append(thumb,copy);
    if(data.role==='host')row.append(button('▶ Play now',async()=>{
      try{
        const result=await partyRequest('start-queued',{queueId:track.id});
        const current=result.playback;
        if(current?.youtubeId){
          youtubeQueue=[{id:current.youtubeId,title:current.title,artist:current.artist}];
          queuePosition=0;
          showYoutube({id:current.youtubeId,title:current.title,artist:current.artist},true);
        }
        await partyRefresh();
      }catch(e){partyError(e.message);}
    },'Play '+track.title+' now'));
    $('partyQueue').append(row);
  });
}
async function partyRefresh(){
  if(!partySession||partyPollBusy)return;
  partyPollBusy=true;
  try{
    const data=await partyRequest('state');
    data.queue.forEach(track=>partySeenQueue.add(track.id));
    partyRender(data);
    if(partySession.role==='guest')partyApplyPlayback(data.playback);
    if(!$('partyDialog').open) $('partyStatus').textContent='Party connected · host controls playback · shared queue updates automatically.';
  }catch(e){
    if(/ended|removed|session expired/i.test(e.message)){
      partySetSession(null);partyError(e.message);
    }else $('partyStatus').textContent='Reconnecting…';
  }finally{partyPollBusy=false;}
}
$('barParty').onclick=()=>{
  partyError('');
  if(!$('partyDialog').open)showDialog('partyDialog');
  if(partySession)partyRefresh();
};
$('partyCreate').onclick=partyCreate;
$('partyJoinToggle').onclick=()=>{$('partyJoinForm').hidden=!$('partyJoinForm').hidden;};
$('partyJoinForm').onsubmit=partyJoin;
$('partyCopy').onclick=async()=>{try{await navigator.clipboard.writeText($('partyCodeDisplay').textContent);$('partyStatus').textContent='Party code copied. Send it to your friends.';}catch{$('partyStatus').textContent='Your party code is '+$('partyCodeDisplay').textContent+'. Copy it manually.';}};
$('partyClose').onclick=async()=>{
  if(!partySession||partySession.role!=='host')return;
  if(!confirm('End this party for everyone?'))return;
  try{await partyRequest('close');partySetSession(null);partyError('Party ended.');}catch(e){partyError(e.message);}
};
$('partyLeave').onclick=async()=>{
  if(!partySession)return;
  try{
    if(partySession.role==='host')await partyRequest('close');
    else await partyRequest('leave');
    partySetSession(null);$('partyStatus').textContent='You left the party.';
  }catch(e){partyError(e.message);}
};
if(partySession){
  $('partyStart').hidden=true;$('partyRoom').hidden=false;
  $('barParty').classList.add('party-active');
  $('barParty').setAttribute('aria-label','Open active listening party');
  partyPollTimer=setInterval(()=>{
    partyRefresh();
    if(partySession?.role==='host')partyPublishPlayback(false);
  },4000);
  window.addEventListener('storage',e=>{if(e.key==='musikero-party-session'&&!e.newValue)partySetSession(null);});
  setTimeout(partyRefresh,500);
}else{
  $('partyRoom').hidden=true;
}

renderLocal();
render();
showSectionView();
syncTransport();
