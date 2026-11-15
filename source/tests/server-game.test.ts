import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync,type SQLInputValue} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {Chess} from 'chess.js';
// @ts-expect-error Node's native TypeScript test runner requires the source extension.
import {handleGame,type GameDB} from '../lib/server-game.ts';
type TestResponse={token:string;room:string;role:string;revision:number;history:string[];moves:{promotion?:string}[];state:{revision:number};status:string;result:string|null;reason:string|null;drawOffer:string|null;fen:string;check:boolean;code:string};
function setup(){
 const sqlite=new DatabaseSync(':memory:');
 for(const f of readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort()) sqlite.exec(readFileSync(new URL('../drizzle/'+f,import.meta.url),'utf8'));
 const db:GameDB={prepare(sql:string){const statement=sqlite.prepare(sql);const wrap=(values:unknown[]):ReturnType<GameDB['prepare']>=>({bind:(...v:unknown[])=>wrap(v),first:async<T>()=>(statement.get(...values as SQLInputValue[])??null) as T|null,run:async()=>({meta:{changes:Number(statement.run(...values as SQLInputValue[]).changes)}})});return wrap([]);}};
 const req=async(path:string,token?:string,data?:unknown,method=data?'POST':'GET')=>{const response=await handleGame(new Request('https://test/api/rooms'+path,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(data?{'Content-Type':'application/json'}:{})},...(data?{body:JSON.stringify(data)}:{})}),db);return {status:response.status,body:await response.json() as TestResponse};};
 return {req,sqlite,db};
}
test('two independent players, legal turns, privacy, stale revisions, retries, resignation',async()=>{
 const {req}=setup();const created=await req('',undefined,{});assert.equal(created.status,201);const w=created.body.token,id='/'+created.body.room;
 assert.equal((await req(id,w)).body.role,'white');
 const joined=await req(id+'/join',undefined,{});const b=joined.body.token;assert.equal(joined.body.role,'black');
 const viewer=await req(id+'/join',undefined,{});assert.equal(viewer.body.role,'spectator');assert.equal(viewer.body.token,null);
 assert.equal((await req(id+'/join',w,{})).body.role,'white');
 const initial=await req(id,b);assert.equal(initial.body.revision,1);assert.ok(!JSON.stringify(initial.body).includes(w));assert.ok(!JSON.stringify(initial.body).includes(b));
 const move={from:'e2',to:'e4',revision:1,requestId:'white-001'};
 assert.equal((await req(id+'/move',undefined,move)).status,403);
 assert.equal((await req(id+'/move',b,{...move,from:'e7',to:'e5'})).body.code,'wrong_turn');
 assert.equal((await req(id+'/move',w,{...move,from:['e2']})).body.code,'invalid_move');
 assert.equal((await req(id+'/move',w,{...move,to:'e5'})).body.code,'illegal_move');
 const moved=await req(id+'/move',w,move);assert.equal(moved.status,200);assert.deepEqual(moved.body.history,['e4']);
 assert.equal((await req(id+'/move',w,move)).body.revision,2);
 assert.equal((await req(id+'/move',w,{...move,to:'e3'})).body.code,'request_reused');
 assert.equal((await req(id+'/move',b,{from:'e7',to:'e5',revision:1,requestId:'black-001'})).body.code,'stale_revision');
 assert.equal((await req(id+'/move',b,{from:'e7',to:'e5',revision:2,requestId:'black-001'})).status,200);
 const resigned=await req(id+'/action',w,{action:'resign',revision:3,requestId:'resign-01'});assert.equal(resigned.body.result,'black');assert.equal(resigned.body.status,'finished');
 assert.equal((await req(id+'/move',w,{from:'g1',to:'f3',revision:4,requestId:'white-002'})).body.code,'finished');
});
test('simultaneous joins allocate only one black seat; simultaneous moves apply once',async()=>{
 const {req}=setup();const c=(await req('',undefined,{})).body,id='/'+c.room;
 const joins=await Promise.all([req(id+'/join',undefined,{}),req(id+'/join',undefined,{})]);assert.deepEqual(joins.map(x=>x.body.role).sort(),['black','spectator']);
 const move={from:'e2',to:'e4',revision:1,requestId:'concurrent-1'};
 const results=await Promise.all([req(id+'/move',c.token,move),req(id+'/move',c.token,move)]);assert.ok(results.every(r=>r.status===200));assert.equal((await req(id)).body.history.length,1);
});
test('full history preserves threefold repetition',async()=>{
 const {req}=setup();const c=(await req('',undefined,{})).body,id='/'+c.room;const b=(await req(id+'/join',undefined,{})).body.token;
 const cycle=[['g1','f3'],['g8','f6'],['f3','g1'],['f6','g8']];let last=await req(id);
 for(let i=0;i<8;i++){const [from,to]=cycle[i%4];last=await req(id+'/move',i%2?b:c.token,{from,to,revision:i+1,requestId:'repeat-00'+i});assert.equal(last.status,200);}
 assert.equal(last.body.result,'draw');assert.equal(last.body.reason,'repetition');
});
test('draw needs opponent approval and expiry prevents reads or play',async()=>{
 const {req,sqlite}=setup();const c=(await req('',undefined,{})).body,id='/'+c.room;const b=(await req(id+'/join',undefined,{})).body.token;
 assert.equal((await req(id+'/action',c.token,{action:'offer_draw',revision:1,requestId:'offer-001'})).body.drawOffer,'white');
 assert.equal((await req(id+'/action',c.token,{action:'accept_draw',revision:2,requestId:'accept-01'})).status,409);
 assert.equal((await req(id+'/action',b,{action:'accept_draw',revision:2,requestId:'accept-01'})).body.result,'draw');
 sqlite.prepare('UPDATE chess_rooms SET expires_at = 0 WHERE id = ?').run(c.room);assert.equal((await req(id,c.token)).status,410);
});
test('checkmate is authoritative and stops further moves',async()=>{
 const {req}=setup();const c=(await req('',undefined,{})).body,id='/'+c.room;const b=(await req(id+'/join',undefined,{})).body.token;
 const sequence=[['f2','f3'],['e7','e5'],['g2','g4'],['d8','h4']];let last=await req(id);
 for(let i=0;i<sequence.length;i++){const [from,to]=sequence[i];last=await req(id+'/move',i%2?b:c.token,{from,to,revision:i+1,requestId:'mate-000'+i});assert.equal(last.status,200);}
 assert.equal(last.body.result,'black');assert.equal(last.body.reason,'checkmate');assert.equal(last.body.check,true);
});
test('castling and en passant survive persisted history replay',async()=>{
 for(const sequence of [
 [['e2','e4'],['e7','e5'],['g1','f3'],['b8','c6'],['f1','c4'],['g8','f6'],['e1','g1']],
 [['e2','e4'],['a7','a6'],['e4','e5'],['d7','d5'],['e5','d6']]
 ]){
 const {req}=setup();const c=(await req('',undefined,{})).body,id='/'+c.room;const b=(await req(id+'/join',undefined,{})).body.token;let last=await req(id);
 for(let i=0;i<sequence.length;i++){const [from,to]=sequence[i];last=await req(id+'/move',i%2?b:c.token,{from,to,revision:i+1,requestId:'special-'+i});assert.equal(last.status,200);}
 const restored=(await req(id)).body;assert.equal(restored.fen,last.body.fen);assert.deepEqual(restored.history,last.body.history);
 assert.equal(last.body.history.at(-1),sequence.length===7?'O-O':'exd6');
 }
});
test('promotion and underpromotion are validated and persisted',async()=>{
 const {req}=setup();const c=(await req('',undefined,{})).body,id='/'+c.room;const b=(await req(id+'/join',undefined,{})).body.token;
 const sequence=[['a2','a4'],['h7','h5'],['a4','a5'],['h5','h4'],['a5','a6'],['h4','h3'],['a6','b7'],['h3','g2']];
 for(let i=0;i<sequence.length;i++){const [from,to]=sequence[i];assert.equal((await req(id+'/move',i%2?b:c.token,{from,to,revision:i+1,requestId:'promote-'+i})).status,200);}
 assert.equal((await req(id+'/move',c.token,{from:'b7',to:'a8',promotion:'k',revision:9,requestId:'promotion-err'})).status,400);
 const promoted=await req(id+'/move',c.token,{from:'b7',to:'a8',promotion:'n',revision:9,requestId:'promotion-ok'});assert.equal(promoted.status,200);assert.equal(promoted.body.moves.at(-1)?.promotion,'n');assert.equal(promoted.body.fen.split('/')[0][0],'N');
 assert.equal((await req(id)).body.fen,promoted.body.fen);
});
test('cross-origin writes, simple forms, and oversized streamed JSON are rejected',async()=>{
 const {db,req}=setup();
 for(const headers of [ {'Content-Type':'application/json',Origin:'https://evil.test'}, {'Content-Type':'application/json','Sec-Fetch-Site':'cross-site'} ]){
  const r=await handleGame(new Request('https://test/api/rooms',{method:'POST',headers:headers as unknown as Record<string,string>,body:'{}'}),db);assert.equal(r.status,403);
 }
 assert.equal((await handleGame(new Request('https://test/api/rooms',{method:'POST',headers:{'Content-Type':'text/plain'},body:'{}'}),db)).status,415);
 const c=(await req('',undefined,{})).body;await req('/'+c.room+'/join',undefined,{});
 const r=await handleGame(new Request('https://test/api/rooms/'+c.room+'/move',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+c.token},body:JSON.stringify({padding:'x'.repeat(5000)})}),db);assert.equal(r.status,413);
 assert.equal((await req('/'+c.room)).body.revision,1);
});
test('client-held join token recovers a lost response and concurrent join retries',async()=>{
 const {req}=setup();const c=(await req('',undefined,{})).body,id='/'+c.room;
 const claim='ab'.repeat(24);
 const joined=await req(id+'/join',claim,{});assert.equal(joined.body.role,'black');assert.equal(joined.body.token,claim);
 // Pretend response was lost. Only the pre-saved claim is retained by the client.
 const reloaded=await req(id,claim);assert.equal(reloaded.body.role,'black');
 const retried=await req(id+'/join',claim,{});assert.equal(retried.body.token,claim);assert.equal(retried.body.role,'black');assert.equal(retried.body.state.revision,1);
 assert.equal((await req(id+'/join',c.token,{})).body.role,'white');
 assert.equal((await req(id+'/join','ABC',{})).body.code,'invalid_token');
 const next=(await req('',undefined,{})).body,nextId='/'+next.room;
 const concurrent=await Promise.all([req(nextId+'/join',claim,{}),req(nextId+'/join',claim,{})]);assert.ok(concurrent.every(r=>r.body.role==='black'&&r.body.token===claim));assert.equal((await req(nextId)).body.revision,1);
});

