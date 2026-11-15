import { Chess } from "chess.js";

type Role = "white" | "black" | "spectator";
type Result = "white" | "black" | "draw" | null;
type Row = {id:string;white_hash:string;black_hash:string|null;moves:string;revision:number;result:Result;reason:string|null;draw_offer:Role|null;requests:string;created_at:number;expires_at:number};
type Receipt = {id:string; role:Role; payload:string};
// Minimal D1 contract also permits deterministic tests against native SQLite.
interface GameStatement {
  bind(...values:unknown[]):GameStatement;
  first<T>():Promise<T|null>;
  run():Promise<{meta:{changes:number}}>;
}
export interface GameDB { prepare(sql:string):GameStatement }
class GameError extends Error { constructor(public status:number, public code:string, message:string){super(message);} }
function fail(status:number,code:string,message:string):never {throw new GameError(status,code,message);}
const random = () => Array.from(crypto.getRandomValues(new Uint8Array(24)),n=>n.toString(16).padStart(2,"0")).join("");
async function hash(value:string) {return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value))),n=>n.toString(16).padStart(2,"0")).join("");}
const tokenFrom = (r:Request) => r.headers.get("authorization")?.match(/^Bearer ([a-f0-9]{48})$/)?.[1] ?? null;
async function roleFor(row:Row, request:Request):Promise<Role> {const token=tokenFrom(request);if(!token)return "spectator";const h=await hash(token);return h===row.white_hash?"white":h===row.black_hash?"black":"spectator";}
function gameFor(row:Row) {const game=new Chess();for(const move of JSON.parse(row.moves) as string[]) game.move(move);return game;}
function state(row:Row,role:Role) {const game=gameFor(row);return {id:row.id,fen:game.fen(),history:game.history(),moves:game.history({verbose:true}).map(m=>({from:m.from,to:m.to,san:m.san,piece:m.piece,color:m.color,...(m.captured?{captured:m.captured}:{}),...(m.promotion?{promotion:m.promotion}:{})})),turn:game.turn(),role,status:row.result?"finished":row.black_hash?"active":"waiting",result:row.result,reason:row.reason,check:game.isCheck(),revision:row.revision,players:{white:true,black:!!row.black_hash},drawOffer:row.draw_offer,createdAt:row.created_at,expiresAt:row.expires_at};}
async function read(db:GameDB,id:string):Promise<Row> {if(!/^[a-f0-9]{48}$/.test(id))fail(404,"not_found","Комната не найдена");const row=await db.prepare("SELECT * FROM chess_rooms WHERE id = ?").bind(id).first() as Row|null;if(!row)fail(404,"not_found","Комната не найдена");if(row.expires_at<=Date.now())fail(410,"expired","Срок действия комнаты истёк");return row;}
async function body(request:Request) {if(Number(request.headers.get("content-length"))>4096)fail(413,"too_large","Слишком большой запрос");const reader=request.body?.getReader();let text="",size=0;const decoder=new TextDecoder();if(reader){while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096){await reader.cancel();fail(413,"too_large","Слишком большой запрос");}text+=decoder.decode(value,{stream:true});}text+=decoder.decode();}try {const value=JSON.parse(text);if(!value || typeof value!=="object" || Array.isArray(value))throw Error();return value;}catch {return fail(400,"bad_json","Некорректный запрос");}}
const json = (value:unknown,status=200)=>Response.json(value,{status,headers:{"Cache-Control":"no-store","Referrer-Policy":"no-referrer"}});
export async function handleGame(request:Request, db:GameDB):Promise<Response> {
  try {
    const url=new URL(request.url);const path=url.pathname.replace(/\/$/,"");
    if(request.method==="POST") {
      const origin=request.headers.get("origin");
      if((origin && origin!==url.origin)||request.headers.get("sec-fetch-site")==="cross-site")fail(403,"cross_origin","Запрос с другого сайта запрещён");
      if(request.headers.get("content-type")?.split(";")[0].trim().toLowerCase()!=="application/json")fail(415,"content_type","Ожидается application/json");
      if(Number(request.headers.get("content-length"))>4096)fail(413,"too_large","Слишком большой запрос");
    }
    // Validate every write, including create and join, before it can mutate storage.
    // Content-Length is optional, so streamed bodies need the same bounded reader.
    const input=request.method==="POST"?await body(request):null;
    if(path==="/api/rooms" && request.method==="POST") {
      const id=random(),token=random(),now=Date.now();
      const row:Row={id,white_hash:await hash(token),black_hash:null,moves:"[]",revision:0,result:null,reason:null,draw_offer:null,requests:"[]",created_at:now,expires_at:now+7*86400000};
      await db.prepare("INSERT INTO chess_rooms (id,white_hash,black_hash,moves,revision,result,reason,draw_offer,requests,created_at,expires_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)").bind(row.id,row.white_hash,null,row.moves,0,null,null,null,row.requests,now,row.expires_at).run();
      return json({room:id,token,role:"white",state:state(row,"white")},201);
    }
    const match=path.match(/^\/api\/rooms\/([^/]+)(?:\/(join|move|action))?$/);
    if(!match)fail(404,"not_found","Не найдено");
    let row=await read(db,match[1]);const role=await roleFor(row,request);const operation=match[2];
    if(!operation && request.method==="GET")return json(state(row,role));
    if(request.method!=="POST")fail(405,"method_not_allowed","Метод не поддерживается");
    if(operation==="join") {
      if(request.headers.has("authorization")&&!tokenFrom(request))fail(400,"invalid_token","Некорректный ключ места");
      if(role!=="spectator") return json({token:tokenFrom(request),role,state:state(row,role)});
      if(row.black_hash||row.result)return json({token:null,role:"spectator",state:state(row,"spectator")});
      const token=tokenFrom(request)??random(),blackHash=await hash(token);
      const updated=await db.prepare("UPDATE chess_rooms SET black_hash = ?, revision = revision + 1 WHERE id = ? AND black_hash IS NULL AND revision = ? AND expires_at > ?").bind(blackHash,row.id,row.revision,Date.now()).run();
      row=await read(db,row.id);
      if(updated.meta.changes!==1&&row.black_hash!==blackHash)return json({token:null,role:"spectator",state:state(row,"spectator")});
      return json({token,role:"black",state:state(row,"black")});
    }
    if(operation!=="move"&&operation!=="action")fail(404,"not_found","Не найдено");
    if(role==="spectator")fail(403,"spectator","Зритель не может делать ходы");
    if(typeof input.requestId!=="string"||!/^[-a-zA-Z0-9_]{8,100}$/.test(input.requestId))fail(400,"request_id","Нужен уникальный идентификатор запроса");
    const payload=JSON.stringify(operation==="move"?{op:operation,from:input.from,to:input.to,promotion:input.promotion??"q"}:{op:operation,action:input.action});
    const receipts=JSON.parse(row.requests) as Receipt[];
    const prior=receipts.find(r=>r.id===input.requestId&&r.role===role);
    if(prior){if(prior.payload!==payload)fail(409,"request_reused","Идентификатор запроса уже использован");return json(state(row,role));}
    if(!Number.isSafeInteger(input.revision)||input.revision!==row.revision)fail(409,"stale_revision","Позиция обновилась. Обновите доску");
    if(row.result)fail(409,"finished","Партия завершена");
    if(!row.black_hash)fail(409,"waiting","Дождитесь второго игрока");
    const game=gameFor(row);
    if(operation==="move") {
      if(game.turn()!==(role==="white"?"w":"b"))fail(403,"wrong_turn","Сейчас ход соперника");
      if(typeof input.from!=="string"||typeof input.to!=="string"||!/^[a-h][1-8]$/.test(input.from)||!/^[a-h][1-8]$/.test(input.to)||!['q','r','b','n'].includes(input.promotion??'q'))fail(400,"invalid_move","Недопустимый ход");
      try{game.move({from:input.from,to:input.to,promotion:input.promotion??"q"});}catch{fail(400,"illegal_move","Недопустимый ход");}
      row.moves=JSON.stringify(game.history());
      // The opponent declines an offer by playing. The offering player's own
      // move must not silently withdraw an offer made just before that move.
      if(row.draw_offer!==role)row.draw_offer=null;
      if(game.isCheckmate()){row.result=role;row.reason="checkmate";}
      else if(game.isDraw()){row.result="draw";row.reason=game.isStalemate()?"stalemate":game.isThreefoldRepetition()?"repetition":game.isInsufficientMaterial()?"insufficient_material":"fifty_moves";}
    } else {
      switch(input.action) {
        case "resign":row.result=role==="white"?"black":"white";row.reason="resignation";break;
        case "offer_draw":if(row.draw_offer)fail(409,"draw_pending","Предложение ничьей уже ожидает ответа");row.draw_offer=role;break;
        case "accept_draw":if(!row.draw_offer||row.draw_offer===role)fail(409,"no_draw_offer","Нет предложения от соперника");row.result="draw";row.reason="agreement";row.draw_offer=null;break;
        case "decline_draw":if(!row.draw_offer||row.draw_offer===role)fail(409,"no_draw_offer","Нет предложения от соперника");row.draw_offer=null;break;
        default:fail(400,"invalid_action","Неизвестное действие");
      }
    }
    // No actionable offers should survive a checkmate, draw, or resignation.
    if(row.result)row.draw_offer=null;
    receipts.push({id:input.requestId,role,payload});
    const saved=await db.prepare("UPDATE chess_rooms SET moves = ?, result = ?, reason = ?, draw_offer = ?, requests = ?, revision = revision + 1 WHERE id = ? AND revision = ? AND expires_at > ?").bind(row.moves,row.result,row.reason,row.draw_offer,JSON.stringify(receipts.slice(-256)),row.id,row.revision,Date.now()).run();
    if(saved.meta.changes!==1) {
      const current=await read(db,row.id);const receipt=(JSON.parse(current.requests) as Receipt[]).find(r=>r.id===input.requestId&&r.role===role);
      if(receipt?.payload===payload)return json(state(current,role));
      fail(409,"stale_revision","Позиция обновилась. Обновите доску");
    }
    row.revision++;return json(state(row,role));
  } catch(error) {
    if(error instanceof GameError)return json({error:error.message,code:error.code},error.status);
    console.error("Chess operation failed",error instanceof Error?error.message:"Unknown error");
    return json({error:"Сервер временно недоступен. Попробуйте ещё раз",code:"server_error"},500);
  }
}
