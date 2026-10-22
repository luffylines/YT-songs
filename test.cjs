const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('dist/app.js','utf8');const parser=source.slice(source.indexOf('const validId'),source.indexOf('let state'));
const parse=vm.runInNewContext(parser+'\nparseVideo',{URL});
for(const link of ['https://www.youtube.com/watch?v=dQw4w9WgXcQ','https://youtu.be/dQw4w9WgXcQ?t=2','https://youtube.com/shorts/dQw4w9WgXcQ','https://music.youtube.com/watch?v=dQw4w9WgXcQ'])assert.equal(parse(link),'dQw4w9WgXcQ');
for(const link of ['https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ','javascript:alert(1)','https://youtube.com/watch?v=bad','https://example.com/dQw4w9WgXcQ','ftp://youtube.com/watch?v=dQw4w9WgXcQ'])assert.equal(parse(link),null);
const html=fs.readFileSync('dist/index.html','utf8');for(const [,id]of source.matchAll(/\$\('([^']+)'\)/g))assert.ok(html.includes('id="'+id+'"'),'Missing DOM element '+id);
console.log('PASS: 9 URL parsing cases and DOM bindings');


const searchHandler=require('./api/search.js');
const originalFetch=global.fetch;
function mockResponse(){
 const out={code:200,headers:{},body:null};
 const res={setHeader(k,v){out.headers[k]=v;return res;},status(n){out.code=n;return res;},json(x){out.body=x;return res;}};
 return {out,res};
}
(async()=>{
  const oldKey=process.env.YOUTUBE_API_KEY;
  try{
    delete process.env.YOUTUBE_API_KEY;
    let {out,res}=mockResponse();
    await searchHandler({method:'GET',query:{q:'OPM'}},res);
    assert.equal(out.code,503);
    process.env.YOUTUBE_API_KEY='unit-test-secret';
    ({out,res}=mockResponse());
    await searchHandler({method:'GET',query:{q:''}},res);
    assert.equal(out.code,400);
    ({out,res}=mockResponse());
    await searchHandler({method:'POST',query:{q:'OPM'}},res);
    assert.equal(out.code,405);
    global.fetch=async url=>{
      const u=new URL(url);assert.equal(u.searchParams.get('key'),'unit-test-secret');
      assert.equal(u.searchParams.get('order'),'date');
      assert.equal(u.searchParams.get('videoEmbeddable'),'true');
      return {ok:true,json:async()=>({items:[{id:{videoId:'dQw4w9WgXcQ'},snippet:{title:'Test song',channelTitle:'Test artist'}},{id:{videoId:'bad'},snippet:{title:'Bad'}}]})};
    };
    ({out,res}=mockResponse());
    await searchHandler({method:'GET',query:{q:'OPM',sort:'date'}},res);
    assert.equal(out.code,200);
    assert.equal(out.body.items.length,1);
    assert.equal(JSON.stringify(out.body).includes('unit-test-secret'),false);
    assert.ok(out.headers['Cache-Control']);
    global.fetch=async()=>({ok:false,status:403,json:async()=>({error:{errors:[{reason:'quotaExceeded'}]}})});
    ({out,res}=mockResponse());
    await searchHandler({method:'GET',query:{q:'OPM'}},res);
    assert.equal(out.code,429);

    const catalogHandler=require('./api/catalog.js');
    const oldJamendo=process.env.JAMENDO_CLIENT_ID;
    try{
      delete process.env.JAMENDO_CLIENT_ID;
      ({out,res}=mockResponse());
      await catalogHandler({method:'GET',query:{}},res);
      assert.equal(out.code,503,'no fake music without client ID');
      process.env.JAMENDO_CLIENT_ID='private-test-id';
      ({out,res}=mockResponse());
      await catalogHandler({method:'GET',query:{page:'0'}},res);
      assert.equal(out.code,400);
      ({out,res}=mockResponse());
      await catalogHandler({method:'GET',query:{genre:'invalid'}},res);
      assert.equal(out.code,400);
      ({out,res}=mockResponse());
      await catalogHandler({method:'GET',query:{track:'bad'}},res);
      assert.equal(out.code,400);
      const recorded=[];
      global.fetch=async url=>{
        const req=new URL(url);recorded.push(req);
        assert.equal(req.hostname,'api.jamendo.com');
        assert.equal(req.searchParams.get('client_id'),'private-test-id');
        return {ok:true,json:async()=>({
          headers:{status:'success'},
          results:[{id:'12345',name:'Fresh Track',artist_name:'Independent Artist',image:'https://usercontent.jamendo.com/a.jpg',audio:'https://prod-1.storage.jamendo.com/12345.mp3',shareurl:'https://www.jamendo.com/track/12345',releasedate:'2026-10-22'},{
            id:'12346',name:'Untrusted',audio:'https://evil.example/12346.mp3',shareurl:'https://evil.example/track/12346'}]
        })};
      };
      ({out,res}=mockResponse());
      await catalogHandler({method:'GET',query:{page:'2',sort:'new'}},res);
      assert.equal(out.code,200);
      assert.equal(recorded.at(-1).searchParams.get('offset'),'40');
      assert.equal(recorded.at(-1).searchParams.get('order'),'releasedate_desc');
      assert.equal(out.body.items.length,1);
      assert.equal(out.body.items[0].id,'jm-12345');
      assert.equal(JSON.stringify(out.body).includes('private-test-id'),false);
      assert.equal(JSON.stringify(out.body).includes('evil.example'),false);
      ({out,res}=mockResponse());
      await catalogHandler({method:'GET',query:{q:'jazz',genre:'jazz'}},res);
      assert.equal(recorded.at(-1).searchParams.get('search'),'jazz');
      assert.equal(recorded.at(-1).searchParams.get('order'),'relevance');
      ({out,res}=mockResponse());
      await catalogHandler({method:'GET',query:{track:'12345',page:'5'}},res);
      assert.equal(out.code,200);
      assert.equal(recorded.at(-1).searchParams.get('id'),'12345');
      assert.equal(recorded.at(-1).searchParams.get('limit'),'1');
      assert.equal(out.body.hasMore,false);
      console.log('PASS: non-commercial catalog validation, paginated 2K support, stream URL safety and on-demand track refresh');
    }finally{
      if(oldJamendo===undefined)delete process.env.JAMENDO_CLIENT_ID;
      else process.env.JAMENDO_CLIENT_ID=oldJamendo;
    }

    console.log('PASS: API key safety, validation, search mapping, and quota errors');
  }finally{
    global.fetch=originalFetch;
    if(oldKey===undefined)delete process.env.YOUTUBE_API_KEY;
    else process.env.YOUTUBE_API_KEY=oldKey;
  }
})().catch(error=>{console.error(error);process.exitCode=1;});


const styles=fs.readFileSync('dist/style.css','utf8');
for(const id of ['bottomPlayer','barPlay','barPrev','barNext','barQueue','queuePanel','queueItems','playerPanel','player','seekSlider','audioPlayer','barArtwork','barTitle','barArtist']){
  assert.ok(html.includes('id="'+id+'"'),'Player UI missing: '+id);
}
assert.match(source,/function syncTransport\(\)/);
assert.match(source,/function renderQueue\(\)/);
assert.match(source,/function showYoutube\(song,autoplay=true\)/);
assert.match(source,/playerVars:\{playsinline:1,origin:location.origin,controls:1\}/);
assert.match(source,/if\(document.hidden&&activeSource==='youtube'\)player\?\.pauseVideo/);
assert.match(styles,/\.bottom-player\{position:fixed/);
assert.match(styles,/#player\{height:230px;min-height:200px/);
assert.match(styles,/@media\(max-width:700px\)/);
assert.doesNotMatch(source,/audioPanel|closePlayer|nextAudio|prevAudio/);
const mover=source.slice(source.indexOf('function moveQueue(delta)'),source.indexOf('function togglePlayback()'));
assert.ok(mover.startsWith('function moveQueue(delta)'),'Queue movement handler missing');
const moves=vm.runInNewContext(`(()=>{
 let activeSource='youtube',queuePosition=0,youtubeQueue=[{id:'first'},{id:'second'}],localTracks=[],activeAudio=-1;
 let history=[],showYoutube=(song)=>history.push(song.id),playLocal=()=>{};
 ${mover}
 return {next:moveQueue(1),pastEnd:moveQueue(1),prev:moveQueue(-1),pastStart:moveQueue(-1),history,queuePosition};
})()`);
assert.equal(moves.next,true);
assert.equal(moves.pastEnd,false);
assert.equal(moves.prev,true);
assert.equal(moves.pastStart,false);
assert.deepEqual(Array.from(moves.history),['second','first']);
assert.equal(moves.queuePosition,0);
console.log('PASS: permanent music dock, visible YouTube player, queue bounds, and mobile layout');


const manifest=JSON.parse(fs.readFileSync('dist/manifest.webmanifest','utf8'));
const icon=fs.readFileSync('dist/icon.svg','utf8');
const sw=fs.readFileSync('dist/sw.js','utf8');
assert.equal(manifest.short_name,'Musikero');
assert.equal(manifest.theme_color,'#080a0a');
assert.match(html,/<title>Musikero — Feel every note<\/title>/i);
assert.match(html,/class="hero-art"/);
assert.match(html,/class="album-sleeve"/);
assert.match(html,/class="record"/);
assert.match(html,/id="exploreMusic"/);
assert.doesNotMatch(html,/Tambay/i);
assert.match(styles,/--bg:#080a0a/);
assert.match(styles,/perspective:1000px;transform-style:preserve-3d/);
assert.match(styles,/rotateY\(-20deg\)/);
assert.match(styles,/@media\(prefers-reduced-motion:reduce\)/);
assert.match(styles,/@media\(max-width:700px\)/);
assert.match(icon,/<title id="title">Musikero<\/title>/);
assert.match(sw,/musikero-shell-v1/);
assert.match(source,/getItem\('musikero-v1'\) \|\| localStorage\.getItem\('tambay-v1'\)/);
assert.match(source,/setItem\('musikero-v1'/);
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);
assert.equal(ids.length,new Set(ids).size,'duplicate HTML ID');
console.log('PASS: Musikero branding, luxury 3D design, mobile accessibility and saved-playlist migration');

const catalogScript=fs.readFileSync('dist/catalog.js','utf8');
const catalogApi=fs.readFileSync('api/catalog.js','utf8');
const shell=fs.readFileSync('dist/sw.js','utf8');
for(const [,id] of catalogScript.matchAll(/el\('([^']+)'\)/g))
  assert.ok(html.includes('id="'+id+'"'),'Missing catalog UI: '+id);
for(const id of ['catalogSection','catalogResults','catalogMore','catalogQuery','catalogForm','catalogStatus','catalogCount','showIndependent']){
  assert.ok(html.includes('id="'+id+'"'),'Missing music catalog control: '+id);
}
assert.match(source,/window\.MusikeroAudio=Object\.freeze/);
assert.match(source,/navigator\.mediaSession\.setActionHandler\('nexttrack'/);
assert.match(catalogScript,/musikero-indie-favorites-v1/);
assert.match(catalogScript,/localStorage\.setItem\(STORAGE_KEY/);
assert.doesNotMatch(catalogScript,/localStorage\.setItem\([^)]*\.audio/);
assert.match(catalogApi,/const PAGE_SIZE=40;/);
assert.match(shell, /if\(url\.origin!==self\.location\.origin \|\| url\.pathname\.startsWith\('\/api\/'\)\)return;/);
assert.ok(shell.includes("'/catalog.js'"));
assert.ok(html.includes('Music via Jamendo'));
assert.ok(styles.includes('.catalog-section{'));
console.log('PASS: independent music UI, mobile styles, catalog metadata-only favorites and offline audio exclusions');