test('every write validates JSON and streamed size before changing storage',async()=>{
 const {req,db,sqlite}=setup();
 const created=(await req('',undefined,{})).body;
 for(const path of ['',`/${created.room}/join`]){
  for(const [body,status] of [['{',400],['null',400],['[]',400],[JSON.stringify({padding:'x'.repeat(5000)}),413]] as const){
   const response=await handleGame(new Request('https://test/api/rooms'+path,{
    method:'POST',headers:{'Content-Type':'application/json'},body,
   }),db);
   assert.equal(response.status,status,`${path}: ${body.slice(0,20)}`);
  }
 }
 assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM chess_rooms').get()?.count,1);
 const unchanged=(await req('/'+created.room)).body;
 assert.equal(unchanged.status,'waiting');assert.equal(unchanged.revision,0);
});

test('a draw offer survives the offering player move, not an opponent move or terminal result',async()=>{
 const {req}=setup();const c=(await req('',undefined,{})).body,id='/'+c.room;
 const b=(await req(id+'/join',undefined,{})).body.token;
 assert.equal((await req(id+'/action',c.token,{action:'offer_draw',revision:1,requestId:'offer-before-move'})).body.drawOffer,'white');
 assert.equal((await req(id+'/move',c.token,{from:'e2',to:'e4',revision:2,requestId:'move-after-offer'})).body.drawOffer,'white');
 assert.equal((await req(id+'/move',b,{from:'e7',to:'e5',revision:3,requestId:'opponent-declines'})).body.drawOffer,null);
 assert.equal((await req(id+'/action',b,{action:'accept_draw',revision:4,requestId:'cannot-accept-now'})).body.code,'no_draw_offer');
 assert.equal((await req(id+'/action',c.token,{action:'offer_draw',revision:4,requestId:'offer-before-resign'})).body.drawOffer,'white');
 const resigned=(await req(id+'/action',c.token,{action:'resign',revision:5,requestId:'resign-with-offer'})).body;
 assert.equal(resigned.status,'finished');assert.equal(resigned.drawOffer,null);
});

