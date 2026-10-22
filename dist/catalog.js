'use strict';
// Musikero independent music: browsing, favorites and provider attribution.
// Music streams are never downloaded, stored offline or inserted into a service worker cache.
(()=>{
  const el=id=>document.getElementById(id);
  const container=el('catalogResults');
  if(!container||!window.MusikeroAudio)return;
  const STORAGE_KEY='musikero-indie-favorites-v1';
  let catalog=[],favoriteMap=new Map(),currentTab='popular',currentGenre='',query='',page=0,hasMore=false;
  let requestId=0,loading=false;
  function txt(tag,value,className){
    const element=document.createElement(tag);
    if(value!==undefined)element.textContent=value;
    if(className)element.className=className;
    return element;
  }
  function control(value,fn,className){
    const b=txt('button',value,className);b.type='button';b.onclick=fn;return b;
  }
  function permittedUrl(value){
    try{
      const u=new URL(value);
      return u.protocol==='https:'&&(u.hostname==='jamendo.com'||u.hostname.endsWith('.jamendo.com'))?u.href:'';
    }catch{return '';}
  }
  function compactTrack(t){
    if(!t||!/^jm-\d+$/.test(t.id))return null;
    const sourceUrl=permittedUrl(t.sourceUrl);
    if(!sourceUrl)return null;
    return {id:t.id,title:String(t.title||'Untitled').slice(0,180),
      artist:String(t.artist||'Independent artist').slice(0,150),
      image:permittedUrl(t.image),sourceUrl};
  }
  try{
    const saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');
    if(Array.isArray(saved)){
      favoriteMap=new Map(saved.slice(0,500).map(compactTrack).filter(Boolean).map(track=>[track.id,track]));
    }
  }catch{}
  function saveFavorites(){
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify([...favoriteMap.values()]));}
    catch{message('Could not save favorites on this browser.');}
  }
  function message(m){el('catalogStatus').textContent=m;}
  function isFavorite(id){return favoriteMap.has(id);}
  function toggleFavorite(track){
    const value=compactTrack(track);
    if(!value)return;
    if(favoriteMap.has(value.id))favoriteMap.delete(value.id);
    else if(favoriteMap.size<500)favoriteMap.set(value.id,value);
    else{message('Saved favorites are limited to 500 tracks in this browser.');return;}
    saveFavorites();
    render();
    window.MusikeroAudio.refresh();
  }
  function updateTabs(){
    document.querySelectorAll('[data-catalog-tab]').forEach(btn=>{
      const selected=btn.dataset.catalogTab===currentTab;
      btn.classList.toggle('selected',selected);btn.setAttribute('aria-pressed',String(selected));
    });
    document.querySelectorAll('[data-catalog-genre]').forEach(btn=>{
      const selected=btn.dataset.catalogGenre===currentGenre;
      btn.classList.toggle('selected',selected);btn.setAttribute('aria-pressed',String(selected));
    });
  }
  function sourceLink(track){
    const a=txt('a','Artist & track ↗','catalog-source');
    a.href=track.sourceUrl;a.target='_blank';a.rel='noopener noreferrer';return a;
  }
  async function startTrack(track){
    if(track.audio){
      window.MusikeroAudio.play(track,catalog);
      return;
    }
    // Favorites contain metadata, never a persisted streaming URL.
    const id=track.id?.replace(/^jm-/,'');
    if(!/^\d+$/.test(id||''))return;
    message('Checking this song is still available…');
    try{
      const response=await fetch('/api/catalog?track='+encodeURIComponent(id),{signal:AbortSignal.timeout(13000)});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||'Unavailable track.');
      const current=(data.items||[]).find(x=>x.id===track.id);
      if(!current)throw new Error('This track is no longer available on the provider.');
      window.MusikeroAudio.play(current,[current]);
      message('Playing '+current.title+' · Jamendo.');
    }catch(error){message(error.message||'This independent track is unavailable.');}
  }
  function render(){
    updateTabs();
    const tracks=currentTab==='saved'?[...favoriteMap.values()]:catalog;
    container.replaceChildren();
    for(const track of tracks){
      const card=txt('article',undefined,'catalog-card');
      const art=control('▶',()=>startTrack(track),'catalog-cover');
      art.setAttribute('aria-label','Play '+track.title);
      if(track.image){
        const img=txt('img');img.src=track.image;img.alt='';img.loading='lazy';art.prepend(img);
      }
      const details=txt('div',undefined,'catalog-details');
      details.append(txt('strong',track.title),txt('small',track.artist));
      if(track.released)details.append(txt('span',track.released,'catalog-date'));
      const actions=txt('div',undefined,'catalog-actions');
      const listen=control('▶ Listen',()=>startTrack(track),'catalog-listen');
      const like=control(isFavorite(track.id)?'♥':'♡',()=>toggleFavorite(track),'catalog-like');
      like.classList.toggle('selected',isFavorite(track.id));
      like.setAttribute('aria-label',(isFavorite(track.id)?'Remove favorite ':'Save favorite ')+track.title);
      like.setAttribute('aria-pressed',String(isFavorite(track.id)));
      actions.append(listen,like,sourceLink(track));
      card.append(art,details,actions);container.append(card);
    }
    if(!tracks.length&&!loading){
      const empty=txt('div',undefined,'catalog-empty');
      empty.append(txt('strong',currentTab==='saved'?'No favorites saved yet.':'No tracks found.'),
        txt('p',currentTab==='saved'?'Save songs with the heart button to build a personal listening collection.':'Try a different search or music genre.'));
      container.append(empty);
    }
    el('catalogCount').textContent=tracks.length+' '+(tracks.length===1?'track':'tracks')+(currentTab==='saved'?' saved':' shown');
    el('catalogMore').hidden=currentTab==='saved'||!hasMore;
  }
  async function browse({more=false}={}){
    if(loading)return;
    if(currentTab==='saved'){render();message('Your favorites are saved as metadata in this browser; audio is fetched when you press Play.');return;}
    if(!more){catalog=[];page=0;hasMore=false;render();}
    loading=true;
    const seq=++requestId,nextPage=page+1;
    el('catalogMore').disabled=true;
    message('Loading independent music…');
    try{
      const params=new URLSearchParams({page:String(nextPage),sort:currentTab,genre:currentGenre,q:query});
      const response=await fetch('/api/catalog?'+params,{signal:AbortSignal.timeout(14000)});
      const data=await response.json();
      if(seq!==requestId)return;
      if(!response.ok)throw new Error(data.error||'Music is currently unavailable.');
      const existing=new Set(catalog.map(t=>t.id));
      const newItems=(Array.isArray(data.items)?data.items:[]).filter(t=>/^jm-\d+$/.test(t.id||'')&&permittedUrl(t.audio)&&permittedUrl(t.sourceUrl)&&!existing.has(t.id));
      catalog.push(...newItems);
      page=nextPage;hasMore=data.hasMore===true&&page<50;
      message(catalog.length+' independent tracks loaded · '+(currentTab==='new'?'Newest releases':'Popular tracks')+'. Tracks stream from Jamendo.');
    }catch(error){
      message(error.message||'Unable to load independent music.');
      const a=txt('a',' Configure Jamendo API ↗');
      a.href='https://devportal.jamendo.com/';a.target='_blank';a.rel='noopener noreferrer';
      if(/not configured/i.test(error.message||''))el('catalogStatus').append(a);
    }finally{
      loading=false;el('catalogMore').disabled=false;
      render();
    }
  }
  document.querySelectorAll('[data-catalog-tab]').forEach(btn=>btn.onclick=()=>{
    currentTab=btn.dataset.catalogTab;requestId++;loading=false;
    if(currentTab==='saved') {render();message('Your saved independent songs. Playback refreshes provider rights on demand.');}
    else browse();
  });
  document.querySelectorAll('[data-catalog-genre]').forEach(btn=>btn.onclick=()=>{
    currentGenre=btn.dataset.catalogGenre;currentTab='popular';query='';el('catalogQuery').value='';
    requestId++;loading=false;browse();
  });
  el('catalogForm').onsubmit=e=>{
    e.preventDefault();query=el('catalogQuery').value.trim();currentTab='popular';
    requestId++;loading=false;browse();
  };
  el('catalogMore').onclick=()=>browse({more:true});
  el('showIndependent').onclick=()=>el('catalogSection').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'start'});
  window.MusikeroCatalog=Object.freeze({isFavorite,toggleFavorite});
  render();
  browse();
})();
