import assert from 'node:assert/strict';
const origin=process.env.CHESS_PREVIEW_URL || 'http://127.0.0.1:4173';
async function request(path,token,body){const response=await fetch(origin+'/api/rooms'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),...(body?{Origin:origin}:{})},...(body?{body:JSON.stringify(body)}:{})});let data;try{data=await response.json();}catch{throw Error('Non-JSON response '+response.status+' at '+path);}return {status:response.status,data};}
const created=await request('',null,{});assert.equal(created.status,201,JSON.stringify(created.data));const id='/'+created.data.room,w=created.data.token;
const joined=await request(id+'/join',null,{});assert.equal(joined.status,200);assert.equal(joined.data.role,'black');const b=joined.data.token;
const spectator=await request(id+'/join',null,{});assert.equal(spectator.data.role,'spectator');assert.equal(spectator.data.token,null);
assert.equal((await request(id+'/join',w,{})).data.role,'white');
const move={from:'e2',to:'e4',revision:1,requestId:crypto.randomUUID()};
assert.equal((await request(id+'/move',null,move)).status,403);
assert.equal((await request(id+'/move',b,{...move,from:'e7',to:'e5'})).data.code,'wrong_turn');
assert.equal((await request(id+'/move',w,{...move,to:'e5'})).data.code,'illegal_move');
const played=await request(id+'/move',w,move);assert.equal(played.status,200,JSON.stringify(played.data));assert.equal(played.data.revision,2);
assert.equal((await request(id+'/move',w,move)).data.revision,2);
const blackMove={from:'e7',to:'e5',revision:2,requestId:crypto.randomUUID()};
assert.equal((await request(id+'/move',b,blackMove)).status,200);
// Reload through new requests using separately retained white and black credentials.
for(const [token,role] of [[w,'white'],[b,'black'],[null,'spectator']]){const reload=await request(id,token);assert.equal(reload.status,200);assert.equal(reload.data.role,role);assert.equal(reload.data.revision,3);assert.deepEqual(reload.data.history,['e4','e5']);assert.ok(!JSON.stringify(reload.data).includes(w));assert.ok(!JSON.stringify(reload.data).includes(b));}
assert.equal((await request(id+'/move',w,{from:'g1',to:'f3',revision:2,requestId:crypto.randomUUID()})).data.code,'stale_revision');
const cross=await fetch(origin+'/api/rooms'+id+'/action',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://evil.example',Authorization:'Bearer '+w},body:JSON.stringify({action:'resign',revision:3,requestId:crypto.randomUUID()})});assert.equal(cross.status,403);
const end=await request(id+'/action',w,{action:'resign',revision:3,requestId:crypto.randomUUID()});assert.equal(end.data.status,'finished');assert.equal(end.data.result,'black');assert.equal((await request(id,b)).data.reason,'resignation');
console.log('PASS: actual HTTP create, join, two credentials, spectator privacy, legal/illegal moves, turn ownership, retry deduplication, stale revisions, reload persistence, cross-origin rejection, resignation.');