async function playLine(sequence:string[]){
 const {req}=setup();const c=(await req('',undefined,{})).body,id='/'+c.room;
 const b=(await req(id+'/join',undefined,{})).body.token,game=new Chess();
 let last=(await req(id,c.token)).body;
 for(const [index,san] of sequence.entries()){
  const move=game.move(san);
  const response=await req(id+'/move',move.color==='w'?c.token:b,{
   from:move.from,to:move.to,...(move.promotion?{promotion:move.promotion}:{}),
   revision:index+1,requestId:`line-move-${index}`,
  });
  assert.equal(response.status,200,`Move ${index+1}: ${san}`);last=response.body;
 }
 return {req,id,w:c.token,b,last};
}

test('king safety forbids ignoring check and castling through an attacked square',async()=>{
 const check=await playLine(['f3','e5','Nc3','Qh4+']);assert.equal(check.last.check,true);
 assert.equal((await check.req(check.id+'/move',check.w,{from:'a2',to:'a3',revision:5,requestId:'ignore-king-check'})).body.code,'illegal_move');
 assert.equal((await check.req(check.id+'/move',check.w,{from:'g2',to:'g3',revision:5,requestId:'block-king-check'})).status,200);
 const castle=await playLine(['e4','b6','Nf3','Ba6','Bc4','e6','Bb3','Nc6']);assert.equal(castle.last.check,false);
 assert.equal((await castle.req(castle.id+'/move',castle.w,{from:'e1',to:'g1',revision:9,requestId:'castle-through-check'})).body.code,'illegal_move');
});

