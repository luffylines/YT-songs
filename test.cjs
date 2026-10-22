const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('dist/app.js','utf8');const parser=source.slice(source.indexOf('const validId'),source.indexOf('let state'));
const parse=vm.runInNewContext(parser+'\nparseVideo',{URL});
for(const link of ['https://www.youtube.com/watch?v=dQw4w9WgXcQ','https://youtu.be/dQw4w9WgXcQ?t=2','https://youtube.com/shorts/dQw4w9WgXcQ','https://music.youtube.com/watch?v=dQw4w9WgXcQ'])assert.equal(parse(link),'dQw4w9WgXcQ');
for(const link of ['https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ','javascript:alert(1)','https://youtube.com/watch?v=bad','https://example.com/dQw4w9WgXcQ','ftp://youtube.com/watch?v=dQw4w9WgXcQ'])assert.equal(parse(link),null);
const html=fs.readFileSync('dist/index.html','utf8');for(const [,id]of source.matchAll(/\$\('([^']+)'\)/g))assert.ok(html.includes('id="'+id+'"'),'Missing DOM element '+id);
console.log('PASS: 9 URL parsing cases and DOM bindings');
