import test from 'node:test';
import assert from 'node:assert/strict';
import {MroyaApi} from '../src/api/client.ts';
import {ApiError,StreamInterruptedError} from '../src/api/errors.ts';
import {createLiveSource} from '../src/providers/liveSource.ts';
import {createDesignSource} from '../src/demo/source.ts';
import {isProductionHost} from '../src/providers/mode.ts';
import {designScenario} from '../src/demo/scenarios.ts';
import {readChatStream} from '../src/api/sse.ts';
const user={id:3,username:'test',email:'',first_name:'Test',last_name:'',timezone:'UTC'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
const uuid='00000000-0000-4000-8000-000000000001';
function fakeFetch(fn:(url:string,init:RequestInit)=>Response|Promise<Response>):typeof fetch{return ((url,init={})=>Promise.resolve(fn(String(url),init))) as typeof fetch;}
function stream(bytes:Uint8Array[],type='text/event-stream') {return new Response(new ReadableStream({start(c){for(const b of bytes)c.enqueue(b);c.close();}}),{headers:{'Content-Type':type,'X-Chat-Turn-ID':uuid}});}
const bytes=(text:string)=>new TextEncoder().encode(text);
test('same-origin session POSTs use CSRF rotated after login and logout',async()=>{
 const calls:{url:string;init:RequestInit}[]=[];
 const api=new MroyaApi(fakeFetch((url,init)=>{calls.push({url,init});if(url.endsWith('csrf/'))return json({csrf_token:'initial'});if(url.endsWith('login/'))return json({user,csrf_token:'rotated'});if(url.endsWith('logout/'))return json({status:'logged_out',csrf_token:'logout-token'});return json({state:'completed',turn_id:uuid,content:'done'});}));
 assert.deepEqual(await api.login('test','fictional-password'),user);await api.send('hello',uuid,()=>{});await api.logout();
 assert.equal((calls[1].init.headers as Record<string,string>)['X-CSRFToken'],'initial');assert.equal((calls[2].init.headers as Record<string,string>)['X-CSRFToken'],'rotated');
 for(const call of calls){assert.ok(call.url.startsWith('/api/v1/'));assert.equal(call.init.credentials,'same-origin');assert.equal(call.init.cache,'no-store');assert.equal(call.init.redirect,'error');}
});
test('401 becomes guest, 503 remains an error without mock fallback',async()=>{
 assert.deepEqual(await createLiveSource(new MroyaApi(fakeFetch(()=>json({error:{code:'authentication_required',message:'Sign in'}},401)))).session(),{status:'guest'});
 await assert.rejects(createLiveSource(new MroyaApi(fakeFetch(()=>json({error:{code:'unavailable',message:'Unavailable'}},503)))).session(),(e:unknown)=>e instanceof ApiError&&e.status===503);
});
test('CSRF failure never automatically repeats a write',async()=>{
 let writes=0;const api=new MroyaApi(fakeFetch((url)=>url.endsWith('csrf/')?json({csrf_token:'token'}):(writes++,json({error:{code:'csrf_failed',message:'Forbidden'}},403))));
 await assert.rejects(api.login('test','fake'),(e:unknown)=>e instanceof ApiError&&e.code==='csrf_failed');assert.equal(writes,1);
});
test('history pagination and canonical memory query preserve actual contract',async()=>{
 const urls:string[]=[];const api=new MroyaApi(fakeFetch(url=>{urls.push(url);return json(url.includes('memories/')?{memories:[{uuid:'record',provenance:{revision:2}}],total:1}:{conversation_id:'real',messages:[],next_before:10});}));
 assert.equal((await api.history(12)).next_before,10);const memory=await api.memories({state:'history',q:'a & b',limit:3});assert.deepEqual(memory.memories[0].provenance,{revision:2});assert.equal(urls[0],'/api/v1/chat/messages/?before=12');assert.ok(urls[1].includes('q=a+%26+b'));
});
test('HTML masquerading as API JSON is rejected',async()=>{const api=new MroyaApi(fakeFetch(()=>new Response('<html/>',{headers:{'Content-Type':'text/html'}})));await assert.rejects(api.me(),(e:unknown)=>e instanceof ApiError&&e.code==='invalid_response');});
test('split UTF8 and CRLF SSE chunks, comments and multiline JSON',async()=>{
 const text=': heartbeat\r\n\r\nevent: delta\r\ndata: {"text":\r\ndata: "Привет"}\r\n\r\nevent: done\r\ndata: {}\r\n\r\n';const encoded=bytes(text),events:string[]=[];
 await readChatStream(stream(Array.from(encoded,b=>new Uint8Array([b]))).body!,e=>events.push(e.event));assert.deepEqual(events,['delta','done']);
});
test('SSE EOF without terminal event is interrupted, not successful',async()=>{await assert.rejects(readChatStream(stream([bytes('event: delta\ndata: {"text":"partial"}\n\n')]).body!,()=>{}),StreamInterruptedError);});
test('SSE error throws and reader is released',async()=>{const response=stream([bytes('event: error\ndata: {"message":"Failed"}\n\n')]);let seen=false;await assert.rejects(readChatStream(response.body!,e=>{seen=e.event==='error';}),ApiError);assert.ok(seen);assert.equal(response.body!.locked,false);});
test('send supports replay and retains supplied UUID, timezone and AbortSignal',async()=>{
 const abort=new AbortController();let request:RequestInit={};const api=new MroyaApi(fakeFetch((url,init)=>{if(url.endsWith('csrf/'))return json({csrf_token:'x'});request=init;return json({state:'completed',turn_id:uuid,assistant_message_id:'message',content:'Persisted'});}));
 const events:string[]=[];await api.send('hello',uuid,e=>events.push(e.event),{signal:abort.signal,retry:true,timezone:'UTC'});assert.deepEqual(events,['replay']);assert.equal(request.signal,abort.signal);assert.deepEqual(JSON.parse(request.body as string),{content:'hello',submission_id:uuid,retry:true,timezone:'UTC'});
});
test('design data source makes zero network requests without Django',async()=>{
 const original=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw new Error('Network forbidden');};try{const source=createDesignSource();await source.session();await source.login('fake','fake');await source.history();await source.memories();await source.map();await source.capabilities();await source.logout();assert.equal(calls,0);}finally{globalThis.fetch=original;}
});
test('production host blocks accidental design bundle; preview scenario flags are local to design',()=>{
 assert.ok(isProductionHost('app.heymroya.com'));assert.ok(isProductionHost('APP.HEYМROYA.COM'.replace('М','M')));assert.ok(!isProductionHost('localhost'));assert.equal(designScenario('?scenario=guest'),'guest');assert.equal(designScenario('?scenario=arbitrary'),'filled');
 // Live source construction accepts no location/query/storage mode switch at all.
 assert.equal(createLiveSource(new MroyaApi(fakeFetch(()=>json({user})))).kind,'live');
});


test('default transport calls browser fetch with its global receiver',async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async function(this:unknown){assert.equal(this,globalThis);return new Response(JSON.stringify({user:{id:1,username:'real',email:'',first_name:'',last_name:'',timezone:'UTC'}}),{headers:{'Content-Type':'application/json'}});};
 try{assert.equal((await new MroyaApi().me()).user.username,'real');}finally{globalThis.fetch=original;}
});


test('malformed successful session cannot become an authenticated user',async()=>{
 await assert.rejects(createLiveSource(new MroyaApi(fakeFetch(()=>json({user:{username:'invalid'}})))).session(),(e:unknown)=>e instanceof ApiError&&e.code==='invalid_response');
});