test('en passant expires after an intervening move and waiting rooms cannot be played',async()=>{
 const {req}=setup();const c=(await req('',undefined,{})).body,id='/'+c.room;
 assert.equal((await req(id+'/move',c.token,{from:'e2',to:'e4',revision:0,requestId:'move-before-join'})).body.code,'waiting');
 const played=await playLine(['e4','a6','e5','d5','Nf3','a5']);
 assert.equal((await played.req(played.id+'/move',played.w,{from:'e5',to:'d6',revision:7,requestId:'expired-en-passant'})).body.code,'illegal_move');
 assert.equal((await played.req(played.id)).body.revision,7);
});

test('stalemate ends the game and is preserved on reload',async()=>{
 const played=await playLine('e3 a5 Qh5 Ra6 Qxa5 h5 Qxc7 Rah6 h4 f6 Qxd7+ Kf7 Qxb7 Qd3 Qxb8 Qh7 Qxc8 Kg6 Qe6'.split(' '));
 assert.equal(played.last.status,'finished');assert.equal(played.last.result,'draw');
 assert.equal(played.last.reason,'stalemate');assert.equal(played.last.check,false);
 assert.equal((await played.req(played.id,played.b)).body.reason,'stalemate');
});

test('fifty moves without pawn movement or capture end the game',async()=>{
 const line='Nh3 Na6 Ng1 Nf6 Na3 Nd5 Rb1 Rg8 Nc4 Nab4 Nb6 Rh8 Nh3 Nc6 Rg1 Nd4 Nf4 Ne3 Nd3 Nef5 Ra1 Ng3 Nc4 Nb3 Na5 Nc5 Ne5 Rb8 Rh1 Ra8 Nec4 Na6 Na3 Nh5 Rb1 Nc5 Ra1 Rb8 N3c4 Rg8 Nb3 Nf6 Nd4 Ng4 Ne6 Nh6 Rb1 Na4 Na5 Nc3 Nf4 Rh8 Nh5 Na4 Ra1 Nf5 Nb3 Nc5 Nf4 Ne3 Ng6 Na4 Nc5 Rg8 Rb1 Ra8 Nd3 Nc3 Ndf4 Nb5 Nd5 Rb8 Ra1 Nc4 Nb6 Nc3 Ne5 Ne4 Nd5 Na3 Ne3 Nc4 Nf5 Na3 Nd4 Ng3 Nd3 Ra8 Rb1 Nf5 Nb4 Rb8 Nb5 Nd6 Rg1 Nf5 Rh1 Nd6 Nd5 Ndc4';
 const played=await playLine(line.split(' '));
 assert.equal(played.last.status,'finished');assert.equal(played.last.result,'draw');
 assert.equal(played.last.reason,'fifty_moves');assert.equal(played.last.history.length,100);
});

test('insufficient material ends the game after a legal capture',async()=>{
 const line='e3 d5 Qh5 Be6 Qxf7+ Bxf7 g4 g6 Bb5+ Nd7 Bxd7+ Kxd7 a3 b5 d3 Be6 Ra2 Bxg4 Ra1 Ke8 Kd2 a5 c4 dxc4 Ne2 Qxd3+ Ke1 Qxe3 fxe3 Bxe2 Kxe2 e6 Rg1 Bxa3 Rxg6 Bxb2 Rxe6+ Kd7 Rxa5 Bxc1 Rxa8 Bxe3 Rxe3 Ne7 Rxe7+ Kxe7 Rxh8 h6 Rxh6 c5 Kd1 Kd7 Rh5 Ke6 Rxc5 c3 Nxc3 Kf7 Nxb5 Kg7 Rg5+ Kh8 Nc7 Kh7 Ke2 Kh6 h3 Kxg5 h4+ Kxh4';
 const played=await playLine(line.split(' '));
 assert.equal(played.last.status,'finished');assert.equal(played.last.result,'draw');
 assert.equal(played.last.reason,'insufficient_material');
 assert.equal((await played.req(played.id)).body.reason,'insufficient_material');
});
