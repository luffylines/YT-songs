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
