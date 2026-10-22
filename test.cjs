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
